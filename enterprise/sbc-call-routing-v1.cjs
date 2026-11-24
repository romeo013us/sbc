'use strict';
/* SBC Call Routing V1: deterministic, no outreach side effects.
 * Queue transitions persist with the authoritative call log snapshot. */
const FINAL_STATUSES=new Set(['completed','ended','no-answer','busy']);
const TERMINAL_ACCOUNT_STATUSES=new Set(['customer','lost','do not call','closed','duplicate','not qualified']);
const OUTCOMES=new Set(['Pending','Interested','Follow-up requested','Appointment booked','No answer','Left voicemail','Not interested','Do Not Call','Order ready','Bad number','Spanish callback needed']);
const DNC_VALUES=new Set(['do not call','do not contact','dnc','opt out','unsubscribe']);
const EXCLUDED_STATES=new Set(['pipeline','retired','processed','spanish_callback','callback_assigned','contacted_review','followup_unscheduled','phone_hold']);
const RETRY_MS=24*60*60*1000;
const ts=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0};
const userTenant=x=>Number(x?.tenantId??x?.tenant_id);
const hasDnc=c=>Boolean(c&&(c.doNotContact===true||c.doNotCall===true||c.salesSuppressed===true||c.isSuppressed===true||DNC_VALUES.has(String(c.status||'').trim().toLowerCase())));
const validTenant=t=>Number.isSafeInteger(Number(t))&&Number(t)>0;
const isTerminalAccount=c=>TERMINAL_ACCOUNT_STATUSES.has(String(c?.status||'').trim().toLowerCase());
const isTerminalLog=log=>!!log&&FINAL_STATUSES.has(String(log.status||'').toLowerCase());
function lastAttempt(customer,logs,tenantId){
 const cid=String(customer?.id||'');
 return (Array.isArray(logs)?logs:[]).filter(x=>String(x.customerId||'')===cid&&userTenant(x)===Number(tenantId)&&isTerminalLog(x))
 .sort((a,b)=>ts(b.endedAt||b.updatedAt||b.createdAt)-ts(a.endedAt||a.updatedAt||a.createdAt))[0]||null;
}
function eligibleForEnglish(customer,logs,tenantId,nowDate=new Date()){
 if(!validTenant(tenantId)||!Number.isFinite(+new Date(nowDate))||!customer||userTenant(customer)!==Number(tenantId)||hasDnc(customer)||isTerminalAccount(customer))return false;
 const state=String(customer.salesQueueState||'');
 if(EXCLUDED_STATES.has(state))return false;
 if(['retry','callback'].includes(state)&&(!ts(customer.salesNextAttemptAt)||ts(customer.salesNextAttemptAt)>+new Date(nowDate)))return false;
 if(String(customer.preferredContactLanguage||'').toLowerCase()==='es')return false;
 const last=lastAttempt(customer,logs,tenantId);
 if(last){
  const outcome=String(last.outcome||'Pending');
  if(['Spanish callback needed','Do Not Call','Not interested','Bad number','Interested','Appointment booked','Order ready'].includes(outcome))return false;
  if(outcome==='Follow-up requested'&&!(state==='callback'&&ts(customer.salesNextAttemptAt)&&ts(customer.salesNextAttemptAt)<=+new Date(nowDate)))return false;
  if(ts(last.endedAt||last.updatedAt||last.createdAt)+RETRY_MS>+new Date(nowDate))return false;
 }
 return true;
}
function routingUpdate(customer,log,stamp=new Date()){
 if(!customer||!isTerminalLog(log)||!OUTCOMES.has(String(log.outcome||'')))return {changed:false,reason:'not-final-or-invalid'};
 const now=+new Date(stamp);if(!Number.isFinite(now))throw Error('CALL_ROUTING_INVALID_DATE');
 const outcome=String(log.outcome||'Pending'),logId=String(log.id||'');
 if(logId&&String(customer.salesLastRoutedCallLogId||'')===logId&&customer.salesLastRoutedOutcome===outcome)return {changed:false,reason:'already-routed'};
 if(hasDnc(customer)&&outcome!=='Do Not Call')return {changed:false,reason:'suppressed'};
 customer.salesLastRoutedCallLogId=logId;customer.salesLastRoutedOutcome=outcome;
 customer.salesLastAttemptAt=log.endedAt||new Date(now).toISOString();
 customer.salesDisposition=outcome;customer.updatedAt=new Date(now).toISOString();
 if(outcome==='Do Not Call'){
  customer.status='Do Not Call';customer.doNotContact=true;customer.salesSuppressed=true;customer.salesQueueState='retired';customer.salesNextAttemptAt='';customer.salesCallbackAssignedTo='';
 }else if(outcome==='Spanish callback needed'){
  customer.preferredContactLanguage='es';
  customer.salesQueueState=customer.salesCallbackAssignedTo?'callback_assigned':'spanish_callback';
  customer.salesNextAttemptAt='';customer.salesCallbackAssignedTo=customer.salesCallbackAssignedTo||'';
  customer.salesCallbackRequestedAt=customer.salesCallbackRequestedAt||new Date(now).toISOString();
 }else if(outcome==='Bad number'){
  customer.salesQueueState='phone_hold';customer.salesNextAttemptAt='';
 }else if(outcome==='Not interested'){
  customer.salesQueueState='retired';customer.salesNextAttemptAt='';
 }else if(['Interested','Appointment booked','Order ready'].includes(outcome)){
  customer.salesQueueState='pipeline';customer.salesNextAttemptAt='';
  if(customer.status==='Lead')customer.status='Contacted';
 }else if(outcome==='Follow-up requested'){
  const due=ts(log.followUpAt);customer.salesQueueState=due?'callback':'followup_unscheduled';customer.salesNextAttemptAt=due?new Date(due).toISOString():'';
 }else if(outcome==='No answer'||outcome==='Left voicemail'||String(log.status||'')==='no-answer'||String(log.status||'')==='busy'){
  customer.salesQueueState='retry';customer.salesNextAttemptAt=new Date(now+RETRY_MS).toISOString();
 }else if(customer.preferredContactLanguage==='es'){
  customer.salesQueueState=customer.salesCallbackAssignedTo?'callback_assigned':'spanish_callback';customer.salesNextAttemptAt='';
 }else{
  customer.salesQueueState='contacted_review';customer.salesNextAttemptAt='';
 }
 return {changed:true,queueState:customer.salesQueueState,outcome};
}
function restoreSnapshot(target,copy){
 if(!target||!copy)return;
 for(const key of Object.keys(target))if(!Object.prototype.hasOwnProperty.call(copy,key))delete target[key];
 Object.assign(target,copy);
}
const spanishCallbacks=(customers,tenantId)=>(customers||[])
 .filter(c=>validTenant(tenantId)&&c&&userTenant(c)===Number(tenantId)&&!hasDnc(c)&&!isTerminalAccount(c)&&['spanish_callback','callback_assigned'].includes(String(c.salesQueueState||'')))
 .sort((a,b)=>ts(a.salesCallbackRequestedAt)-ts(b.salesCallbackRequestedAt));
const isSpanishApproved=user=>!!user&&user.active!==false&&user.spanishCallingApprovedByOwner===true&&['account_manager','manager'].includes(String(user.role||''));
module.exports=Object.freeze({OUTCOMES,hasDnc,isTerminalLog,lastAttempt,eligibleForEnglish,routingUpdate,restoreSnapshot,spanishCallbacks,isSpanishApproved});
