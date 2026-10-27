'use strict';
const RAILS=require('../enterprise/v566-scale-revenue-rails');
module.exports=function registerSecurity(app,{auth,ownerOnly,getContext}){
  app.get('/api/v566/security/tenant-context',auth,(req,res)=>{try{const ctx=RAILS.signedTenantContext(req);const binding=RAILS.tenantBindingFor(req,{actorId:req.user?.id||'system',path:req.path});res.json({ok:true,version:RAILS.VERSION,context:ctx,binding:{configured:binding.configured,tenantId:binding.tenantId,token:ctx.unsignedFallback?null:undefined}});}catch(e){res.status(403).json({ok:false,error:e.message});}});
  app.post('/api/v566/security/owner-clearance',auth,ownerOnly,(req,res)=>{try{res.json({ok:true,version:RAILS.VERSION,data:RAILS.ownerGate(req.body?.value)});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.get('/api/v566/security/release-manifest',auth,ownerOnly,(req,res)=>res.json({ok:true,...RAILS.releaseManifest()}));
};
