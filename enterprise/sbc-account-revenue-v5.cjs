'use strict';
/**
 * SBC V5 — read-only Account Manager revenue-planning intelligence.
 * Source of truth: existing tenant-scoped CRM snapshot and owner-linked V4
 * research. No new customer DB, no outreach, quotes, payments or writes.
 */
const V3=require('../public/sbc-prospect-opportunity-v3.js');
const V4=require('./sbc-prospect-account-links-v4.cjs');
const OWNER_PATH='/api/owner/prospect-intelligence/v5/accounts/:customerId/plan';
const MANAGER_PATH='/api/prospect-intelligence/v5/accounts/:customerId/plan';
const ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const BLOCKED=/^(?:do not call|do not contact|dnc|opt.?out|unsubscribe|deleted|lost|closed)$/i;
function row(items,tenant,id){
 return Array.isArray(items)?items.find(x=>x&&Number(x.tenantId??x.tenant_id)===tenant&&String(x.id)===id):null;
}
function assigned(customer){return String(customer?.assignedTo??customer?.assigned_to??'').trim();}
function blocked(customer){
 return Boolean(customer?.doNotContact===true||customer?.doNotCall===true||
 customer?.salesSuppressed===true||customer?.isSuppressed===true||
 BLOCKED.test(String(customer?.status??'').trim()));
}
function identity(req,requireTenant,roles){
 let tenant=0;try{tenant=Number(requireTenant(req))}catch{}
 const user=req.user,role=String(user?.role||''),uid=String(user?.id||'').trim();
 const expiry=user?.expiresAt?Date.parse(user.expiresAt):null;
 return Number.isSafeInteger(tenant)&&tenant>0&&uid&&roles.includes(role)&&user?.active!==false&&
 (expiry===null||(Number.isFinite(expiry)&&expiry>Date.now()))?{tenant,uid,role}:null;
}
function stage(customer){
 return String(customer?.status||'').trim().toLowerCase()==='customer'?'EXISTING_CUSTOMER':'PROSPECT';
}
function buildPlan({customer={},links=[],now=Date.now()}={}){
 const time=Number(now);if(!Number.isFinite(time))throw Error('V5_INVALID_DATE');
 const sources=(Array.isArray(links)?links:[]).filter(x=>x&&x.packet&&
  V4.matchesAccount(x.packet,customer)).sort((a,b)=>Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0));
 const selected=sources[0]||null;
 const opportunity=V3.evaluate(
  {businessName:String(customer.businessName??customer.business_name??''),
   industry:String(customer.industry??''),status:customer.status,
   doNotContact:blocked(customer)},
  selected?.packet?.audit||{},time);
 const isBlocked=blocked(customer);
 const fresh=opportunity.verification==='measured',hasFinding=fresh&&opportunity.opportunities.length>0;
 const actions=[];
 const push=(code,title,details)=>actions.push({code,title,details,internalOnly:true,requiresOwnerApproval:true});
 if(isBlocked){
  push('INTERNAL_SUPPRESSION_REVIEW','Review contact suppression internally','Do not initiate outbound contact or schedule a sales follow-up.');
 }else if(!selected){
  push('OWNER_RESEARCH_REVIEW','Request owner-approved website research','Verify business identity and public evidence before recommending a service.');
 }else if(!fresh){
  push('REFRESH_PUBLIC_AUDIT','Refresh outdated or unverified website evidence','Previous scores are not valid evidence for a present-day recommendation.');
 }else if(hasFinding){
  push('REVIEW_MEASURED_WEBSITE_FINDINGS','Review measured website findings','Confirm actual customer needs, current subscriptions and owner-approved project scope.');
  push('REQUEST_OWNER_PROPOSAL_REVIEW','Prepare a manual proposal for owner review','No quote, sale, probability, or payment is created automatically.');
 }else{
  push('CONFIRM_CUSTOMER_GOALS','Confirm business priorities','No measured website deficiency is asserted; review verified customer requests first.');
 }
 const rawDue=String(customer.followUp??customer.followUpAt??customer.follow_up??'');
 const followUp=/^\d{4}-\d{2}-\d{2}/.test(rawDue)?rawDue.slice(0,10):null;
 if(followUp&&!isBlocked)push('REVIEW_EXISTING_FOLLOW_UP','Review existing CRM follow-up date','Confirm contact permission and business needs before any communication.');
 return {
  schema:'SBC-ACCOUNT-REVENUE-PLAN-V5',roleModel:'ACCOUNT_MANAGER_FIRST',
  accountId:String(customer.id??''),businessName:String(customer.businessName??customer.business_name??'').slice(0,140),
  customerStage:stage(customer),contactStatus:isBlocked?'SUPPRESSED':'PERMISSION_NOT_VERIFIED',
  auditStatus:opportunity.verification,researchPriority:isBlocked||!fresh?null:opportunity.score,
  sourcePacketIds:sources.slice(0,10).map(x=>String(x.packetId||'')),
  evidenceDate:fresh?opportunity.evidenceDate:null,
  measuredTopics:hasFinding?opportunity.opportunities.map(x=>x.topic):[],
  nextFollowUp:followUp,actions,
  projectedRevenue:null,quoteAuthorized:false,paymentAuthorized:false,outreachAuthorized:false,
  automaticActions:0,requiresManualCRMReview:true,
  caveat:'Planning from existing CRM snapshot and public Lighthouse evidence only. No verified revenue, customer permission, current subscriptions or automatic contact. Confirm live account ownership before acting.'
 };
}
function register(app,{auth,ownerOnly,requireTenant,db,getStore,writerReady,clock=Date.now}={}){
 if(!db||typeof getStore!=='function'||typeof writerReady!=='function')throw Error('V5_CRM_READ_DEPENDENCIES_REQUIRED');
 function respond(req,res,ownerMode){
  res.setHeader('Cache-Control','no-store');
  const ctx=identity(req,requireTenant,[ownerMode?'owner':'account_manager']);
  if(!ctx)return res.status(403).json({ok:false,code:'V5_ACCOUNT_ACCESS_DENIED'});
  const id=String(req.params?.customerId||'');
  if(!ID.test(id))return res.status(404).json({ok:false,code:'V5_ACCOUNT_NOT_FOUND'});
  const customer=row(db.customers,ctx.tenant,id);
  if(!customer)return res.status(ownerMode?404:403).json({ok:false,code:'V5_ACCOUNT_NOT_FOUND'});
  if(!ownerMode){
   const employee=row(db.users,ctx.tenant,ctx.uid);
   if(!employee||employee.role!=='account_manager'||employee.active===false||assigned(customer)!==ctx.uid)
    return res.status(403).json({ok:false,code:'V5_ACCOUNT_ACCESS_DENIED'});
  }
  try{
   if(!writerReady())return res.status(423).json({ok:false,code:'V5_WRITER_UNAVAILABLE'});
   const store=getStore();
   const linked=Array.isArray(store?.sbcProspectAccountLinksV4)?store.sbcProspectAccountLinksV4:[];
   const scoped=linked.filter(x=>Number(x.tenantId)===ctx.tenant&&String(x.customerId)===id);
   const plan=buildPlan({customer,links:scoped,now:clock()});
   return res.json({ok:true,plan,source:'CURATED_V4_RESEARCH_AND_CRM_SNAPSHOT',tenantScoped:true,
    staffPermissions:ownerMode?'OWNER_ONLY':'CURRENT_ASSIGNED_ACCOUNT_MANAGER_ONLY'});
  }catch{return res.status(503).json({ok:false,code:'V5_PLAN_UNAVAILABLE'})}
 }
 app.get(OWNER_PATH,auth,ownerOnly,(req,res)=>respond(req,res,true));
 app.get(MANAGER_PATH,auth,(req,res)=>respond(req,res,false));
}
module.exports=Object.freeze({register,buildPlan,OWNER_PATH,MANAGER_PATH});
