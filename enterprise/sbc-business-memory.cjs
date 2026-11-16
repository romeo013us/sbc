'use strict';
/** SBC owner-approved business reference. NOT a ChatGPT memory export/sync.
 * Storage is tenant+owner isolated and serialized through existing durable store.
 * This module never sends text to an AI or modifies any business records.
 */
const PATH='/api/owner/business-memory';
const DEFAULT_PROFILE=[
'BUSINESS IDENTITY',
'Successful By Choice LLC (SBC), based in Miami, Florida. Motto: "Because Why Not?". Public website: sbcmia.com; hosting/reseller website: sbcwebsites.com.',
'SBC provides websites, domains and hosting, Google Business Profile help, website maintenance, business cards and printed promotional material, branding, and small-business technology.',
'',
'THE FANTASTIC FOUR',
'1. Command Center — private SBC CRM, sales, account management, team, order tracking, and fulfillment.',
'2. Office Box — separate customer CRM. Paid subscriptions are separate, verified transactions.',
'3. sbcmia.com — agency website and SBC services.',
'4. sbcwebsites.com — hosting and domain reseller.',
'',
'APPROVED PUBLIC WEBSITE PACKAGES (one-time setup)',
'$99 Business Visibility: Google Business Profile and business cards, no website.',
'$199 Business Starter: scope-limited one-page website.',
'$499 Business Basic: scope-limited four-page website and 100 business cards.',
'$899 Business Essentials: expanded website, email setup, 500 cards and agreed SEO/security scope.',
'$1,499 Complete Business Launch: multi-page website, GBP assistance, email setup, business cards and Office Box orientation.',
'From $2,499 Custom Business Platform: custom quote and written scope before checkout.',
'Optional Website Care costs $79/month, requires separately approved recurring billing. Other licenses, hosting, renewals and maintenance may be additional.',
'',
'OPERATING GOALS AND GUARDRAILS',
'Build a profitable, reliable and professional 9.5+/10 God Tier small-business services company.',
'Keep software and AI costs low; prefer existing tools and owner-reviewed work. Protect recurring margins.',
'Honor previously agreed customer pricing. Never infer Square payment settlement from a browser click or a demo order.',
'Require written scope approval and owner authorization for live payment changes, vendor fulfillment, outreach, database mutations, and publishing.',
'Separate $0 QA simulation from actual paid orders; require provider evidence for payment and delivery.',
'',
'TEAM AND AI RESPONSIBILITIES',
'Kim provides internal operations assistance. Kevin provides control, safety and verification. External ChatGPT helps with owner-controlled writing, research, planning and development, but is not automatically connected to the CRM.',
'Lead research, account management, sales, fulfillment and training should remain permission-scoped and auditable.',
'',
'SALES AND CUSTOMER QUALITY',
'Serve small businesses across industries in Miami, South Florida and beyond. Use clear offers, careful consent, verified contacts, professional websites, and measured lead-to-paid-order conversion.',
'Track vendor costs, labor hours, payment fees and real profit per order. Protect tenant boundaries.',
'Do not include private customer contacts, private records, payment details, API keys, personal health information or passwords in an external ChatGPT prompt without explicit authorization.',
'',
'LIMITATIONS',
'This is an editable owner-approved business context template, not a live database, legal advice, a financial report, or an automatic export of ChatGPT account Memory. Verify current claims in the authoritative system.'
].join('\n');
const SECRET=/(?:\b(?:SBC_(?:API|AUTH|WEBHOOK|SESSION|COOKIE|ENCRYPTION|VAULT)_SECRET|OPENAI_API_KEY|API[_-]?KEY|SECRET[_-]?KEY|ACCESS[_-]?TOKEN|PASSWORD|PRIVATE[_-]?KEY)\s*[:=]\s*\S+)|(?:\b(?:sk|rk)-(?:live-|test-)?[A-Za-z0-9_\-]{12,})|(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i;
const validText=v=>typeof v==='string'&&v.trim().length>=60&&v.length<=10000&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v)&&!SECRET.test(v);
function validate(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['expectedRevision','approved','content'].includes(k)))return null;
 if(body.approved!==true||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!validText(body.content))return null;
 return {expectedRevision:body.expectedRevision,content:body.content.trim()};
}
function register(app,{auth,ownerOnly,requireTenant,getStore,saveStore,writerReady,serializeSiteMutation}){
 if(typeof serializeSiteMutation!=='function'||typeof saveStore!=='function')throw Error('SBC_BUSINESS_MEMORY_DURABILITY_REQUIRED');
 const identity=req=>{
  let tid;try{tid=Number(requireTenant(req))}catch{tid=NaN}
  const oid=String(req.user?.id||'').trim();
  return String(req.user?.role)==='owner'&&oid&&Number.isSafeInteger(tid)&&tid>0?{tenantId:tid,ownerId:oid}:null;
 };
 const own=(items,id)=>items.find(x=>x&&Number(x.tenantId)===id.tenantId&&String(x.ownerId)===id.ownerId);
 const view=r=>r?{content:r.content,revision:r.revision,updatedAt:r.updatedAt,source:'OWNER_APPROVED'}:
  {content:DEFAULT_PROFILE,revision:0,updatedAt:null,source:'CURATED_TEMPLATE_UNSAVED'};
 app.get(PATH,auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');const id=identity(req);
  if(!id)return res.status(403).json({ok:false,code:'BUSINESS_MEMORY_OWNER_TENANT_REQUIRED'});
  const store=getStore(),all=Array.isArray(store?.sbcBusinessKnowledgeProfiles)?store.sbcBusinessKnowledgeProfiles:[],record=own(all,id);
  return res.json({ok:true,profile:view(record),revisions:(record?.history||[]).slice(0,10).map(h=>({revision:h.revision,updatedAt:h.updatedAt,content:h.content})),
   autoSync:false,externalAIConnected:false});
 });
 app.put(PATH,auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const id=identity(req);
  if(!id)return res.status(403).json({ok:false,code:'BUSINESS_MEMORY_OWNER_TENANT_REQUIRED'});
  const input=validate(req.body);
  if(!input)return res.status(422).json({ok:false,code:'BUSINESS_MEMORY_INPUT_INVALID'});
  if(!writerReady())return res.status(423).json({ok:false,code:'BUSINESS_MEMORY_WRITER_UNAVAILABLE'});
  try{
   const result=await serializeSiteMutation(async()=>{
    if(!writerReady())return {status:423,body:{ok:false,code:'BUSINESS_MEMORY_WRITER_UNAVAILABLE'}};
    const store=getStore(),all=Array.isArray(store.sbcBusinessKnowledgeProfiles)?store.sbcBusinessKnowledgeProfiles:[],current=own(all,id);
    const revision=Number(current?.revision||0);
    if(revision!==input.expectedRevision)return {status:409,body:{ok:false,code:'BUSINESS_MEMORY_REVISION_CONFLICT',currentRevision:revision}};
    const updatedAt=new Date().toISOString();
    const profile={tenantId:id.tenantId,ownerId:id.ownerId,content:input.content,revision:revision+1,updatedAt,
     history:current?[{revision,content:current.content,updatedAt:current.updatedAt},...(current.history||[])].slice(0,10):[]};
    const saved=await saveStore({...store,sbcBusinessKnowledgeProfiles:[profile,...all.filter(x=>!(Number(x.tenantId)===id.tenantId&&String(x.ownerId)===id.ownerId))].slice(0,250)});
    if(saved?.ok===false||saved?.skipped===true)throw Error('BUSINESS_MEMORY_NOT_DURABLE');
    return {status:200,body:{ok:true,profile:view(profile),durable:true,externalAction:false}};
   });
   return res.status(result.status).json(result.body);
  }catch{return res.status(503).json({ok:false,code:'BUSINESS_MEMORY_SAVE_UNVERIFIED'})}
 });
}
module.exports={PATH,DEFAULT_PROFILE,validate,register};
