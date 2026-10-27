'use strict';
const E=require('../enterprise/v56180-god-tier-scale');
module.exports=function register(app,{auth,ownerOnly,getContext}={}){
  const ctx=()=>getContext();
  app.get('/api/v56180/status',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await E.status()});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.get('/api/v56180/control-tower',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await E.controlTower()});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.post('/api/v56180/run',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await E.cycle());}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56180/domain/lookup',auth,ownerOnly,async(req,res)=>{try{res.json(await E.domainLookup(req.body?.name));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56180/addon/quote',auth,ownerOnly,async(req,res)=>{try{res.json(await E.addonQuote(String(req.body?.customerId||''),String(req.body?.addonKey||'')));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56180/entitlement/snapshot',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await E.entitlementSnapshot(global.__SBC_REQUIRE_TENANT(req),String(req.body?.customerId||''))});}catch(e){res.status(400).json({ok:false,error:e.message});}});
};
module.exports.ENGINE=E;
