'use strict';
const SUPERBRAIN=require('../enterprise/v56135-superbrain-intelligence');
function register(app,{auth,ownerOnly,getContext,getIntelligence,refreshIntelligence}={}){
  app.get('/api/v56135/superbrain/overview',auth,(req,res)=>{try{const intel=getIntelligence?.();if(!intel)return res.status(503).json({ok:false,error:'Super-Brain intelligence fabric is initializing.'});res.json({ok:true,...intel.snapshot()});}catch(e){res.status(500).json({ok:false,error:'Super-Brain overview unavailable.'});}});
  app.post('/api/v56135/superbrain/recommend',auth,(req,res)=>{try{const c=getContext();const intel=getIntelligence?.();if(!intel)return res.status(503).json({ok:false,error:'Super-Brain intelligence fabric is initializing.'});const lead=(c.db?.customers||[]).find(x=>String(x.id)===String(req.body?.leadId));if(!lead)return res.status(404).json({ok:false,error:'Lead/customer not found.'});const out=intel.recommend({customer:lead,needs:req.body?.needs||req.body?.needsMatrix||[],text:req.body?.text||req.body?.discoveryText||'',catalog:c.catalog});res.json({ok:true,data:out});}catch(e){res.status(400).json({ok:false,error:'Super-Brain recommendation failed.'});}});
  app.post('/api/v56135/superbrain/refresh',auth,ownerOnly,async(req,res)=>{try{const intel=await refreshIntelligence?.();if(!intel)return res.status(503).json({ok:false,error:'Super-Brain refresh unavailable.'});res.json({ok:true,...intel.snapshot()});}catch(e){res.status(500).json({ok:false,error:'Super-Brain refresh failed.'});}});
}
module.exports=register;
module.exports.VERSION=SUPERBRAIN.VERSION;
