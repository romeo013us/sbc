// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const ENGINE=require('../enterprise/v56200-revenue-proof');
module.exports=function register(app,{auth,ownerOnly}={}){
  app.get('/api/v56200/revenue-proof/status',auth,ownerOnly,(req,res)=>res.json({ok:true,...ENGINE.status()}));
  app.get('/api/v56200/revenue-proof/catalog',auth,(req,res)=>res.json({ok:true,version:ENGINE.VERSION,packages:ENGINE.PACKAGES,officePlans:ENGINE.OFFICE_PLANS}));
  app.get('/api/v56200/revenue-proof/scorecard',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await ENGINE.scorecard(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.get('/api/v56200/revenue-proof/funnel',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await ENGINE.funnel(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.post('/api/v56200/revenue-proof/track',auth,ownerOnly,async(req,res)=>{try{res.status(201).json(await ENGINE.track(req.body?.event,{tenantId:__sbcRequireTenantId(req.tenantId),customerId:req.body?.customerId||'',value:req.body?.value||0,metadata:req.body?.metadata||{}}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56200/revenue-proof/cost',auth,ownerOnly,async(req,res)=>{try{res.status(201).json(await ENGINE.addCost({tenantId:__sbcRequireTenantId(req.tenantId),costType:req.body?.costType,provider:req.body?.provider,amount:req.body?.amount,referenceId:req.body?.referenceId,metadata:req.body?.metadata||{}}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56200/revenue-proof/run',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await ENGINE.run());}catch(e){res.status(500).json({ok:false,error:e.message});}});
};
module.exports.ENGINE=ENGINE;
