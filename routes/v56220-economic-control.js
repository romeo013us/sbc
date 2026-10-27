'use strict';
const E=require('../enterprise/v56220-economic-control');
module.exports=function register(app,{auth,ownerOnly,getContext}={}){
  const guard=ownerOnly||((req,res,next)=>next());
  app.get('/api/v56220/economic/status',auth,guard,async(req,res)=>{try{res.json(await E.status(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:'Economic control status unavailable.'});}});
  app.get('/api/v56220/economic/metrics',auth,guard,async(req,res)=>{try{res.json({ok:true,version:E.VERSION,...await E.calculate(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.post('/api/v56220/economic/run',auth,guard,async(req,res)=>{try{res.status(202).json(await E.run(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.post('/api/v56220/economic/cash',auth,guard,async(req,res)=>{try{res.status(201).json(await E.recordCash(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56220/economic/exceptions/:id/resolve',auth,guard,async(req,res)=>{try{res.json(await E.resolveException(req.params.id));}catch(e){res.status(400).json({ok:false,error:e.message});}});
};
module.exports.ENGINE=E;
