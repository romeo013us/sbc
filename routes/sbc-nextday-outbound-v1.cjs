'use strict';
/* SBC Next-Day Sales Prep V1.
 * Owner-reviewed planning only. Never starts automated calls, sends unsolicited
 * email, triggers Twilio, or changes payment/fulfillment state.
 * Reuses authoritative CRM + Tasks persistence and current employee assignments.
 */
const crypto=require('node:crypto');
const MAX=20;
const emailRx=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean=(v,n=240)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
const blocked=c=>Boolean(c && (c.doNotContact===true||c.salesSuppressed===true||
 c.isSuppressed===true||c.doNotCall===true||c.emailUnsubscribed===true||
 ['dnc','do not contact','do not call','unsubscribe','opt out','lost','customer','duplicate','closed'].includes(clean(c.status,80).toLowerCase())));
const phone=v=>{let p=String(v||'').trim().replace(/[\s().-]/g,'');if(/^\d{10}$/.test(p))p='+1'+p;else if(/^1\d{10}$/.test(p))p='+'+p;return /^\+[1-9]\d{7,14}$/.test(p)?p:'';};
const validDate=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const x=new Date(v+'T12:00:00Z');return !Number.isNaN(x.getTime())&&x.toISOString().slice(0,10)===v;};
const tenantOf=v=>Number(v?.tenantId??v?.tenant_id);
function leadsFor(db,tenantId) {
 return (db.customers||[]).filter(c=>tenantOf(c)===tenantId && !blocked(c) &&
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
function intro(c){
 const name=clean(c.businessName||c.business_name||c.contactName,100);
 const benefit=pitch(c);
 const subject='A quick idea for '+name;
 const text='Hello '+name+' team,\n\nMy name is Jonathan Jones, owner of Successful By Choice LLC here in Miami.\n\nWe help local businesses strengthen their professional presence, with websites, Google Business Profiles, branding, and practical business services.\n\nI wanted to introduce SBC and ask whether you would be interested in a short, no-obligation recommendation about '+benefit+'.\n\nI may follow up with a brief call on the next business day. If email is better, feel free to reply here.\n\nBest,\nJonathan Jones\nOwner | Successful By Choice LLC\ninfo@sbcmia.com\nhttps://sbcmia.com\n\n[Verified physical mailing address required before sending]\nTo stop receiving marketing emails from SBC, reply unsubscribe.';
 return {subject,text,benefit};
}
function item(c){
 const draft=intro(c);
 return {id:String(c.id),businessName:clean(c.businessName||c.business_name||c.contactName,160),
 contactName:clean(c.contactName||c.ownerName||'',120),phone:phone(c.phone),
 email:emailRx.test(clean(c.email,254))?clean(c.email,254):'',
 industry:clean(c.industry||c.businessCategory||'',100),
 source:clean(c.source||c.leadSource||'',160),assignedTo:clean(c.assignedTo||'',100),
 temperature:clean(c.leadTemperature||'',30),
 emailStatus:'DRAFT_ONLY_NO_SEND',draft,callOpening:'Hello, this is Jonathan Jones with Successful By Choice in Miami. I wanted to introduce SBC and see whether '+draft.benefit+' is a priority for your business.'};
}
function register(app,deps){
 const {auth,ownerOnly,getDb,saveData,requireTenant,requireWriter,makeId,now}=deps;
 const get=(req)=>{const t=Number(requireTenant(req));if(!Number.isSafeInteger(t)||t<1)throw Error('TENANT_REQUIRED');return t;};
 const fail=(res,e)=>res.status(e.status||503).json({ok:false,error:clean(e.code||e.message||'UNAVAILABLE',150)});
 app.get('/api/owner/nextday/preview',auth,ownerOnly,(req,res)=>{
  try{
   const t=get(req),db=getDb(),n=Math.min(MAX,Math.max(1,Number(req.query.limit)||10));
   const eligible=leadsFor(db,t),existing=new Set((db.tasks||[]).filter(x=>x.type==='SBC Next-Day Call'&&x.status!=='Completed').map(x=>String(x.customerId)));
   const rows=eligible.filter(x=>!existing.has(String(x.id))).slice(0,n).map(item);
   const callers=(db.users||[]).filter(u=>tenantOf(u)===t&&u.active!==false&&u.role==='caller')
    .map(u=>({id:String(u.id),name:clean(u.name||u.username,100)}));
   res.setHeader('Cache-Control','no-store');
   res.json({ok:true,mode:'OWNER_REVIEW_NO_AUTOMATIC_EMAIL',available:eligible.length,candidates:rows,callers,maxBatch:MAX,sender:'info@sbcmia.com'});
  }catch(e){fail(res,e);}
 });
 app.get('/api/owner/nextday/queue',auth,ownerOnly,(req,res)=>{
  try{
   const t=get(req),db=getDb();
   const records=(db.tasks||[]).filter(x=>x.type==='SBC Next-Day Call'&&tenantOf(x)===t)
    .slice(0,100).map(x=>({id:x.id,customerId:x.customerId,customerName:x.customerName,
    assignedTo:x.assignedTo,assignedToName:x.assignedToName,dueAt:x.dueAt,status:x.status,
    notes:x.notes,createdAt:x.createdAt}));
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
    const d=intro(c),id=makeId('task'),ts=now();
    // Draft text lives in existing persisted task.notes, no second data store or migration.
    const notes='EMAIL NOT SENT. OWNER REVIEW REQUIRED.\nEmail: '+clean(c.email,254)+
      '\nLead source: '+clean(c.source||'',160)+'\n\nSUBJECT:\n'+d.subject+
      '\n\nDRAFT EMAIL (NOT SENT):\n'+d.text+
      '\n\nCALL OPENING:\nHello, this is Jonathan Jones with Successful By Choice here in Miami. I wanted to introduce SBC and see whether '+d.benefit+' is relevant to your business.\n\nCheck DNC, consent, local time and latest replies before dialing.';
    const task={id,tenantId:t,customerId:String(c.id),customerName:clean(c.businessName||c.business_name||c.contactName,160),
      title:'Next-Day Outbound · '+clean(c.businessName||c.business_name||c.contactName,120),
      dueAt:date+'T10:00:00',type:'SBC Next-Day Call',priority:'Normal',status:'Open',
      assignedTo:caller?.id||'',assignedToName:caller?.name||'Owner review',createdBy:req.user.id,
      notes,createdAt:ts,updatedAt:ts};
    const old={assignedTo:c.assignedTo,nextAction:c.nextAction,followUpAt:c.followUpAt};
    changed.push({c,old});
    if(caller)c.assignedTo=caller.id;
    c.nextAction='Next-day outbound call planned '+date+'; introductory email DRAFT ONLY (not sent). Review CRM and contact restrictions.';
    c.followUpAt=date;
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
}
module.exports={register,blocked,phone,leadsFor,intro,item};
