'use strict';
const ENGINE=require('../enterprise/v56135-kim-mission-controller');
module.exports=function register(app,{auth,ownerOnly,getController,getCustomer}={}){
  app.get('/api/v56135/kim-mission/overview',auth,(req,res)=>{try{res.json({ok:true,...getController().overview(global.__SBC_REQUIRE_TENANT(req))});}catch(e){res.status(500).json({ok:false,error:'Kim mission overview unavailable.'});}});
  app.post('/api/v56135/kim-mission/run',auth,ownerOnly,async(req,res)=>{try{const c=getController();const tenantId=global.__SBC_REQUIRE_TENANT(req);const customer=typeof getCustomer==='function'?getCustomer(req.body?.leadId):null;if(!customer||Number(customer.tenantId)!==Number(tenantId))throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});const out=await c.runMission(customer,req.body?.interactionData||{},req.body?.options||{});res.status(out.ok===false?422:200).json(out);}catch(e){res.status(400).json({ok:false,error:'Kim mission failed.',details:String(e.message||'')});}});
  app.post('/api/v56135/kim-mission/cycle',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await getController().cycle({limit:req.body?.limit||20,tenantId:global.__SBC_REQUIRE_TENANT(req),reason:req.body?.reason||`manual:${req.user.role}`})});}catch(e){res.status(400).json({ok:false,error:'Kim mission cycle failed.',details:String(e.message||'')});}});
};
module.exports.ENGINE=ENGINE;
