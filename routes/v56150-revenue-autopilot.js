'use strict';
const AUTO=require('../enterprise/v56150-revenue-autopilot');
module.exports=function register(app,{auth,ownerOnly,getContext}={}){
  const ctx=()=>getContext();
  app.get('/api/v56150/revenue-autopilot/status',auth,ownerOnly,(req,res)=>res.json({ok:true,...AUTO.status()}));
  app.get('/api/v56150/revenue-autopilot/control-tower',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await AUTO.controlTower()});}catch(e){res.status(500).json({ok:false,error:'Revenue Control Tower unavailable.',details:String(e.message||e)});}});
  app.post('/api/v56150/revenue-autopilot/run',auth,ownerOnly,async(req,res)=>{try{const out=await AUTO.runOnce();res.status(202).json(out);}catch(e){res.status(400).json({ok:false,error:e.message||'Autopilot run failed.'});}});
  app.post('/api/v56150/revenue-autopilot/dropzone/scan',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await AUTO.scanDropzone());}catch(e){res.status(400).json({ok:false,error:e.message||'Dropzone scan failed.'});}});
  app.post('/api/v56150/affiliate/referral',auth,ownerOnly,async(req,res)=>{try{res.status(201).json(await AUTO.createAffiliateReferral(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message||'Affiliate referral could not be recorded.'});}});
  app.post('/api/v56150/affiliate/commission',auth,ownerOnly,async(req,res)=>{try{res.status(201).json(await AUTO.recordAffiliatePayout(req.body||{}));}catch(e){res.status(400).json({ok:false,error:e.message||'Affiliate commission could not be recorded.'});}});
  app.get('/api/v56150/affiliate/summary',auth,ownerOnly,async(req,res)=>{const c=ctx();if(!c.mysqlPool)return res.status(503).json({ok:false,error:'Durable affiliate storage unavailable.'});try{const [rows]=await c.mysqlPool.query("SELECT affiliate_id,COUNT(*) referrals,SUM(status='CONVERTED') converted,COALESCE(SUM(commission_cents),0) commission_cents FROM sbc_affiliate_referrals WHERE tenant_id=1 GROUP BY affiliate_id ORDER BY commission_cents DESC");res.json({ok:true,affiliates:rows.map(x=>({...x,commission:Number((Number(x.commission_cents||0)/100).toFixed(2))}))});}catch(e){res.status(500).json({ok:false,error:'Affiliate summary unavailable.'});}});
};
