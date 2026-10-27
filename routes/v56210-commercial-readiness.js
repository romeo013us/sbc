'use strict';
const E=require('../enterprise/v56210-commercial-readiness');
module.exports=function register(app,{auth,ownerOnly,getContext}={}){
  const ctx=()=>getContext?.()||{};
  app.get('/api/v56210/commercial/status',auth,ownerOnly,(req,res)=>res.json({ok:true,...E.status()}));
  app.get('/api/v56210/commercial/catalog',auth,(req,res)=>res.json({ok:true,version:E.VERSION,packages:E.PACKAGES,officePlans:E.OFFICE_PLANS,planLimits:E.PLAN_LIMITS}));
  app.get('/api/v56210/commercial/scorecard',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await E.scorecard(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.get('/api/v56210/commercial/economics',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await E.economics(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.post('/api/v56210/commercial/spend',auth,ownerOnly,async(req,res)=>{try{res.status(201).json(await E.recordSpend(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56210/commercial/usage',auth,ownerOnly,async(req,res)=>{try{res.status(201).json(await E.meterUsage(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56210/commercial/assign-plan',auth,ownerOnly,async(req,res)=>{try{res.status(201).json(await E.assignPlan(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56210/commercial/run',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await E.run());}catch(e){res.status(500).json({ok:false,error:e.message});}});
};
module.exports.ENGINE=E;
