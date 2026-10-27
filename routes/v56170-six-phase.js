'use strict';
const ENGINE=require('../enterprise/v56170-six-phase-autopilot');
module.exports=function register(app,{auth,ownerOnly,getContext}={}){
  app.get('/api/v56170/status',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await ENGINE.status()});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.get('/api/v56170/control-tower',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await ENGINE.controlTower()});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.post('/api/v56170/run',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await ENGINE.cycle());}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56170/dropzone/scan',auth,ownerOnly,async(req,res)=>{try{const out=await getContext().autopilot.scanDropzone();res.status(202).json({ok:true,...out});}catch(e){res.status(400).json({ok:false,error:e.message});}});
};
