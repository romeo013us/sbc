'use strict';
module.exports=function register(app,{auth,ownerOnly,getController}){
 const C=()=>getController();
 const guard=ownerOnly||((req,res,next)=>next());
 // SBC_V6522_API_STABILIZATION: return a bounded, explicit response when a provider/database operation stalls.
 app.get('/api/v56240/growth/status',auth,guard,async(req,res)=>{let timer;try{const result=await Promise.race([C().status(global.__SBC_REQUIRE_TENANT(req)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Growth status exceeded 3500ms response budget; no automatic retry or mutation was started.'),{code:'GROWTH_STATUS_TIMEOUT'})),3500);})]);res.setHeader('Cache-Control','no-store');res.json(result);}catch(e){const timedOut=e.code==='GROWTH_STATUS_TIMEOUT';res.status(timedOut?503:500).json({ok:false,error:e.message,code:e.code||'GROWTH_STATUS_ERROR',recoverySafe:true,readOnly:true});}finally{clearTimeout(timer);}});
 app.get('/api/v56240/growth/capability-health',auth,guard,(req,res)=>{try{res.json(C().capabilityHealth?.()||{ok:false,error:'Capability health unavailable.'});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/inbound',auth,guard,async(req,res)=>{try{const raw=req.rawBody||JSON.stringify(req.body||{});res.status(202).json(await C().inbound(raw,global.__SBC_REQUIRE_TENANT(req),String(req.body?.source||'capability-facade')));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/gap-sweep',auth,guard,async(req,res)=>{try{res.json(await C().gapSweep(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/outbound/queue',auth,guard,async(req,res)=>{try{res.status(202).json(await C().queueOutbound(req.body?.lead||{},String(req.body?.channel||'sms'),String(req.body?.body||''),req.user||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/preview',auth,guard,async(req,res)=>{try{res.status(201).json(await C().preview(req.body?.lead||{},req.body?.offer||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.get('/growth-preview/:slug',async(req,res)=>{try{const p=await C().getPreview?.(req.params.slug);if(!p)return res.status(404).send('Preview not found.');res.type('html').send(p.html);}catch(e){res.status(404).send('Preview unavailable.');}});
 app.post('/api/v56240/growth/activation',auth,guard,async(req,res)=>{try{res.json(await C().activation(req.body?.customer||{},req.user||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/cost',auth,guard,async(req,res)=>{try{res.status(201).json(await C().recordCost(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/checkout-fence',auth,guard,async(req,res)=>{try{res.status(201).json(await C().checkoutFence(req.body?.order||{},req.user||{},req.get('Idempotency-Key')||req.body?.idempotencyKey||''));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/host-map',auth,guard,async(req,res)=>{try{res.json(await C().hostMap(req.body?.customer||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/vendor-dispatch',auth,guard,async(req,res)=>{try{res.status(202).json(await C().vendorDispatch(req.body?.order||{},req.body?.provider||'internal'));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/addon',auth,guard,async(req,res)=>{try{res.status(201).json(await C().addonOffer(req.body?.customer||{},req.body?.addonKey||'',req.body?.price||0));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.get('/api/v56240/growth/bitmask',auth,guard,async(req,res)=>{try{res.json(await C().bitmaskFor(req.query?.plan||''));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.get('/api/v56240/growth/referrals',auth,guard,async(req,res)=>{try{res.json(await C().referralTelemetry(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.get('/api/v56240/growth/profit',auth,guard,async(req,res)=>{try{res.json(await C().profit(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/sanity',auth,guard,async(req,res)=>{try{res.json(await C().sanity('owner',global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v56240/growth/run',auth,guard,async(req,res)=>{try{res.status(202).json(await C().run());}catch(e){res.status(500).json({ok:false,error:e.message});}});
};
