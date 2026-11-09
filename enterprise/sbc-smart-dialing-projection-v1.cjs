'use strict';
/*
 * SBC read-only disposition projection for the existing assigned-leads desk.
 * A call report is not a provider receipt or permission to contact.
 * No SQL, Twilio I/O, or paid AI. Tenant/assignment checks remain server-owned.
 */
const HOUR=3600000, DAY=24*HOUR;
const kind=value=>{
 const s=String(value||'').trim().toLowerCase().replace(/[\s-]+/g,'_');
 return ({
  no_answer:'no_answer',left_voicemail:'voicemail',voicemail:'voicemail',busy:'busy',
  do_not_call:'dnc',opt_out:'dnc',bad_number:'bad_number',wrong_number:'bad_number',
  disconnected:'bad_number',not_interested:'declined',
  follow_up_requested:'callback',appointment_requested:'callback',
  interested:'connected',conversation:'connected'
 })[s] || 'review';
};
function millis(value) {
 if(typeof value!=='string'||!/(Z|[+-]\d{2}:\d{2})$/i.test(value.trim()))return null;
 const n=Date.parse(value);return Number.isFinite(n)?n:null;
}
function scopedReports(lead,reports,{userId,tenantId}) {
 const id=String(lead?.id||'');
 return (Array.isArray(reports)?reports:[]).filter(r=>{
  if(String(r?.customerId||'')!==id)return false;
  const reportTenant=r.tenantId??r.tenant_id;
  if(reportTenant!==null && reportTenant!==undefined && reportTenant!=='')
   return Number(reportTenant)===Number(tenantId);
  // Legacy reports without tenant metadata are usable only for their own caller.
  return String(r.callerId||'')===String(userId);
 }).sort((a,b)=>(millis(b.createdAt)||0)-(millis(a.createdAt)||0));
}
function evaluate(lead,reports=[],context={},now=new Date()) {
 const base=Boolean(lead?.canCall);
 if(!base)return {...lead,queueStatus:'blocked',queueReason:String(lead?.reason||'NOT_CALLABLE'),nextEligibleAt:''};
 const scoped=scopedReports(lead,reports,context);
 if(scoped.some(r=>kind(r.outcome)==='dnc'))return {...lead,canCall:false,queueStatus:'suppressed',queueReason:'DO_NOT_CALL',nextEligibleAt:''};
 const mostRecent=scoped[0];
 if(!mostRecent)return {...lead,queueStatus:'ready',queueReason:'',nextEligibleAt:''};
 const outcome=kind(mostRecent.outcome),timestamp=millis(mostRecent.createdAt);
 if(outcome==='bad_number')return {...lead,canCall:false,queueStatus:'quarantined',queueReason:'PHONE_NEEDS_VERIFIED_REPLACEMENT',nextEligibleAt:''};
 if(outcome==='declined')return {...lead,canCall:false,queueStatus:'review',queueReason:'DECLINED_OWNER_REVIEW',nextEligibleAt:''};
 if(outcome==='callback'){
  const due=millis(mostRecent.callbackAt);
  if(due===null)return {...lead,canCall:false,queueStatus:'review',queueReason:'CALLBACK_TIME_NEEDS_CONFIRMATION',nextEligibleAt:''};
  if(due>now.getTime())return {...lead,canCall:false,queueStatus:'scheduled',queueReason:'CALLBACK_NOT_DUE',nextEligibleAt:new Date(due).toISOString()};
  return {...lead,queueStatus:'callback_due',queueReason:'',nextEligibleAt:new Date(due).toISOString()};
 }
 if(outcome==='connected')return {...lead,canCall:false,queueStatus:'review',queueReason:'CONVERSATION_REQUIRES_NEXT_ACTION',nextEligibleAt:''};
 if(['no_answer','voicemail','busy'].includes(outcome)){
  if(timestamp===null)return {...lead,canCall:false,queueStatus:'review',queueReason:'CALL_TIME_UNVERIFIED',nextEligibleAt:''};
  let streak=0;
  for(const r of scoped){
   if(['no_answer','voicemail','busy'].includes(kind(r.outcome)))streak++;
   else break;
  }
  if(streak>=5)return {...lead,canCall:false,queueStatus:'review',queueReason:'MAX_ATTEMPTS_OWNER_REVIEW',nextEligibleAt:''};
  const delay=[DAY,2*DAY,4*DAY,15*DAY][Math.min(streak-1,3)];
  const due=timestamp+delay;
  if(due>now.getTime())return {...lead,canCall:false,queueStatus:'cooldown',queueReason:'RETRY_NOT_DUE',nextEligibleAt:new Date(due).toISOString()};
  return {...lead,queueStatus:'retry_due',queueReason:'',nextEligibleAt:new Date(due).toISOString()};
 }
 return {...lead,canCall:false,queueStatus:'review',queueReason:'OUTCOME_REQUIRES_REVIEW',nextEligibleAt:''};
}
function rank(leads) {
 const temp={hot:30,warm:20,cold:10};
 const weight=lead=>(lead.queueStatus==='callback_due'?100:lead.queueStatus==='retry_due'?80:40)+(temp[String(lead.leadTemperature||'').toLowerCase()]||0);
 return [...(leads||[])].sort((a,b)=>Number(b.canCall)-Number(a.canCall) ||
  weight(b)-weight(a) || String(a.businessName||'').localeCompare(String(b.businessName||'')));
}
module.exports={kind,millis,scopedReports,evaluate,rank};
