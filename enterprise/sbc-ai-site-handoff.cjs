'use strict';
// Owner-only, tenant-scoped ChatGPT handoff for four independent website proposals.
// No automatic ChatGPT session access, external AI charge, publishing, or outreach.
const ROOT='/api/website-production/customers/:id/ai-proposals';
const TIERS=Object.freeze([199,499,799,999]);
const clean=(v,max)=>String(v??'').trim().slice(0,max);
function buildPrompt(customer){
 const profile=customer?.websiteVerifiedDetails?.verified===true?customer.websiteVerifiedDetails:null;
 const business=clean(customer?.businessName||customer?.contactName||'Business',120);
 const industry=clean(customer?.industry||'Business services',80);
 const city=clean(customer?.city||'',80);
 const services=Array.isArray(profile?.services)?profile.services.map(x=>clean(typeof x==='string'?x:x?.name,70)).filter(Boolean).slice(0,12):[];
 return [
 'You are creating FOUR separate high-quality customer-ready WEBSITE PROJECTS for Successful By Choice.',
 'Business: '+business,
 'Industry: '+industry,
 'Location: '+(city||'not supplied'),
 'Owner-confirmed services: '+(services.length?services.join(', '):'NOT YET VERIFIED — ask for facts, do not invent services'),
 'Use distinct, premium art direction but the SAME verified business identity in each version.',
 'Create a working responsive implementation and a deployable project ZIP for each tier:',
 '1. $199 STARTER — a polished single-page website with hero, services, contact and clear calls to action.',
 '2. $499 CUSTOM — a premium multi-page website with richer functionality appropriate to the business, and editable content.',
 '3. $799 ADVANCED PROPOSAL — an advanced working design concept; include only operational features actually implemented and tested, otherwise mark them planned.',
 '4. $999 GROWTH — a premium multi-page website with accessible navigation, technical SEO fundamentals, fast loading, and working lead capture only where a real endpoint exists.',
 'Quality benchmark: C & T Auto Motors Signature V2. No generic or broken layouts; test navigation, desktop, mobile, styling, accessible inputs and deployment.',
 'Do not fabricate reviews, prices, vehicles, credentials, legal promises, booking availability, or customer claims.',
 'Use clearly labeled example content when photos/prices are pending; do not represent examples as real inventory.',
 'Never collect sensitive identity, financial, or health information through an unsecured form.',
 'Keep all four builds separate with a comparison of included features, tests performed, remaining setup, and deployment instructions.',
 'The user will download each website ZIP and upload it directly into the matching SBC customer proposal slot for private review; no manual hosting or URL entry is needed.',
 'These are owner-reviewed PROPOSALS; do not publish, contact the prospect, make purchases, or modify the live site without approval.'
 ].join('\n');
}
// One customer + one selected package. The original multi-site request now covers four approved packages.
function buildTierPrompt(customer,tier){
 const amount=Number(tier);
 if(!TIERS.includes(amount))throw Error('INVALID_TIER');
 const profile=customer?.websiteVerifiedDetails?.verified===true?customer.websiteVerifiedDetails:null;
 const business=clean(customer?.businessName||customer?.contactName||'Business name not recorded',120);
 const industry=clean(customer?.industry||'Not verified',80);
 const city=clean(customer?.city||'',80);
 const services=Array.isArray(profile?.services)?profile.services.map(x=>clean(typeof x==='string'?x:x?.name,70)).filter(Boolean).slice(0,12):[];
 const packages={
  199:'STARTER: a polished responsive single-page website with essential sections and clear contact calls to action.',
  499:'CUSTOM: a premium responsive multi-page site with editable source and genuinely working components.',
  799:'ADVANCED: a premium multi-page proposal with polished interactions, accessible controls, and only features that truly work.',
  999:'GROWTH: a premium responsive multi-page site with strong technical SEO foundations, accessible navigation and fast loading. Include working lead capture only with a real endpoint; otherwise clearly label backend setup requirements. Do not claim hosting, SSL issuance or results without verification.'
 };
 return [
  'Build ONE complete website project for Successful By Choice. Package: $'+amount+'.',
  'Business name from SBC account: '+business,
  'CRM industry (verify before publishing): '+industry,
  'CRM location: '+(city||'Not supplied'),
  'Owner-confirmed services: '+(services.length?services.join(', '):'NOT YET VERIFIED. Request confirmed services; never invent them.'),
  'Project scope: '+packages[amount],
  'You are the website developer. Write the full responsive website code and provide ONE complete downloadable ZIP of all required HTML, CSS, JavaScript, and assets.',
  'Include index.html at the ZIP root. Use relative local asset paths so the project opens in the SBC private ZIP preview.',
  'Ensure navigation links, responsive layouts, and interactive components you claim to provide have working implementations.',
  'Label placeholders for unverified phone numbers, email, addresses, photos, prices and business claims. Never invent reviews, awards, licenses or testimonials.',
  'Make this website distinctive, fast, readable, accessible, and appropriate to the business. No third-party builder subscription or paid API is required to run it.',
  'Use local assets where licensing permits, and clearly identify any external dependencies or features requiring a backend.',
  'Test what is possible, honestly list any untested behavior, and provide preview instructions and exact deployment requirements.',
  'Do not publish, contact customers, register domains, place orders or incur charges.',
  'I will upload the ZIP to the selected SBC customer account for owner review and saved revisions.'
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
 const conceptOnly=require('./sbc-ai-concept-access.cjs').middleware({db,requireTenant});
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
 app.get(ROOT,auth,conceptOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {tid,id,customer}=target(req);
   if(!customer)return res.status(404).json({ok:false,code:'CUSTOMER_NOT_FOUND'});
   const saved=current(tid,id);
   return res.json({ok:true,customerId:id,revision:saved?.revision||0,variants:saved?.variants||{},prompt:buildPrompt(customer),prompts:Object.fromEntries(TIERS.map(t=>[String(t),buildTierPrompt(customer,t)])),mode:'CHATGPT_MANUAL_HANDOFF',automated:false});
  }catch(e){return fail(res,e)}
 });
 app.patch(ROOT,auth,conceptOnly,async(req,res)=>{
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
 // Extend the existing authenticated proposal workspace; use the same tenant,
 // owner and writer safeguards instead of adding an unaudited parallel account API.
 require('./sbc-ai-zip-proposals.cjs').register(app,{auth,ownerOnly,requireTenant,db,getStore,saveStore,writerReady,serializeSiteMutation});
}
module.exports={register,buildPrompt,buildTierPrompt,normalizeVariant};
