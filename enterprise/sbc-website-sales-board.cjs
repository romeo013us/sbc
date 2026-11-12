'use strict';
// Read-only high-signal full-website sales pipeline. Revenue is not a claim
// unless a provider-captured, website-attributed order passes the shared
// finance evidence gate. No outbound actions and no business data mutation.
const sameTenant=(obj,tenantId)=>{
 const id=Number(tenantId),a=Number(obj?.tenantId??0),b=Number(obj?.tenant_id??0);
 return Number.isSafeInteger(id)&&id>0&&(a===id||b===id)&&(!a||!b||a===b);
};
const approved=s=>s?.status==='Approved'&&s.archived!==true;
const looksLikeWebsite=o=>{
 const source=[o?.product,o?.productName,o?.packageId,o?.packageName,o?.service,o?.serviceName,o?.category]
  .map(x=>String(x??'').toLowerCase().trim()).join(' ');
 return /\b(business starter|business basic|website|web design|web design starter|web design basic|online store|complete launch)\b/.test(source);
};
const currencyToCents=amount=>{
 if(typeof amount==='string'&&!/^\d+(?:\.\d{1,2})?$/.test(amount.trim()))return 0;
 const n=Number(amount);
 return Number.isFinite(n)&&n>0&&n<1e9?Math.round(n*100):0;
};
function project({tenantId,customers=[],sites=[],appointments=[],orders=[],workOrders=[],paidGuard=()=>{throw Error('PAYMENT_PROOF_MISSING')},limit=100}={}){
 const tid=Number(tenantId);
 if(!Number.isSafeInteger(tid)||tid<=0)throw Error('TENANT_CONTEXT_REQUIRED');
 const all=customers.filter(c=>sameTenant(c,tid)&&c?.status!=='Deleted'&&c?.isTestRecord!==true&&c?.test!==true);
 const customerIds=new Set(all.map(c=>String(c.id)));
 const candidateSites=sites.filter(s=>sameTenant(s,tid)&&customerIds.has(String(s.customerId))&&!s.archived);
 const sitesByCustomer=new Map();
 for(const s of candidateSites){
  const key=String(s.customerId),prev=sitesByCustomer.get(key);
  const time=Date.parse(s.updatedAt||s.createdAt||0)||0,prior=Date.parse(prev?.updatedAt||prev?.createdAt||0)||0;
  if(!prev||time>prior)sitesByCustomer.set(key,s);
 }
 const booked=appointments.filter(a=>sameTenant(a,tid)&&String(a.status||'')==='Scheduled'&&customerIds.has(String(a.customerId)));
 const apptByCustomer=new Map();
 for(const a of booked){
  const key=String(a.customerId),s=sitesByCustomer.get(key);
  if(!approved(s)||String(a.websiteId)!==String(s.id))continue;
  const prev=apptByCustomer.get(key);
  if(!prev||String(a.startAt||'')<String(prev.startAt||''))apptByCustomer.set(key,a);
 }
 const verifiedOrders=new Map(),orderById=new Map();let excluded=0,revenueCents=0;
 for(const o of orders.filter(x=>sameTenant(x,tid)&&customerIds.has(String(x.customerId)))){
  let captured=false;
  try{paidGuard(o,tid);captured=true}catch{}
  if(!captured||!looksLikeWebsite(o)){excluded++;continue}
  const cents=currencyToCents(o.price??o.amount??o.total);
  if(!cents){excluded++;continue}
  const key=String(o.customerId);
  const list=verifiedOrders.get(key)||[];list.push({id:String(o.id),cents});verifiedOrders.set(key,list);
  orderById.set(String(o.id),o);revenueCents+=cents;
 }
 const activeWorkOrders=workOrders.filter(x=>sameTenant(x,tid)&&customerIds.has(String(x.customerId))&&orderById.has(String(x.orderId)));
 const workByCustomer=new Map();
 for(const work of activeWorkOrders){
  const key=String(work.customerId),prev=workByCustomer.get(key);
  const time=Date.parse(work.updatedAt||work.createdAt||0)||0,previous=Date.parse(prev?.updatedAt||prev?.createdAt||0)||0;
  if(!prev||time>previous)workByCustomer.set(key,work);
 }
 const stages={WEBSITE_PUBLISHED:0,PAID_IN_FULFILLMENT:1,PAID_NEEDS_FULFILLMENT:2,APPOINTMENT_BOOKED:3,READY_TO_CALL:4,REVIEW_WEBSITE:5,NEEDS_WEBSITE:6,SUPPRESSED:7};
 const stageName={WEBSITE_PUBLISHED:'Published',PAID_IN_FULFILLMENT:'Paid · in fulfillment',PAID_NEEDS_FULFILLMENT:'Paid · start fulfillment',
  APPOINTMENT_BOOKED:'Walkthrough scheduled',READY_TO_CALL:'Website ready for calling',REVIEW_WEBSITE:'Review website',NEEDS_WEBSITE:'Build website',SUPPRESSED:'Do not contact'};
 const action={WEBSITE_PUBLISHED:'Verify launch and request an approved review',PAID_IN_FULFILLMENT:'Advance assigned fulfillment tasks',
  PAID_NEEDS_FULFILLMENT:'Create payment-verified work order',APPOINTMENT_BOOKED:'Prepare for confirmed website walkthrough',
  READY_TO_CALL:'Make an appropriate human sales call',REVIEW_WEBSITE:'Review full site and approve before sharing',
  NEEDS_WEBSITE:'Build a complete website',SUPPRESSED:'No outreach—respect suppression'};
 const rows=all.map(c=>{
  const key=String(c.id),site=sitesByCustomer.get(key),meeting=apptByCustomer.get(key),paid=verifiedOrders.get(key)||[],work=workByCustomer.get(key);
  const suppressed=c.doNotCall===true||c.doNotContact===true||c.salesSuppressed===true||c.smsOptOut===true||String(c.salesQueueState||'').toLowerCase()==='suppressed';
  let stage=suppressed?'SUPPRESSED':work?.status==='PUBLISHED'?'WEBSITE_PUBLISHED':paid.length?(work?'PAID_IN_FULFILLMENT':'PAID_NEEDS_FULFILLMENT'):meeting?'APPOINTMENT_BOOKED':approved(site)?'READY_TO_CALL':site?'REVIEW_WEBSITE':'NEEDS_WEBSITE';
  return {customerId:key,businessName:String(c.businessName||c.contactName||'Business').slice(0,120),
   industry:String(c.industry||'').slice(0,90),stage,stageLabel:stageName[stage],nextAction:action[stage],
   websiteId:site?String(site.id):null,offerTier:site?.offerTier==='starter'?'starter':site?'essentials':null,
   websiteApproved:approved(site),appointmentId:meeting?String(meeting.id):null,appointmentAt:meeting?.startAt||null,
   paidOrders:paid.length,paidRevenueCents:paid.reduce((n,x)=>n+x.cents,0),
   workOrderId:work?String(work.id):null,publicUrl:work?.status==='PUBLISHED'?String(work.publicUrl||''):null};
 });
 rows.sort((a,b)=>(stages[a.stage]-stages[b.stage])||a.businessName.localeCompare(b.businessName));
 const take=Math.max(1,Math.min(200,Number(limit)||100));
 return {
  ok:true,metrics:{
   totalLeads:all.length,websitesBuilt:rows.filter(x=>x.websiteId).length,
   approvedWebsites:rows.filter(x=>x.websiteApproved).length,
   bookedMeetings:rows.filter(x=>x.appointmentId).length,
   websiteBuyers:verifiedOrders.size,capturedWebsiteRevenueCents:revenueCents,
   publishedWebsites:rows.filter(x=>x.stage==='WEBSITE_PUBLISHED').length,
   suppressed:rows.filter(x=>x.stage==='SUPPRESSED').length,
   unverifiedOrUnattributedOrdersExcluded:excluded,
  },
  stages:Object.keys(stages).map(key=>({key,label:stageName[key],count:rows.filter(r=>r.stage===key).length})),
  rows:rows.slice(0,take),totalRows:rows.length,returnedRows:Math.min(rows.length,take),
  evidence:'Confirmed customer/site/appointment joins. Revenue includes only website-attributed, provider-captured orders; unlinked or unverified orders excluded. No ROI prediction.'
 };
}
function register(app,{auth,ownerOnly,requireTenant,db,getStore,paidGuard}){
 app.get('/api/website-production/sales-board',auth,ownerOnly,(req,res)=>{
  let tid;try{tid=Number(requireTenant(req));if(!Number.isSafeInteger(tid)||tid<=0)throw Error('TENANT_CONTEXT_REQUIRED');}
  catch{return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'})}
  const m=getStore();
  res.setHeader('Cache-Control','no-store');
  try{return res.json(project({tenantId:tid,customers:db.customers||[],sites:m.websiteDemos||[],appointments:db.appointments||[],orders:db.orders||[],workOrders:m.websiteProductionOrders||[],paidGuard,limit:req.query.limit||100}))}
  catch{return res.status(503).json({ok:false,code:'SALES_BOARD_UNAVAILABLE'})}
 });
}
module.exports={project,register};
