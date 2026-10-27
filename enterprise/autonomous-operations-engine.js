'use strict';
const crypto = require('crypto');
const VERSION = '1.0.0';
const MODES = ['SHADOW','GUARDED','AUTONOMOUS'];
const RISK = {LOW:'LOW',MEDIUM:'MEDIUM',HIGH:'HIGH',CRITICAL:'CRITICAL'};
const PROTECTED_ACTIONS = new Set([
  'issue_refund','change_price','rotate_credentials','delete_customer','delete_production','change_security_policy',
  'grant_owner_access','send_high_value_quote','publish_unapproved_production','change_billing_authority'
]);
const DEFINITIONS = [
  ['lead.created','lead_intake','Qualify and prepare a new lead', 'LOW'],
  ['lead.updated','lead_followup','Determine the next permitted sales action', 'LOW'],
  ['customer.intake.completed','customer_onboarding','Validate intake and prepare fulfillment', 'LOW'],
  ['payment.verified','paid_order_launch','Launch the paid customer workflow', 'MEDIUM'],
  ['fulfillment.failed','fulfillment_recovery','Diagnose and retry a recoverable fulfillment failure', 'MEDIUM'],
  ['qa.failed','qa_recovery','Attempt a safe QA repair and retest', 'MEDIUM'],
  ['qa.passed','approval_request','Advance to customer approval', 'LOW'],
  ['customer.approved','production_activation','Prepare production activation', 'HIGH'],
  ['subscription.failed','billing_recovery','Start the permitted billing recovery sequence', 'MEDIUM'],
  ['support.requested','support_triage','Classify and route a customer request', 'LOW'],
  ['system.anomaly','system_recovery','Assess an operational anomaly and recover when safe', 'HIGH'],
  ['timer.tick','autonomous_sweep','Sweep pending autonomous work', 'LOW']
].map(([trigger,id,name,risk])=>({trigger,id,name,risk,enabled:true}));

function now(){return new Date().toISOString();}
function id(prefix='ao'){return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(v||{})).digest('hex');}
function ensure(store){
  store.autonomous = store.autonomous && typeof store.autonomous==='object' ? store.autonomous : {};
  const s=store.autonomous;
  if(!MODES.includes(s.mode))s.mode='AUTONOMOUS';
  s.paused=Boolean(s.paused);
  s.version=VERSION;
  s.jobs=Array.isArray(s.jobs)?s.jobs:[];
  s.events=Array.isArray(s.events)?s.events:[];
  s.exceptions=Array.isArray(s.exceptions)?s.exceptions:[];
  s.actions=Array.isArray(s.actions)?s.actions:[];
  s.metrics=s.metrics&&typeof s.metrics==='object'?s.metrics:{};
  for(const k of ['events','queued','running','completed','failed','retries','escalated','blocked','autoRepaired'])s.metrics[k]=Number(s.metrics[k]||0);
  s.updatedAt=s.updatedAt||now();
  return s;
}
function definitionFor(trigger){return DEFINITIONS.find(d=>d.trigger===trigger);}
function append(s,listName,row,max=5000){s[listName].unshift(row);if(s[listName].length>max)s[listName].length=max;}
function policy(action,ctx={}){
  const risk=ctx.risk||'LOW';
  const protectedAction=PROTECTED_ACTIONS.has(action);
  const mode=ctx.mode||'GUARDED';
  if(protectedAction)return {allowed:false,decision:'ESCALATE',reason:'Protected owner boundary'};
  if(mode==='SHADOW')return {allowed:false,decision:'SIMULATE',reason:'Shadow mode'};
  if(risk==='CRITICAL')return {allowed:false,decision:'ESCALATE',reason:'Critical risk requires human authority'};
  if(risk==='HIGH' && ctx.approved!==true)return {allowed:false,decision:'ESCALATE',reason:'High-risk action requires approval'};
  return {allowed:true,decision:'EXECUTE',reason:'Within autonomous policy'};
}
function createJob(s,def,payload={},source='system'){
  const dedupe=hash({definition:def.id,payload});
  if(s.jobs.some(j=>j.dedupe===dedupe&&['QUEUED','RUNNING','COMPLETED'].includes(j.status)))return {deduped:true,job:s.jobs.find(j=>j.dedupe===dedupe)};
  const job={id:id('job'),dedupe,definitionId:def.id,trigger:def.trigger,name:def.name,risk:def.risk,payload,source,status:'QUEUED',attempts:0,maxAttempts:3,history:[{at:now(),status:'QUEUED'}],createdAt:now(),updatedAt:now()};
  append(s,'jobs',job);s.metrics.queued++;return {deduped:false,job};
}
function emit(store,trigger,payload={},source='system'){
  const s=ensure(store);const event={id:id('evt'),trigger,payload,source,createdAt:now()};append(s,'events',event);s.metrics.events++;
  const def=definitionFor(trigger); if(def&&!s.paused)createJob(s,def,payload,source);
  s.updatedAt=now();return event;
}
function recordAction(s,job,action,decision,result={}){
  const row={id:id('act'),jobId:job.id,action,decision,result,createdAt:now()};append(s,'actions',row);return row;
}
function exception(s,job,reason,details={}){
  const row={id:id('exc'),jobId:job.id,reason,details,status:'OPEN',createdAt:now()};append(s,'exceptions',row);
  s.metrics.escalated++;job.status='ESCALATED';job.escalation=row;job.updatedAt=now();
}
function safeLeadPlan(payload){
  const lead=payload.lead||payload.customer||payload;const missing=[];
  for(const k of ['name','email','phone'])if(!String(lead?.[k]||'').trim())missing.push(k);
  return {qualification:'PENDING_HUMAN_OR_AI_ENRICHMENT',missing,packageRecommendation:null,nextAction:missing.length?'REQUEST_MISSING_INFO':'PREPARE_PERSONALIZED_OUTREACH'};
}
function executeJob(store,job,ctx={}){
  const s=ensure(store); if(s.paused){job.status='PAUSED';return job;}
  job.attempts++;job.status='RUNNING';job.updatedAt=now();job.history.push({at:now(),status:'RUNNING',attempt:job.attempts});
  let action='observe';let risk=job.risk;let result={ok:true,verified:true};
  switch(job.definitionId){
    case 'lead_intake': action='qualify_lead'; result=safeLeadPlan(job.payload); break;
    case 'lead_followup': action='prepare_followup'; result={ok:true,nextAction:'AI_ASSISTED_FOLLOWUP',humanOwner:'lead_sales'}; break;
    case 'customer_onboarding': action='validate_intake'; result={ok:true,nextAction:'FULFILLMENT_READY_CHECK'}; break;
    case 'paid_order_launch': action='launch_paid_order'; result={ok:true,nextAction:'FULFILLMENT_AUTOMATION'}; break;
    case 'fulfillment_recovery': action='retry_recoverable_fulfillment'; result={ok:true,nextAction:'RETRY_IF_IDEMPOTENT'}; break;
    case 'qa_recovery': action='safe_qa_repair'; result={ok:true,nextAction:'RETEST_AFTER_REPAIR'}; break;
    case 'approval_request': action='request_customer_approval'; result={ok:true,nextAction:'CUSTOMER_APPROVAL'}; break;
    case 'production_activation': action='publish_unapproved_production'; break;
    case 'billing_recovery': action='recover_billing'; result={ok:true,nextAction:'CUSTOMER_NOTIFICATION_AND_RETRY'}; break;
    case 'support_triage': action='triage_support'; result={ok:true,nextAction:'ROUTE_TO_AI_OR_HUMAN'}; break;
    case 'system_recovery': action='recover_system_anomaly'; result={ok:true,nextAction:'DIAGNOSE_THEN_REPAIR'}; break;
    case 'autonomous_sweep': action='sweep_autonomous_work'; result={ok:true,nextAction:'PROCESS_PENDING_JOBS'}; break;
  }
  const decision=policy(action,{risk,mode:s.mode,approved:ctx.approved===true});
  recordAction(s,job,action,decision.decision,result);
  if(!decision.allowed){exception(s,job,decision.reason,{action,risk});return job;}
  job.status='VERIFYING';job.result=result;job.verification={passed:true,checks:['policy','action-recorded','result-envelope'],verifiedAt:now()};job.status='COMPLETED';job.completedAt=now();job.updatedAt=job.completedAt;job.history.push({at:now(),status:'COMPLETED'});s.metrics.completed++;s.metrics.queued=Math.max(0,s.metrics.queued-1);return job;
}
function process(store,ctx={}){
  const s=ensure(store);if(s.paused)return {ok:true,paused:true,processed:0};let processed=0;
  for(const job of s.jobs.filter(j=>j.status==='QUEUED').slice(0,Number(ctx.limit||25))){try{executeJob(store,job,ctx);processed++;}catch(e){job.error=e.message;job.status=job.attempts<job.maxAttempts?'QUEUED':'FAILED';job.history.push({at:now(),status:job.status,error:e.message});if(job.status==='QUEUED')s.metrics.retries++;else{s.metrics.failed++;exception(s,job,'Unhandled autonomous execution error',{error:e.message});}s.metrics.queued=Math.max(0,s.metrics.queued-1);}}
  s.updatedAt=now();return {ok:true,processed,queued:s.jobs.filter(j=>j.status==='QUEUED').length,exceptions:s.exceptions.filter(x=>x.status==='OPEN').length,metrics:s.metrics};
}
function sweep(store,db,ctx={}){
  const s=ensure(store);const emitted=[];
  for(const o of Array.isArray(db?.orders)?db.orders:[]){
    const paid=String(o.paymentStatus||o.status||'').toLowerCase();
    if(['paid','completed','payment_received'].includes(paid)&&!s.events.some(e=>e.trigger==='payment.verified'&&String(e.payload?.orderId||'')===String(o.id)))emitted.push(emit(store,'payment.verified',{orderId:o.id,customerId:o.customerId,packageId:o.packageId||o.packageKey||o.productId||''},'autonomous_sweep'));
  }
  for(const c of Array.isArray(db?.customers)?db.customers:[]){
    if(c&&c.id&&!s.events.some(e=>e.trigger==='lead.created'&&String(e.payload?.leadId||'')===String(c.id)))emitted.push(emit(store,'lead.created',{leadId:c.id,lead:c},'autonomous_sweep'));
  }
  const result=process(store,ctx);return {ok:true,emitted:emitted.length,result};
}
function summary(store){const s=ensure(store);return {version:VERSION,mode:s.mode,paused:s.paused,definitions:DEFINITIONS,metrics:s.metrics,queued:s.jobs.filter(j=>j.status==='QUEUED').slice(0,25),running:s.jobs.filter(j=>j.status==='RUNNING').slice(0,25),exceptions:s.exceptions.filter(x=>x.status==='OPEN').slice(0,25),recentActions:s.actions.slice(0,25),recentEvents:s.events.slice(0,25),updatedAt:s.updatedAt};}
function setMode(store,mode,actor){const s=ensure(store);if(!MODES.includes(mode))throw new Error('INVALID_AUTONOMOUS_MODE');if(actor!=='owner')throw new Error('OWNER_AUTHORITY_REQUIRED');s.mode=mode;s.updatedAt=now();return {mode:s.mode};}
function pause(store,actor){if(actor!=='owner')throw new Error('OWNER_AUTHORITY_REQUIRED');const s=ensure(store);s.paused=true;s.updatedAt=now();return {paused:true};}
function resume(store,actor){if(actor!=='owner')throw new Error('OWNER_AUTHORITY_REQUIRED');const s=ensure(store);s.paused=false;s.updatedAt=now();return {paused:false};}
module.exports={VERSION,DEFINITIONS,MODES,PROTECTED_ACTIONS,ensure,emit,process,sweep,summary,setMode,pause,resume};
