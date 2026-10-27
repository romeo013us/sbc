// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const BROKER=require('../enterprise/v56160-event-broker');
module.exports=function register(app,{auth,ownerOnly}={}){
  app.get('/api/v56160/event-broker/status',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await BROKER.status()});}catch(e){res.status(500).json({ok:false,error:'Event broker status unavailable.'});}});
  app.post('/api/v56160/event-broker/run',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await BROKER.processOnce());}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/v56160/event-broker/publish',auth,ownerOnly,async(req,res)=>{try{const b=req.body||{};res.status(202).json(await BROKER.publish(b.eventType,{tenantId:__sbcRequireTenantId(req.tenantId),entityType:b.entityType||'customer',entityId:b.entityId||'',payload:b.payload||{}}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
};
