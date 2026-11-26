'use strict';
// SBC Website Call Desk. A human-controlled bridge between verified research,
// full website production and sales follow-up. No dial, text, email, voice AI,
// calendar invite, payment, or vendor side effects occur in this module.
const {randomUUID}=require('node:crypto');
const {scopedLead,shouldRead,buildCachedDossier,configuredSnapshotReader}=require('./creative-intelligence/live-dossier-hydrator.cjs');
const POLICY=require('./sbc-preview-sales-policy.cjs');
const WEBSITE_PITCH=require('../public/sbc-website-sales-script-v1.js');
const OUTCOMES=new Set(['NO_ANSWER','INTERESTED','CALLBACK_REQUESTED','NOT_INTERESTED','BAD_NUMBER','DO_NOT_CALL','ALREADY_HAS_WEBSITE','APPOINTMENT_REQUESTED']);
const int=value=>{const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:0};
const tenantId=x=>int(x?.tenantId??x?.tenant_id);
function sameTenant(record,tid){
 const id=int(tid),a=int(record?.tenantId),b=int(record?.tenant_id);
 return id>0 && (a===id||b===id) && (!a||!b||a===b);
}
function accessible(customer,actor,tid){
 if(!sameTenant(actor,tid)||!sameTenant(customer,tid)||actor.active===false)return false;
 const role=String(actor.role||'');
 const assigned=String(customer.assignedTo||customer.assigned_to||'');
 return role==='owner'||role==='manager'||(['caller','account_manager'].includes(role)&&!!assigned&&assigned===String(actor.id));
}
function suppressed(c){
 return c?.doNotCall===true||c?.doNotContact===true||c?.salesSuppressed===true||c?.isSuppressed===true||
  ['dnc','do not call','do not contact','opt out','unsubscribe','lost'].includes(String(c?.status||'').trim().toLowerCase());
}
function cleanPhone(raw){
 let v=String(raw??'').trim().replace(/[\s().-]/g,'');
 if(/^\d{10}$/.test(v))v='+1'+v;
 else if(/^1\d{10}$/.test(v))v='+'+v;
 return /^\+[1-9]\d{7,14}$/.test(v)?v:'';
}
function research(c){
 const r=c?.leadIntelligence?.researchBrief;
 const v=r&&typeof r==='object'&&!Array.isArray(r)?r:{};
 const verified=['Sales Ready','Verified'].includes(String(c?.verificationStatus||''))&&c?.researchRejected!==true;
 return {verified,googleVerified:v.googleBusinessPresence==='found',
  websitePresence:['found','not_found'].includes(v.websitePresence)?v.websitePresence:'not_checked',
  ownerContactVerified:v.ownerContactVerified===true,
  googleBusinessUrl:/^https:\/\/(?:www\.)?(?:google\.com|maps\.google\.com)\//i.test(String(v.googleBusinessUrl||''))?String(v.googleBusinessUrl).slice(0,400):''};
}
function createCallScript(customer,site){
 const r=research(customer);
 const approved=site?.status==='Approved'&&site.archived!==true&&
  String(site.customerId||'')===String(customer?.id||'')&&!!String(site.slug||'');
 return WEBSITE_PITCH.build({
  businessName:customer?.businessName||'your business',
  contactName:customer?.contactName||'',
  callerName:'John',
  googleVerified:r.verified&&r.googleVerified,
  websitePresence:r.verified?r.websitePresence:'not_checked',
  approved
 });
}
function coach(){
 return {
  busy:"No worries, I know you're working. Is later today or tomorrow better for a quick 10-minute look?",
  website:"That's good to hear. I don't want to assume you don't have one. Would you be open to comparing a different design, or is your current site meeting your needs?",
  price:"Our one-page Starter starts at $199. Let me show you the concept and we can see what fits your business.",
  send:"Absolutely. I can have the private concept ready for our Zoom. We'll confirm where to send anything first.",
  notInterested:"Understood, thanks for your time. I won't keep pitching you."
 };
}
function latestSites(sites,tid){
 const by=new Map();
 for(const site of sites||[]){
  if(!sameTenant(site,tid)||site.archived===true)continue;
  const key=String(site.customerId||''),before=by.get(key);
  const stamp=Date.parse(site.updatedAt||site.createdAt||'')||0;
  const previous=Date.parse(before?.updatedAt||before?.createdAt||'')||0;
  if(!before||stamp>=previous)by.set(key,site);
 }
 return by;
}
function project({customers=[],sites=[],appointments=[],calls=[],actor,tenantId:tid,now=new Date().toISOString(),limit=100,customerId=''}={}){
 const id=int(tid);if(!sameTenant(actor,id)||!['owner','manager','caller','account_manager'].includes(String(actor.role)))throw Error('NOT_AUTHORIZED');
 const chosen=latestSites(sites,id);
 const nowMs=Date.parse(now)||Date.now();
 const rows=(customers||[]).filter(c=>accessible(c,actor,id)&&
  !['deleted','duplicate','archived'].includes(String(c.status||'').trim().toLowerCase())&&c.isTestRecord!==true&&c.test!==true&&(!customerId||String(c.id)===String(customerId))).map(c=>{
  const cId=String(c.id),s=chosen.get(cId)||null,r=research(c),phone=cleanPhone(c.phone||c.primaryPhone);
  const held=Date.parse(c.websiteSalesBadNumberUntil||'')>nowMs;
  // A confirmed website Zoom may exist before a private concept is created.
  // The appointment editor creates website demos without a websiteId; recognize
  // its explicit title without counting unrelated, expired or foreign meetings.
  const meeting=(appointments||[]).filter(a=>sameTenant(a,id)&&String(a.customerId)===cId&&
   String(a.status)==='Scheduled'&&Number.isFinite(Date.parse(a.startAt||''))&&
   Date.parse(a.endAt||a.startAt)>nowMs&&
   (/^10-minute SBC website preview$/i.test(String(a.title||'').trim())||
    (s&&a.websiteId&&String(a.websiteId)===String(s.id))))
   .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt))[0]||null;
  const last=(calls||[]).filter(x=>sameTenant(x,id)&&String(x.customerId)===cId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  let stage='READY_TO_CALL';
  if(suppressed(c)||last?.kind==='DO_NOT_CALL')stage='SUPPRESSED';
  else if(held)stage='NUMBER_COOLDOWN';
  else if(!r.verified)stage='RESEARCH_REQUIRED';
  else if(!phone)stage='CONTACT_UNVERIFIED';
  else if(last?.kind==='NOT_INTERESTED')stage='DECLINED';
  else if(meeting)stage='APPOINTMENT_BOOKED';
  else if(last?.kind==='INTERESTED'||last?.kind==='APPOINTMENT_REQUESTED')stage='INTERESTED';
  else if(!s)stage='BUILD_WEBSITE';
  else if(s.status!=='Approved')stage='REVIEW_WEBSITE';
  return {customerId:cId,businessName:String(c.businessName||c.contactName||'Business').slice(0,120),
   contactName:String(c.contactName||'').slice(0,100),phone:phone||'',industry:String(c.industry||'').slice(0,90),
   assignedTo:String(c.assignedTo||''),stage,websiteId:s?String(s.id):null,
   websiteUrl:s?.status==='Approved'&&s.slug?'/demo/'+encodeURIComponent(s.slug):'',
   websiteTier:s?.offerTier==='starter'?'starter':s?'essentials':null,
   verifiedResearch:r.verified,googleBusinessVerified:r.googleVerified,googleBusinessUrl:r.googleBusinessUrl,
   websitePresence:r.websitePresence,ownerContactVerified:r.ownerContactVerified,
   script:createCallScript(c,s),coach:coach(),lastOutcome:last?.kind||'',lastContactAt:last?.createdAt||'',
   appointmentAt:meeting?.startAt||'',callAllowed:['READY_TO_CALL','INTERESTED','BUILD_WEBSITE','REVIEW_WEBSITE'].includes(stage),
   aiVoiceOutboundEnabled:false,aiVoiceStatus:'DISABLED_UNTIL_SEPARATE_CONSENT_AND_LEGAL_REVIEW',
   cooldownUntil:held?String(c.websiteSalesBadNumberUntil):'',nextAction:{
    SUPPRESSED:'No further outreach',NUMBER_COOLDOWN:'Return number to research; do not retry before cooldown',
    RESEARCH_REQUIRED:'Return to Lorna to verify business details and website presence',
    CONTACT_UNVERIFIED:'Ask Lorna to verify a working number',BUILD_WEBSITE:'Call first. If interested, book the 10-minute Zoom, then prepare the private concept',
    REVIEW_WEBSITE:'Call first; review any draft only before a customer presentation',APPOINTMENT_BOOKED:s?.status==='Approved'?'Confirmed Zoom: rehearse the existing private preview':s?'Confirmed Zoom: review the draft before presenting it':'Confirmed Zoom: prepare the private ChatGPT website concept before the presentation',
    DECLINED:'Respect refusal and stop outreach',INTERESTED:'Book the requested 10-minute Zoom; generate the private concept afterward',READY_TO_CALL:'Human salesperson can consider a compliant manual call'
   }[stage]};
 });
 const priority=['APPOINTMENT_BOOKED','INTERESTED','READY_TO_CALL','BUILD_WEBSITE','REVIEW_WEBSITE','RESEARCH_REQUIRED','CONTACT_UNVERIFIED','NUMBER_COOLDOWN','DECLINED','SUPPRESSED'];
 rows.sort((a,b)=>priority.indexOf(a.stage)-priority.indexOf(b.stage)||a.businessName.localeCompare(b.businessName));
 const max=Math.max(1,Math.min(200,int(limit)||100));
 return {ok:true,actorRole:String(actor.role),total:rows.length,rows:rows.slice(0,max),
  summary:{readyToCall:rows.filter(x=>x.callAllowed).length,needsBuild:rows.filter(x=>x.stage==='BUILD_WEBSITE').length,
   requiresResearch:rows.filter(x=>['RESEARCH_REQUIRED','CONTACT_UNVERIFIED','NUMBER_COOLDOWN'].includes(x.stage)).length,
   awaitingReview:rows.filter(x=>x.stage==='REVIEW_WEBSITE').length,booked:rows.filter(x=>x.stage==='APPOINTMENT_BOOKED').length,
   bookedNeedsConcept:rows.filter(x=>x.stage==='APPOINTMENT_BOOKED'&&!x.websiteUrl).length,
   suppressed:rows.filter(x=>x.stage==='SUPPRESSED').length},
  safety:{autoDialEnabled:false,aiVoiceEnabled:false,description:'No automated dialing, voice calls, emails, messages, or bookings are executed from this desk.'}};
}
function recordOutcome({customer,site,actor,tenantId:tid,kind,now=new Date().toISOString()}={}){
 if(!accessible(customer,actor,tid))throw Error('NOT_AUTHORIZED');
 const type=String(kind||'').trim().toUpperCase();
 if(!OUTCOMES.has(type))throw Error('INVALID_OUTCOME');
 if(type!=='DO_NOT_CALL'&&suppressed(customer))throw Error('CONTACT_SUPPRESSED');
 const at=new Date(now);
 if(!Number.isFinite(at.valueOf()))throw Error('INVALID_TIMESTAMP');
 const patch={};
 if(type==='BAD_NUMBER')patch.websiteSalesBadNumberUntil=new Date(at.valueOf()+15*86400000).toISOString();
 if(type==='DO_NOT_CALL'){patch.doNotCall=true;patch.doNotContact=true;patch.salesSuppressed=true;}
 const record={id:'webcall_'+randomUUID(),tenantId:int(tid),customerId:String(customer.id),websiteId:site&&sameTenant(site,tid)&&String(site.customerId)===String(customer.id)?String(site.id):null,
  actorId:String(actor.id),kind:type,createdAt:at.toISOString(),outboundTriggered:false,channel:'manual_outcome_only'};
 return {kind:type,record,customerPatch:patch};
}
function register(app,{auth,requireTenant,db,getStore,saveStore,writerReady,now=()=>new Date().toISOString(),readSnapshot=configuredSnapshotReader}){
 const scope=(req,res)=>{
  let tid;try{tid=int(requireTenant(req))}catch{}
  if(!tid||!sameTenant(req.user,tid)||!['owner','manager','caller','account_manager'].includes(String(req.user?.role||''))){
   res.status(403).json({ok:false,code:'NOT_AUTHORIZED'});return 0;
  }return tid;
 };
 app.get('/api/website-production/call-desk',auth,async(req,res)=>{
  const tid=scope(req,res);if(!tid)return;
  res.setHeader('Cache-Control','private, no-store');
  try{
   const selected=typeof req.query.customerId==='string'?req.query.customerId.slice(0,120):'';
   const view=()=>project({actor:req.user,tenantId:tid,customers:db.customers||[],sites:getStore().websiteDemos||[],appointments:db.appointments||[],calls:getStore().websiteSalesCalls||[],now:now(),limit:req.query.limit||100,customerId:selected});
   let result=view();
   if(selected&&result.rows.length===1){
    const find=()=> (db.customers||[]).find(c=>String(c.id)===selected&&accessible(c,req.user,tid));
    const customer=find();let snapshot=null;
    if(customer&&shouldRead(scopedLead(customer,tid),result.rows[0])){try{snapshot=await readSnapshot('sbc:'+tid,selected);}catch{}}
    // Reproject after asynchronous cache access; never expose a reassigned lead or stale suppression state.
    result=view();const current=find();
    if(current&&result.rows.length===1){try{result.rows[0].salesDossier=buildCachedDossier(current,tid,result.rows[0],snapshot,Date.parse(now()));}catch{}}
   }
   return res.json(result);
  }
  catch{return res.status(503).json({ok:false,code:'CALL_DESK_UNAVAILABLE'})}
 });
 app.post('/api/website-production/call-desk/:customerId/outcome',auth,async(req,res)=>{
  const tid=scope(req,res);if(!tid)return;
  if(!writerReady())return res.status(423).json({ok:false,code:'CALL_DESK_WRITER_UNAVAILABLE'});
  const c=(db.customers||[]).find(x=>String(x.id)===String(req.params.customerId)&&accessible(x,req.user,tid));
  if(!c)return res.status(404).json({ok:false,code:'CUSTOMER_NOT_FOUND'});
  const m=getStore();
  const s=latestSites(m.websiteDemos||[],tid).get(String(c.id));
  let result;try{result=recordOutcome({customer:c,site:s,actor:req.user,tenantId:tid,kind:req.body?.kind,now:now()});}
  catch(e){return res.status(/NOT_AUTHORIZED|CONTACT_SUPPRESSED/.test(String(e.message))?403:400).json({ok:false,code:String(e.message)})}
  const previousCalls=Array.isArray(m.websiteSalesCalls)?m.websiteSalesCalls:[];
  const previousPatch=Object.fromEntries(Object.keys(result.customerPatch).map(key=>[key,c[key]]));
  m.websiteSalesCalls=[result.record,...previousCalls].slice(0,2000);
  Object.assign(c,result.customerPatch);
  try{
   const saved=await saveStore(m);
   if(saved?.skipped===true||saved?.ok===false||saved?.persisted===false)throw Error('CALL_OUTCOME_NOT_DURABLE');
   res.status(201).json({ok:true,record:result.record});
  }catch(e){
   for(const [key,value]of Object.entries(previousPatch)){if(value===undefined)delete c[key];else c[key]=value;}
   m.websiteSalesCalls=previousCalls;
   return res.status(503).json({ok:false,code:'CALL_OUTCOME_NOT_COMMITTED'});
  }
 });
}
module.exports={project,recordOutcome,createCallScript,register,cleanPhone,accessible,OUTCOMES};
