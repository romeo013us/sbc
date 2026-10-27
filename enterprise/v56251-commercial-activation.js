// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.25.1 — Commercial Activation Layer
 *
 * Connects the Autonomous Lead Factory to the existing durable economic
 * control plane without creating a second CRM, payment rail, or secret store.
 * MySQL remains authoritative; provider credentials remain in the existing
 * Provider Credential Vault.
 */
const crypto=require('crypto');
const VERSION='56.25.1';
const DEFAULTS={
  enabled:false,
  autoRun:false,
  intervalMinutes:60,
  maxRunsPerDay:4,
  apolloPagesPerRun:1,
  clayRowsPerRun:25,
  apolloCostPerPage:0,
  clayCostPerRow:0,
  monthlyAcquisitionCap:250,
  targetVerifiedPerDay:25,
  targetSalesReadyPerDay:10,
  targetNewMrrPerWeek:597,
  requireOwnerReviewOnCap:true
};
const MAX_INTERVAL_MIN=1440;
const MAX_DAILY_RUNS=24;
let ctx={db:null,mysqlPool:null,audit:()=>{},sqlDateTime:null,economicControl:null,leadFactory:null,secretValue:()=>''};
let cfg={...DEFAULTS};
let timer=null,running=false;
const memory={dayKey:null,runsToday:0,lastRun:null,lastError:null};
const iso=()=>new Date().toISOString();
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0};
const clean=(v,m=300)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,m);
const day=()=>iso().slice(0,10);
const id=(p='com')=>`${p}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
function resetDay(){const d=day();if(memory.dayKey!==d){memory.dayKey=d;memory.runsToday=0}}
async function ensureTables(){
  if(!ctx.mysqlPool)return false;
  await ctx.mysqlPool.query(`CREATE TABLE IF NOT EXISTS sbc_v56251_commercial_events (
    id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL, event_type VARCHAR(80) NOT NULL,
    source VARCHAR(80) NOT NULL DEFAULT '', entity_id VARCHAR(120) NOT NULL DEFAULT '',
    quantity INT NOT NULL DEFAULT 0, amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    metadata_json LONGTEXT, idempotency_key VARCHAR(180) NOT NULL, created_at DATETIME NOT NULL,
    UNIQUE KEY uq_commercial_idem(tenant_id,idempotency_key), INDEX idx_commercial(tenant_id,event_type,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  return true;
}
function configure(input={}){
  cfg={...cfg,...(input.config||{})};
  cfg.intervalMinutes=Math.max(5,Math.min(MAX_INTERVAL_MIN,Number(cfg.intervalMinutes||60)));
  cfg.maxRunsPerDay=Math.max(1,Math.min(MAX_DAILY_RUNS,Number(cfg.maxRunsPerDay||4)));
  cfg.apolloPagesPerRun=Math.max(1,Math.min(100,Number(cfg.apolloPagesPerRun||1)));
  cfg.clayRowsPerRun=Math.max(1,Math.min(5000,Number(cfg.clayRowsPerRun||25)));
  cfg.apolloCostPerPage=Math.max(0,n(cfg.apolloCostPerPage));
  cfg.clayCostPerRow=Math.max(0,n(cfg.clayCostPerRow));
  cfg.monthlyAcquisitionCap=Math.max(0,n(cfg.monthlyAcquisitionCap));
  cfg.targetVerifiedPerDay=Math.max(0,n(cfg.targetVerifiedPerDay));
  cfg.targetSalesReadyPerDay=Math.max(0,n(cfg.targetSalesReadyPerDay));
  cfg.targetNewMrrPerWeek=Math.max(0,n(cfg.targetNewMrrPerWeek));
  resetDay();
  return {version:VERSION,...status()};
}
async function event(eventType,{tenantId=1,source='commercial_activation',entityId='',quantity=0,amount=0,metadata={},idempotencyKey=''}={}){
  if(!ctx.mysqlPool)return {ok:false,reason:'durable_storage_unavailable'};
  const key=clean(idempotencyKey||`${eventType}:${entityId}:${day()}:${quantity}:${amount}`,180);
  const ts=ctx.sqlDateTime?ctx.sqlDateTime(iso()):iso();
  await ctx.mysqlPool.query(`INSERT INTO sbc_v56251_commercial_events(id,tenant_id,event_type,source,entity_id,quantity,amount,metadata_json,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity),amount=VALUES(amount),metadata_json=VALUES(metadata_json)`,[id('evt'),Number(tenantId),clean(eventType,80),clean(source,80),clean(entityId,120),Math.max(0,Math.round(n(quantity))),n(amount),JSON.stringify(metadata||{}),key,ts]);
  return {ok:true,eventType,quantity,amount};
}
async function recordEconomicSpend({tenantId=1,amount=0,source='lead_factory',entityId='',metadata={}}={}){
  const value=n(amount);if(value<=0||!ctx.economicControl?.ledger)return {ok:true,recorded:false,amount:0};
  return ctx.economicControl.ledger('ACQUISITION_SPEND',{tenantId,entityType:'lead_factory',entityId,amount:value,direction:'OUT',source,idempotencyKey:`lead_factory_spend:${tenantId}:${day()}:${entityId}:${value}`,metadata});
}
async function monthlySpend(tenantId=1){
  if(!ctx.mysqlPool)return 0;
  const [r]=await ctx.mysqlPool.query(`SELECT COALESCE(SUM(amount),0) total FROM sbc_v56251_commercial_events WHERE tenant_id=? AND event_type='ACQUISITION_SPEND' AND created_at>=DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-01')`,[Number(tenantId)]);
  return n(r?.[0]?.total);
}
async function run(input={}){
  resetDay();
  if(running)return {ok:true,skipped:true,reason:'commercial_activation_in_progress'};
  if(!ctx.leadFactory)return {ok:false,error:'lead_factory_unavailable'};
  if(!cfg.enabled)return {ok:false,skipped:true,reason:'commercial_activation_disabled'};
  if(memory.runsToday>=cfg.maxRunsPerDay)return {ok:false,skipped:true,reason:'daily_run_guard'};
  const tenantId=Number(__sbcRequireTenantId(input.tenantId));
  const spend=await monthlySpend(tenantId);
  const estimated=cfg.apolloPagesPerRun*cfg.apolloCostPerPage+cfg.clayRowsPerRun*cfg.clayCostPerRow;
  if(cfg.requireOwnerReviewOnCap&&cfg.monthlyAcquisitionCap>0&&spend+estimated>cfg.monthlyAcquisitionCap){
    await event('ACQUISITION_CAP_BLOCKED',{tenantId,amount:estimated,metadata:{monthlySpend:spend,cap:cfg.monthlyAcquisitionCap}});
    return {ok:false,skipped:true,reason:'monthly_acquisition_cap',monthlySpend:spend,estimatedRunCost:estimated,cap:cfg.monthlyAcquisitionCap};
  }
  running=true;
  try{
    const out=await ctx.leadFactory.run({...input,dispatchClay:true,per_page:Math.min(100,Number(input.per_page||25))});
    memory.runsToday+=1;
    const added=n(out.added),duplicates=n(out.duplicates),claySent=n(out.clay?.sent),clayFailed=n(out.clay?.failed);
    const cost=estimated;
    await event('LEAD_FACTORY_RUN',{tenantId,quantity:added,amount:cost,metadata:{apolloOrganizations:n(out.apollo),duplicates,claySent,clayFailed}});
    if(added)await event('LEADS_ACQUIRED',{tenantId,quantity:added,metadata:{source:'apollo'}});
    if(duplicates)await event('LEADS_DEDUPED',{tenantId,quantity:duplicates});
    if(claySent)await event('LEADS_ENRICHMENT_DISPATCHED',{tenantId,quantity:claySent,metadata:{provider:'clay'}});
    if(clayFailed)await event('LEADS_ENRICHMENT_FAILED',{tenantId,quantity:clayFailed,metadata:{provider:'clay'}});
    if(cost>0){await event('ACQUISITION_SPEND',{tenantId,quantity:1,amount:cost,metadata:{apolloPages:cfg.apolloPagesPerRun,clayRows:claySent}});await recordEconomicSpend({tenantId,amount:cost,entityId:String(out.at||Date.now()),metadata:{apolloPages:cfg.apolloPagesPerRun,clayRows:claySent}})}
    memory.lastRun={at:iso(),...out,cost};memory.lastError=null;
    return {ok:true,...memory.lastRun,monthlySpend:spend+cost};
  }catch(e){memory.lastError=clean(e.message,500);throw e}finally{running=false}
}
async function scorecard(tenantId=1){
  const tid=Number(tenantId)||1; if(ctx.mysqlPool)await ensureTables();
  let events=[];
  if(ctx.mysqlPool){const [r]=await ctx.mysqlPool.query(`SELECT event_type,SUM(quantity) quantity,SUM(amount) amount FROM sbc_v56251_commercial_events WHERE tenant_id=? AND created_at>=DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-01') GROUP BY event_type`,[tid]);events=r||[]}
  const map={};for(const e of events)map[e.event_type]={quantity:n(e.quantity),amount:n(e.amount)};
  const customers=(ctx.db?.customers||[]).filter(c=>Number(__sbcRequireTenantId(c?.tenantId))===tid);
  const verified=customers.filter(c=>String(c?.leadResearch?.status||'').toUpperCase()==='CLAY_ENRICHED' || String(c?.verificationState||'').toUpperCase()==='VERIFIED').length;
  const salesReady=customers.filter(c=>String(c?.automation?.state||'').toUpperCase()==='SALES_READY' || String(c?.status||'').toUpperCase()==='SALES READY').length;
  let economic=null;try{economic=ctx.economicControl?.calculate?await ctx.economicControl.calculate(tid):null}catch{}
  const acquired=map.LEADS_ACQUIRED?.quantity||0;
  const spend=map.ACQUISITION_SPEND?.amount||0;
  return {ok:true,version:VERSION,tenantId:tid,targets:{verifiedPerDay:cfg.targetVerifiedPerDay,salesReadyPerDay:cfg.targetSalesReadyPerDay,newMrrPerWeek:cfg.targetNewMrrPerWeek},funnel:{acquired,verified,salesReady,deduped:map.LEADS_DEDUPED?.quantity||0,clayDispatched:map.LEADS_ENRICHMENT_DISPATCHED?.quantity||0,clayFailed:map.LEADS_ENRICHMENT_FAILED?.quantity||0},economics:{acquisitionSpend:Number(spend.toFixed(2)),estimatedLeadCost:acquired?Number((spend/acquired).toFixed(4)):0,economicControl:economic},runtime:{...memory,config:{...cfg}}};
}
async function status(tenantId=1){return scorecard(tenantId)}
function start(){if(timer)return;resetDay();timer=setInterval(()=>{if(cfg.enabled&&cfg.autoRun)run({}).catch(e=>{memory.lastError=clean(e.message,500)})},cfg.intervalMinutes*60000);if(timer.unref)timer.unref()}
function restart(){if(timer){clearInterval(timer);timer=null}start()}
function stop(){if(timer){clearInterval(timer);timer=null}}
function init(context={}){ctx={...ctx,...context};ensureTables().catch(e=>console.warn('[V56.25.1 COMMERCIAL ACTIVATION] tables:',e.message));start();return {version:VERSION,config:{...cfg}}}
module.exports={VERSION,DEFAULTS,init,start,restart,stop,configure,status,scorecard,event,run,monthlySpend};
