'use strict';
const G=require('../enterprise/sbc-growth-os-v650');
module.exports=function register(app,{auth,ownerOnly,getContext}={}){
 const guard=ownerOnly||((req,res,next)=>next()); const ctx=()=>getContext?.()||{};
 app.get('/api/v650/growth-os/status',auth,guard,async(req,res)=>{try{res.json(await G.status(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.get('/api/v650/growth-os/config',auth,guard,async(req,res)=>{try{res.json({ok:true,version:G.VERSION,config:await G.getConfig(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v650/growth-os/config',auth,guard,async(req,res)=>{try{res.json(await G.setConfig(req.body||{},req.user||{},global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v650/growth-os/run',auth,guard,async(req,res)=>{try{res.status(202).json(await G.run(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v650/growth-os/campaigns',auth,guard,async(req,res)=>{try{res.status(201).json({ok:true,campaign:await G.createCampaign(req.body||{},req.user||{},global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v650/growth-os/assets/:id/publish',auth,guard,async(req,res)=>{try{res.json(await G.publishAsset(req.params.id,req.user||{},global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(409).json({ok:false,error:e.message});}});
 app.post('/api/v650/growth-os/events',auth,guard,async(req,res)=>{try{res.status(201).json(await G.event(req.body||{},global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.get('/api/v650/growth-os/council',auth,guard,async(req,res)=>{try{const m=await G.metricsSnapshot(global.__SBC_REQUIRE_TENANT(req));res.json({ok:true,version:G.VERSION,decision:G.councilDecision({metrics:m}),connectors:G.connectorStatus()});}catch(e){res.status(500).json({ok:false,error:e.message});}});
};
