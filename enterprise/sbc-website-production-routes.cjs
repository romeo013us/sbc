'use strict';
const P=require('./sbc-website-workorders.cjs');
function register(app,{auth,ownerOnly,requireTenant,db,getStore,saveStore,writerReady,paidGuard}){
 const respond=(res,e)=>{const code=String(e?.message||e);const status=/TENANT_CONTEXT|NOT_ASSIGNED|OWNER_REQUIRED|ASSIGNEE_INVALID/.test(code)?403:/PAYMENT_EVIDENCE|PREREQUISITES|WEBSITE_NOT_APPROVED|CUSTOMER_MISMATCH|ALREADY_COMPLETED/.test(code)?409:/UNKNOWN_TASK|INVALID|REQUIRED/.test(code)?400:503;return res.status(status).json({ok:false,code})};
 const tenant=req=>{const n=Number(requireTenant(req));if(!Number.isSafeInteger(n)||n<1)throw Error('TENANT_CONTEXT_REQUIRED');return n};
 const available=(res)=>{if(!writerReady()){res.status(423).json({ok:false,code:'WEBSITE_PRODUCTION_WRITER_UNAVAILABLE'});return false}return true};
 const orders=()=>{const m=getStore();return Array.isArray(m.websiteProductionOrders)?m.websiteProductionOrders:[]};
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
}
module.exports={register};