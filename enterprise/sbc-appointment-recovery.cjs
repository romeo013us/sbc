'use strict';
// A durable at-most-once outbox. Accepted is not delivered. Unknown attempts need
// provider reconciliation; restarting the worker never retries a SENDING record.
const {getState,editState,hash}=require('./sbc-connected-journey.cjs');
const {sameTenant,accessible,suppressed,safeMeetingLink}=require('./sbc-sales-p0p1.cjs');
const {destination,isSuppressed}=require('./v66137-sms-delivery-truth.cjs');
function channelTarget(c,channel){try{return channel==='email'?String(c.email||'').trim().toLowerCase():destination(c.phone)}catch{return ''}}
function createRecovery(service,{enabled=()=>false,senders={}}={}){
 const {db,now,transaction}=service;
 const error=(code,status=400)=>{throw Object.assign(Error(code),{status})};
 function recordConsent(cid,actor,tid,b){return transaction(()=>{
  const c=service.account(cid,actor,tid);if(!['email','sms'].includes(b.channel)||typeof b.granted!=='boolean')error('INVALID_CONSENT');
  const proof=String(b.proof||'').trim(),capturedAt=String(b.capturedAt||'');
  if(b.granted&&(proof.length<12||proof.length>500||!Number.isFinite(Date.parse(capturedAt))||Date.parse(capturedAt)>Date.parse(now())+60000))error('CONSENT_EVIDENCE_REQUIRED');
  const target=channelTarget(c,b.channel);if(b.granted&&(!target||(b.channel==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target))))error('CHANNEL_DESTINATION_REQUIRED');
  editState(c).consents[b.channel]={granted:b.granted,proof:proof.slice(0,500),capturedAt,recordedAt:now(),recordedBy:actor.id,destinationHash:hash(target)};
  service.event(c,b.granted?'appointment_consent_recorded':'appointment_consent_revoked',{channel:b.channel,actor:actor.id});return {ok:true,durable:true};
 })}
 function eligible(c,a,channel){
  if(suppressed(c)||isSuppressed(c)||c.deleted===true)return false;
  const consent=getState(c).consents?.[channel],target=channelTarget(c,channel);
  return consent?.granted===true&&!!consent.proof&&Number.isFinite(Date.parse(consent.capturedAt))&&Date.parse(consent.capturedAt)<=Date.parse(now())&&consent.destinationHash===hash(target)&&!!target&&
   sameTenant(a,c.tenantId)&&String(a.customerId)===String(c.id)&&a.status==='Scheduled'&&Date.parse(a.startAt)>Date.parse(now())&&!!safeMeetingLink(a.meetingUrl||a.location);
 }
 // Evaluate the intended send time, not only the worker's current time. A
 // reminder due at 07:30 Eastern must not disappear at 08:00 solely because
 // the normal 15-minute dispatch window elapsed while sending was forbidden.
 const easternHour=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'});
 function hourAt(ms){return Number(easternHour.format(new Date(ms)))}
 function nextAllowedSendAt(due){
  const hour=hourAt(due);
  if(hour>=8&&hour<20)return due;
  // Eastern is always UTC-hour aligned. Move along UTC hour boundaries instead
  // of assuming an EST/EDT offset; handles the daylight-saving transitions.
  let next=Math.floor(due/3600000)*3600000;
  if(next<due)next+=3600000;
  for(let n=0;n<15;n++,next+=3600000)if(hourAt(next)===8)return next;
  throw Error('APPOINTMENT_NEXT_SEND_WINDOW_UNAVAILABLE');
 }
 function quiet(){const hour=hourAt(Date.parse(now()));return hour<8||hour>=20}
 function candidates(actor,tid){
  const at=Date.parse(now()),rows=[];
  for(const c of db.customers||[]){if(!sameTenant(c,tid)||(actor&&!accessible(c,actor,tid)))continue;
   for(const a of db.appointments||[]){for(const channel of ['email','sms']){
    if(!eligible(c,a,channel))continue;
    const kinds=[['24h',Date.parse(a.startAt)-86400000],['1h',Date.parse(a.startAt)-3600000],['confirmation',Date.parse(a.scheduleConfirmedAt||a.createdAt)]];
    for(const [kind,due] of kinds){if(!Number.isFinite(due))continue;
     const sendAt=nextAllowedSendAt(due),maxLag=kind==='confirmation'?3600000:900000;
     if(at<sendAt||at-sendAt>maxLag)continue;
     const key=hash([c.tenantId,a.id,a.startAt,channel,kind]);if((getState(c).reminders||[]).some(r=>r.key===key))continue;
     rows.push({key,customerId:c.id,appointmentId:a.id,channel,kind,dueAt:new Date(due).toISOString(),scheduledSendAt:new Date(sendAt).toISOString(),quietHoursHeld:sendAt>due});
    }
   }}
  }return rows;
 }
 function preview(actor,tid){if(!['owner','account_manager'].includes(actor?.role))error('NOT_AUTHORIZED',403);
  const rows=candidates(actor,tid);
  const receipts=(db.customers||[]).filter(c=>accessible(c,actor,tid)).flatMap(c=>(getState(c).reminders||[]).map(r=>({...r,businessName:c.businessName||c.contactName})));
  const current=Date.parse(now());
  const attention={requiresReconciliation:0,failed:0,acceptedUnconfirmed:0};
  for(const r of receipts){
   const status=String(r.status||'');
   if(status==='UNKNOWN'||(status==='SENDING'&&current-Date.parse(r.claimedAt||'')>=600000))attention.requiresReconciliation++;
   if(status==='FAILED')attention.failed++;
   if(status==='ACCEPTED'&&!r.deliveryConfirmed)attention.acceptedUnconfirmed++;
  }
  return {ok:true,sendEnabled:enabled()===true,quietHours:quiet(),rows,receipts,attention,
   note:'Accepted means the provider accepted a request. SENDING or UNKNOWN requires reconciliation; it is never automatically retried.'};
 }
 async function run(tid,actor){
  if(actor&&(actor.role!=='owner'||!sameTenant(actor,tid)||actor.active===false))error('OWNER_REQUIRED',403);
  if(enabled()!==true)return {ok:true,sendEnabled:false,processed:0,reason:'DISPATCH_DISABLED'};
  if(quiet())return {ok:true,sendEnabled:true,processed:0,reason:'QUIET_HOURS'};
  let processed=0;
  for(const item of candidates(null,tid).slice(0,25)){
   const claimed=await transaction(()=>{
    const c=(db.customers||[]).find(c=>sameTenant(c,tid)&&String(c.id)===String(item.customerId));
    const a=(db.appointments||[]).find(a=>sameTenant(a,tid)&&String(a.id)===String(item.appointmentId));
    if(!c||!a||!eligible(c,a,item.channel)||(getState(c).reminders||[]).some(r=>r.key===item.key))return null;
    if(typeof senders[item.channel]!=='function')return null;
    const receipt={...item,status:'SENDING',claimedAt:now(),deliveryConfirmed:false,providerId:''};editState(c).reminders.push(receipt);
    return {customer:JSON.parse(JSON.stringify(c)),appointment:JSON.parse(JSON.stringify(a))};
   },['customers']);
   if(!claimed)continue;
   // Recheck after the durable claim and before reaching the provider.
   const current=(db.customers||[]).find(c=>sameTenant(c,tid)&&c.id===item.customerId),meeting=(db.appointments||[]).find(a=>sameTenant(a,tid)&&a.id===item.appointmentId);
   let result,status='UNKNOWN',providerId='';
   const dispatchTime=Date.parse(now()),scheduledTime=Date.parse(item.scheduledSendAt),maxLag=item.kind==='confirmation'?3600000:900000;
   const inDispatchWindow=Number.isFinite(dispatchTime)&&Number.isFinite(scheduledTime)&&dispatchTime>=scheduledTime&&dispatchTime-scheduledTime<=maxLag;
   try{
    if(!current||!meeting||!eligible(current,meeting,item.channel)||hash(channelTarget(current,item.channel))!==hash(channelTarget(claimed.customer,item.channel))||meeting.startAt!==claimed.appointment.startAt||!inDispatchWindow||quiet())status='CANCELLED_BEFORE_SEND';
    else{
     const time=new Date(meeting.startAt).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'});
     const message='SBC appointment '+(item.kind==='confirmation'?'confirmation':'reminder')+': '+time+' Eastern. '+safeMeetingLink(meeting.meetingUrl||meeting.location)+' Manage your appointment securely: '+service.publicOrigin+'/account.php';
     result=await senders[item.channel](JSON.parse(JSON.stringify(current)),'Your SBC appointment',message);
     providerId=String(result?.sid||result?.messageId||'');status=providerId?(result?.deliveryConfirmed===true?'DELIVERED':'ACCEPTED'):'UNKNOWN';
    }
   }catch{status='UNKNOWN'}
   await transaction(()=>{
    const c=(db.customers||[]).find(c=>sameTenant(c,tid)&&c.id===item.customerId),r=c&&(getState(c).reminders||[]).find(r=>r.key===item.key);
    if(r)Object.assign(r,{status,providerId,providerStatus:String(result?.providerStatus||''),completedAt:now(),deliveryConfirmed:status==='DELIVERED'});
    return {ok:true};
   },['customers']);processed++;
  }return {ok:true,sendEnabled:true,processed};
 }
 function delivery(providerId,state){return transaction(()=>{
  if(!/^SM[a-f0-9]{32}$/i.test(String(providerId))||!['delivered','failed','undelivered','sent','queued'].includes(state))return {ok:true,matched:false};
  for(const c of db.customers||[]){const r=(getState(c).reminders||[]).find(r=>r.channel==='sms'&&r.providerId===providerId);if(!r)continue;
   if(r.status==='DELIVERED'||r.status==='FAILED')return {ok:true,matched:true};
   Object.assign(r,{status:state==='delivered'?'DELIVERED':['failed','undelivered'].includes(state)?'FAILED':'ACCEPTED',providerStatus:state,deliveryConfirmed:state==='delivered',deliveryUpdatedAt:now()});return {ok:true,matched:true};
  }return {ok:true,matched:false};
 },['customers'])}
 return {recordConsent,preview,run,delivery};
}
module.exports={createRecovery,channelTarget};
