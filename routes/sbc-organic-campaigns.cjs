'use strict';
const C=require('../enterprise/sbc-campaign-core.cjs');
const {createStore}=require('../enterprise/sbc-campaign-store.cjs');
const {createWorker,configuration}=require('../enterprise/sbc-campaign-worker.cjs');
const {createGateway}=require('../enterprise/sbc-campaign-gateway.cjs');

function register(app,{auth,ownerOnly,tenantOf,corporateTenant,getPool,canWrite,getData,authorize,secret,
 cutover=()=>process.env.SBC_NATIVE_MARKETING_FROM_UTC,trackingOrigin=process.env.SBC_MARKETING_TRACKING_ORIGIN,clock=Date.now,log=()=>{}}){
 const gateway=createGateway({authorize,secret});
 const worker=createWorker({tenant:corporateTenant,getPool,canWrite,gateway,cutover,clock,log,trackingOrigin});
 const timer=setInterval(()=>worker.run().catch(()=>log('campaign_cycle_unavailable')),60000);
 timer.unref();
 app.get('/m/c/:content',async(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   res.setHeader('Referrer-Policy','no-referrer');
   res.setHeader('X-Robots-Tag','noindex');
   const m=/^sbc-([0-9a-z]{7,10})-(facebook|instagram|linkedin|google)$/.exec(req.params.content);
   if(!m)return res.sendStatus(404);
   const at=parseInt(m[1],36),pool=getPool();
   if(at<C.ANCHOR||at>C.currentSlot(clock())||C.currentSlot(at)!==at||at.toString(36)!==m[1])return res.sendStatus(404);
   if(!pool)return res.sendStatus(503);
   try{
     const ua=String(req.headers['user-agent']||'');
     const visit=req.method==='GET'&&req.headers['sec-fetch-mode']==='navigate'&&!/bot|crawler|spider|preview|facebookexternalhit/i.test(ua);
     const url=await createStore(pool,corporateTenant).visit(at,m[2],visit&&canWrite());
     if(!url||new URL(url).origin!=='https://sbcmia.com')return res.sendStatus(404);
     return res.redirect(302,url);
   }catch(e){return res.sendStatus(e.code==='ER_NO_SUCH_TABLE'?404:503);}
 });
 function mount(method,path,action){
   app[method]('/api/marketing/campaigns'+path,auth,ownerOnly,async(req,res)=>{
     res.setHeader('Cache-Control','private, no-store');
     try{
       if(tenantOf(req)!==corporateTenant)return res.status(403).json({ok:false,error:'SBC_BUSINESS_ACCOUNT_REQUIRED'});
       const pool=getPool();
       if(!pool)return res.status(503).json({ok:false,error:'CAMPAIGN_STORE_UNAVAILABLE'});
       if(method!=='get'&&!canWrite())return res.status(423).json({ok:false,error:'CAMPAIGN_WRITER_UNAVAILABLE'});
       const db=createStore(pool,corporateTenant);
       res.json({ok:true,...await action(req,db)});
     }catch(e){res.status(e.status||503).json({ok:false,error:e.status?e.message:'CAMPAIGN_STORE_UNAVAILABLE'});}
   });
 }
 mount('get','',async(req,db)=>{
   let custom=[],history=[];
   try{custom=await db.catalog();history=await db.history(clock()-30*86400000,clock());}
   catch(e){if(e.code!=='ER_NO_SUCH_TABLE')throw e;}
   const catalog=[...C.evergreen,...custom],next=Math.max(C.ANCHOR,C.currentSlot(clock())+C.INTERVAL);
   const plan=Array.from({length:6},(_,i)=>C.channels.map(p=>C.buildSlot(next+i*C.INTERVAL,p,catalog,trackingOrigin))).flat();
   const mode=configuration(cutover());
   return {mode,catalog,approvedImages:C.approvedImages,plan,history:history.slice(0,48),
     counts:history.reduce((out,s)=>{out[s.state]=(out[s.state]||0)+1;return out;},{}),
     performance:canWrite()?C.measure(history,getData(),corporateTenant):null,canWrite:canWrite()};
 });
 mount('post','',async(req,db)=>{
   let spec;try{spec=C.validateCampaign(req.body);}catch(e){throw Object.assign(e,{status:400});}
   await db.setup();return {id:await db.add(spec)};
 });
 mount('post','/:id/archive',async(req,db)=>{
   if(!await db.archive(req.params.id))throw Object.assign(Error('CAMPAIGN_NOT_ACTIVE'),{status:404});
   return {archived:true};
 });
 mount('post','/connections/check',async()=>{
   const result=await Promise.all(C.channels.map(async platform=>{
     try{await gateway.connect(platform);return [platform,'Account read verified'];}
     catch(e){return [platform,/^[A-Z][A-Z_0-9]{0,78}$/.test(e.code||'')?e.code:'ACCOUNT_READ_UNAVAILABLE'];}
   }));
   return {connections:Object.fromEntries(result)};
 });
 return {stop:()=>clearInterval(timer)};
}
module.exports={register};
