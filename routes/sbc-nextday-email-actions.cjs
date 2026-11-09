'use strict';
/* SBC outreach actions: owner-only consent evidence, approved email submission,
 * and manual reply/opt-out triage. Never synthesizes inbound email events.
 * No unconsented cold email, new customers, automated calls or appointments.
 */
const MAIL=require('../enterprise/sbc-consented-outreach-email.cjs');
const READINESS=require('../enterprise/v6625-lead-readiness-audit.cjs');
const NEXTDAY=require('./sbc-nextday-outbound-v1.cjs');
const EVENTS=require('../enterprise/sbc-outbound-signed-events.cjs');
const LEDGER=require('../enterprise/sbc-outreach-consent-ledger.cjs');
const RELAY=require('../enterprise/sbc-outreach-signed-mailbox-relay.cjs');
const compact=(v,n=500)=>String(v??'').trim().slice(0,n);
const tenantOf=v=>Number(v?.tenantId??v?.tenant_id);
function register(app,{auth,ownerOnly,getDb,saveData,requireTenant,requireWriter,
 makeId=p=>p+'_'+Date.now().toString(36),now=()=>new Date().toISOString(),
 mail=MAIL,notifyOwner}={}){
 const getTenant=req=>{const t=Number(requireTenant(req));if(!Number.isSafeInteger(t)||t<1)throw Object.assign(Error('TENANT_REQUIRED'),{status:403});return t};
 const fail=(res,e)=>res.status(e.status||503).json({ok:false,error:compact(e.code||e.message||'REQUEST_FAILED',130)});
 function lead(db,t,id){return (db.customers||[]).find(c=>String(c.id)===String(id)&&tenantOf(c)===t)||null;}
 function task(db,t,id){return (db.tasks||[]).find(x=>String(x.id)===String(id)&&tenantOf(x)===t&&x.type==='SBC Next-Day Call')||null;}
 function status(db,t){
  const s=mail.envStatus();
  const eligible=NEXTDAY.leadsFor(db,t);
  return {...s,optedIn:eligible.filter(mail.hasConsent).length,
   availableVerifiedLeads:eligible.length,autoSendEnabled:false,replyIntegration:'MANUAL_RECORD_ONLY',
   signedDeliveryWebhookConfigured:!!process.env.SBC_SENDGRID_EVENT_PUBLIC_KEY,
   signedMailboxRelayConfigured:String(process.env.SBC_MAIL_RELAY_SECRET||'').length>=32,
   deliveryTracking:'PROVIDER_ACCEPTED_ONLY_UNTIL_SIGNED_WEBHOOK'};
 }
 app.get('/api/owner/nextday/email-status',auth,ownerOnly,(req,res)=>{
  try{const t=getTenant(req);res.setHeader('Cache-Control','no-store');res.json({ok:true,...status(getDb(),t)})}
  catch(e){fail(res,e)}
 });
 let changing=false;
 app.post('/api/owner/nextday/consent/:customerId',auth,ownerOnly,async(req,res)=>{
  if(changing)return res.status(409).json({ok:false,error:'OUTREACH_WRITE_BUSY'});
  changing=true;
  try{
   requireWriter();const t=getTenant(req),db=getDb(),c=lead(db,t,req.params.customerId),b=req.body||{};
   if(!c)return res.status(404).json({ok:false,error:'CONTACT_NOT_FOUND'});
   if(b.confirm!=='OWNER_HAS_DIRECT_OPT_IN_PROOF')return res.status(422).json({ok:false,error:'EXPLICIT_CONSENT_EVIDENCE_REQUIRED'});
   const source=compact(b.source,240),date=Date.parse(String(b.obtainedAt||''));
   const method=compact(b.method,80);
   if(source.length<12||!['signup_form','customer_request','documented_opt_in'].includes(method)||
    !Number.isFinite(date)||date>Date.now()||date<Date.UTC(2020,0,1)||
    /scrap|purchas|third.party|public listing|google maps|unknown|n\/a/i.test(source))
     return res.status(422).json({ok:false,error:'DIRECT_CONSENT_SOURCE_AND_DATE_REQUIRED'});
   const previous=LEDGER.snapshot(c);
   let info;try{info=LEDGER.record(c,{date:new Date(date).toISOString(),source,method})}
   catch(e){return res.status(422).json({ok:false,error:e.message})}
   try{await saveData()}catch(e){LEDGER.restore(c,previous);throw e}
   res.json({ok:true,customerId:c.id,consentRecorded:true,
    evidenceAt:info.marketingEmailConsentAt,source:info.marketingEmailConsentSource,
    note:'Consent proof recorded from owner attestation; not independently verified by the email provider.'});
  }catch(e){fail(res,e)}finally{changing=false}
 });
 app.post('/api/owner/nextday/optout/:customerId',auth,ownerOnly,async(req,res)=>{
  if(changing)return res.status(409).json({ok:false,error:'OUTREACH_WRITE_BUSY'});
  changing=true;
  try{
   requireWriter();const t=getTenant(req),db=getDb(),c=lead(db,t,req.params.customerId);
   if(!c)return res.status(404).json({ok:false,error:'CONTACT_NOT_FOUND'});
   const previous=LEDGER.snapshot(c);
   LEDGER.suppress(c,{reason:'OWNER_MARKETING_OPT_OUT',at:now()});
   try{await saveData()}catch(e){LEDGER.restore(c,previous);throw e}
   res.json({ok:true,customerId:c.id,marketingSuppressed:true});
  }catch(e){fail(res,e)}finally{changing=false}
 });
 const inflight=new Set();
 app.post('/api/owner/nextday/send/:taskId',auth,ownerOnly,async(req,res)=>{
  const key=String(req.params.taskId);
  if(inflight.has(key)||changing)return res.status(409).json({ok:false,error:'OUTREACH_WRITE_BUSY'});
  inflight.add(key);changing=true;
  let current=null;
  try{
   requireWriter();const t=getTenant(req),db=getDb(),b=req.body||{};
   if(b.confirm!=='OWNER_APPROVES_CONSENTED_EMAIL')return res.status(422).json({ok:false,error:'OWNER_SEND_APPROVAL_REQUIRED'});
   const r=task(db,t,key);
   if(!r)return res.status(404).json({ok:false,error:'PREPARED_CALL_TASK_NOT_FOUND'});
   const c=lead(db,t,r.customerId);
   if(!c||!NEXTDAY.leadsFor(db,t).some(x=>String(x.id)===String(c.id)))
    return res.status(422).json({ok:false,error:'SUPPRESSED_OR_UNVERIFIED_LEAD'});
   if(!mail.hasConsent(c))return res.status(422).json({ok:false,error:'MARKETING_EMAIL_CONSENT_REQUIRED'});
   if(!mail.envStatus().ready)return res.status(503).json({ok:false,error:'MARKETING_EMAIL_PROVIDER_NOT_READY'});
   if(r.outboundEmailStatus)return res.status(409).json({ok:false,error:'EMAIL_ALREADY_ATTEMPTED_REVIEW_STATUS_BEFORE_RETRY'});
   const draft=NEXTDAY.intro(c,NEXTDAY.existingDemo(db,c));
   current=r;
   r.outboundEmailStatus='SUBMISSION_IN_PROGRESS';
   r.outboundEmailAttemptAt=now();
   // Reserve attempt DURABLY before contacting provider; never auto-retry an unknown outcome.
   try{await saveData()}catch(e){delete r.outboundEmailStatus;delete r.outboundEmailAttemptAt;throw e}
   let result;
   try{result=await mail.submit(c,draft,{taskId:r.id,tenantId:t})}
   catch(e){
    r.outboundEmailStatus='SUBMISSION_UNCONFIRMED_REVIEW_REQUIRED';
    r.outboundEmailLastError=compact(e.code||e.message||'PROVIDER_ERROR',130);
    try{await saveData()}catch(_){}
    return res.status(e.status||502).json({ok:false,error:'SEND_UNCONFIRMED_DO_NOT_RETRY_AUTOMATICALLY',
      detail:r.outboundEmailLastError});
   }
   r.outboundEmailStatus=result.status;
   r.outboundEmailProviderId=result.providerMessageId||'';
   r.outboundEmailAcceptedAt=now();
   r.notes=String(r.notes||'').replace('EMAIL NOT SENT. OWNER REVIEW REQUIRED.',
      'EMAIL ACCEPTED BY PROVIDER, DELIVERY NOT CONFIRMED.')
     .replace('DRAFT EMAIL (NOT SENT):','EMAIL CONTENT (ACCEPTED, NOT VERIFIED DELIVERED):');
   c.nextAction='Email provider accepted introduction; delivery not confirmed. Check reply and contact eligibility before calling.';
   try{await saveData()}catch(e){
    return res.status(503).json({ok:false,error:'EMAIL_ACCEPTED_BUT_CRM_PERSISTENCE_UNCONFIRMED',
     requiresManualReview:true,doNotRetry:true});
   }
   res.json({ok:true,taskId:r.id,customerId:c.id,provider:'sendgrid',
    status:r.outboundEmailStatus,providerMessageId:r.outboundEmailProviderId,
    delivered:false,requiresSignedDeliveryEvidence:true});
  }catch(e){fail(res,e)}finally{inflight.delete(key);changing=false}
 });
 // Record an email reply *after an owner actually reads it*; no inbox access is assumed.
 app.post('/api/owner/nextday/reply/:taskId',auth,ownerOnly,async(req,res)=>{
  if(changing)return res.status(409).json({ok:false,error:'OUTREACH_WRITE_BUSY'});
  changing=true;
  try{
   requireWriter();const t=getTenant(req),db=getDb(),r=task(db,t,req.params.taskId),b=req.body||{};
   if(!r)return res.status(404).json({ok:false,error:'PREPARED_CALL_TASK_NOT_FOUND'});
   const c=lead(db,t,r.customerId);
   if(!c)return res.status(404).json({ok:false,error:'CONTACT_NOT_FOUND'});
   if(b.confirm!=='OWNER_VERIFIED_REAL_REPLY'||
     !['INTERESTED','APPOINTMENT_REQUEST','NOT_INTERESTED','UNSUBSCRIBE','BOUNCE'].includes(b.kind))
    return res.status(422).json({ok:false,error:'REAL_REPLY_EVIDENCE_REQUIRED'});
   const kind=b.kind,at=now(),notes=compact(b.notes,600);
   const original={replyStatus:r.replyStatus,replyAt:r.replyAt,replyNotes:r.replyNotes,nextAction:c.nextAction};
   const previous=LEDGER.snapshot(c);
   r.replyStatus=kind;r.replyAt=at;r.replyNotes=notes;
   LEDGER.mutate(c,{lastReplyKind:kind,lastReplyAt:at});
   if(kind==='UNSUBSCRIBE'||kind==='BOUNCE'){
    LEDGER.suppress(c,{reason:'OWNER_RECORDED_'+kind,at});
   }
   if(kind==='INTERESTED')c.nextAction='Positive email reply. Respond before placing another outbound call.';
   if(kind==='APPOINTMENT_REQUEST')c.nextAction='Email appointment request received; confirm specific date/time before booking.';
   const created=[];
   if(kind==='APPOINTMENT_REQUEST'||kind==='INTERESTED'){
    const item={id:makeId('task'),tenantId:t,customerId:String(c.id),customerName:compact(c.businessName||c.contactName,140),
      title:kind==='APPOINTMENT_REQUEST'?'Appointment requested by email':'Respond to interested email prospect',
      dueAt:at,type:kind==='APPOINTMENT_REQUEST'?'SBC Appointment Request':'Email Reply',
      priority:'High',status:'Open',notes:'Manually recorded email reply from owner review. '+notes,
      assignedTo:'',assignedToName:'Owner',createdBy:String(req.user.id),createdAt:at,updatedAt:at};
    db.tasks.unshift(item);created.push(item);
   }
   try{await saveData()}catch(e){
    for(const k of ['replyStatus','replyAt','replyNotes'])r[k]=original[k];
    c.nextAction=original.nextAction;
    LEDGER.restore(c,previous);
    if(created.length)db.tasks.splice(0,created.length);
    throw e;
   }
   let alert={ok:false,skipped:true};
   if(created.length&&typeof notifyOwner==='function'){
    try{alert=await notifyOwner({subject:kind==='APPOINTMENT_REQUEST'?'SBC appointment request · '+compact(c.businessName,70):'SBC interested email reply · '+compact(c.businessName,70),
      text:'Business: '+compact(c.businessName,120)+'\nAction: '+kind+'\nNotes: '+notes+'\nOpen Command Center → Prepare Tomorrow to confirm the appointment or reply. No customer appointment has been automatically booked.'})||alert}
    catch(e){alert={ok:false,reason:'OWNER_NOTIFY_NOT_CONFIRMED'}}
   }
   res.json({ok:true,kind,taskId:r.id,ownerActionCreated:created.map(x=>x.id),
    ownerNotificationAccepted:alert.ok===true,automaticEmailProcessing:false,automaticAppointmentBooking:false});
  }catch(e){fail(res,e)}finally{changing=false}
 });

 // Signed provider delivery receipts. This is NOT an inbox or a cold-email sender.
 app.post('/api/nextday/sendgrid/events',async(req,res)=>{
  const raw=req.rawBody;
  const signature=req.get?.('x-twilio-email-event-webhook-signature')||
   req.headers?.['x-twilio-email-event-webhook-signature'];
  const timestamp=req.get?.('x-twilio-email-event-webhook-timestamp')||
   req.headers?.['x-twilio-email-event-webhook-timestamp'];
  if(!EVENTS.verified(raw,{signature,timestamp}))
   return res.status(401).json({ok:false,error:'INVALID_SIGNED_EMAIL_EVENT'});
  if(changing)return res.status(503).json({ok:false,error:'EMAIL_EVENT_RETRY_LATER'});
  changing=true;
  try{
   requireWriter();const db=getDb();
   const events=Array.isArray(req.body)?req.body:null;
   if(!events)return res.status(422).json({ok:false,error:'INVALID_EMAIL_EVENT_ARRAY'});
   const result=EVENTS.apply(db,events);
   try{if(result.changed.length)await saveData()}
   catch(e){result.undo();throw e}
   return res.json({ok:true,accepted:result.changed.length});
  }catch(e){fail(res,e)}finally{changing=false}
 });

 // Mailbox relay for info@sbcmia.com. Configure a TRUSTED server-side inbox
 // connector (e.g. Microsoft 365 flow) to sign raw JSON before posting.
 // No changes to MX/DNS; fail closed when secret or valid signature is absent.
 app.post('/api/nextday/mailbox/reply',async(req,res)=>{
  const raw=req.rawBody;
  const signature=req.get?.('x-sbc-mail-relay-signature')||
   req.headers?.['x-sbc-mail-relay-signature'];
  const timestamp=req.get?.('x-sbc-mail-relay-timestamp')||
   req.headers?.['x-sbc-mail-relay-timestamp'];
  if(!RELAY.verify(raw,{signature,timestamp}))
   return res.status(401).json({ok:false,error:'SIGNED_MAILBOX_RELAY_REQUIRED'});
  if(changing)return res.status(503).json({ok:false,error:'MAILBOX_RETRY_LATER'});
  changing=true;
  try{
   requireWriter();
   const db=getDb(),result=RELAY.apply(db,req.body,{now,makeId});
   if(result.changed){
    try{await saveData()}catch(e){result.undo?.();throw e}
    let ownerNotified=false;
    if(typeof notifyOwner==='function'){
     try{const c=(db.customers||[]).find(x=>String(x.id)===String(result.customerId));
      const notify=await notifyOwner({subject:'SBC new email reply · '+compact(c?.businessName||'Lead',80),
       text:'A new reply was received through the authenticated SBC mailbox connector.\nType: '+result.kind+
        '\nBusiness: '+compact(c?.businessName||'Lead',120)+
        '\nOpen Command Center → Prepare Tomorrow → Due work to review it. No appointment was automatically booked.'});
      ownerNotified=notify?.ok===true;
     }catch(_){}
    }
    return res.json({ok:true,accepted:1,kind:result.kind,reviewTaskId:result.reviewTaskId,
      ownerNotificationAccepted:ownerNotified});
   }
   return res.json({ok:true,duplicate:true,accepted:0});
  }catch(e){fail(res,e)}finally{changing=false}
 });
}
module.exports={register};
