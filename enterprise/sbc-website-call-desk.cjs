'use strict';
// SBC Website Call Desk. A human-controlled bridge between verified research,
// full website production and sales follow-up. No dial, text, email, voice AI,
// calendar invite, payment, or vendor side effects occur in this module.
const {randomUUID}=require('node:crypto');
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
 return role==='owner'||role==='manager'||(role==='caller'&&!!customer.assignedTo&&String(customer.assignedTo)===String(actor.id));
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
  String(site.customerId||'')===String(customer?.id||'');
 return WEBSITE_PITCH.build({
  businessName:customer?.businessName||customer?.contactName||'your business',
  googleVerified:r.verified&&r.googleVerified,
  websitePresence:r.verified?r.websitePresence:'not_checked',
  approved
 });
}
function coach(){
 return {
  busy:"Absolutely. I don't want to interrupt your work. Would tomorrow at a specific time be better for a quick 10-minute look? If not, no problem.",
  website:"That's good to hear. I don't want to assume you don't have one. Would you be open to comparing a different design, or is your current site meeting your needs?",
  price:"Our basic one-page website starts at $199, and the more complete four-page option starts at $349. I can show you the exact site before you decide.",
  send:"Of course. May I send the approved website link to the email address you prefer? We'll only send it with your permission.",
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
function project({customers=[],sites=[],appointments=[],calls=[],actor,tenantId:tid,now=new Date().toISOString(),limit=100}={}){
 const id=int(tid);if(!sameTenant(actor,id)||!['owner','manager','caller'].includes(String(actor.role)))throw Error('NOT_AUTHORIZED');
 const chosen=latestSites(sites,id);
 const nowMs=Date.parse(now)||Date.now();
 const rows=(customers||[]).filter(c=>accessible(c,actor,id)&&
  !['deleted','duplicate','archived'].includes(String(c.status||'').trim().toLowerCase())&&c.isTestRecord!==true&&c.test!==true).map(c=>{
  const cId=String(c.id),s=chosen.get(cId)||null,r=research(c),phone=cleanPhone(c.phone||c.primaryPhone);
  const held=Date.parse(c.websiteSalesBadNumberUntil||'')>nowMs;
  const meeting=(appointments||[]).find(a=>sameTenant(a,id)&&String(a.customerId)===cId&&String(a.websiteId||'')===String(s?.id||'')&&String(a.status)==='Scheduled');
  const last=(calls||[]).filter(x=>sameTenant(x,id)&&String(x.customerId)===cId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  let stage='READY_TO_CALL';
  if(suppressed(c)||last?.kind==='DO_NOT_CALL')stage='SUPPRESSED';
  else if(held)stage='NUMBER_COOLDOWN';
  else if(!r.verified)stage='RESEARCH_REQUIRED';
  else if(!phone)stage='CONTACT_UNVERIFIED';
  else if(!s)stage='BUILD_WEBSITE';
  else if(s.status!=='Approved')stage='REVIEW_WEBSITE';
  else if(meeting)stage='APPOINTMENT_BOOKED';
  else if(last?.kind==='NOT_INTERESTED')stage='DECLINED';
  else if(last?.kind==='INTERESTED'||last?.kind==='APPOINTMENT_REQUESTED')stage='INTERESTED';
  return {customerId:cId,businessName:String(c.businessName||c.contactName||'Business').slice(0,120),
   contactName:String(c.contactName||'').slice(0,100),phone:phone||'',industry:String(c.industry||'').slice(0,90),
   assignedTo:String(c.assignedTo||''),stage,websiteId:s?String(s.id):null,
   websiteUrl:s?.status==='Approved'&&s.slug?'/demo/'+encodeURIComponent(s.slug):'',
   websiteTier:s?.offerTier==='starter'?'starter':s?'essentials':null,
   verifiedResearch:r.verified,googleBusinessVerified:r.googleVerified,googleBusinessUrl:r.googleBusinessUrl,
   websitePresence:r.websitePresence,ownerContactVerified:r.ownerContactVerified,
   script:createCallScript(c,s),coach:coach(),lastOutcome:last?.kind||'',lastContactAt:last?.createdAt||'',
   appointmentAt:meeting?.startAt||'',callAllowed:stage==='READY_TO_CALL'||stage==='INTERESTED',
   aiVoiceOutboundEnabled:false,aiVoiceStatus:'DISABLED_UNTIL_SEPARATE_CONSENT_AND_LEGAL_REVIEW',
   cooldownUntil:held?String(c.websiteSalesBadNumberUntil):'',nextAction:{
    SUPPRESSED:'No further outreach',NUMBER_COOLDOWN:'Return number to research; do not retry before cooldown',
    RESEARCH_REQUIRED:'Return to Lorna to verify business details and website presence',
    CONTACT_UNVERIFIED:'Ask Lorna to verify a working number',BUILD_WEBSITE:'Build a complete SBC website',
    REVIEW_WEBSITE:'Owner reviews every page before sharing',APPOINTMENT_BOOKED:'Prepare confirmed 10-minute walkthrough',
    DECLINED:'Respect refusal and stop outreach',INTERESTED:'Agree on a meeting time',READY_TO_CALL:'Human salesperson can consider a compliant manual call'
   }[stage]};
 });
 const priority=['READY_TO_CALL','INTERESTED','APPOINTMENT_BOOKED','REVIEW_WEBSITE','BUILD_WEBSITE','RESEARCH_REQUIRED','CONTACT_UNVERIFIED','NUMBER_COOLDOWN','DECLINED','SUPPRESSED'];
 rows.sort((a,b)=>priority.indexOf(a.stage)-priority.indexOf(b.stage)||a.businessName.localeCompare(b.businessName));
 const max=Math.max(1,Math.min(200,int(limit)||100));
 return {ok:true,actorRole:String(actor.role),total:rows.length,rows:rows.slice(0,max),
  summary:{readyToCall:rows.filter(x=>x.callAllowed).length,needsBuild:rows.filter(x=>x.stage==='BUILD_WEBSITE').length,
   requiresResearch:rows.filter(x=>['RESEARCH_REQUIRED','CONTACT_UNVERIFIED','NUMBER_COOLDOWN'].includes(x.stage)).length,
   awaitingReview:rows.filter(x=>x.stage==='REVIEW_WEBSITE').length,booked:rows.filter(x=>x.stage==='APPOINTMENT_BOOKED').length,
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
function register(app,{auth,requireTenant,db,getStore,saveStore,writerReady,now=()=>new Date().toISOString()}){
 const scope=(req,res)=>{
  let tid;try{tid=int(requireTenant(req))}catch{}
  if(!tid||!sameTenant(req.user,tid)||!['owner','manager','caller'].includes(String(req.user?.role||''))){
   res.status(403).json({ok:false,code:'NOT_AUTHORIZED'});return 0;
  }return tid;
 };
 app.get('/api/website-production/call-desk',auth,(req,res)=>{
  const tid=scope(req,res);if(!tid)return;
  const m=getStore();
  res.setHeader('Cache-Control','private, no-store');
  try{return res.json(project({actor:req.user,tenantId:tid,customers:db.customers||[],sites:m.websiteDemos||[],
    appointments:db.appointments||[],calls:m.websiteSalesCalls||[],now:now(),limit:req.query.limit||100}));}
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
