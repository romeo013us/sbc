'use strict';
// Owner-only, tenant-scoped ChatGPT handoff for three independent website proposals.
// No automatic ChatGPT session access, external AI charge, publishing, or outreach.
const ROOT='/api/website-production/customers/:id/ai-proposals';
const TIERS=Object.freeze([199,499,799]);
const clean=(v,max)=>String(v??'').trim().slice(0,max);
function buildPrompt(customer){
 const profile=customer?.websiteVerifiedDetails?.verified===true?customer.websiteVerifiedDetails:null;
 const business=clean(customer?.businessName||customer?.contactName||'Business',120);
 const industry=clean(customer?.industry||'Business services',80);
 const city=clean(customer?.city||'',80);
 const services=Array.isArray(profile?.services)?profile.services.map(x=>clean(typeof x==='string'?x:x?.name,70)).filter(Boolean).slice(0,12):[];
 return [
 'You are creating THREE separate high-quality customer-ready WEBSITE PROJECTS for Successful By Choice.',
 'Business: '+business,
 'Industry: '+industry,
 'Location: '+(city||'not supplied'),
 'Owner-confirmed services: '+(services.length?services.join(', '):'NOT YET VERIFIED — ask for facts, do not invent services'),
 'Use distinct, premium art direction but the SAME verified business identity in each version.',
 'Create a working responsive implementation and a deployable project ZIP for each tier:',
 '1. $199 STARTER — a polished single-page website with hero, services, contact and clear calls to action.',
 '2. $499 CUSTOM — a premium multi-page website with richer functionality appropriate to the business, and editable content.',
 '3. $799 ADVANCED PROPOSAL — an advanced working design concept; include only operational features actually implemented and tested, otherwise mark them planned.',
 'Quality benchmark: C & T Auto Motors Signature V2. No generic or broken layouts; test navigation, desktop, mobile, styling, accessible inputs and deployment.',
 'Do not fabricate reviews, prices, vehicles, credentials, legal promises, booking availability, or customer claims.',
 'Use clearly labeled example content when photos/prices are pending; do not represent examples as real inventory.',
 'Never collect sensitive identity, financial, or health information through an unsecured form.',
 'Keep all three builds separate with a comparison of included features, tests performed, remaining setup, and deployment instructions.',
 'The user will download each result, deploy and review it, then paste its preview link into the appropriate SBC Command Center proposal slot.',
 'These are owner-reviewed PROPOSALS; do not publish, contact the prospect, make purchases, or modify the live site without approval.'
 ].join('\n');
}
function normalizeVariant(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID_PROPOSAL');
 const tier=Number(raw.tier);
 if(!TIERS.includes(tier))throw Error('INVALID_TIER');
 const previewUrl=clean(raw.previewUrl,600);
 if(previewUrl){
  let u;try{u=new URL(previewUrl)}catch{throw Error('INVALID_PREVIEW_URL')}
  const host=u?.hostname?.toLowerCase()||'';
  if(u.protocol!=='https:'||!host||u.username||u.password||/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host)||host.endsWith('.local')||host.endsWith('.internal'))throw Error('INVALID_PREVIEW_URL');
 }
 const notes=clean(raw.notes,500);
 if(typeof raw.notes!=='undefined'&&typeof raw.notes!=='string')throw Error('INVALID_PROPOSAL_NOTES');
 return {tier,previewUrl,notes,status:'OWNER_REVIEW_REQUIRED'};
}
function register(app,{auth,ownerOnly,requireTenant,db,getStore,saveStore,writerReady,serializeSiteMutation}){
 if(![auth,ownerOnly,requireTenant,getStore,saveStore,writerReady,serializeSiteMutation].every(x=>typeof x==='function'))throw Error('AI_HANDOFF_DEPENDENCY_REQUIRED');
 function target(req){
  const tid=Number(requireTenant(req));
  if(!Number.isSafeInteger(tid)||tid<1)throw Error('TENANT_CONTEXT_REQUIRED');
  const id=String(req.params.id||'');
  if(!id||id.length>120)throw Error('INVALID_CUSTOMER_ID');
  const customer=(Array.isArray(db?.customers)?db.customers:[]).find(x=>String(x.id)===id&&Number(x.tenantId)===tid);
  return {tid,id,customer};
 }
 function current(tid,id){
  const store=getStore();
  const proposals=Array.isArray(store?.aiWebsiteProposals)?store.aiWebsiteProposals:[];
  return proposals.find(x=>String(x.customerId)===id&&Number(x.tenantId)===tid)||null;
 }
 const fail=(res,e)=>{
  const code=String(e?.message||'AI_HANDOFF_FAILED');
  const status=code==='TENANT_CONTEXT_REQUIRED'?403:code==='STALE_PROPOSAL_REVISION'?409:
   code==='WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'?423:code.startsWith('INVALID_')?400:503;
  return res.status(status).json({ok:false,code:status===503?'AI_HANDOFF_NOT_SAVED':code});
 };
 app.get(ROOT,auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {tid,id,customer}=target(req);
   if(!customer)return res.status(404).json({ok:false,code:'CUSTOMER_NOT_FOUND'});
   const saved=current(tid,id);
   return res.json({ok:true,customerId:id,revision:saved?.revision||0,variants:saved?.variants||{},prompt:buildPrompt(customer),mode:'CHATGPT_MANUAL_HANDOFF',automated:false});
  }catch(e){return fail(res,e)}
 });
 app.patch(ROOT,auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!writerReady())return fail(res,Error('WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'));
  try{
   const result=await serializeSiteMutation(async()=>{
    const {tid,id,customer}=target(req);
    if(!customer)return {status:404,body:{ok:false,code:'CUSTOMER_NOT_FOUND'}};
    if(!Number.isSafeInteger(req.body?.expectedRevision)||req.body.expectedRevision<0)throw Error('INVALID_EXPECTED_REVISION');
    const value=normalizeVariant(req.body);
    const previous=current(tid,id);
    const revision=previous?.revision||0;
    if(revision!==req.body.expectedRevision)throw Error('STALE_PROPOSAL_REVISION');
    const variants={...(previous?.variants||{}),[String(value.tier)]:{...value,updatedAt:new Date().toISOString()}};
    const next={tenantId:tid,customerId:id,revision:revision+1,variants,updatedAt:new Date().toISOString(),source:'CHATGPT_MANUAL_HANDOFF'};
    const store=getStore();
    const rows=Array.isArray(store?.aiWebsiteProposals)?store.aiWebsiteProposals:[];
    const updated={...store,aiWebsiteProposals:[...rows.filter(x=>!(String(x.customerId)===id&&Number(x.tenantId)===tid)),next]};
    const saved=await saveStore(updated);
    if(saved?.skipped===true||saved?.ok===false)throw Error('AI_HANDOFF_NOT_SAVED');
    return {status:200,body:{ok:true,revision:next.revision,variants:next.variants,durable:true}};
   });
   return res.status(result.status).json(result.body);
  }catch(e){return fail(res,e)}
 });
}
module.exports={register,buildPrompt,normalizeVariant};
