// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.15 — Closed-Loop Revenue Autopilot
 * Additive orchestration over the existing V56.14 async/revenue rails.
 *
 * Safety model:
 * - Lead acquisition is source-driven; this module does not scrape directories.
 * - SMS/voice remain consent/policy gated; the supervisor creates outreach work,
 *   but never bypasses existing suppression controls.
 * - Payment/fulfillment remain on the existing Square + monetization queue.
 * - $10,000 owner gate remains authoritative.
 * - No new environment secret is required.
 */
const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const crypto=require('crypto');
const ACQ=require('./sbc-customer-acquisition-v1');
const V567=require('./v567-nine-nine');
const VERSION='56.16.0';
const DROPZONE_ROOT=path.resolve(process.env.SBC_DROPZONE_ROOT||path.join(__dirname,'..','data','dropzone'));
const DROPZONE_ARCHIVE=path.join(DROPZONE_ROOT,'processed');
const DROPZONE_FAILED=path.join(DROPZONE_ROOT,'failed');
const MAX_FILE_BYTES=25*1024*1024;
const MAX_FILES_PER_SCAN=Math.max(1,Math.min(20,Number(process.env.SBC_AUTOPILOT_DROPZONE_BATCH||5)));
const DEMO_LIMIT=Math.max(1,Math.min(20,Number(process.env.SBC_AUTOPILOT_DEMO_BATCH||5)));
const ALERT_LIMIT=100;
let watcher=null;
let scanTimer=null;
let running=false;
let ctx=null;

const id=(p='auto')=>`${p}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
const clean=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const now=()=>new Date().toISOString();

function status(){return {version:VERSION,dropzoneRoot:DROPZONE_ROOT,watcher:Boolean(watcher),running,dropzoneEnabled:ctx?.config?.dropzoneEnabled!==false,autoDemo:ctx?.config?.autoDemo!==false,autoOutbound:ctx?.config?.autoOutbound===true,consentGatedOutbound:true};}
function ensureDirs(){return Promise.all([fsp.mkdir(DROPZONE_ROOT,{recursive:true}),fsp.mkdir(DROPZONE_ARCHIVE,{recursive:true}),fsp.mkdir(DROPZONE_FAILED,{recursive:true})]);}
function eligible(c){
  const temp=String(c?.leadTemperature||c?.leadIntelligence?.leadTemperature||'').toLowerCase();
  const score=Number(c?.leadScore||c?.leadIntelligence?.leadScore||0);
  const suppressed=c?.doNotContact===true||c?.salesSuppressed===true||c?.smsOptOut===true||c?.doNotCall===true||String(c?.status||'').toLowerCase()==='do not contact';
  return !suppressed&&(temp==='hot'||temp==='warm'||score>=55);
}
function outboundPermission(c,channel){
  if(c?.doNotContact===true||c?.salesSuppressed===true||c?.doNotCall===true||c?.smsOptOut===true)return {allowed:false,reason:'suppressed'};
  if(channel==='sms' && !(c?.smsConsent===true||c?.consentToSms===true))return {allowed:false,reason:'explicit_sms_consent_required'};
  if(channel==='email' && !(c?.emailConsent===true||c?.consentToEmail===true))return {allowed:false,reason:'email_consent_not_recorded'};
  return {allowed:true,reason:'explicit_consent_recorded'};
}
async function raiseAlert(severity,type,message,metadata={}){
  const rec={id:id('alert'),severity:clean(severity,20),alertType:clean(type,80),message:clean(message,1000),status:'OPEN',metadata,createdAt:now()};
  if(ctx?.mysqlPool){await ctx.mysqlPool.query('INSERT INTO sbc_revenue_alerts(id,tenant_id,severity,alert_type,message,status,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?)',[rec.id,Number(__sbcRequireTenantId(metadata.tenantId)),rec.severity,rec.alertType,rec.message,rec.status,JSON.stringify(metadata),ctx.sqlDateTime?ctx.sqlDateTime(rec.createdAt):rec.createdAt]).catch(()=>{});}
  return rec;
}
async function event(type,customerId,meta={}){
  const rec={id:id('funnel'),tenantId:Number(__sbcRequireTenantId(meta.tenantId)),customerId:String(customerId||''),eventType:clean(type,100),metadata:meta,occurredAt:now()};
  if(ctx?.mysqlPool){await ctx.mysqlPool.query('INSERT IGNORE INTO sbc_revenue_funnel_events(id,tenant_id,customer_id,event_type,idempotency_key,metadata_json,occurred_at) VALUES (?,?,?,?,?,?,?)',[rec.id,rec.tenantId,rec.customerId,rec.eventType,clean(meta.idempotencyKey||`${rec.eventType}:${rec.customerId}`,180),JSON.stringify(meta),ctx.sqlDateTime?ctx.sqlDateTime(rec.occurredAt):rec.occurredAt]).catch(()=>{});}
  try{ctx?.audit?.({id:'system',name:'SBC Revenue Autopilot',role:'system'},`autopilot_${rec.eventType}`,`Revenue autopilot event: ${rec.eventType}`,{customerId:rec.customerId,...meta});}catch{}
  try{if(ctx?.eventBroker?.publish){await ctx.eventBroker.publish(rec.eventType,{tenantId:rec.tenantId,entityType:'customer',entityId:rec.customerId,payload:{customerId:rec.customerId,...meta}});}}catch{}
  return rec;
}
async function createAffiliateReferral(input={}){
  if(!ctx?.mysqlPool)throw new Error('Durable affiliate storage unavailable.');
  const tenantId=Number(__sbcRequireTenantId(input.tenantId)),affiliateId=clean(input.affiliateId,100),customerId=clean(input.customerId,100);
  if(!affiliateId||!customerId)throw new Error('affiliateId and customerId are required.');
  const referralId=clean(input.referralId||id('ref'),120);
  await ctx.mysqlPool.query('INSERT INTO sbc_affiliate_referrals(id,tenant_id,affiliate_id,customer_id,status,commission_cents,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE updated_at=UTC_TIMESTAMP()', [referralId,tenantId,affiliateId,customerId,'PENDING',0,JSON.stringify(input.metadata||{}) ,ctx.sqlDateTime?ctx.sqlDateTime(now()):now()]);
  return {ok:true,referralId,status:'PENDING'};
}
async function recordAffiliatePayout({tenantId=1,affiliateId,customerId='',orderId='',amount=0,rate=0.1,idempotencyKey}={}){
  if(!ctx?.mysqlPool)throw new Error('Durable affiliate storage unavailable.');
  const cents=Math.max(0,Math.round(Number(amount||0)*Number(rate||0)));
  const key=clean(idempotencyKey||`affiliate:${affiliateId}:${orderId}`,180);
  if(!affiliateId||!key)throw new Error('affiliateId and idempotencyKey are required.');
  await ctx.mysqlPool.query('INSERT IGNORE INTO sbc_affiliate_ledger(id,tenant_id,affiliate_id,customer_id,order_id,entry_type,amount_cents,idempotency_key,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())',[id('aff'),Number(tenantId),clean(affiliateId,100),clean(customerId,100),clean(orderId,100),'COMMISSION',cents,key,JSON.stringify({rate:Number(rate||0)})]);
  return {ok:true,affiliateId,amount:Number((cents/100).toFixed(2)),idempotencyKey:key};
}
async function buildDemoForCustomer(c){
  if(!ctx?.createWebsiteDemo)return {ok:false,reason:'demo_engine_unavailable'};
  const existing=(ctx.db?.megaOpsStore?.websiteDemos||ctx.db?.settings?.megaOps?.websiteDemos||[]).find(d=>String(d.customerId)===String(c.id)&&!d.archived);
  if(existing)return {ok:true,existing:true,demo:existing};
  const demo=await ctx.createWebsiteDemo(c.id,{fast:true});
  c.autopilotDemoId=demo.id;c.autopilotDemoUrl=demo.url;c.autopilotDemoAt=now();
  await event('demo_created',c.id,{demoId:demo.id,demoUrl:demo.url,tenantId:__sbcRequireTenantId(c.tenantId),idempotencyKey:`demo:${c.id}`});
  return {ok:true,created:true,demo};
}
async function prepareOutreach(c){
  const demoUrl=String(c.autopilotDemoUrl||'');
  const draft=ACQ.draft(c,'email',demoUrl);
  const permission=outboundPermission(c,'email');
  const rec={id:id('outreach'),customerId:c.id,channel:'email',subject:draft.subject,body:draft.body,status:permission.allowed?'READY_CONSENTED':'HELD_NO_CONSENT',permission,createdAt:now()};
  if(ctx?.mysqlPool){await ctx.mysqlPool.query('INSERT INTO sbc_autopilot_outreach(id,tenant_id,customer_id,channel,subject,body,status,reason,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status=VALUES(status),reason=VALUES(reason),body=VALUES(body),updated_at=UTC_TIMESTAMP()', [rec.id,Number(__sbcRequireTenantId(c.tenantId)),String(c.id),'email',draft.subject,draft.body,rec.status,permission.reason,ctx.sqlDateTime?ctx.sqlDateTime(rec.createdAt):rec.createdAt]);}
  await event('outreach_prepared',c.id,{channel:'email',status:rec.status,reason:permission.reason,tenantId:__sbcRequireTenantId(c.tenantId),idempotencyKey:`outreach:email:${c.id}`});
  return rec;
}
async function processLead(c){
  if(!eligible(c))return {ok:true,skipped:true,reason:'not_qualified'};
  const results=[];
  await event('qualified',c.id,{tenantId:__sbcRequireTenantId(c.tenantId),score:Number(c.leadScore||0),temperature:c.leadTemperature||c.leadIntelligence?.leadTemperature||''});
  if(ctx?.config?.autoDemo!==false){try{results.push(await buildDemoForCustomer(c));}catch(e){const err=String(e.message||e);results.push({ok:false,step:'demo',error:err});await raiseAlert('ERROR','DEMO_BUILD_FAILED',`Demo generation failed for ${c.businessName||c.id}: ${err}`,{customerId:c.id,tenantId:__sbcRequireTenantId(c.tenantId)});}}
  try{results.push(await prepareOutreach(c));}catch(e){const err=String(e.message||e);results.push({ok:false,step:'outreach',error:err});await raiseAlert('WARN','OUTREACH_PREP_FAILED',`Outreach preparation failed for ${c.businessName||c.id}: ${err}`,{customerId:c.id,tenantId:__sbcRequireTenantId(c.tenantId)});}
  if(results.some(x=>x?.ok===false))return {ok:false,customerId:c.id,results};
  c.autopilotProcessedAt=now();
  return {ok:true,customerId:c.id,results};
}
async function runOnce(){
  if(running)return {ok:true,skipped:true,reason:'cycle_in_progress'};
  running=true;
  try{
    const customers=Array.isArray(ctx?.db?.customers)?ctx.db.customers:[];
    let processed=0,createdDemos=0,readyOutreach=0,heldOutreach=0;
    for(const c of customers){if(processed>=DEMO_LIMIT)break;if(!eligible(c)||c.autopilotProcessedAt)continue;const before=c.autopilotDemoId;const out=await processLead(c);if(out.ok&&!out.skipped){processed++;if(!before&&c.autopilotDemoId)createdDemos++;if(out.results.some(x=>x?.status==='READY_CONSENTED'))readyOutreach++;if(out.results.some(x=>x?.status==='HELD_NO_CONSENT'))heldOutreach++;}}
    if(processed&&ctx?.saveData)await ctx.saveData();
    return {ok:true,processed,createdDemos,readyOutreach,heldOutreach,at:now()};
  }finally{running=false;}
}
async function ingestFile(file){
  const ext=path.extname(file).toLowerCase();
  if(ext!=='.csv')return {skipped:true,reason:'only_csv_is_supported_by_current_worker'};
  const stat=await fsp.stat(file);if(stat.size>MAX_FILE_BYTES)throw new Error('Dropzone file exceeds 25MB.');
  const bytes=await fsp.readFile(file);const filename=path.basename(file);const batchId=`AUTO-${Date.now()}-${sha(bytes).slice(0,10)}`;
  const ASYNC=ctx.asyncIngest;if(!ASYNC)throw new Error('Async ingestion rail unavailable.');
  const queued=await ASYNC.enqueue({tenantId:1,batchId,source:'Lorna Dropzone',csvBase64:bytes.toString('base64')});
  await event('dropzone_accepted','',{tenantId:1,batchId,filename,jobId:queued.id,idempotencyKey:`dropzone:${sha(bytes)}`});
  await fsp.rename(file,path.join(DROPZONE_ARCHIVE,`${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g,'_')}`));
  return {ok:true,batchId,jobId:queued.id,filename};
}
async function scanDropzone(){
  if(ctx?.config?.dropzoneEnabled===false)return {ok:true,skipped:true,reason:'disabled'};
  await ensureDirs();const names=await fsp.readdir(DROPZONE_ROOT);let processed=0,failed=0,skipped=0;
  for(const name of names.filter(n=>!n.startsWith('.')&&!['processed','failed'].includes(n)).slice(0,MAX_FILES_PER_SCAN)){
    const file=path.join(DROPZONE_ROOT,name);let st;try{st=await fsp.stat(file);}catch{continue}if(!st.isFile())continue;
    try{const r=await ingestFile(file);if(r.skipped){skipped++;continue}processed++;}catch(e){failed++;try{await fsp.rename(file,path.join(DROPZONE_FAILED,`${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g,'_')}`));}catch{};try{await event('dropzone_failed','',{tenantId:1,filename:name,error:String(e.message||e)});}catch{}}
  }
  return {ok:true,processed,failed,skipped};
}
function start(){if(watcher||!ctx)return status();try{fs.mkdirSync(DROPZONE_ROOT,{recursive:true});fs.mkdirSync(DROPZONE_ARCHIVE,{recursive:true});fs.mkdirSync(DROPZONE_FAILED,{recursive:true});}catch{};const debounce=new Map();try{watcher=fs.watch(DROPZONE_ROOT,{persistent:false},(eventType,name)=>{if(!name)return;clearTimeout(debounce.get(name));const t=setTimeout(()=>{scanDropzone().catch(()=>{});debounce.delete(name)},350);debounce.set(name,t);});}catch(e){watcher=null;}
  scanTimer=setInterval(()=>{scanDropzone().catch(()=>{});runOnce().catch(()=>{})},Math.max(30000,Number(process.env.SBC_AUTOPILOT_INTERVAL_MS||60000)));scanTimer.unref?.();scanDropzone().catch(()=>{});return status();}
function stop(){try{watcher?.close()}catch{};watcher=null;if(scanTimer)clearInterval(scanTimer);scanTimer=null;return status();}
function configure(input={}){ctx=input;return {ok:true,...status()};}
async function dunningSnapshot(){
  if(!ctx?.mysqlPool)return {configured:false};
  const [rows]=await ctx.mysqlPool.query(`SELECT state,COUNT(*) count,COALESCE(SUM(amount),0) amount FROM sbc_dunning_cases WHERE tenant_id=1 GROUP BY state ORDER BY state`);
  return {configured:true,states:rows};
}
async function controlTower(){
  const customers=Array.isArray(ctx?.db?.customers)?ctx.db.customers:[];const orders=Array.isArray(ctx?.db?.orders)?ctx.db.orders:[];
  const base={version:VERSION,generatedAt:now(),automation:status(),funnel:{leads:customers.length,qualified:customers.filter(eligible).length,demos:customers.filter(c=>c.autopilotDemoId).length,paidOrders:orders.filter(o=>/PAID|COMPLETED|FULFILLED/i.test(String(o.paymentStatus||o.status||''))).length}};
  if(!ctx?.mysqlPool)return {...base,durable:false};
  const [funnel]=await ctx.mysqlPool.query(`SELECT event_type,COUNT(*) count FROM sbc_revenue_funnel_events WHERE tenant_id=1 GROUP BY event_type ORDER BY count DESC`);
  const [aff]=await ctx.mysqlPool.query(`SELECT COALESCE(SUM(amount_cents),0) cents,COUNT(*) entries FROM sbc_affiliate_ledger WHERE tenant_id=1`);
  const [alerts]=await ctx.mysqlPool.query(`SELECT id,severity,alert_type,message,status,created_at FROM sbc_revenue_alerts WHERE tenant_id=1 ORDER BY created_at DESC LIMIT ?`,[ALERT_LIMIT]);
  return {...base,durable:true,funnelEvents:funnel,affiliate:{entries:Number(aff[0]?.entries||0),amount:Number((Number(aff[0]?.cents||0)/100).toFixed(2))},alerts,dunning:await dunningSnapshot()};
}
module.exports={VERSION,DROPZONE_ROOT,configure,start,stop,status,scanDropzone,runOnce,controlTower,eligible,outboundPermission,createAffiliateReferral,recordAffiliatePayout,raiseAlert,recordFunnelEvent:event};
