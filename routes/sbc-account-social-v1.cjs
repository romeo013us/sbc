'use strict';
/* Explicitly mounted Account Manager + Social API. Dark by default.
 * The authenticated application MUST supply auth and resolveActor.
 * request bodies, headers and query parameters are never identity sources.
 * No public publishing endpoint and no timers are registered here.
 */
const PATH='/api/account-social/v1';
function registerAccountSocialRoutes(app,{enabled=false,service,auth,resolveActor,writeReady=()=>false}={}){
 if(!enabled)return false;
 if(!app||typeof app.get!=='function'||typeof app.post!=='function'||typeof app.put!=='function')throw Error('EXPRESS_APP_REQUIRED');
 if(typeof auth!=='function')throw Error('AUTH_MIDDLEWARE_REQUIRED');
 if(typeof resolveActor!=='function')throw Error('AUTHENTICATED_ACTOR_RESOLVER_REQUIRED');
 if(!service||typeof service.portfolio!=='function')throw Error('ACCOUNT_SOCIAL_SERVICE_REQUIRED');
 function route(method,path,fn){
  app[method](PATH+path,auth,async(req,res)=>{
   try{
    if(method!=='get'&&!writeReady())return res.status(423).json({ok:false,error:'WRITER_NOT_READY'});
    const actor=await resolveActor(req);
    if(!actor||!actor.id||!actor.role||!actor.tenantId)throw Object.assign(Error('AUTHENTICATED_CONTEXT_REQUIRED'),{code:'AUTHENTICATED_CONTEXT_REQUIRED'});
    const value=await fn(actor,req);
    res.setHeader('Cache-Control','no-store');
    return res.status(method==='post'&&path==='/posts'?201:200).json({ok:true,data:value});
   }catch(e){
    const code=String(e?.code||e?.message||'ACCOUNT_SOCIAL_UNAVAILABLE');
    const status=/AUTHENTICATED|ACCESS_DENIED|OWNER_REQUIRED|SYSTEM_ROLE_REQUIRED/.test(code)?403:
     /NOT_FOUND/.test(code)?404:/TRANSITION|CONCURRENTLY|CHANGED/.test(code)?409:
     /INVALID|REQUIRED|EMPTY|HTTPS|NOT_VERIFIED|MISMATCH|MANAGER_INVALID/.test(code)?400:503;
    res.setHeader('Cache-Control','no-store');return res.status(status).json({ok:false,error:code.replace(/[^A-Z0-9_]/g,'').slice(0,80)||'ACCOUNT_SOCIAL_UNAVAILABLE'});
   }
  });
 }
 route('get','/portfolio',(a)=>service.portfolio(a));
 route('put','/accounts/:customerId/manager',(a,r)=>service.assign(a,{customerId:r.params.customerId,managerId:r.body?.managerId}));
 route('post','/accounts/:customerId/interactions',(a,r)=>service.logInteraction(a,{customerId:r.params.customerId,kind:r.body?.kind,summary:r.body?.summary}));
 route('get','/accounts/:customerId/channels',(a,r)=>service.channels(a,r.params.customerId));
 route('post','/accounts/:customerId/channels',(a,r)=>service.connectChannel(a,{customerId:r.params.customerId,platform:r.body?.platform,providerAccountId:r.body?.providerAccountId,secretRef:r.body?.secretRef}));
 route('post','/channels/:channelId/verify',(a,r)=>service.verifyChannel(a,r.params.channelId));
 route('get','/accounts/:customerId/posts',(a,r)=>service.posts(a,r.params.customerId));
 route('post','/posts',(a,r)=>service.draftPost(a,{channelId:r.body?.channelId,body:r.body?.body,mediaUrl:r.body?.mediaUrl,ctaUrl:r.body?.ctaUrl}));
 route('get','/posts/:postId',(a,r)=>service.getPost(a,r.params.postId));
 route('post','/posts/:postId/submit',(a,r)=>service.submitPost(a,r.params.postId));
 route('post','/posts/:postId/approve',(a,r)=>service.approvePost(a,r.params.postId));
 route('post','/posts/:postId/schedule',(a,r)=>service.schedulePost(a,r.params.postId,r.body?.scheduledAt));
 return true;
}
module.exports={registerAccountSocialRoutes,PATH};
