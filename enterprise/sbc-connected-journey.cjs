'use strict';
// Journey state uses the existing MySQL customer JSON, workspace tasks and order JSON.
// Public inquiries are requests, never proof of identity, consent, booking or payment.
const {createHash}=require('node:crypto');
const {accessible,sameTenant,suppressed}=require('./sbc-sales-p0p1.cjs');
const REVENUE_TRUTH=require('./sbc-revenue-reporting-truth-v66142.cjs');
const REVENUE_GATE=require('./v56134-god-tier-revenue.js');
const SERVICES=new Set(['website-design','domains-hosting','business-email','google-business-visibility','social-media-setup','business-cards','flyers-marketing','led-neon-signs','ongoing-business-support','office-box','individual-web-products','florida-notary','business-launch']);
const PACKAGES={starter:'Business Starter',custom:'Business Custom',advanced:'Business Advanced',growth:'Business Growth',visibility:'Business Visibility',platform:'Custom Business Platform'};
const PLAYS={
 website:['intake','build','qa','approval','release','delivery'],
 print:['intake','build','qa','approval','release','delivery'],
 service:['intake','build','qa','approval','release','delivery']
};
const LABELS={intake:'Confirm requirements and authorized materials',build:'Prepare work and customer proof',qa:'Complete quality checks',approval:'Customer approval',release:'Owner release approval',delivery:'Deliver and confirm handoff'};
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const clone=v=>JSON.parse(JSON.stringify(v));
const {undo}=require('./sbc-owned-state-rollback.cjs');
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const fail=(code,status=400)=>{throw Object.assign(Error(code),{code,status})};
const getState=c=>c?.leadIntelligence?.customerJourney||{version:1,inquiries:[],events:[],consents:{},reminders:[]};
function editState(c){if(!c.leadIntelligence?.customerJourney)c.leadIntelligence={...(c.leadIntelligence||{}),customerJourney:clone(getState(c))};return c.leadIntelligence.customerJourney;}
function parsed(o){try{return o?.notes?.trim().startsWith('{')?JSON.parse(o.notes):{}}catch{return {}}}
function writePlan(o,plan,at){o.notes=JSON.stringify({...parsed(o),customerJourney:plan});o.updatedAt=at;}
function safeUrl(value){try{const u=new URL(text(value,1500));return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
function sourcePage(value){
 try{const u=new URL(text(value,500));if(u.origin!=='https://sbcmia.com')return 'https://sbcmia.com/contact.php';
 const out=new URL('https://sbcmia.com/contact.php');
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','first_utm_source']){const v=u.searchParams.get(key)||'';if(/^[a-z0-9][a-z0-9_-]{0,63}$/.test(v))out.searchParams.set(key,v)}return out.href;
 }catch{return 'https://sbcmia.com/contact.php'}
}
function normalize(b){
 const serviceSlug=SERVICES.has(b.serviceSlug)?b.serviceSlug:'';
 const packageId=Object.hasOwn(PACKAGES,b.packageId)?b.packageId:Object.keys(PACKAGES).find(k=>PACKAGES[k]===b.packageName)||'';
 const requestId=text(b.requestId,100);if(requestId&&!/^[A-Za-z0-9_-]{20,100}$/.test(requestId))fail('INVALID_INQUIRY_KEY');
 const intent=b.intent||'information';if(!['information','callback','quote','checkout'].includes(intent))fail('INVALID_INTENT');
 const timeZone=text(b.timeZone,80)||'America/New_York';try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INVALID_TIMEZONE')}
 const out={requestId,businessName:text(b.businessName||b.company||b.business,180),contactName:text(b.contactName||b.name,140),
 email:text(b.email,180).toLowerCase(),phone:text(b.phone,40),message:text(b.message||b.notes,3000),
 serviceSlug,serviceInterest:text(b.serviceInterest||b.service,160),packageId,intent,
 preferredWindow:text(b.preferredWindow,160),timeZone,sourcePage:sourcePage(b.sourcePage),privacyAcknowledged:b.privacyAcknowledged===true};
 if(!out.businessName&&!out.contactName)fail('NAME_REQUIRED');
 if(out.email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email))fail('INVALID_EMAIL');
 if(out.phone&&!/^[+()0-9 .-]{7,40}$/.test(out.phone))fail('INVALID_PHONE');
 if(!out.phone&&!out.email)fail('CONTACT_REQUIRED');
 if(out.intent==='callback'&&!out.preferredWindow)fail('CALLBACK_WINDOW_REQUIRED');
 return out;
}
const phone=v=>{const n=String(v||'').replace(/\D/g,'');return n.length===10?'1'+n:n};
function contactMatch(customers,b,tid){
 const rows=customers.filter(c=>sameTenant(c,tid)&&!['Deleted','Duplicate','Archived'].includes(c.status));
 const hits=rows.filter(c=>(b.email&&text(c.email).toLowerCase()===b.email)||(phone(b.phone)&&phone(c.phone)===phone(b.phone)));
 // Conflicting shared phone/email records require staff review; never guess which account.
 return hits.length===1?hits[0]:null;
}
function active(u,tid){return u&&u.active!==false&&sameTenant(u,tid)&&(!u.expiresAt||(Number.isFinite(Date.parse(u.expiresAt))&&Date.parse(u.expiresAt)>Date.now()));}
function createService({db,id,now=()=>new Date().toISOString(),save,writerReady=()=>false,confirmInquiry}={}){
 const publicOrigin=String(process.env.SBC_WEBSITE_PUBLIC_ORIGIN||'https://sbcmia.com');
 if(!/^https:\/\/(?:[a-z0-9][a-z0-9-]{0,62}\.)?sbcmia\.com$/.test(publicOrigin))throw Error('INVALID_SBC_WEBSITE_PUBLIC_ORIGIN');
 let tail=Promise.resolve();
 const serialize=work=>{const pending=tail.then(work);tail=pending.catch(()=>{});return pending};
 const ensureWriter=()=>{if(!writerReady())fail('WRITER_UNAVAILABLE',423)};
 const commit=async()=>{const r=await save();if(r?.skipped===true||r?.ok===false||r?.persisted===false)fail('JOURNEY_NOT_COMMITTED',503)};
 const transaction=(work,keys=['customers','tasks','activities','orders','appointments'],verify)=>serialize(async()=>{
  ensureWriter();const old=Object.fromEntries(keys.map(k=>[k,clone(db[k]||[])]));let committed=false,changed;
  try{const result=work();if(result&&typeof result.then==='function')fail('JOURNEY_SYNC_MUTATION_REQUIRED',500);changed=Object.fromEntries(keys.map(k=>[k,clone(db[k]||[])]));await commit();committed=true;if(verify)await verify(result);return result}catch(e){if(!committed)for(const [k,v] of Object.entries(old))db[k]=undo(v,changed?changed[k]:clone(db[k]||[]),db[k]||[]);throw e.status?e:Object.assign(Error('JOURNEY_NOT_COMMITTED'),{status:503})}
 });
 function ownerFor(c){
  const tid=c.tenantId;
  const assigned=(db.users||[]).find(u=>String(u.id)===String(c.assignedTo)&&['owner','account_manager'].includes(u.role)&&active(u,tid));
  return assigned||(db.users||[]).find(u=>u.role==='owner'&&active(u,tid))||null;
 }
 function account(cid,actor,tid){
  if(!active(actor,tid)||!['owner','account_manager'].includes(actor.role))fail('NOT_AUTHORIZED',403);
  const c=(db.customers||[]).find(c=>String(c.id)===String(cid)&&accessible(c,actor,tid));if(!c)fail('ACCOUNT_NOT_FOUND',404);return c;
 }
 function event(c,type,meta={}){const state=editState(c);state.events=(state.events||[]).concat([{id:id('je'),type,at:now(),...meta}]).slice(-1000);c.updatedAt=now()}
 function task(c,title,key,notes=''){
  const assigned=ownerFor(c);if(!assigned)fail('TENANT_OWNER_REQUIRED',503);
  db.tasks=db.tasks||[];
  let t=db.tasks.find(t=>sameTenant(t,c.tenantId)&&t.journeyTaskKey===key&&t.status!=='Completed');
  if(!t){t={id:id('task'),tenantId:Number(c.tenantId),customerId:c.id,customerName:c.businessName||c.contactName,
   journeyTaskKey:key,type:'Customer Journey',priority:'High',status:'Open',createdBy:'sbc-customer-journey',createdAt:now()};db.tasks.unshift(t)}
  Object.assign(t,{title,notes,assignedTo:assigned.id,assignedToName:assigned.name||assigned.username||assigned.role,dueAt:now(),updatedAt:now()});return t;
 }
 async function intake(tid,body){let proof;return transaction(()=>{
  if(!Number.isSafeInteger(Number(tid))||Number(tid)<=0)fail('TENANT_CONTEXT_REQUIRED',403);
  const b=normalize(body||{}),fingerprint=hash(b);
  if(b.requestId){for(const c of db.customers||[]){if(!sameTenant(c,tid))continue;const prev=(getState(c).inquiries||[]).find(x=>x.requestId===b.requestId);
   if(prev){if(prev.fingerprint!==fingerprint)fail('INQUIRY_KEY_CONFLICT',409);proof={customerId:c.id,activityId:prev.activityId};return {ok:true,accepted:true,durable:true,id:prev.id}}}}
  let c=contactMatch(db.customers||[],b,tid);
  if(!c){c={id:id('cust'),tenantId:Number(tid),businessName:b.businessName,contactName:b.contactName,email:b.email,phone:b.phone,
   status:'Lead',source:'sbcmia.com',verificationStatus:'Needs Verification',createdAt:now(),updatedAt:now(),leadIntelligence:{verificationStatus:'Needs Verification'}};
   const owner=ownerFor(c);if(!owner)fail('TENANT_OWNER_REQUIRED',503);c.assignedTo=owner.id;db.customers.unshift(c)}
  const state=editState(c);if((state.inquiries||[]).length>=1000)fail('INQUIRY_ARCHIVE_REQUIRED',409);
  const inquiry={...b,id:id('inq'),fingerprint,at:now(),status:'Needs review',contactVerified:false};
  state.inquiries=(state.inquiries||[]).concat([inquiry]);state.firstSource=state.firstSource||b.sourcePage;state.lastSource=b.sourcePage;
  c.webLead=true;c.webLeadPendingReview=true;c.lastWebLeadAt=now();
  event(c,'inquiry_received',{inquiryId:inquiry.id,serviceSlug:b.serviceSlug,intent:b.intent});
  task(c,suppressed(c)?'Review inquiry and contact restrictions':b.intent==='callback'?'Verify inquiry and confirm requested call':'Review new service inquiry','inquiry:'+c.id,
   'Service: '+(b.serviceSlug||b.serviceInterest||'Discuss scope')+'. '+(b.preferredWindow?'Requested window: '+b.preferredWindow+' ('+b.timeZone+'). ':'')+'Verify identity before using existing account details.');
  const activity={id:id('act'),tenantId:Number(tid),type:'web_lead',message:'New service inquiry requires verification',meta:{customerId:c.id,inquiryId:inquiry.id,sourcePage:b.sourcePage},createdAt:now()};
  inquiry.activityId=activity.id;proof={customerId:c.id,activityId:activity.id};
  db.activities=[activity,...(db.activities||[])].slice(0,1000);
  return {ok:true,accepted:true,durable:true,id:inquiry.id};
 },['customers','tasks','activities'],async()=>{
  // A failed readback after commit is uncertain, not a rollback. Retain the receipt
  // so a retry/restart can find the same durable inquiry instead of duplicating it.
  if(confirmInquiry&&!await confirmInquiry(tid,proof.customerId,proof.activityId))fail('WEBSITE_INQUIRY_UNCONFIRMED',503);
 })}
 // Reuse the same tenant-scoped receipt reconciliation as Kim and revenue reporting.
 // Snapshot only: not a new payment rail or independent provider attestation.
 function paidForTenant(tid){
  const scoped=(db.orders||[]).filter(o=>sameTenant(o,tid));
  const records=scoped.map(o=>o.testMode===true||o.sbcTest===true||parsed(o).sbcLaunchQa||REVENUE_GATE.isProtectedLaunchQaOrder(o)?{...o,testOnly:true}:o);
  return new Set(REVENUE_TRUTH.paidSummary(records,db.customers||[],{tenantId:tid}).orders);
 }
 function row(c,paid=paidForTenant(c.tenantId)){
  const s=getState(c),latest=(s.inquiries||[]).at(-1),assigned=ownerFor(c);
  const pending=(s.inquiries||[]).filter(i=>i.status==='Needs review').length;
  const orders=(db.orders||[]).filter(o=>sameTenant(o,c.tenantId)&&String(o.customerId)===String(c.id));
  const customerOrders=orders.filter(o=>!parsed(o).sbcLaunchQa);
  const activeOrders=customerOrders.filter(o=>parsed(o).customerJourney?.status!=='Delivered'&&paid.has(o));
  const upcoming=(db.appointments||[]).filter(a=>sameTenant(a,c.tenantId)&&String(a.customerId)===String(c.id)&&a.status==='Scheduled'&&Date.parse(a.endAt)>Date.parse(now()));
  return {customerId:c.id,businessName:c.businessName||c.contactName||'Account',assignedTo:assigned?.id||'',assignedToName:assigned?.name||assigned?.role||'Owner assignment required',
   ownerFallback:!!assigned&&String(assigned.id)!==String(c.assignedTo||''),serviceSlug:latest?.serviceSlug||'',packageId:latest?.packageId||'',intent:latest?.intent||'',
   sourcePage:s.lastSource||'',pendingInquiries:pending,paidOrders:customerOrders.filter(o=>paid.has(o)).length,openOrders:activeOrders.length,
   nextAction:pending?'Verify inquiry and respond':activeOrders.length?'Continue paid order checklist':upcoming.length?'Prepare confirmed appointment':'Review next follow-up',
   contactSuppressed:suppressed(c),updatedAt:c.updatedAt||c.createdAt||''};
 }
 function queue(actor,tid){if(!active(actor,tid)||!['owner','account_manager'].includes(actor.role))fail('NOT_AUTHORIZED',403);
  const paid=paidForTenant(tid);
  const rows=(db.customers||[]).filter(c=>accessible(c,actor,tid)&&!c._recoveryProjection&&!['Deleted','Duplicate','Archived'].includes(String(c.status||'')))
   .map(c=>row(c,paid)).sort((a,b)=>b.pendingInquiries-a.pendingInquiries||b.openOrders-a.openOrders||b.updatedAt.localeCompare(a.updatedAt));
  return {ok:true,readOnly:!writerReady(),rows,counts:{accounts:rows.length,inquiries:rows.reduce((n,r)=>n+r.pendingInquiries,0),openOrders:rows.reduce((n,r)=>n+r.openOrders,0)}};
 }
 function ordersFor(c){return (db.orders||[]).filter(o=>sameTenant(o,c.tenantId)&&String(o.customerId)===String(c.id))}
 function orderView(o,paid=paidForTenant(o.tenantId)){const p=parsed(o).customerJourney,qa=!!parsed(o).sbcLaunchQa;return {id:o.id,product:o.product,price:Number(o.price)||0,paymentVerified:paid.has(o),protectedQa:qa,
  status:qa?'Protected QA — not customer fulfillment':paid.has(o)?p?.status||'Paid — checklist pending':'Payment verification required',revision:p?.revision||0,
  steps:qa?[]:p?.steps||[],previewUrl:qa||!paid.has(o)?'':safeUrl(p?.previewUrl),deliveryUrl:!qa&&paid.has(o)&&p?.status==='Delivered'?safeUrl(p?.deliveryUrl):'',customerMessage:qa?'Internal QA payment; excluded from customer revenue and delivery.':!paid.has(o)?'Payment evidence requires reconciliation. Customer delivery is on hold.':p?.customerMessage||'',
  canApprove:!qa&&paid.has(o)&&!!safeUrl(p?.previewUrl)&&p?.steps?.some(s=>s.key==='qa'&&s.completed)&&!p?.steps?.some(s=>s.key==='approval'&&s.completed)};}
 function detail(cid,actor,tid){const c=account(cid,actor,tid),s=getState(c),paid=paidForTenant(tid);return {ok:true,readOnly:!writerReady(),account:row(c,paid),inquiries:s.inquiries||[],events:s.events||[],
  orders:ordersFor(c).map(o=>orderView(o,paid)),appointments:(db.appointments||[]).filter(a=>sameTenant(a,tid)&&String(a.customerId)===String(c.id)),consents:s.consents||{},reminders:s.reminders||[]}}
 function review(cid,actor,tid,body){return transaction(()=>{const c=account(cid,actor,tid),s=editState(c),i=(s.inquiries||[]).find(i=>i.id===body.inquiryId);
  if(!i)fail('INQUIRY_NOT_FOUND',404);if(body.verified!==true)fail('CONTACT_VERIFICATION_REQUIRED');
  i.status='Reviewed';i.contactVerified=true;i.reviewedBy=actor.id;i.reviewedAt=now();c.webLeadPendingReview=s.inquiries.some(i=>i.status==='Needs review');
  if(!c.webLeadPendingReview)for(const t of db.tasks||[])if(sameTenant(t,tid)&&t.journeyTaskKey==='inquiry:'+c.id)t.status='Completed';
  if(i.intent==='callback')task(c,'Confirm requested call and schedule appointment','callback:'+c.id,'Requested window: '+i.preferredWindow+' ('+i.timeZone+'). Use Account 360 booking after confirming availability.');
  event(c,'inquiry_reviewed',{inquiryId:i.id,actor:actor.id});return {ok:true,durable:true};
 })}
 function syncPaidOrder(o,paid=paidForTenant(o.tenantId)){
  const c=(db.customers||[]).find(c=>sameTenant(c,o.tenantId)&&String(c.id)===String(o.customerId));if(!c||!paid.has(o)||parsed(o).sbcLaunchQa)return false;
  if(parsed(o).customerJourney)return false;
  const last=(getState(c).inquiries||[]).at(-1),play=/website|starter|custom|advanced|growth/i.test(String(o.product))?'website':/card|flyer|print|sign/i.test(String(o.product))?'print':'service';
  const labels=play==='website'?{intake:'Confirm business details, services and content rights',build:'Build the private website preview',qa:'Check mobile layout, links and agreed scope'}:
   play==='print'?{intake:'Confirm quantity, dimensions, artwork rights and specifications',build:'Prepare the production proof',qa:'Check artwork, specifications and supplier terms'}:
   {intake:'Confirm the purchased service scope and authorized access',build:'Prepare the service work and completion summary',qa:'Verify the agreed service requirements'};
  const plan={version:1,revision:1,status:'Needs information',serviceSlug:last?.serviceSlug||'',playbook:play,createdAt:now(),
   steps:PLAYS[play].map(key=>({key,label:labels[key]||LABELS[key],completed:false})),previewUrl:'',deliveryUrl:'',customerMessage:'Your payment is recorded. SBC is reviewing the information needed to begin.'};
  writePlan(o,plan,now());c.status='Customer';task(c,'Start paid order: '+o.product,'delivery:'+o.id,'Complete the requirements, proof, quality, approval and delivery checklist.');event(c,'payment_confirmed',{orderId:o.id});return true;
 }
 const reconcile=(actor,tid)=>transaction(()=>{if(actor?.role!=='owner'||!active(actor,tid))fail('OWNER_REQUIRED',403);let created=0;const paid=paidForTenant(tid);
  for(const o of db.orders||[])if(sameTenant(o,tid)&&syncPaidOrder(o,paid))created++;return {ok:true,durable:true,created};});
 function progress(oid,actor,tid,b){return transaction(()=>{
  const o=(db.orders||[]).find(o=>String(o.id)===String(oid)&&sameTenant(o,tid));if(!o)fail('ORDER_NOT_FOUND',404);const c=account(o.customerId,actor,tid);
  if(parsed(o).sbcLaunchQa)fail('PROTECTED_QA_ORDER',409);
  const paid=paidForTenant(tid);if(!paid.has(o))fail('PAYMENT_VERIFICATION_REQUIRED',423);syncPaidOrder(o,paid);const p=clone(parsed(o).customerJourney);
  if(Number(b.expectedRevision)!==p.revision)fail('ORDER_REVISION_CONFLICT',409);
  if(b.step==='preview'){
   if(p.steps.find(s=>s.key==='release')?.completed)fail('ORDER_ALREADY_RELEASED',409);
   const url=safeUrl(b.previewUrl);if(!url)fail('HTTPS_PREVIEW_REQUIRED');p.previewUrl=url;p.revision++;
   for(const s of p.steps)if(['qa','approval','release','delivery'].includes(s.key))s.completed=false;
   p.deliveryUrl='';p.status='In progress';p.customerMessage='Your proof is being checked by SBC.';
  }else{
   const index=p.steps.findIndex(s=>s.key===b.step);if(index<0)fail('INVALID_DELIVERY_STEP');
   if(p.steps[index].completed)return {ok:true,durable:true,order:orderView(o)};
   if(p.steps.slice(0,index).some(s=>!s.completed))fail('PREVIOUS_STEPS_REQUIRED',409);
   if(b.step==='approval')fail('CUSTOMER_APPROVAL_REQUIRED',403);
   if(b.step==='release'&&actor.role!=='owner')fail('OWNER_REQUIRED',403);
   if(b.step==='qa'&&!safeUrl(p.previewUrl))fail('CUSTOMER_PROOF_REQUIRED',409);
   if(b.step==='delivery'){const url=safeUrl(b.deliveryUrl);if(!url)fail('HTTPS_DELIVERY_REQUIRED');p.deliveryUrl=url;p.status='Delivered';p.customerMessage='Your order is ready. Open your deliverable below.';
    for(const t of db.tasks||[])if(sameTenant(t,tid)&&t.journeyTaskKey==='delivery:'+o.id)t.status='Completed';
    const follow=task(c,'Follow up on delivered order','handoff:'+o.id,'Confirm the handoff and any remaining questions; review contact restrictions before responding.');follow.dueAt=new Date(Date.parse(now())+7*86400000).toISOString();
   }else{p.status=b.step==='qa'?'Awaiting customer approval':'In progress';p.customerMessage=b.step==='qa'?'Your proof is ready. Please review it and approve or request changes.':'SBC is working through your order.';}
   p.steps[index]={...p.steps[index],completed:true,at:now(),actor:actor.id};
  }
  writePlan(o,p,now());event(c,'order_progress',{orderId:o.id,step:b.step,actor:actor.id});return {ok:true,durable:true,order:orderView(o)};
 })}
 function portalCustomer(req){const c=req.portalCustomer,a=req.portalAccount;
  if(!c||!a||a.active===false||String(a.customerId)!==String(c.id)||!Number.isSafeInteger(Number(c.tenantId))||Number(c.tenantId)<=0||(a.tenantId!==undefined&&!sameTenant(a,c.tenantId)))fail('CUSTOMER_LOGIN_REQUIRED',401);
  const live=(db.customers||[]).find(row=>String(row.id)===String(c.id)&&sameTenant(row,c.tenantId));if(!live)fail('CUSTOMER_LOGIN_REQUIRED',401);return live;
 }
 function portalSummary(req){const c=portalCustomer(req),paid=paidForTenant(c.tenantId);return {ok:true,orders:ordersFor(c).map(o=>{const view=orderView(o,paid);return {...view,steps:view.steps.map(s=>({key:s.key,label:s.label,completed:s.completed}))}}),appointments:(db.appointments||[]).filter(a=>sameTenant(a,c.tenantId)&&String(a.customerId)===String(c.id)).map(a=>({id:a.id,title:a.title,startAt:a.startAt,endAt:a.endAt,status:a.status,location:a.location||'',rescheduleRequest:a.rescheduleRequest?{status:a.rescheduleRequest.status,preferredWindow:a.rescheduleRequest.preferredWindow}:null}))}}
 function approve(req,oid,b){return transaction(()=>{const c=portalCustomer(req),o=ordersFor(c).find(o=>o.id===oid);if(!o)fail('ORDER_NOT_FOUND',404);
  if(parsed(o).sbcLaunchQa)fail('PROTECTED_QA_ORDER',409);
  const stored=parsed(o).customerJourney;if(!paidForTenant(c.tenantId).has(o)||!stored)fail('PAYMENT_VERIFICATION_REQUIRED',423);const p=clone(stored);
  if(Number(b.expectedRevision)!==p.revision)fail('PROOF_CHANGED_REFRESH_REQUIRED',409);
  if(!safeUrl(p.previewUrl)||!p.steps.find(s=>s.key==='qa')?.completed)fail('PROOF_NOT_READY',409);
  if(!['approve','changes_requested'].includes(b.decision))fail('INVALID_APPROVAL');
  if(p.status==='Delivered'||p.steps.find(s=>s.key==='release')?.completed)fail('ORDER_ALREADY_RELEASED',409);
  const s=p.steps.find(s=>s.key==='approval');s.completed=b.decision==='approve';s.at=now();s.actor='customer:'+req.portalAccount.id;
  p.status=s.completed?'Awaiting owner release':'Changes requested';p.customerMessage=s.completed?'Your approval is recorded. SBC is preparing the final handoff.':'Your change request is recorded. SBC will review it.';
  if(!s.completed){p.revision++;p.steps.find(s=>s.key==='qa').completed=false;task(c,'Review customer changes for '+o.product,'delivery:'+o.id,text(b.note,1000))}
  writePlan(o,p,now());event(c,'customer_'+b.decision,{orderId:o.id,revision:p.revision,note:text(b.note,1000)});return {ok:true,durable:true};
 })}
 function reschedule(req,aid,b){return transaction(()=>{const c=portalCustomer(req),a=(db.appointments||[]).find(a=>sameTenant(a,c.tenantId)&&a.customerId===c.id&&a.id===aid);
  if(!a)fail('APPOINTMENT_NOT_FOUND',404);if(a.status!=='Scheduled'||Date.parse(a.endAt)<=Date.parse(now()))fail('APPOINTMENT_NOT_ACTIVE',409);
  const preferredWindow=text(b.preferredWindow,160);if(preferredWindow.length<5)fail('PREFERRED_WINDOW_REQUIRED');
  a.rescheduleRequest={preferredWindow,status:'Awaiting confirmation',requestedAt:now()};task(c,'Confirm customer reschedule request','reschedule:'+a.id,preferredWindow);
  event(c,'reschedule_requested',{appointmentId:a.id});return {ok:true,durable:true,status:'Awaiting confirmation',originalAppointmentUnchanged:true};
 })}
 async function checkoutCustomer(tid,b){const receipt=await intake(tid,b);return (db.customers||[]).find(c=>sameTenant(c,tid)&&(getState(c).inquiries||[]).some(i=>i.id===receipt.id))}
 return {db,now,id,publicOrigin,serialize,transaction,account,ownerFor,event,task,queue,detail,intake,checkoutCustomer,review,syncPaidOrder,reconcile,progress,portalSummary,portalCustomer,approve,reschedule};
}
function requireRelease(order){const plan=parsed(order).customerJourney;if(plan&&!plan.steps?.some(s=>s.key==='release'&&s.completed===true))throw Object.assign(Error('CUSTOMER_APPROVAL_AND_OWNER_RELEASE_REQUIRED'),{code:'CUSTOMER_APPROVAL_AND_OWNER_RELEASE_REQUIRED'});return order}
module.exports={createService,getState,editState,hash,safeUrl,parsed,sourcePage,normalize,contactMatch,requireRelease};
