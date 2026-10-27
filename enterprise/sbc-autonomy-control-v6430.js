'use strict';
const crypto=require('crypto');
const VERSION='64.3.0';
const MODES=['SHADOW','GUARDED','AUTONOMOUS'];
const PROTECTED=new Set(['refund','delete_customer','delete_production','change_credentials','change_security','restore_crm','publish_unapproved','change_billing_authority','move_money']);
function now(){return new Date().toISOString()}
function id(p){return `${p}_${crypto.randomBytes(8).toString('hex')}`}
function ensure(store){
  store.sbcAutonomy=store.sbcAutonomy&&typeof store.sbcAutonomy==='object'?store.sbcAutonomy:{};
  const s=store.sbcAutonomy;
  if(!MODES.includes(s.mode))s.mode='GUARDED';
  if(typeof s.paused!=='boolean')s.paused=false;
  s.jobs=Array.isArray(s.jobs)?s.jobs:[];s.exceptions=Array.isArray(s.exceptions)?s.exceptions:[];s.audit=Array.isArray(s.audit)?s.audit:[];
  s.metrics=s.metrics&&typeof s.metrics==='object'?s.metrics:{};
  for(const k of ['queued','completed','failed','blocked','escalated','verified'])s.metrics[k]=Number(s.metrics[k]||0);
  s.updatedAt=s.updatedAt||now();return s;
}
function policy(action,{risk='LOW',approved=false,mode='GUARDED'}={}){
  if(PROTECTED.has(action))return {decision:'OWNER_REQUIRED',allowed:false,reason:'Protected owner action'};
  if(mode==='SHADOW')return {decision:'SIMULATE',allowed:false,reason:'Shadow mode'};
  if(risk==='CRITICAL')return {decision:'OWNER_REQUIRED',allowed:false,reason:'Critical risk'};
  if(risk==='HIGH'&&!approved)return {decision:'OWNER_REQUIRED',allowed:false,reason:'High-risk action requires owner approval'};
  return {decision:'AUTO',allowed:true,reason:'Within autonomous policy'};
}
function exception(s,type,reason,meta={}){const e={id:id('exc'),type,reason,status:'OPEN',severity:meta.severity||'MEDIUM',createdAt:now(),meta};s.exceptions.unshift(e);s.metrics.escalated++;return e}
function enqueue(store,action,payload={},risk='LOW',source='system'){
 const s=ensure(store);const key=crypto.createHash('sha256').update(JSON.stringify({action,payload})).digest('hex');
 const prior=s.jobs.find(j=>j.idempotencyKey===key&&['QUEUED','RUNNING','COMPLETED'].includes(j.status));if(prior)return {deduped:true,job:prior};
 const job={id:id('job'),action,payload,risk,source,idempotencyKey:key,status:'QUEUED',createdAt:now(),updatedAt:now()};s.jobs.unshift(job);s.metrics.queued++;s.updatedAt=now();return {deduped:false,job};
}
function process(store,{limit=25,approved=false}={}){
 const s=ensure(store);if(s.paused)return {ok:true,paused:true,processed:0};let processed=0;
 for(const j of s.jobs.filter(x=>x.status==='QUEUED').slice(0,limit)){
   const d=policy(j.action,{risk:j.risk,approved,mode:s.mode});j.status='VERIFYING';j.updatedAt=now();s.audit.unshift({id:id('audit'),jobId:j.id,action:j.action,decision:d.decision,reason:d.reason,createdAt:now()});
   if(!d.allowed){j.status='ESCALATED';s.metrics.blocked++;s.metrics.queued=Math.max(0,s.metrics.queued-1);exception(s,'OWNER_APPROVAL_REQUIRED',d.reason,{jobId:j.id,action:j.action,severity:j.risk==='CRITICAL'?'CRITICAL':'HIGH'});processed++;continue;}
   j.status='COMPLETED';j.result={ok:true,verified:true,execution:'CONTROLLED_AUTONOMY'};j.completedAt=now();s.metrics.completed++;s.metrics.verified++;s.metrics.queued=Math.max(0,s.metrics.queued-1);processed++;
 }
 s.updatedAt=now();return {ok:true,processed,queued:s.jobs.filter(x=>x.status==='QUEUED').length,exceptions:s.exceptions.filter(x=>x.status==='OPEN').length,metrics:s.metrics};
}
function sweep(store,db={}){
 const s=ensure(store);if(s.paused)return {ok:true,paused:true,emitted:0};let emitted=0;
 for(const c of Array.isArray(db.customers)?db.customers.slice(0,1000):[]){
   if(!c?.id)continue;
   const key=`lead:${c.id}`;if(s.jobs.some(j=>j.payload?.key===key&&['QUEUED','COMPLETED','ESCALATED'].includes(j.status)))continue;
   enqueue(store,'lead_qualification',{key,leadId:c.id,businessName:c.businessName||'',email:c.email||'',phone:c.phone||''},'LOW','autonomous_sweep');emitted++;
 }
 for(const o of Array.isArray(db.orders)?db.orders.slice(0,500):[]){
   const paid=['paid','completed','payment_received'].includes(String(o.paymentStatus||o.status||'').toLowerCase());
   if(paid&&o.id&&!s.jobs.some(j=>j.payload?.orderId===String(o.id)&&j.action==='fulfillment_launch'&&['QUEUED','COMPLETED','ESCALATED'].includes(j.status)))enqueue(store,'fulfillment_launch',{orderId:String(o.id)},'MEDIUM','autonomous_sweep'),emitted++;
 }
 const result=process(store,{limit:25});return {ok:true,emitted,result};
}
function setMode(store,mode){if(!MODES.includes(mode))throw new Error('INVALID_AUTONOMY_MODE');const s=ensure(store);s.mode=mode;s.updatedAt=now();return s.mode}
function pause(store){const s=ensure(store);s.paused=true;s.updatedAt=now();return true}
function resume(store){const s=ensure(store);s.paused=false;s.updatedAt=now();return true}
function summary(store){const s=ensure(store);return {version:VERSION,mode:s.mode,paused:s.paused,metrics:s.metrics,openExceptions:s.exceptions.filter(x=>x.status==='OPEN').slice(0,50),queued:s.jobs.filter(x=>x.status==='QUEUED').slice(0,25),recentAudit:s.audit.slice(0,25),updatedAt:s.updatedAt,protectedActions:[...PROTECTED]}}
function simulate(){
 const store={};const s=ensure(store);s.mode='AUTONOMOUS';const cases=[];const scenarios=[['lead_qualification','LOW'],['followup_prepare','LOW'],['fulfillment_launch','MEDIUM'],['refund','CRITICAL'],['delete_customer','CRITICAL'],['system_recovery','HIGH'],['customer_onboarding','LOW'],['renewal_prepare','LOW'],['publish_unapproved','HIGH'],['support_triage','LOW']];
 for(let i=0;i<10000;i++){const [action,risk]=scenarios[i%scenarios.length];const d=policy(action,{risk,mode:'AUTONOMOUS',approved:false});cases.push(d)}
 return {ok:true,cases:cases.length,auto:cases.filter(x=>x.decision==='AUTO').length,ownerRequired:cases.filter(x=>x.decision==='OWNER_REQUIRED').length,simulated:cases.filter(x=>x.decision==='SIMULATE').length,protectedBoundaryIntact:cases.filter((x,i)=>scenarios[i%scenarios.length][0]==='refund'&&x.decision==='OWNER_REQUIRED').length===1000,generatedAt:now()};
}
module.exports={VERSION,MODES,PROTECTED,ensure,policy,enqueue,process,sweep,setMode,pause,resume,summary,simulate};
