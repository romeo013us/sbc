
'use strict';
const crypto=require('crypto');
const ENGINE=require('../enterprise/v56250-autonomous-lead-factory');
module.exports=function register(app,{auth,ownerOnly,getContext,secretValue,audit}={}){
  const context=()=>({...(getContext?getContext():{}),secretValue:secretValue||(()=>''),audit:audit||(()=>{})});
  app.get('/api/v56250/lead-factory/status',auth,ownerOnly,(req,res)=>res.json(ENGINE.status()));
  app.post('/api/v56250/lead-factory/config',auth,ownerOnly,async(req,res)=>{try{const c=req.body||{};const out=ENGINE.configure({config:{enabled:c.enabled!==false,autoApollo:Boolean(c.autoApollo),autoClay:Boolean(c.autoClay),batchSize:Math.max(1,Math.min(100,Number(c.batchSize||25))),maxDailyApolloPages:Math.max(1,Math.min(100,Number(c.maxDailyApolloPages||10))),maxDailyClayRows:Math.max(1,Math.min(5000,Number(c.maxDailyClayRows||250))),minScoreForClay:Math.max(0,Math.min(100,Number(c.minScoreForClay||55)))}});res.json(out)}catch(e){res.status(400).json({ok:false,error:e.message})}});
  app.post('/api/v56250/lead-factory/apollo/search',auth,ownerOnly,async(req,res)=>{try{const out=await ENGINE.apolloSearch(req.body||{});res.json(out)}catch(e){res.status(e.message.includes('guard')?429:400).json({ok:false,error:e.message})}});
  app.post('/api/v56250/lead-factory/apollo/ingest',auth,ownerOnly,async(req,res)=>{try{const orgs=Array.isArray(req.body?.organizations)?req.body.organizations:[];if(!orgs.length)return res.status(400).json({ok:false,error:'organizations array is required.'});res.status(202).json(await ENGINE.ingestOrganizations(orgs,{dispatchClay:req.body?.dispatchClay!==false}))}catch(e){res.status(400).json({ok:false,error:e.message})}});
  app.post('/api/v56250/lead-factory/run',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await ENGINE.run(req.body||{}))}catch(e){res.status(400).json({ok:false,error:e.message})}});
  app.post('/api/v56250/lead-factory/clay/webhook',async(req,res)=>{try{const token=secretValue?.('CLAY_WEBHOOK_TOKEN','CLAY_WEBHOOK_TOKEN')||'';if(token){const supplied=String(req.headers.authorization||'').replace(/^Bearerglobal.__SBC_REQUIRE_TENANT(req)s+/i,'');if(!supplied||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(token)))return res.status(401).json({ok:false,error:'Invalid Clay webhook token.'})}const out=await ENGINE.acceptClay(req.body||{});res.status(202).json(out)}catch(e){res.status(400).json({ok:false,error:e.message})}});
};
module.exports.ENGINE=ENGINE;
