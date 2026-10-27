// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.16 — Closed-Loop Event Broker / State Machine
 * Durable DB-backed orchestration over the existing V56.15 revenue rails.
 *
 * The broker is deliberately additive. It does not replace Square, Revenue PLAY,
 * async ingestion, fulfillment, or owner approvals. It records and advances
 * business state only when the authoritative subsystem has produced an event.
 */
const crypto=require('crypto');
const VERSION='56.16.0';
const MAX_CONCURRENCY=Math.max(1,Math.min(4,Number(process.env.SBC_EVENT_BROKER_CONCURRENCY||2)));
const MAX_BATCH=Math.max(1,Math.min(50,Number(process.env.SBC_EVENT_BROKER_BATCH||20)));
const POLL_MS=Math.max(15000,Number(process.env.SBC_EVENT_BROKER_INTERVAL_MS||30000));
let ctx=null, timer=null, running=false;
const id=(p='evt')=>`${p}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
const clean=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const now=()=>new Date().toISOString();
const CUSTOMER_STATES=Object.freeze(['NEW','INGESTED','QUALIFIED','PREVIEW_GENERATED','OUTREACH_READY','CHECKOUT_CREATED','PAYMENT_PENDING','PAID','FULFILLMENT_QUEUED','FULFILLED','ACTIVATED','PAST_DUE','SUSPENDED','MANUAL_HOLD']);
const TRANSITIONS=Object.freeze({
  NEW:['INGESTED','QUALIFIED','MANUAL_HOLD'],
  INGESTED:['QUALIFIED','MANUAL_HOLD'],
  QUALIFIED:['PREVIEW_GENERATED','OUTREACH_READY','MANUAL_HOLD'],
  PREVIEW_GENERATED:['OUTREACH_READY','CHECKOUT_CREATED','MANUAL_HOLD'],
  OUTREACH_READY:['CHECKOUT_CREATED','MANUAL_HOLD'],
  CHECKOUT_CREATED:['PAYMENT_PENDING','PAID','MANUAL_HOLD'],
  PAYMENT_PENDING:['PAID','PAST_DUE','MANUAL_HOLD'],
  PAID:['FULFILLMENT_QUEUED','ACTIVATED','MANUAL_HOLD'],
  FULFILLMENT_QUEUED:['FULFILLED','ACTIVATED','MANUAL_HOLD'],
  FULFILLED:['ACTIVATED','MANUAL_HOLD'],
  ACTIVATED:['PAST_DUE','MANUAL_HOLD'],
  PAST_DUE:['PAYMENT_PENDING','SUSPENDED','PAID','MANUAL_HOLD'],
  SUSPENDED:['PAYMENT_PENDING','PAID','ACTIVATED','MANUAL_HOLD'],
  MANUAL_HOLD:['QUALIFIED','CHECKOUT_CREATED','PAYMENT_PENDING','FULFILLMENT_QUEUED','CANCELLED']
});
function transition(from,to){from=String(from||'NEW').toUpperCase();to=String(to||'').toUpperCase();if(from===to)return {ok:true,idempotent:true,from,to};if(!(TRANSITIONS[from]||[]).includes(to))throw new Error(`ILLEGAL_STATE_TRANSITION:${from}->${to}`);return {ok:true,idempotent:false,from,to};}
async function ensureTables(){if(!ctx?.mysqlPool)return false;await ctx.mysqlPool.query(`CREATE TABLE IF NOT EXISTS sbc_revenue_state_machine (tenant_id BIGINT NOT NULL DEFAULT 1,entity_type VARCHAR(40) NOT NULL,entity_id VARCHAR(120) NOT NULL,state VARCHAR(60) NOT NULL,version INT NOT NULL DEFAULT 1,last_event_id VARCHAR(120) NOT NULL DEFAULT '',metadata_json LONGTEXT,updated_at DATETIME NOT NULL,PRIMARY KEY (tenant_id,entity_type,entity_id),INDEX idx_state(tenant_id,state,updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);await ctx.mysqlPool.query(`CREATE TABLE IF NOT EXISTS sbc_revenue_event_jobs (id VARCHAR(120) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,event_type VARCHAR(100) NOT NULL,entity_type VARCHAR(40) NOT NULL,entity_id VARCHAR(120) NOT NULL,payload_json LONGTEXT NOT NULL,status VARCHAR(30) NOT NULL DEFAULT 'PENDING',attempts INT NOT NULL DEFAULT 0,next_attempt_at DATETIME NULL,last_error TEXT,created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,UNIQUE KEY uq_event_idem(tenant_id,event_type,entity_id),INDEX idx_event_jobs(status,next_attempt_at,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);return true;}
async function publish(eventType,{tenantId=1,entityType='customer',entityId='',payload={}}={}){if(!ctx?.mysqlPool) return {ok:false,reason:'durable_storage_unavailable'};const eid=id('broker');const ts=ctx.sqlDateTime?ctx.sqlDateTime(now()):now();await ctx.mysqlPool.query(`INSERT INTO sbc_revenue_event_jobs(id,tenant_id,event_type,entity_type,entity_id,payload_json,status,attempts,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,?,?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at)`,[eid,Number(tenantId),clean(eventType,100),clean(entityType,40),clean(entityId,120),JSON.stringify(payload||{}),'PENDING',ts,ts]);return {ok:true,id:eid,eventType,entityId};}
async function setState(entityType,entityId,next,tenantId=1,eventId='',metadata={}){if(!ctx?.mysqlPool)return {ok:false,reason:'durable_storage_unavailable'};const [rows]=await ctx.mysqlPool.query('SELECT state,version FROM sbc_revenue_state_machine WHERE tenant_id=? AND entity_type=? AND entity_id=? LIMIT 1',[tenantId,entityType,entityId]);const current=rows[0]?.state||'NEW';transition(current,next);const version=Number(rows[0]?.version||0)+1;const ts=ctx.sqlDateTime?ctx.sqlDateTime(now()):now();await ctx.mysqlPool.query(`INSERT INTO sbc_revenue_state_machine(tenant_id,entity_type,entity_id,state,version,last_event_id,metadata_json,updated_at) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE state=VALUES(state),version=VALUES(version),last_event_id=VALUES(last_event_id),metadata_json=VALUES(metadata_json),updated_at=VALUES(updated_at)`,[tenantId,entityType,entityId,next,version,eventId,JSON.stringify(metadata||{}),ts]);return {ok:true,from:current,to:next,version};}
async function customer(id){return (ctx?.db?.customers||[]).find(x=>String(x.id)===String(id))||null;}
async function handle(job){const p=JSON.parse(job.payload_json||'{}');const type=String(job.event_type);const entityId=String(job.entity_id||p.customerId||p.orderId||'');let next='';
  if(type==='lead_ingested'||type==='dropzone_accepted') next='INGESTED';
  else if(type==='qualified') next='QUALIFIED';
  else if(type==='demo_created') next='PREVIEW_GENERATED';
  else if(type==='outreach_prepared') next='OUTREACH_READY';
  else if(type==='checkout_created') next='CHECKOUT_CREATED';
  else if(type==='payment_pending') next='PAYMENT_PENDING';
  else if(type==='payment_paid'||type==='payment_completed') next='PAID';
  else if(type==='fulfillment_queued') next='FULFILLMENT_QUEUED';
  else if(type==='fulfillment_completed'||type==='vendor_delivered') next='FULFILLED';
  else if(type==='customer_activated'||type==='office_box_activated') next='ACTIVATED';
  else if(type==='payment_failed'||type==='past_due') next='PAST_DUE';
  else if(type==='suspended') next='SUSPENDED';
  else return {ignored:true,eventType:type};
  const entityType=job.entity_type||'customer';
  let state;
  try{state=await setState(entityType,entityId,next,Number(__sbcRequireTenantId(job.tenant_id)),job.id,p);}catch(e){
    if(String(e.message||'').startsWith('ILLEGAL_STATE_TRANSITION')){
      // Existing authoritative events can arrive out of order after a restart. Preserve the event for audit,
      // but do not force an invalid transition.
      return {ok:true,ignored:true,reason:'illegal_transition_preserved',error:e.message};
    }
    throw e;
  }
  if(ctx?.audit)try{ctx.audit({id:'system',name:'SBC Event Broker',role:'system'},`broker_${type}`,`Revenue state transition ${state.from} → ${state.to}`,{eventId:job.id,entityType,entityId});}catch{}
  return {ok:true,state,eventType:type,entityId};
}
async function processOnce(){if(running||!ctx?.mysqlPool)return {ok:true,skipped:true,reason:running?'cycle_in_progress':'no_mysql'};running=true;let processed=0,failed=0;try{await ensureTables();const [rows]=await ctx.mysqlPool.query(`SELECT * FROM sbc_revenue_event_jobs WHERE status='PENDING' AND (next_attempt_at IS NULL OR next_attempt_at<=UTC_TIMESTAMP()) ORDER BY created_at LIMIT ?`,[MAX_BATCH]);const queue=rows.slice();const worker=async()=>{while(queue.length){const job=queue.shift();if(!job)return;try{await ctx.mysqlPool.query(`UPDATE sbc_revenue_event_jobs SET status='PROCESSING',updated_at=UTC_TIMESTAMP() WHERE id=? AND status='PENDING'`,[job.id]);const out=await handle(job);await ctx.mysqlPool.query(`UPDATE sbc_revenue_event_jobs SET status='PROCESSED',attempts=attempts+1,last_error=?,updated_at=UTC_TIMESTAMP() WHERE id=?`,[out?.ignored?String(out.reason||''): '',job.id]);processed++;}catch(e){failed++;const attempts=Number(job.attempts||0)+1;const terminal=attempts>=6;await ctx.mysqlPool.query(`UPDATE sbc_revenue_event_jobs SET status=?,attempts=?,last_error=?,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL LEAST(60,POW(2,LEAST(6,?))) SECOND),updated_at=UTC_TIMESTAMP() WHERE id=?`,[terminal?'FAILED':'PENDING',attempts,String(e.message||e).slice(0,1000),attempts,job.id]);}}};await Promise.all(Array.from({length:Math.min(MAX_CONCURRENCY,queue.length||1)},worker));return {ok:true,processed,failed,batch:rows.length,at:now()};}finally{running=false;}}
async function reconcile(){if(!ctx?.db?.customers)return {ok:true,queued:0};let queued=0;for(const c of ctx.db.customers){if(c.autopilotProcessedAt&&!c.autopilotStateEventAt){const r=await publish('qualified',{tenantId:__sbcRequireTenantId(c.tenantId),entityId:c.id,payload:{customerId:c.id,score:c.leadScore||0,temperature:c.leadTemperature||''}});if(r.ok){c.autopilotStateEventAt=now();queued++;}}}if(queued&&ctx.saveData)await ctx.saveData();return {ok:true,queued};}
async function status(){if(!ctx?.mysqlPool)return {version:VERSION,configured:false};const [rows]=await ctx.mysqlPool.query(`SELECT status,COUNT(*) count FROM sbc_revenue_event_jobs GROUP BY status`);const [states]=await ctx.mysqlPool.query(`SELECT state,COUNT(*) count FROM sbc_revenue_state_machine WHERE tenant_id=1 GROUP BY state ORDER BY state`);return {version:VERSION,configured:true,concurrency:MAX_CONCURRENCY,batch:MAX_BATCH,pollMs:POLL_MS,running,queue:rows,states};}
function configure(input={}){ctx=input;return {ok:true,version:VERSION,concurrency:MAX_CONCURRENCY};}
function start(){if(timer||!ctx)return;ensureTables().catch(e=>console.warn('[V56.16 BROKER] table init:',e.message));const cycle=async()=>{try{await reconcile();await processOnce();}catch(e){console.warn('[V56.16 BROKER] cycle:',e.message)}};cycle();timer=setInterval(cycle,POLL_MS);timer.unref?.();}
function stop(){if(timer)clearInterval(timer);timer=null;}
module.exports={VERSION,CUSTOMER_STATES,TRANSITIONS,configure,start,stop,publish,processOnce,reconcile,status,setState,transition};
