'use strict';
// Owner-only Account 360 → Website Studio bridge.
// Opt-in private concepts. Never auto-approves research, contacts visitors,
// changes demo approval, purchases services or publishes a public website.
const {verifiedProfile}=require('./contracts.cjs');
const {createPrivateConcept}=require('./index.cjs');
const ROOT='/api/website-production/sites/:id/studio';
const isRecord=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const strictKeys=(value,permitted)=>isRecord(value)&&Object.keys(value).every(k=>permitted.includes(k));
const trimmed=value=>typeof value==='string'?value.trim():value;
function buildApprovedProfile(raw,site,actor){
 if(!strictKeys(raw,['business','services','contact']))throw Error('INVALID_SITE_PROFILE');
 if(!strictKeys(raw.business,['name','category','city','region'])||!strictKeys(raw.contact,['phone','email'])||!Array.isArray(raw.services))throw Error('INVALID_SITE_PROFILE');
 const identity=String(site?.customer?.businessName||'').trim();
 if(!identity)throw Error('BUSINESS_IDENTITY_REQUIRED');
 if(typeof raw.business.name!=='string'||trimmed(raw.business.name).toLocaleLowerCase('en-US')!==identity.toLocaleLowerCase('en-US'))throw Error('CUSTOMER_IDENTITY_MISMATCH');
 if(raw.services.length>12)throw Error('INVALID_SITE_PROFILE');
 const services=raw.services.map(service=>{
  if(!strictKeys(service,['name','description']))throw Error('INVALID_SITE_PROFILE');
  return {name:trimmed(service.name),description:trimmed(service.description)||'',provenance:{kind:'owner_confirmed'}};
 });
 if(new Set(services.map(s=>String(s.name).toLocaleLowerCase('en-US'))).size!==services.length)throw Error('DUPLICATE_SITE_SERVICE');
 const profile={schemaVersion:1,
  business:{name:identity,category:trimmed(raw.business.category),city:trimmed(raw.business.city)||'',region:trimmed(raw.business.region)||''},
  services,reviews:[],contact:{phone:trimmed(raw.contact.phone)||'',email:trimmed(raw.contact.email)||''},
  verification:{approvedBy:String(actor.id||''),approvedAt:new Date().toISOString()}};
 verifiedProfile(profile);
 return profile;
}
function register(app,{auth,ownerOnly,requireTenant,getStore,saveStore,writerReady,serializeSiteMutation}){
 if(typeof auth!=='function'||typeof ownerOnly!=='function'||typeof requireTenant!=='function'||typeof getStore!=='function'||typeof saveStore!=='function'||typeof writerReady!=='function')throw Error('STUDIO_DEPENDENCY_REQUIRED');
 let approvalQueue=Promise.resolve();
 const respond=(res,code,status=400)=>res.status(status).json({ok:false,code});
 const locate=req=>{
  const tid=Number(requireTenant(req));
  if(!Number.isSafeInteger(tid)||tid<1)throw Error('TENANT_CONTEXT_REQUIRED');
  const id=String(req.params.id||'');
  if(!id||id.length>120)throw Error('INVALID_SITE_ID');
  const store=getStore();
  return (Array.isArray(store?.websiteDemos)?store.websiteDemos:[]).find(s=>String(s.id)===id&&Number(s.tenantId)===tid)||null;
 };
 const responseError=(res,e)=>{
  const code=String(e?.message||'STUDIO_ERROR');
  if(code==='TENANT_CONTEXT_REQUIRED')return respond(res,code,403);
  if(code==='CUSTOMER_IDENTITY_MISMATCH'||code==='STALE_SITE_VERSION'||code==='APPROVED_SITE_LOCKED'||code==='SITE_ARCHIVED'||code==='STUDIO_NOT_EDITABLE'||code==='STUDIO_PROFILE_NOT_APPROVED')return respond(res,code,409);
  if(code==='STUDIO_SAVE_NOT_DURABLE')return respond(res,code,503);
  return respond(res,/^(INVALID_|BUSINESS_IDENTITY_REQUIRED|DUPLICATE_)/.test(code)?code:'STUDIO_ERROR',/^(INVALID_|BUSINESS_IDENTITY_REQUIRED|DUPLICATE_)/.test(code)?400:503);
 };
 const fetchApproved=site=>{
  const profile=site.websiteStudioApprovedProfile;
  if(!profile||!Number.isSafeInteger(site.websiteStudioProfileVersion)||site.websiteStudioProfileVersion<1)return null;
  verifiedProfile(profile);
  if(profile.business.name.toLocaleLowerCase('en-US')!==String(site.customer?.businessName||'').trim().toLocaleLowerCase('en-US'))throw Error('CUSTOMER_IDENTITY_MISMATCH');
  return profile;
 };
 const readonly=(req,res,callback)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{const site=locate(req);if(!site)return respond(res,'WEBSITE_NOT_FOUND',404);return callback(site)}catch(e){return responseError(res,e)}
 };
 app.get(ROOT,auth,ownerOnly,(req,res)=>readonly(req,res,site=>{
  const c=site.customer||{};
  return res.json({ok:true,id:String(site.id),status:String(site.status||''),archived:site.archived===true,version:site.websiteStudioProfileVersion||0,
   identity:{name:String(c.businessName||''),category:String(site.industry||c.industry||''),city:String(c.city||''),region:String(c.region||'')},
   approvedProfile:fetchApproved(site),canApprove:site.archived!==true&&['Draft','Pending'].includes(site.status)});
 }));
 app.patch(ROOT+'/approved-profile',auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!writerReady())return respond(res,'WEBSITE_PRODUCTION_WRITER_UNAVAILABLE',423);
  const work=async()=>{
   if(!writerReady())return {status:423,body:{ok:false,code:'WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'}};
   const site=locate(req);if(!site)return {status:404,body:{ok:false,code:'WEBSITE_NOT_FOUND'}};
   if(site.archived===true)throw Error('SITE_ARCHIVED');
   if(!['Draft','Pending'].includes(site.status))throw Error('APPROVED_SITE_LOCKED');
   const data=req.body;
   if(!strictKeys(data,['expectedVersion','ownerConfirmed','profile'])||data.ownerConfirmed!==true||!Number.isSafeInteger(data.expectedVersion)||data.expectedVersion<0)throw Error('INVALID_SITE_APPROVAL');
   const expected=site.websiteStudioProfileVersion||0;
   if(data.expectedVersion!==expected)throw Error('STALE_SITE_VERSION');
   const approved=buildApprovedProfile(data.profile,site,req.user);
   const updated={...site,websiteStudioProfileVersion:expected+1,websiteStudioApprovedProfile:approved,
    websiteStudioAudit:{action:'OWNER_CONFIRMED_FACTS',actorId:String(req.user.id),approvedAt:approved.verification.approvedAt,version:expected+1}};
   const current=getStore(),next={...current,websiteDemos:current.websiteDemos.map(s=>String(s.id)===String(site.id)&&Number(s.tenantId)===Number(site.tenantId)?updated:s)};
   const saved=await saveStore(next);
   if(saved?.ok===false||saved?.skipped===true||saved?.durable===false)throw Error('STUDIO_SAVE_NOT_DURABLE');
   return {status:200,body:{ok:true,durable:true,id:String(site.id),version:expected+1,approvedProfile:approved}};
  };
  const operation=serializeSiteMutation ? serializeSiteMutation(work) : approvalQueue.catch(()=>undefined).then(work);
  if(!serializeSiteMutation)approvalQueue=operation.then(()=>undefined,()=>undefined);
  try{const result=await operation;return res.status(result.status).json(result.body)}catch(e){return responseError(res,e)}
 });
 const concept=(req,res,mode)=>readonly(req,res,site=>{
  const profile=fetchApproved(site);
  if(!profile)return respond(res,'STUDIO_PROFILE_NOT_APPROVED',409);
  const {bundle}=createPrivateConcept({verified_profile:profile,quoteEstimatorEnabled:true});
  if(mode==='bundle')return res.json({ok:true,publicationReady:false,files:bundle.files});
  // CSP sandbox isolates preview from Command Center and disables network and forms.
  const css=bundle.files['styles.css'].replace(/<\/style/gi,'<\\/style');
  const js=bundle.files['site.js'].replace(/<\/script/gi,'<\\/script');
  const html=bundle.files['index.html']
   .replace('<link rel="stylesheet" href="styles.css">','<style>'+css+'</style>')
   .replace('<script defer src="site.js"></script>','')
   .replace('</body>','<script>'+js+'</script></body>');
  res.setHeader('Content-Security-Policy',"sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'");
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.send(html);
 });
 app.get(ROOT+'/preview',auth,ownerOnly,(req,res)=>concept(req,res,'preview'));
 app.get(ROOT+'/bundle',auth,ownerOnly,(req,res)=>concept(req,res,'bundle'));
}
module.exports={register,buildApprovedProfile};
