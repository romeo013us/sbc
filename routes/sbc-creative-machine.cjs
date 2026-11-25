'use strict';
const express=require('express');
const {rateLimit}=require('express-rate-limit');
const {PLAN,IMPORT,createCreativeImporterAuth,mysqlNonceConsumer}=require('../enterprise/sbc-creative-importer-auth.cjs');
const {createLedger}=require('../enterprise/sbc-social-creative-ledger.cjs');
const {verifyBundle}=require('../enterprise/sbc-social-creative-bundle.cjs');
function registerCreativeMachine(app,{corporateTenant,getPool,canWrite,getKey=()=>process.env.SBC_CREATIVE_IMPORTER_SECRET,getSigningKey=()=>process.env.SBC_CREATIVE_SIGNING_PUBLIC_KEY,clock=Date.now,ledgerFactory=createLedger,parse=express.json({limit:'8mb',strict:true}),limit=rateLimit({windowMs:60000,limit:12,standardHeaders:'draft-7',legacyHeaders:false})}){
 const actor=Object.freeze({tenantId:corporateTenant,id:'creative_replenisher',role:'system'});
 for(const path of [PLAN,IMPORT]){
  app.post(path,limit,parse,async(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   if(!canWrite())return res.status(423).json({ok:false,error:'CREATIVE_WRITER_UNAVAILABLE'});
   try{
    const pool=getPool();if(!pool||!Number.isSafeInteger(corporateTenant)||corporateTenant<1)return res.status(503).json({ok:false,error:'CREATIVE_STORE_UNAVAILABLE'});
    if(!getKey())return res.status(503).json({ok:false,error:'CREATIVE_IMPORTER_UNCONFIGURED'});
    const auth=createCreativeImporterAuth({getKey,clock,consume:mysqlNonceConsumer(pool,corporateTenant,canWrite)});
    await auth({method:req.method,path:req.originalUrl,body:req.body,timestamp:req.headers['x-sbc-creative-time'],nonce:req.headers['x-sbc-creative-nonce'],signature:req.headers['x-sbc-creative-signature']});
    if(path===PLAN){
     if(Object.keys(req.body).length!==0)return res.status(400).json({ok:false,error:'EMPTY_PLAN_REQUEST_REQUIRED'});
     const ledger=ledgerFactory({pool,corporateTenant,writerReady:canWrite,clock});
     const data=await ledger.snapshot(actor);
     return res.json({ok:true,tenantId:corporateTenant,approved:data.approved,drafts:data.drafts,low:data.approved<6,missing:data.missing,assets:data.assets.map(a=>({sha256:a.sha256,dhash:a.dhash}))});
    }
    const publicKey=getSigningKey();
    if(!publicKey)return res.status(503).json({ok:false,error:'CREATIVE_IMPORT_KEY_UNCONFIGURED'});
    const signed=verifyBundle(req.body,{tenantId:corporateTenant,publicKey,now:clock()});
    const ledger=ledgerFactory({pool,corporateTenant,writerReady:canWrite,clock,verifyPng:signed.verifyPng});
    return res.json({ok:true,...await ledger.stage(actor,signed.rows)});
   }catch(e){
    const code=String(e.message||'');
    const status=code==='IMPORTER_REPLAY'?409:code==='IMPORTER_AUTH_INVALID'||code==='IMPORTER_AUTH_EXPIRED'?401:code.startsWith('CREATIVE_BUNDLE_')?400:code==='CREATIVE_WRITER_UNAVAILABLE'?423:code==='DUPLICATE_OR_UNAVAILABLE_CREATIVE'?409:503;
    return res.status(status).json({ok:false,error:status===503?'CREATIVE_MACHINE_UNAVAILABLE':code});
   }
  });
 }
}
module.exports={registerCreativeMachine};
