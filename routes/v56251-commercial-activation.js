'use strict';
const E=require('../enterprise/v56251-commercial-activation');
module.exports=function register(app,{auth,ownerOnly,getController}={}){
 const guard=ownerOnly||((req,res,next)=>next());
 const c=()=>getController();
 app.get('/api/v56251/commercial/status',auth,guard,async(req,res)=>{try{res.json(await c().status(global.__SBC_REQUIRE_TENANT(req)))}catch(e){res.status(500).json({ok:false,error:e.message})}});
 app.get('/api/v56251/commercial/scorecard',auth,guard,async(req,res)=>{try{res.json(await c().scorecard(global.__SBC_REQUIRE_TENANT(req)))}catch(e){res.status(500).json({ok:false,error:e.message})}});
 app.post('/api/v56251/commercial/config',auth,guard,async(req,res)=>{try{res.json(c().configure({config:req.body||{}}))}catch(e){res.status(400).json({ok:false,error:e.message})}});
 app.post('/api/v56251/commercial/run',auth,guard,async(req,res)=>{try{res.status(202).json(await c().run(req.body||{}))}catch(e){res.status(400).json({ok:false,error:e.message})}});
};
module.exports.ENGINE=E;
