'use strict';
/**
 * SBC Prospect Intelligence V4 — owner-approved research -> EXISTING CRM account.
 * Uses the same serialized durable writer and curated V2 research vault as V3.
 * Never creates customer records, authorizes contact, generates an order or bills.
 */
const crypto=require('node:crypto');
const H=require('../public/sbc-prospect-handoff-v2.js');
const Opportunity=require('../public/sbc-prospect-opportunity-v3.js');
const OWNER_PATH='/api/owner/prospect-intelligence/account-links';
const STAFF_PATH='/api/prospect-intelligence/v4/accounts/:customerId/research';
const REQUEST=/^sbc-link-[a-f0-9]{32}$/;
const PACKET=/^spi-packet-[A-Za-z0-9-]{1,64}$/;
const ACCOUNT=/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const name=x=>typeof x==='string'?x.trim().replace(/\s+/g,' ').toLowerCase():'';
function scoped(items,tenant,id){
 return Array.isArray(items)?items.find(x=>x&&String(x.id)===id&&Number(x.tenantId??x.tenant_id)===tenant):null;
}
function managerId(customer){return String(customer?.assignedTo??customer?.assigned_to??'').trim();}
function publicSite(raw){
 try{if(!raw)return '';const url=new URL(String(raw));return url.protocol==='https:'?url.hostname.toLowerCase().replace(/\.$/,''):'';}catch{return ''}
}
function matchesAccount(packet,customer){
 const a=name(packet?.business?.businessName),b=name(customer?.businessName??customer?.business_name);
 const left=publicSite(packet?.business?.website),right=publicSite(customer?.website);
 return Boolean(a&&a===b&&(!left||!right||left===right));
}
function identity(req,requireTenant,allowedRoles){
 let tenantId=0;try{tenantId=Number(requireTenant(req))}catch{}
 const id=String(req.user?.id??'').trim(),role=req.user?.role;
 return Number.isSafeInteger(tenantId)&&tenantId>0&&id&&req.user?.active!==false&&allowedRoles.includes(role)?
  {tenantId,id,role}:null;
}
function rows(store,key){return Array.isArray(store?.[key])?store[key]:[];}
function output(link,customer,now){
 const business={...link.packet.business,status:customer.status,doNotContact:customer.doNotContact===true,
  salesSuppressed:customer.salesSuppressed===true};
 const opportunity=Opportunity.evaluate(business,link.packet.audit,now);
 const nextAction=opportunity.outreach.action==='DO_NOT_CONTACT'?
  'Internal review only. Do not contact this account; verify suppression controls.':
  opportunity.verification!=='measured'?
   'Refresh the public website audit before discussing scores or planning a customer follow-up.':
   opportunity.opportunities.length?
    'Review measured website opportunities, verify the customer need and contact permission, and request owner approval before a quote.':
    'Confirm the customer priorities and any existing website services before scheduling a follow-up.';
 return {id:link.id,customerId:link.customerId,business:link.packet.business,
  linkedAt:link.createdAt,auditHistory:link.events.map(x=>({kind:x.kind,at:x.at})),
  opportunity,nextAction,outreachAllowed:false,requiresOwnerReview:true,
  note:'Research only; does not authorize calls, email, billing, publishing or automatic follow-up.'};
}
function register(app,{auth,ownerOnly,requireTenant,db,getStore,saveStore,writerReady,serializeSiteMutation,clock=Date.now}={}){
 if(!db||typeof getStore!=='function'||typeof saveStore!=='function'||typeof writerReady!=='function'||typeof serializeSiteMutation!=='function')
  throw Error('PROSPECT_V4_DURABILITY_AND_CRM_REQUIRED');
 app.get(OWNER_PATH,auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const a=identity(req,requireTenant,['owner']);if(!a)return res.status(403).json({ok:false,code:'OWNER_TENANT_REQUIRED'});
  try{
   const list=rows(getStore(),'sbcProspectAccountLinksV4').filter(x=>x.tenantId===a.tenantId&&x.ownerId===a.id);
   return res.json({ok:true,records:list.slice(0,100).map(x=>({
    id:x.id,customerId:x.customerId,packetId:x.packetId,createdAt:x.createdAt,
    status:'ASSIGNED_RESEARCH_ONLY',auditHistory:x.events.map(e=>({kind:e.kind,at:e.at}))})),
    outreachTriggered:false,crmMutations:0});
  }catch{return res.status(503).json({ok:false,code:'PROSPECT_V4_READ_UNAVAILABLE'})}
 });
 app.post(OWNER_PATH,auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const a=identity(req,requireTenant,['owner']);if(!a)return res.status(403).json({ok:false,code:'OWNER_TENANT_REQUIRED'});
  const b=req.body;
  if(!b||Array.isArray(b)||typeof b!=='object'||
   Object.keys(b).some(k=>!['requestId','packetId','customerId','expectedManagerId','confirmBusinessMatch'].includes(k))||
   !REQUEST.test(b.requestId)||!PACKET.test(b.packetId)||!ACCOUNT.test(b.customerId)||
   !ACCOUNT.test(b.expectedManagerId)||b.confirmBusinessMatch!==true)
   return res.status(422).json({ok:false,code:'PROSPECT_V4_OWNER_CONFIRMATION_REQUIRED'});
  if(!writerReady())return res.status(423).json({ok:false,code:'PROSPECT_V4_WRITER_UNAVAILABLE'});
  try{
   const receipt=await serializeSiteMutation(async()=>{
    if(!writerReady())return {status:423,body:{ok:false,code:'PROSPECT_V4_WRITER_UNAVAILABLE'}};
    const store=getStore(),all=rows(store,'sbcProspectAccountLinksV4');
    const prior=all.find(x=>x.tenantId===a.tenantId&&x.ownerId===a.id&&x.requestId===b.requestId);
    if(prior){
     if(prior.customerId!==b.customerId||prior.packetId!==b.packetId||prior.managerIdAtLink!==b.expectedManagerId)
      return {status:409,body:{ok:false,code:'PROSPECT_V4_IDEMPOTENCY_CONFLICT'}};
     return {status:200,body:{ok:true,duplicate:true,record:{id:prior.id,customerId:prior.customerId,packetId:prior.packetId}}};
    }
    const pkt=rows(store,'sbcProspectPacketVault').find(x=>x.id===b.packetId&&x.tenantId===a.tenantId&&x.ownerId===a.id);
    if(!pkt)return {status:404,body:{ok:false,code:'PROSPECT_V4_RESEARCH_NOT_FOUND'}};
    let packet;try{packet=H.validatePacket(JSON.stringify(pkt.packet),clock())}
    catch{return {status:409,body:{ok:false,code:'PROSPECT_V4_RESEARCH_STALE_OR_INVALID'}}}
    const customer=scoped(db.customers,a.tenantId,b.customerId);
    if(!customer)return {status:404,body:{ok:false,code:'PROSPECT_V4_ACCOUNT_NOT_FOUND'}};
    if(!matchesAccount(packet,customer))
     return {status:409,body:{ok:false,code:'PROSPECT_V4_BUSINESS_IDENTITY_MISMATCH'}};
    const mid=managerId(customer),worker=scoped(db.users,a.tenantId,mid);
    if(!mid||mid!==b.expectedManagerId||!worker||worker.active===false||worker.role!=='account_manager')
     return {status:409,body:{ok:false,code:'PROSPECT_V4_ASSIGNMENT_NOT_VERIFIED'}};
    if(all.some(x=>x.tenantId===a.tenantId&&x.packetId===b.packetId))
     return {status:409,body:{ok:false,code:'PROSPECT_V4_PACKET_ALREADY_LINKED'}};
    if(all.length>=500)return {status:507,body:{ok:false,code:'PROSPECT_V4_CAPACITY_REACHED'}};
    const at=new Date(clock()).toISOString();
    const entry={id:'spi-link-'+crypto.randomUUID(),requestId:b.requestId,
     tenantId:a.tenantId,ownerId:a.id,customerId:b.customerId,packetId:b.packetId,
     managerIdAtLink:mid,packet,createdAt:at,
     events:[{kind:'OWNER_APPROVED_ACCOUNT_RESEARCH_LINK',actorId:a.id,at}]};
    const saved=await saveStore({...store,sbcProspectAccountLinksV4:[entry,...all]});
    if(!saved||saved?.skipped===true||saved?.ok===false)throw Error('PROSPECT_V4_NOT_DURABLE');
    return {status:201,body:{ok:true,durable:true,record:{id:entry.id,customerId:entry.customerId,
     packetId:entry.packetId,createdAt:at},outreachTriggered:false,customerModified:false}};
   });
   return res.status(receipt.status).json(receipt.body);
  }catch{return res.status(503).json({ok:false,code:'PROSPECT_V4_SAVE_NOT_VERIFIED'})}
 });
 app.get(STAFF_PATH,auth,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const a=identity(req,requireTenant,['account_manager']);
  if(!a)return res.status(403).json({ok:false,code:'PROSPECT_V4_ACCOUNT_ACCESS_DENIED'});
  const cid=String(req.params?.customerId||'');
  if(!ACCOUNT.test(cid))return res.status(404).json({ok:false,code:'PROSPECT_V4_ACCOUNT_NOT_FOUND'});
  const customer=scoped(db.customers,a.tenantId,cid);
  if(!customer)return res.status(403).json({ok:false,code:'PROSPECT_V4_ACCOUNT_ACCESS_DENIED'});
  const worker=scoped(db.users,a.tenantId,a.id);
  if(!worker||worker.role!=='account_manager'||worker.active===false||managerId(customer)!==a.id)
   return res.status(403).json({ok:false,code:'PROSPECT_V4_ACCOUNT_ACCESS_DENIED'});
  try{
   if(!writerReady())return res.status(423).json({ok:false,code:'PROSPECT_V4_WRITER_UNAVAILABLE'});
   const all=rows(getStore(),'sbcProspectAccountLinksV4').filter(x=>x.tenantId===a.tenantId&&x.customerId===cid);
   return res.json({ok:true,customerId:cid,research:all.slice(0,20).map(x=>output(x,customer,clock())),
    permission:'CURRENT_ASSIGNED_ACCOUNT_MANAGER_ONLY',automatedOutreach:false});
  }catch{return res.status(503).json({ok:false,code:'PROSPECT_V4_READ_UNAVAILABLE'})}
 });
}
module.exports=Object.freeze({register,OWNER_PATH,STAFF_PATH,matchesAccount});
