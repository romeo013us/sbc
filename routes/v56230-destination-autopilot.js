'use strict';
const E=require('../enterprise/v56230-kim-destination-autopilot');
module.exports=function register(app,{auth,ownerOnly,getController}={}){
 const guard=ownerOnly||((req,res,next)=>next());
 const C=()=>getController();
 app.get('/api/v56230/destination/status',auth,guard,async(req,res)=>{try{res.json(await C().status(global.__SBC_REQUIRE_TENANT(req)));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.get('/api/v56230/destination/missions/:id',auth,guard,async(req,res)=>{try{const m=await C().get(req.params.id);if(!m)return res.status(404).json({ok:false,error:'Mission not found.'});res.json({ok:true,mission:m});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v56230/destination/missions',auth,guard,async(req,res)=>{try{res.status(201).json({ok:true,mission:await C().createMission(req.body||{},req.user||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56230/destination/missions/:id/arm',auth,guard,async(req,res)=>{try{res.json({ok:true,mission:await C().arm(req.params.id,req.user||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56230/destination/missions/:id/drive',auth,guard,async(req,res)=>{try{res.json({ok:true,mission:await C().drive(req.params.id,req.user||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56230/destination/missions/:id/pause',auth,guard,async(req,res)=>{try{res.json({ok:true,mission:await C().pause(req.params.id,req.user||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}});
 app.post('/api/v56230/destination/cycle',auth,guard,async(req,res)=>{try{res.status(202).json(await C().cycle({tenantId:global.__SBC_REQUIRE_TENANT(req)}));}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.post('/api/v56230/destination/missions/:id/refresh',auth,guard,async(req,res)=>{try{const m=await C().get(req.params.id);if(!m)return res.status(404).json({ok:false,error:'Mission not found.'});res.json(await C().refresh(m));}catch(e){res.status(500).json({ok:false,error:e.message});}});
};
module.exports.ENGINE=E;
