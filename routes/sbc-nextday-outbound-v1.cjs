'use strict';
/* SBC Next-Day Sales Prep V1.
 * Owner-reviewed planning only. Never starts automated calls, sends unsolicited
 * email, triggers Twilio, or changes payment/fulfillment state.
 * Reuses authoritative CRM + Tasks persistence and current employee assignments.
 */
const crypto=require('node:crypto');
const READINESS=require('../enterprise/v6625-lead-readiness-audit.cjs');
const MAIL=require('../enterprise/sbc-consented-outreach-email.cjs');
const MAX=20;
const emailRx=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean=(v,n=240)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
const blocked=c=>Boolean(c && (c.doNotContact===true||c.salesSuppressed===true||
 c.isSuppressed===true||c.doNotCall===true||c.emailUnsubscribed===true||
 ['dnc','do not contact','do not call','unsubscribe','opt out','lost','customer','duplicate','closed'].includes(clean(c.status,80).toLowerCase())));
const phone=v=>{let p=String(v||'').trim().replace(/[\s().-]/g,'');if(/^\d{10}$/.test(p))p='+1'+p;else if(/^1\d{10}$/.test(p))p='+'+p;return /^\+[1-9]\d{7,14}$/.test(p)?p:'';};
const validDate=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const x=new Date(v+'T12:00:00Z');return !Number.isNaN(x.getTime())&&x.toISOString().slice(0,10)===v;};
function easternCallSlot(date,hour=10){
 const probe=new Date(date+'T12:00:00Z');
 const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'})
  .formatToParts(probe).find(p=>p.type==='timeZoneName')?.value||'';
 const match=/^GMT([+-]\d{1,2})(?::(\d{2}))?$/.exec(zone);
 if(!match)throw Error('EASTERN_TIMEZONE_OFFSET_UNAVAILABLE');
 const sign=match[1].startsWith('-')?-1:1;
 const minutes=Number(match[1])*60+sign*Number(match[2]||0);
 return new Date(Date.parse(date+'T'+String(hour).padStart(2,'0')+':00:00Z')-minutes*60000).toISOString();
}

const tenantOf=v=>Number(v?.tenantId??v?.tenant_id);
function leadsFor(db,tenantId) {
 return (db.customers||[]).filter(c=>tenantOf(c)===tenantId && !blocked(c) &&
  !READINESS.suppressed(c) && READINESS.verified(c) &&
  ['warm','hot'].includes(clean(c.leadTemperature,20).toLowerCase()) &&
  !/sbc system test|sbc full-cycle test|v47 full-cycle test|do not service/i.test([c.source,c.notes].join(' ')) &&
  !/@example\.invalid$/i.test(String(c.email||'')) &&
  c.id && clean(c.businessName||c.business_name||c.contactName) && phone(c.phone));
}
function pitch(c){
 const i=clean(c.industry||c.businessCategory||c.type||'',100).toLowerCase();
 if(/auto|tire|mechanic|repair/.test(i))return 'making it easier for drivers to find your shop and request service';
 if(/barber|beauty|salon|hair|nail/.test(i))return 'helping customers find your services and contact you for appointments';
 if(/restaurant|cafe|food|bakery/.test(i))return 'helping customers find your menu, hours, and location online';
 if(/store|retail|boutique|shop/.test(i))return 'helping nearby shoppers find and contact your business';
 return 'making it easier for local customers to find and contact your business';
}
function existingDemo(db,c){
 const m=db.megaOpsStore||db.settings?.megaOps||{};
 const d=(m.websiteDemos||[]).find(x=>String(x.customerId)===String(c.id)&&x.archived!==true&&String(x.status)==='Ready'&&/^[a-z0-9-]+$/.test(String(x.slug||'')));
 return d?{ready:true,slug:d.slug,url:'/demo/'+encodeURIComponent(d.slug),generatedAt:d.updatedAt||d.createdAt||''}:null;
}
function intro(c,demo){
 const name=clean(c.businessName||c.business_name||c.contactName,100);
 const benefit=pitch(c);
 const subject='A quick idea for '+name;
 const preview=demo?.ready?'We have also prepared a sample website preview for '+name+'. If you would like to see it, reply to this email and I can send a link or show you during our call.\n\n':'';
 const text='Hello '+name+' team,\n\nMy name is Jonathan Jones, owner of Successful By Choice LLC here in Miami.\n\nWe help local businesses strengthen their professional presence, with websites, Google Business Profiles, branding, and practical business services.\n\nI wanted to introduce SBC and ask whether you would be interested in a short, no-obligation recommendation about '+benefit+'.\n\n'+preview+'I may follow up with a brief call on the next business day. If email is better, feel free to reply here.\n\nBest,\nJonathan Jones\nOwner | Successful By Choice LLC\ninfo@sbcmia.com\nhttps://sbcmia.com\n\n[Verified physical mailing address required before sending]\nTo stop receiving marketing emails from SBC, reply unsubscribe.';
 return {subject,text,benefit};
}
function item(c,db){
 const demo=existingDemo(db,c),draft=intro(c,demo);
 return {id:String(c.id),businessName:clean(c.businessName||c.business_name||c.contactName,160),
 contactName:clean(c.contactName||c.ownerName||'',120),phone:phone(c.phone),
 email:emailRx.test(clean(c.email,254))?clean(c.email,254):'',
 industry:clean(c.industry||c.businessCategory||'',100),
 source:clean(c.source||c.leadSource||'',160),assignedTo:clean(c.assignedTo||'',100),
 temperature:clean(c.leadTemperature||'',30),
 emailStatus:'DRAFT_ONLY_NO_SEND',marketingConsentVerified:MAIL.hasConsent(c),draft,demo,callOpening:'Hello, this is Jonathan Jones with Successful By Choice in Miami. I wanted to introduce SBC and see whether '+draft.benefit+' is a priority for your business.'};
}
function register(app,deps){
 const {auth,ownerOnly,getDb,saveData,requireTenant,requireWriter,makeId,now,notifyOwner}=deps;
 const get=(req)=>{const t=Number(requireTenant(req));if(!Number.isSafeInteger(t)||t<1)throw Error('TENANT_REQUIRED');return t;};
 const fail=(res,e)=>res.status(e.status||503).json({ok:false,error:clean(e.code||e.message||'UNAVAILABLE',150)});
 app.get('/api/owner/nextday/preview',auth,ownerOnly,(req,res)=>{
  try{
   const t=get(req),db=getDb(),n=Math.min(MAX,Math.max(1,Number(req.query.limit)||10));
   const eligible=leadsFor(db,t),existing=new Set((db.tasks||[]).filter(x=>x.type==='SBC Next-Day Call'&&x.status!=='Completed').map(x=>String(x.customerId)));
   const rows=eligible.filter(x=>!existing.has(String(x.id))).slice(0,n).map(c=>item(c,db));
   const callers=(db.users||[]).filter(u=>tenantOf(u)===t&&u.active!==false&&u.role==='caller')
    .map(u=>({id:String(u.id),name:clean(u.name||u.username,100)}));
   res.setHeader('Cache-Control','no-store');
   res.json({ok:true,mode:'OWNER_REVIEW_NO_AUTOMATIC_EMAIL',available:eligible.length,
    leadReadiness:READINESS.inspect(db.customers||[],t,{limit:20}),
    candidates:rows,callers,maxBatch:MAX,sender:'info@sbcmia.com'});
  }catch(e){fail(res,e);}
 });
 app.get('/api/owner/nextday/queue',auth,ownerOnly,(req,res)=>{
  try{
   const t=get(req),db=getDb();
   const crm=new Map((db.customers||[]).filter(c=>tenantOf(c)===t).map(c=>[String(c.id),c]));
   const records=(db.tasks||[]).filter(x=>x.type==='SBC Next-Day Call'&&tenantOf(x)===t)
    .slice(0,100).map(x=>({id:x.id,customerId:x.customerId,customerName:x.customerName,
    assignedTo:x.assignedTo,assignedToName:x.assignedToName,dueAt:x.dueAt,status:x.status,
    notes:x.notes,createdAt:x.createdAt,marketingConsentVerified:MAIL.hasConsent(crm.get(String(x.customerId))),
    outboundEmailStatus:x.outboundEmailStatus||'DRAFT_ONLY',replyStatus:x.replyStatus||''}));
   res.setHeader('Cache-Control','no-store');res.json({ok:true,records});
  }catch(e){fail(res,e);}
 });
 let saving=false;
 app.post('/api/owner/nextday/prepare',auth,ownerOnly,async(req,res)=>{
  if(saving)return res.status(409).json({ok:false,error:'PREPARATION_IN_PROGRESS'});
  saving=true;
  try{
   requireWriter();
   const t=get(req),db=getDb(),b=req.body||{},ids=Array.isArray(b.leadIds)?b.leadIds.map(String):[];
   if(b.confirm!=='OWNER_REVIEWED_PREP' || ids.length<1 || ids.length>MAX || new Set(ids).size!==ids.length)
     return res.status(422).json({ok:false,error:'OWNER_REVIEW_OR_BATCH_INVALID'});
   const date=clean(b.callDate,10);
   const dateParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
   const dm=Object.fromEntries(dateParts.map(p=>[p.type,p.value]));
   const dayNow=dm.year+'-'+dm.month+'-'+dm.day;
   if(!validDate(date)||date<=dayNow||Date.parse(date+'T12:00:00Z')-Date.parse(dayNow+'T12:00:00Z')>10*86400000)
     return res.status(422).json({ok:false,error:'NEXT_10_DAYS_DATE_REQUIRED'});
   const callerId=clean(b.assignedTo||'',100);
   const caller=callerId?(db.users||[]).find(u=>String(u.id)===callerId&&tenantOf(u)===t&&u.active!==false&&u.role==='caller'):null;
   if(callerId&&!caller)return res.status(422).json({ok:false,error:'ACTIVE_CALLER_REQUIRED'});
   const approved=leadsFor(db,t),allowed=new Map(approved.map(c=>[String(c.id),c]));
   const selected=ids.map(i=>allowed.get(i));
   if(selected.some(x=>!x))return res.status(422).json({ok:false,error:'LEAD_NOT_ELIGIBLE_OR_SUPPRESSED'});
   if(caller&&selected.some(c=>c.assignedTo&&String(c.assignedTo)!==callerId))
     return res.status(409).json({ok:false,error:'SOME_LEADS_ASSIGNED_TO_ANOTHER_CALLER'});
   const newRecords=[],changed=[];
   for(const c of selected){
    if((db.tasks||[]).some(q=>q.type==='SBC Next-Day Call'&&String(q.customerId)===String(c.id)&&
      String(q.dueAt||'').slice(0,10)===date&&q.status!=='Completed'))continue;
    const demo=existingDemo(db,c),d=intro(c,demo),id=makeId('task'),ts=now();
    // Draft text lives in existing persisted task.notes, no second data store or migration.
    const notes='EMAIL NOT SENT. OWNER REVIEW REQUIRED.\nEmail: '+clean(c.email,254)+
      '\nLead source: '+clean(c.source||'',160)+'\nDemo link (preview only): '+(demo?.url||'None verified')+'\n\nSUBJECT:\n'+d.subject+
      '\n\nDRAFT EMAIL (NOT SENT):\n'+d.text+
      '\n\nCALL OPENING:\nHello, this is Jonathan Jones with Successful By Choice here in Miami. I wanted to introduce SBC and see whether '+d.benefit+' is relevant to your business.\n\nCheck DNC, consent, local time and latest replies before dialing.';
    const task={id,tenantId:t,customerId:String(c.id),customerName:clean(c.businessName||c.business_name||c.contactName,160),
      title:'Next-Day Outbound · '+clean(c.businessName||c.business_name||c.contactName,120),
      dueAt:easternCallSlot(date),type:'SBC Next-Day Call',priority:'Normal',status:'Open',
      assignedTo:caller?.id||'',assignedToName:caller?.name||'Owner review',createdBy:req.user.id,
      notes,createdAt:ts,updatedAt:ts};
    const old={assignedTo:c.assignedTo,nextAction:c.nextAction,followUpAt:c.followUpAt,followUp:c.followUp,websiteDemoUrl:c.websiteDemoUrl};
    changed.push({c,old});
    if(caller)c.assignedTo=caller.id;
    c.nextAction='Next-day outbound call planned '+date+'; introductory email DRAFT ONLY (not sent). Review CRM and contact restrictions.';
    c.followUpAt=date;
    c.followUp=date;
    if(demo?.ready)c.websiteDemoUrl=demo.url;
    newRecords.push(task);
   }
   db.tasks=Array.isArray(db.tasks)?db.tasks:[];
   db.tasks.unshift(...newRecords);
   try{if(newRecords.length)await saveData();}
   catch(e){db.tasks.splice(0,newRecords.length);for(const x of changed)Object.assign(x.c,x.old);throw e;}
   res.json({ok:true,created:newRecords.length,skipped:ids.length-newRecords.length,
     records:newRecords.map(x=>({id:x.id,customerName:x.customerName,assignedTo:x.assignedTo,dueAt:x.dueAt})),
     emailSent:0,externalCalls:0,note:'Drafts and call tasks saved. No emails or calls sent.'});
  }catch(e){fail(res,e);}finally{saving=false;}
 });

 // Owner's due-first view: existing appointments, scheduled follow-ups, and
 // explicitly requested appointments from structured caller reports.
 // No free-text classification, no outbound notifications and no auto-booking.
 app.get('/api/owner/nextday/priorities',auth,ownerOnly,(req,res)=>{
  try{
   const t=get(req),db=getDb(),nowMs=Date.now();
   const contacts=new Map((db.customers||[]).filter(c=>tenantOf(c)===t).map(c=>[String(c.id),c]));
   const belongs=(customerId,tenantId)=>tenantId===t||contacts.has(String(customerId));
   const records=[];
   const bookedContacts=new Set((db.appointments||[]).filter(a=>
    belongs(a.customerId,tenantOf(a))&&!['cancelled','canceled'].includes(clean(a.status,50).toLowerCase()))
    .map(a=>String(a.customerId)));
   for(const a of db.appointments||[]){
    if(!belongs(a.customerId,tenantOf(a)))continue;
    if(['cancelled','canceled','completed'].includes(clean(a.status,50).toLowerCase()))continue;
    const at=Date.parse(a.startAt||'');if(!Number.isFinite(at))continue;
    records.push({kind:'APPOINTMENT',id:String(a.id),customerId:String(a.customerId||''),
     businessName:clean(a.customerName||contacts.get(String(a.customerId))?.businessName||'Appointment',140),
     dueAt:new Date(at).toISOString(),description:clean(a.title,200),status:clean(a.status,50)||'Scheduled'});
   }
   for(const task of db.tasks||[]){
    if(!belongs(task.customerId,tenantOf(task)))continue;
    if(task.type==='SBC Appointment Request'&&bookedContacts.has(String(task.customerId)))continue;
    if(['completed','cancelled','canceled'].includes(clean(task.status,50).toLowerCase()))continue;
    const at=Date.parse(task.dueAt||'');if(!Number.isFinite(at))continue;
    records.push({kind:task.type==='SBC Appointment Request'?'APPOINTMENT_REQUEST':
     /appointment/i.test(String(task.type||''))?'APPOINTMENT_REMINDER':'FOLLOW_UP',
     id:String(task.id),customerId:String(task.customerId||''),
     businessName:clean(task.customerName||contacts.get(String(task.customerId))?.businessName||'Lead',140),
     dueAt:new Date(at).toISOString(),description:clean(task.title,200),status:clean(task.status,50)||'Open'});
   }
   const appointmentContacts=bookedContacts;
   for(const r of (db.callReports||[]).slice(0,500)){
    if(r.appointmentRequested!==true||appointmentContacts.has(String(r.customerId))||!contacts.has(String(r.customerId)))continue;
    records.push({kind:'APPOINTMENT_REQUEST',id:String(r.id),customerId:String(r.customerId),
     businessName:clean(contacts.get(String(r.customerId)).businessName||'',140),
     dueAt:new Date(r.createdAt||Date.now()).toISOString(),
     description:'Confirm the requested appointment time with the customer',status:'Needs owner scheduling'});
   }
   records.sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt)||
    String(a.kind).localeCompare(String(b.kind)));
   res.setHeader('Cache-Control','no-store');
   res.json({ok:true,records:records.slice(0,100),
    dueCount:records.filter(r=>Date.parse(r.dueAt)<=nowMs).length,
    appointmentRequests:records.filter(r=>r.kind==='APPOINTMENT_REQUEST').length,
    note:'Owner in-app due list; no external notifications or invitations were sent.'});
  }catch(e){fail(res,e)}
 });
 // A structured appointment request does not equal a confirmed booking.
 // Owner may schedule only after confirming the specific time with the customer.
 app.post('/api/owner/nextday/appointment',auth,ownerOnly,async(req,res)=>{
  if(saving)return res.status(409).json({ok:false,error:'APPOINTMENT_WRITE_IN_PROGRESS'});
  saving=true;
  try{
   requireWriter();
   const t=get(req),db=getDb(),b=req.body||{};
   const c=(db.customers||[]).find(x=>String(x.id)===String(b.customerId||'')&&tenantOf(x)===t);
   const raw=String(b.startAt||''),at=Date.parse(raw);
   if(!c||b.customerConfirmed!==true||!Number.isFinite(at)||at<=Date.now()||at>Date.now()+366*86400000)
    return res.status(422).json({ok:false,error:'CONFIRMED_CUSTOMER_AND_FUTURE_TIME_REQUIRED'});
   if(!/(Z|[+-]\d{2}:\d{2})$/i.test(raw))
    return res.status(422).json({ok:false,error:'TIMEZONE_OFFSET_REQUIRED'});
   const title=clean(b.title||'SBC business consultation',160),startAt=new Date(at).toISOString();
   if((db.appointments||[]).some(a=>String(a.customerId)===String(c.id)&&
      String(a.startAt)===startAt&&!['cancelled','canceled'].includes(clean(a.status,50).toLowerCase())))
     return res.status(409).json({ok:false,error:'APPOINTMENT_ALREADY_EXISTS'});
   const nowTs=now();
   const appt={id:makeId('appt'),tenantId:t,customerId:String(c.id),
    customerName:clean(c.businessName||c.contactName,140),title,startAt,
    endAt:'',location:clean(b.location||'Phone / online',140),
    notes:'Owner confirmed time with customer. Prepared from SBC Next-Day Sales Prep.',
    status:'Scheduled',createdAt:nowTs,updatedAt:nowTs};
   const task={id:makeId('task'),tenantId:t,customerId:String(c.id),
    customerName:appt.customerName,title:'Appointment reminder · '+title,
    dueAt:startAt,type:'Appointment Reminder',priority:'High',status:'Open',notes:'SBC appointment '+appt.id+
    '. Check customer confirmation and preparation before meeting.',
    assignedTo:'',assignedToName:'Owner',createdBy:String(req.user.id),
    createdAt:nowTs,updatedAt:nowTs};
   if(!Array.isArray(db.appointments))db.appointments=[];
   if(!Array.isArray(db.tasks))db.tasks=[];
   db.appointments.unshift(appt);db.tasks.unshift(task);
   try{await saveData();}catch(e){db.appointments.shift();db.tasks.shift();throw e;}
   let alert={ok:false,skipped:true};
   if(typeof notifyOwner==='function'){
    try{alert=await notifyOwner({subject:'SBC appointment confirmed · '+appt.customerName,
      text:'Appointment: '+appt.title+'\nBusiness: '+appt.customerName+'\nTime (UTC): '+appt.startAt+'\nLocation: '+appt.location+'\nOpen Command Center to view your due-sorted reminders.\nSBC appointment ID: '+appt.id})||alert}
    catch(e){alert={ok:false,reason:'OWNER_NOTIFY_NOT_CONFIRMED'}}
   }
   res.status(201).json({ok:true,appointment:{id:appt.id,customerId:appt.customerId,
    customerName:appt.customerName,startAt:appt.startAt,title:appt.title},
    reminderTaskId:task.id,ownerNotificationAccepted:alert.ok===true,ownerNotificationStatus:alert.ok===true?'ACCEPTED':alert.reason||'NOT_CONFIGURED'});
  }catch(e){fail(res,e)}finally{saving=false;}
 });
}
module.exports={register,blocked,phone,leadsFor,intro,item,existingDemo,easternCallSlot};
