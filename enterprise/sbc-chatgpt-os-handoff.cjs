'use strict';
/** SBC ChatGPT OS handoff: stores ONLY owner-reviewed notes, never executes actions.
 * No paid AI API, CRM customer edits, payment writes, outreach, or auto-publishing.
 */
const crypto=require('node:crypto');
const PATH='/api/owner/chatgpt-handoff/reviews';
const SECTIONS=new Set(['Home','Leads & Accounts','Sales','Fulfillment','Team','Training','Growth','Marketing','Communications','Website Production','Money & Readiness','Admin','Operations']);
const REQUEST=/^sbc-os-[a-f0-9]{32}$/;
const clean=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)?value.trim():null;
function validate(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['requestId','section','task','brief','response','reviewed'].includes(k)))return null;
 const requestId=clean(body.requestId,40),section=clean(body.section,40),task=clean(body.task,150),brief=clean(body.brief,3000),response=clean(body.response,12000);
 if(!REQUEST.test(requestId||'')||!SECTIONS.has(section)||!task||!response||response.length<4||brief===null||body.reviewed!==true)return null;
 return {requestId,section,task,brief,response};
}
function register(app,{auth,ownerOnly,requireTenant,getStore,saveStore,writerReady,serializeSiteMutation}){
 if(typeof serializeSiteMutation!=='function'||typeof saveStore!=='function')throw Error('SBC_CHATGPT_OS_DURABLE_SERIALIZATION_REQUIRED');
 const ownerId=req=>String(req.user?.id||'').trim().slice(0,120);
 const tenantId=req=>{
  let n;try{n=Number(requireTenant(req))}catch{n=0}
  return Number.isSafeInteger(n)&&n>0&&ownerId(req)&&String(req.user?.role)==='owner'?n:null;
 };
 const visible=(items,req,tid)=>(Array.isArray(items)?items:[]).filter(x=>x&&Number(x.tenantId)===tid&&String(x.ownerId)===ownerId(req));
 app.get(PATH,auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const tid=tenantId(req);if(!tid)return res.status(403).json({ok:false,code:'OWNER_TENANT_REQUIRED'});
  const data=visible(getStore()?.sbcChatGPTOwnerReviews,req,tid).slice(0,20);
  return res.json({ok:true,records:data,source:'OWNER_REVIEW_ONLY',externalAiConnected:false});
 });
 app.post(PATH,auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const tid=tenantId(req);if(!tid)return res.status(403).json({ok:false,code:'OWNER_TENANT_REQUIRED'});
  const input=validate(req.body);if(!input)return res.status(422).json({ok:false,code:'REVIEW_INPUT_INVALID'});
  if(!writerReady())return res.status(423).json({ok:false,code:'OWNER_REVIEW_WRITER_UNAVAILABLE'});
  try{
   const out=await serializeSiteMutation(async()=>{
    if(!writerReady())return {status:423,body:{ok:false,code:'OWNER_REVIEW_WRITER_UNAVAILABLE'}};
    const store=getStore(),all=Array.isArray(store.sbcChatGPTOwnerReviews)?store.sbcChatGPTOwnerReviews:[];
    const existing=visible(all,req,tid).find(x=>x.requestId===input.requestId);
    if(existing){
     if(existing.task!==input.task||existing.brief!==input.brief||existing.response!==input.response||existing.section!==input.section)
      return {status:409,body:{ok:false,code:'REVIEW_REQUEST_CONFLICT'}};
     return {status:200,body:{ok:true,duplicate:true,record:existing}};
    }
    const record={id:'sbc-os-review-'+crypto.randomUUID(),tenantId:tid,ownerId:ownerId(req),requestId:input.requestId,
      section:input.section,task:input.task,brief:input.brief,response:input.response,status:'OWNER_REVIEW_ONLY',
      createdAt:new Date().toISOString(),externalAction:false};
    const owners=visible(all,req,tid),remove=owners.length>=50?new Set(owners.slice(49).map(x=>x.id)):new Set();
    const next={...store,sbcChatGPTOwnerReviews:[record,...all.filter(x=>!remove.has(x.id))].slice(0,500)};
    const saved=await saveStore(next);
    if(saved?.skipped===true||saved?.ok===false)throw Error('OWNER_REVIEW_NOT_DURABLE');
    return {status:201,body:{ok:true,record,durable:true,externalAction:false}};
   });
   return res.status(out.status).json(out.body);
  }catch{return res.status(503).json({ok:false,code:'OWNER_REVIEW_SAVE_UNVERIFIED'})}
 });
}
module.exports={PATH,validate,register};
