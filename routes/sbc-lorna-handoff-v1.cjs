'use strict';
/* Separate research handoff endpoints. Existing Lorna role rules must grant ONLY
 * these exact routes after review; no global CRM, marketing, or payments access.
 * Mount only with signed-in auth, server-derived tenant context and writer lease.
 */
const BASE='/api/account-social/v1/research';
function registerHandoffRoutes(app,{enabled=false,service,auth,resolveActor,writeReady=()=>false}={}){
 if(!enabled)return false;
 if(!app||typeof app.get!=='function'||typeof app.post!=='function')throw Error('EXPRESS_APP_REQUIRED');
 if(typeof auth!=='function'||typeof resolveActor!=='function')throw Error('AUTHENTICATED_HANDOFF_MIDDLEWARE_REQUIRED');
 if(!service||typeof service.submit!=='function')throw Error('HANDOFF_SERVICE_REQUIRED');
 function route(method,path,handler){app[method](BASE+path,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const a=await resolveActor(req);
   if(!a||!a.id||!a.role||!a.tenantId)throw Object.assign(Error('AUTHENTICATED_CONTEXT_REQUIRED'),{code:'AUTHENTICATED_CONTEXT_REQUIRED'});
   if(method!=='get'&&writeReady()!==true)return res.status(423).json({ok:false,error:'WRITER_NOT_READY'});
   const data=await handler(a,req);
   return res.status(method==='post'&&path==='/handoffs'?201:200).json({ok:true,data});
  }catch(e){const code=String(e?.code||'RESEARCH_HANDOFF_UNAVAILABLE');
   const status=/AUTHENTICATED|ACCESS_DENIED|OWNER_REQUIRED|RESEARCH_ROLE_REQUIRED|RESEARCHER_INACTIVE|RESEARCHER_NOT_ASSIGNED/.test(code)?403:
    /NOT_FOUND/.test(code)?404:/ALREADY|CONCURRENTLY|CHANGED|OWNER_REVIEW_REQUIRED/.test(code)?409:
    /INVALID|NOT_READY|SUPPRESSED|REQUIRED/.test(code)?400:503;
   return res.status(status).json({ok:false,error:code.replace(/[^A-Z0-9_]/g,'').slice(0,90)||'RESEARCH_HANDOFF_UNAVAILABLE'});
  }
 });}
 route('post','/handoffs',(a,r)=>service.submit(a,{customerId:r.body?.customerId,summary:r.body?.summary}));
 route('get','/queue',a=>service.queue(a));
 route('get','/feedback',a=>service.researchQueue(a));
 route('get','/summary',a=>service.summary(a));
 route('post','/handoffs/:handoffId/assign',(a,r)=>service.assign(a,{handoffId:r.params.handoffId,managerId:r.body?.managerId}));
 route('post','/handoffs/:handoffId/return',(a,r)=>service.returnForResearch(a,{handoffId:r.params.handoffId,issue:r.body?.issue,reason:r.body?.reason}));
 route('post','/feedback/:feedbackId/resolve',(a,r)=>service.resolve(a,{feedbackId:r.params.feedbackId,action:r.body?.action,note:r.body?.note,evidenceUrl:r.body?.evidenceUrl}));
 return true;
}
module.exports={registerHandoffRoutes,BASE};
