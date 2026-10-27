// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto=require('crypto');
const VERSION='56.13.1';
const subscribers=new Set();
const recent=[];
let busAttached=false;
function id(p='rt'){return `${p}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;}
function now(){return new Date().toISOString();}
function clean(v,n=12000){return String(v??'').slice(0,n);}
function transient(e){return /ECONNRESET|PROTOCOL_CONNECTION_LOST|ETIMEDOUT|EPIPE|ECONNREFUSED|socket|connection/i.test(String(e?.code||e?.message||e));}
async function queryWithRetry(pool,sql,params=[],opts={}){
  if(!pool)throw new Error('MYSQL_UNAVAILABLE');
  const attempts=Math.max(1,Math.min(5,Number(opts.attempts||3)));
  let last;
  for(let i=1;i<=attempts;i++){
    try{return await pool.query(sql,params);}
    catch(e){last=e;if(!transient(e)||i===attempts)throw e;await new Promise(r=>setTimeout(r,Math.min(5000,250*Math.pow(2,i-1))));}
  }
  throw last;
}
function startMySQLResilience({getPool,onEvent=()=>{}}={}){
  const interval=Math.max(30000,Number(process.env.SBC_MYSQL_RESILIENCE_INTERVAL_MS||60000));
  const tick=async()=>{const pool=getPool?.();if(!pool)return;try{await queryWithRetry(pool,'SELECT 1 AS ok');onEvent({state:'HEALTHY',at:now()});}catch(e){onEvent({state:'DEGRADED',error:clean(e.message,300),transient:transient(e),at:now()});}};
  tick(); const timer=setInterval(tick,interval);timer.unref?.();return ()=>clearInterval(timer);
}
class RevenueTelemetry{
  constructor({getPool,getDb}={}){this.getPool=getPool||(()=>null);this.getDb=getDb||(()=>({}));this.bus=null;}
  async ensureTables(){const pool=this.getPool();if(!pool)return false;await queryWithRetry(pool,`CREATE TABLE IF NOT EXISTS sbc_v56131_call_telemetry(id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,lead_id VARCHAR(100) NOT NULL,call_sid VARCHAR(120) NOT NULL DEFAULT '',event_type VARCHAR(80) NOT NULL,state VARCHAR(50) NOT NULL DEFAULT '',objection_key VARCHAR(100) NOT NULL DEFAULT '',intent_score INT NOT NULL DEFAULT 0,duration_seconds INT NOT NULL DEFAULT 0,revenue DECIMAL(14,2) NOT NULL DEFAULT 0,payload_json LONGTEXT,created_at DATETIME(3) NOT NULL,INDEX idx_v56131_lead(lead_id,created_at),INDEX idx_v56131_event(event_type,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);return true;}
  subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);}
  record(event={}){const e={id:event.id||id('call'),version:VERSION,at:now(),tenantId:Number(__sbcRequireTenantId(event.tenantId)),leadId:clean(event.leadId,100),callSid:clean(event.callSid,120),eventType:clean(event.eventType||event.type||'CALL_STATE',80),state:clean(event.state,50),objectionKey:clean(event.objectionKey,100),intentScore:Number(event.intentScore||0),durationSeconds:Number(event.durationSeconds||0),revenue:Number(event.revenue||0),payload:event.payload||event.meta||{}};recent.push(e);if(recent.length>1000)recent.splice(0,recent.length-1000);for(const fn of subscribers){try{fn(e)}catch{}};const pool=this.getPool();if(pool)queryWithRetry(pool,'INSERT INTO sbc_v56131_call_telemetry(id,tenant_id,lead_id,call_sid,event_type,state,objection_key,intent_score,duration_seconds,revenue,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[e.id,e.tenantId,e.leadId,e.callSid,e.eventType,e.state,e.objectionKey,e.intentScore,e.durationSeconds,e.revenue,JSON.stringify(e.payload||{}),new Date(e.at).toISOString().slice(0,23).replace('T',' ')]).catch(()=>{});return e;}
  attachBus(bus){if(busAttached||!bus?.on)return;this.bus=bus;bus.on('telemetry',e=>this.record({eventType:'VOICE_STATE',...e}));busAttached=true;}
  snapshot(){return {version:VERSION,at:now(),activeSubscribers:subscribers.size,recent:recent.slice(-100)};}
  async metrics(tenantId=1){const pool=this.getPool();if(pool){try{const [[r]]=await queryWithRetry(pool,`SELECT COUNT(*) events,COUNT(DISTINCT lead_id) contacts,COALESCE(SUM(duration_seconds),0) seconds,COALESCE(SUM(revenue),0) revenue,SUM(event_type='OBJECTION_RESOLVED') objections_won,SUM(event_type='OBJECTION_DETECTED') objections_detected FROM sbc_v56131_call_telemetry WHERE tenant_id=?`,[tenantId]);const seconds=Number(r?.seconds||0),revenue=Number(r?.revenue||0),won=Number(r?.objections_won||0),detected=Number(r?.objections_detected||0);return {events:Number(r?.events||0),contacts:Number(r?.contacts||0),aiHours:seconds/3600,revenue,revenuePerAIHour:seconds?revenue/(seconds/3600):0,objectionWins:won,objectionsDetected:detected,objectionWinRate:detected?won/detected:0};}catch{}}
  const rows=recent.filter(x=>Number(__sbcRequireTenantId(x.tenantId))===Number(tenantId));const seconds=rows.reduce((n,x)=>n+Number(x.durationSeconds||0),0),revenue=rows.reduce((n,x)=>n+Number(x.revenue||0),0),won=rows.filter(x=>x.eventType==='OBJECTION_RESOLVED').length,detected=rows.filter(x=>x.eventType==='OBJECTION_DETECTED').length;return {events:rows.length,contacts:new Set(rows.map(x=>x.leadId).filter(Boolean)).size,aiHours:seconds/3600,revenue,revenuePerAIHour:seconds?revenue/(seconds/3600):0,objectionWins:won,objectionsDetected:detected,objectionWinRate:detected?won/detected:0};}
}
module.exports={VERSION,RevenueTelemetry,queryWithRetry,startMySQLResilience};
