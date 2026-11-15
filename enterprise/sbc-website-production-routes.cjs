'use strict';
const P=require('./sbc-website-workorders.cjs');
const Editor=require('./sbc-instant-site-editor.cjs');
const StudioOwner=require('./website-studio/studio-owner-routes.cjs');
const {createController}=require('./website-studio/hybrid-ai.cjs');
function register(app,{auth,ownerOnly,requireTenant,db,getStore,saveStore,writerReady,paidGuard,hybridAIController,recordGlobalSpend}){
 const respond=(res,e)=>{const code=String(e?.message||e);const status=/TENANT_CONTEXT|NOT_ASSIGNED|OWNER_REQUIRED|ASSIGNEE_INVALID/.test(code)?403:/PAYMENT_EVIDENCE|PREREQUISITES|WEBSITE_NOT_APPROVED|CUSTOMER_MISMATCH|ALREADY_COMPLETED/.test(code)?409:/UNKNOWN_TASK|INVALID|REQUIRED/.test(code)?400:503;return res.status(status).json({ok:false,code})};
 const tenant=req=>{const n=Number(requireTenant(req));if(!Number.isSafeInteger(n)||n<1)throw Error('TENANT_CONTEXT_REQUIRED');return n};
 const available=(res)=>{if(!writerReady()){res.status(423).json({ok:false,code:'WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'});return false}return true};
 const orders=()=>{const m=getStore();return Array.isArray(m.websiteProductionOrders)?m.websiteProductionOrders:[]};

 // Serializes draft saves within the published writer process, so two editors
 // cannot read the same version and both claim successful persistence.
 let editQueue=Promise.resolve();
 const serializeSiteMutation=work=>{
   const operation=editQueue.catch(()=>undefined).then(work);
   editQueue=operation.then(()=>undefined,()=>undefined);
   return operation;
 };
 const readSite=(req)=>{
   const t=tenant(req);
   const m=getStore();
   return (Array.isArray(m.websiteDemos)?m.websiteDemos:[]).find(x=>
     String(x.id)===String(req.params.id)&&Number(x.tenantId)===t)||null;
 };
 app.get('/api/website-production/sites/:id/editor',auth,ownerOnly,(req,res)=>{
   let site;try{site=readSite(req)}catch(e){return respond(res,e)}
   if(!site)return res.status(404).json({ok:false,code:'WEBSITE_NOT_FOUND'});
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,site:Editor.view(site)});
 });
 app.patch('/api/website-production/sites/:id/editor',auth,ownerOnly,async(req,res)=>{
   if(!available(res))return;
   let result;
   const operation=serializeSiteMutation(async()=>{
     // Resolve the row and expectedVersion INSIDE the serialized critical section.
     const site=readSite(req);
     if(!site)return {status:404,body:{ok:false,code:'WEBSITE_NOT_FOUND'}};
     let updated;try{updated=Editor.apply(site,req.body);}
     catch(e){
       const code=String(e.message||e);
       const status=/STALE_SITE_VERSION|APPROVED_SITE_LOCKED|SITE_ARCHIVED|SITE_NOT_EDITABLE/.test(code)?409:
         /UNSUPPORTED_SITE_FIELD|INVALID_SITE_/.test(code)?400:503;
       return {status,body:{ok:false,code}};
     }
     const m=getStore();
     const existing=Array.isArray(m.websiteDemos)?m.websiteDemos:[];
     const next={...m,websiteDemos:existing.map(x=>String(x.id)===String(updated.id)&&Number(x.tenantId)===tenant(req)?updated:x)};
     const saved=await saveStore(next);
     if(saved?.skipped===true||saved?.ok===false)throw Error('WEBSITE_EDIT_NOT_DURABLE');
     return {status:200,body:{ok:true,site:Editor.view(updated),durable:true}};
   });
   try{result=await operation;}catch(e){return respond(res,e)}
   res.setHeader('Cache-Control','no-store');
   return res.status(result.status).json(result.body);
 });

 // New approved-facts Studio operates alongside existing editor, not in place of it.
 StudioOwner.register(app,{auth,ownerOnly,requireTenant,getStore,saveStore,writerReady,serializeSiteMutation,db});
 // Hybrid AI is separate from legacy paid-demo generation. Read-only private
 // status and owner-authorized manual upgrade are tenant-scoped and fail closed.
 const hybridAI=hybridAIController||createController({getStore,saveStore,writerReady,requireGlobalCap:true,reserveGlobal:recordGlobalSpend});
 app.get('/api/website-production/hybrid-ai/status',auth,ownerOnly,(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   try{tenant(req);return res.json({ok:true,...hybridAI.status()})}catch(e){return respond(res,e)}
 });
 app.get('/api/website-production/sites/:id/studio/ai',auth,ownerOnly,(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   let site;try{site=readSite(req)}catch(e){return respond(res,e)}
   if(!site)return res.status(404).json({ok:false,code:'WEBSITE_NOT_FOUND'});
   return res.json({ok:true,ai:site.websiteStudioAI||null,budget:hybridAI.status(),siteStatus:site.status});
 });
 app.post('/api/website-production/sites/:id/studio/ai/upgrade',auth,ownerOnly,async(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   let tid;try{tid=tenant(req)}catch(e){return respond(res,e)}
   if(req.body&&(Object.keys(req.body).some(key=>key!=='provider')||(req.body.provider!==undefined&&!['openai','gemini'].includes(req.body.provider))))return res.status(400).json({ok:false,code:'AI_UPGRADE_ACCEPTS_ONLY_PROVIDER_CHOICE'});
   try{
     const result=await hybridAI.enhance({siteId:String(req.params.id||''),tenantId:tid,mode:'manual-upgrade',provider:req.body?.provider});
     const code=result.status;
     const http=code==='WEBSITE_NOT_FOUND'?404:code==='WRITER_UNAVAILABLE'?423:code==='AI_BUDGET_EXHAUSTED'?429:code==='AI_NOT_CONFIGURED'?503:
       ['AI_PROVIDER_UNAVAILABLE','AI_USAGE_UNVERIFIED','AI_OUTPUT_REJECTED','AI_RESERVATION_LOST','AI_VISUAL_CONFLICT','AI_USAGE_OVER_RESERVATION'].includes(code)?502:200;
     return res.status(http).json({ok:http===200,...result});
   }catch(e){return respond(res,'STUDIO_AI_UPGRADE_FAILED')}
 });

 const project=(req)=>{const tid=tenant(req);return orders().find(w=>String(w.id)===String(req.params.id)&&Number(w.tenantId)===tid)};
 const visible=(work,user)=>P.sameTenant(work,user)&&(String(user.role)==='owner'||(work.tasks||[]).some(t=>String(t.assignedTo)===String(user.id)));
 const publicView=(work,user)=>String(user.role)==='owner'?work:{...work,contractorRequests:[]};
 async function persist(work){
   const m=getStore(),data=Array.isArray(m.websiteProductionOrders)?m.websiteProductionOrders:[];
   m.websiteProductionOrders=[work,...data.filter(x=>String(x.id)!==String(work.id))].slice(0,500);
   const result=await saveStore(m);
   if(result?.skipped===true)throw Error('WEBSITE_PRODUCTION_NOT_DURABLE');
   return work;
 }
 app.post('/api/website-production/work-orders',auth,ownerOnly,async(req,res)=>{
   if(!available(res))return;
   let tid;try{tid=tenant(req)}catch(e){return respond(res,e)}
   const order=db.orders?.find(x=>String(x.id)===String(req.body?.orderId||'')&&P.sameTenant(x,{tenantId:tid}));
   if(!order)return res.status(404).json({ok:false,code:'ORDER_NOT_FOUND'});
   const site=getStore().websiteDemos?.find(x=>String(x.id)===String(req.body?.websiteId||'')&&P.sameTenant(x,{tenantId:tid}));
   if(!site)return res.status(404).json({ok:false,code:'WEBSITE_NOT_FOUND'});
   if(String(site.customerId)!==String(order.customerId))return res.status(409).json({ok:false,code:'CUSTOMER_MISMATCH'});
   if(site.status!=='Approved'||site.archived)return res.status(409).json({ok:false,code:'WEBSITE_NOT_APPROVED'});
   try{paidGuard(order,tid)}catch{return res.status(409).json({ok:false,code:'PAYMENT_EVIDENCE_REQUIRED'})}
   const existing=orders().find(x=>String(x.orderId)===String(order.id)&&Number(x.tenantId)===tid);
   if(existing)return res.json({ok:true,existing:true,workOrder:existing});
   try{
     const workOrder=P.start({order,site,actor:req.user});
     await persist(workOrder);
     return res.status(201).json({ok:true,workOrder});
   }catch(e){return respond(res,e)}
 });
 app.get('/api/website-production/work-orders',auth,(req,res)=>{
   let tid;try{tid=tenant(req)}catch(e){return respond(res,e)}
   res.setHeader('Cache-Control','no-store');
   const items=orders().filter(x=>Number(x.tenantId)===tid&&visible(x,req.user));
   return res.json({ok:true,workOrders:items.slice(0,100).map(x=>publicView(x,req.user))});
 });
 app.get('/api/website-production/work-orders/:id',auth,(req,res)=>{
   let w;try{w=project(req)}catch(e){return respond(res,e)}
   if(!w||!visible(w,req.user))return res.status(404).json({ok:false,code:'WORK_ORDER_NOT_FOUND'});
   res.setHeader('Cache-Control','no-store');return res.json({ok:true,workOrder:publicView(w,req.user)});
 });
 app.post('/api/website-production/work-orders/:id/assign',auth,ownerOnly,async(req,res)=>{
   if(!available(res))return;
   let w;try{w=project(req)}catch(e){return respond(res,e)}
   if(!w)return res.status(404).json({ok:false,code:'WORK_ORDER_NOT_FOUND'});
   const worker=db.users?.find(x=>String(x.id)===String(req.body?.userId||''));
   try{return res.json({ok:true,workOrder:await persist(P.assign(w,req.body?.task,worker,req.user))})}
   catch(e){return respond(res,e)}
 });
 app.post('/api/website-production/work-orders/:id/complete',auth,async(req,res)=>{
   if(!available(res))return;
   let w;try{w=project(req)}catch(e){return respond(res,e)}
   if(!w||!visible(w,req.user))return res.status(403).json({ok:false,code:'NOT_ASSIGNED'});
   try{return res.json({ok:true,workOrder:await persist(P.complete(w,req.body?.task,req.user,{url:req.body?.publicUrl}))})}
   catch(e){return respond(res,e)}
 });
 app.post('/api/website-production/work-orders/:id/vendor',auth,ownerOnly,async(req,res)=>{
   if(!available(res))return;
   let w;try{w=project(req)}catch(e){return respond(res,e)}
   if(!w)return res.status(404).json({ok:false,code:'WORK_ORDER_NOT_FOUND'});
   try{return res.json({ok:true,workOrder:await persist(P.proposeContractor(w,req.body,req.user))})}
   catch(e){return respond(res,e)}
 });
 return hybridAI;
}
module.exports={register};