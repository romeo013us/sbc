// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
module.exports=function registerSupernovaRoutes(app,{auth,ownerOnly,supernova,redisClient,redisReady}){
 app.get('/api/supernova/status',auth,ownerOnly,(req,res)=>res.json({ok:true,...supernova.snapshot(),redis:{configured:Boolean(redisClient),ready:Boolean(redisReady)}}));
 app.get('/api/supernova/events',auth,(req,res)=>{res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders?.();const send=e=>res.write(`event:${e.type||'message'}\ndata:${JSON.stringify(e)}\n\n`);send({type:'connected',at:new Date().toISOString()});const onWrite=e=>send({...e,type:'write'}),onAudit=e=>send({...e,type:'audit'});supernova.events.on('write',onWrite);supernova.events.on('audit',onAudit);req.on('close',()=>{supernova.events.off('write',onWrite);supernova.events.off('audit',onAudit);});});
 app.post('/api/supernova/jwt/issue',auth,ownerOnly,(req,res)=>{try{const token=supernova.signJwt({sub:req.user.id,role:req.user.role,tenantId:__sbcRequireTenantId(req.user.tenantId),permissions:req.body?.permissions||[]},process.env.SBC_JWT_SECRET,Number(req.body?.ttlSec||3600));res.json({ok:true,token});}catch(e){res.status(503).json({ok:false,error:e.message});}});
 app.post('/api/supernova/worker-test',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,result:await supernova.pool.run({type:String(req.body?.type||'evaluate'),payload:req.body||{}})});}catch(e){res.status(500).json({ok:false,error:e.message});}});
 app.get('/api/supernova/audit/verify',auth,ownerOnly,(req,res)=>res.json(supernova.verifyAudit()));
};
