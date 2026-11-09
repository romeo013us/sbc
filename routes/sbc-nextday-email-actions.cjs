'use strict';
/* SBC outreach actions: owner-only consent evidence, approved email submission,
 * and manual reply/opt-out triage. Never synthesizes inbound email events.
 * No unconsented cold email, new customers, automated calls or appointments.
 */
const MAIL=require('../enterprise/sbc-consented-outreach-email.cjs');
const READINESS=require('../enterprise/v6625-lead-readiness-audit.cjs');
const NEXTDAY=require('./sbc-nextday-outbound-v1.cjs');
const compact=(v,n=500)=>String(v??'').trim().slice(0,n);
const tenantOf=v=>Number(v?.tenantId??v?.tenant_id);
function register(app,{auth,ownerOnly,getDb,saveData,requireTenant,requireWriter,
 makeId=p=>p+'_'+Date.now().toString(36),now=()=>new Date().toISOString(),
 mail=MAIL}={}){
 const getTenant=req=>{const t=Number(requireTenant(req));if(!Number.isSafeInteger(t)||t<1)throw Object.assign(Error('TENANT_REQUIRED'),{status:403});return t};
 const fail=(res,e)=>res.status(e.status||503).json({ok:false,error:compact(e.code||e.message||'REQUEST_FAILED',130)});
 function lead(db,t,id){return (db.customers||[]).find(c=>String(c.id)===String(id)&&tenantOf(c)===t)||null;}
 function task(db,t,id){return (db.tasks||[]).find(x=>String(x.id)===String(id)&&tenantOf(x)===t&&x.type==='SBC Next-Day Call')||null;}
 function status(db,t){
  const s=mail.envStatus();
  const eligible=NEXTDAY.leadsFor(db,t);
  return {...s,optedIn:eligible.filter(mail.hasConsent).length,
   availableVerifiedLeads:eligible.length,autoSendEnabled:false,replyIntegration:'MANUAL_RECORD_ONLY',
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
   const previous={marketingEmailConsent:c.marketingEmailConsent,
    marketingEmailConsentAt:c.marketingEmailConsentAt,
    marketingEmailConsentSource:c.marketingEmailConsentSource};
   c.marketingEmailConsent=true;c.marketingEmailConsentAt=new Date(date).toISOString();
   c.marketingEmailConsentSource=method+': '+source;
   try{await saveData()}catch(e){Object.assign(c,previous);throw e}
   res.json({ok:true,customerId:c.id,consentRecorded:true,
    evidenceAt:c.marketingEmailConsentAt,source:c.marketingEmailConsentSource,
    note:'Consent proof recorded from owner attestation; not independently verified by the email provider.'});
  }catch(e){fail(res,e)}finally{changing=false}
 });
 app.post('/api/owner/nextday/optout/:customerId',auth,ownerOnly,async(req,res)=>{
  if(changing)return res.status(409).json({ok:false,error:'OUTREACH_WRITE_BUSY'});
  changing=true;
  try{
   requireWriter();const t=getTenant(req),db=getDb(),c=lead(db,t,req.params.customerId);
   if(!c)return res.status(404).json({ok:false,error:'CONTACT_NOT_FOUND'});
   const previous={marketingEmailOptOut:c.marketingEmailOptOut,
    emailUnsubscribed:c.emailUnsubscribed,marketingEmailConsent:c.marketingEmailConsent};
   c.marketingEmailOptOut=true;c.emailUnsubscribed=true;c.marketingEmailConsent=false;
   try{await saveData()}catch(e){Object.assign(c,previous);throw e}
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
   changing=false;
   let result;
   try{result=await mail.submit(c,draft)}
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
   const original={replyStatus:r.replyStatus,replyAt:r.replyAt,replyNotes:r.replyNotes,
    emailUnsubscribed:c.emailUnsubscribed,marketingEmailOptOut:c.marketingEmailOptOut,
    marketingEmailConsent:c.marketingEmailConsent,nextAction:c.nextAction};
   r.replyStatus=kind;r.replyAt=at;r.replyNotes=notes;
   if(kind==='UNSUBSCRIBE'||kind==='BOUNCE'){
    c.emailUnsubscribed=true;c.marketingEmailOptOut=true;c.marketingEmailConsent=false;
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
    for(const [k,v]of Object.entries(original)){if(k in r)r[k]=v;else c[k]=v}
    if(created.length)db.tasks.splice(0,created.length);
    throw e;
   }
   res.json({ok:true,kind,taskId:r.id,ownerActionCreated:created.map(x=>x.id),
    automaticEmailProcessing:false,automaticAppointmentBooking:false});
  }catch(e){fail(res,e)}finally{changing=false}
 });
}
module.exports={register};
