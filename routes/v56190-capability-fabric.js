'use strict';
const FAB=require('../enterprise/v56190-capability-fabric');
module.exports=function register(app,{auth,ownerOnly}={}){
  app.get('/api/v56190/status',auth,ownerOnly,(req,res)=>res.json({ok:true,...FAB.status()}));
  app.get('/api/v56190/capabilities',auth,ownerOnly,(req,res)=>res.json({ok:true,version:FAB.VERSION,capabilities:FAB.facade.list(),featureBits:FAB.facade.FEATURE_BITS}));
  app.post('/api/v56190/capability/resolve',auth,ownerOnly,(req,res)=>{try{const r=FAB.resolveCapability(String(req.body?.name||''),{plan:req.body?.plan,overrides:req.body?.overrides||{}});res.json({ok:true,...r});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56190/capability/dispatch',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await FAB.dispatchCapability(String(req.body?.name||''),req.body?.payload||{},{plan:req.body?.plan,overrides:req.body?.overrides||{}}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56190/sftp-watch/scan',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await FAB.scan());}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56190/sftp-watch/start',auth,ownerOnly,(req,res)=>res.status(202).json({ok:true,...FAB.start()}));
  app.post('/api/v56190/sftp-watch/stop',auth,ownerOnly,(req,res)=>res.json({ok:true,...FAB.stop()}));
};
module.exports.ENGINE=FAB;
