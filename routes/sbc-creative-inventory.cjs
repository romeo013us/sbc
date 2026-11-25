'use strict';
const {createLedger,assertActor}=require('../enterprise/sbc-social-creative-ledger.cjs');
function registerCreativeInventory(app,{auth,ownerOnly,tenantOf,corporateTenant,getPool,canWrite,ledgerFactory=createLedger,clock=Date.now}){
 const base='/api/marketing/creative-inventory';
 function mount(method,suffix,fn){
  app[method](base+suffix,auth,ownerOnly,async(req,res)=>{
   res.setHeader('Cache-Control','no-store');
   const actor={tenantId:tenantOf(req),id:String(req.user?.id||''),role:req.user?.role};
   try{assertActor(actor,corporateTenant,['owner']);}catch{return res.status(403).json({ok:false,error:'CREATIVE_ACCESS_DENIED'});}
   if(method!=='get'&&!canWrite())return res.status(423).json({ok:false,error:'CREATIVE_WRITER_UNAVAILABLE'});
   try{
    const pool=getPool();if(!pool)throw Error('CREATIVE_STORE_UNAVAILABLE');
    const ledger=ledgerFactory({pool,corporateTenant,writerReady:canWrite,clock});
    await fn(req,res,ledger,actor);
   }catch(e){
    const code=String(e.message||'');const status=code==='CREATIVE_WRITER_UNAVAILABLE'?423:code==='INVALID_ASSET_HASH'?400:code==='ARTWORK_UNAVAILABLE'?404:code==='CREATIVE_NOT_APPROVABLE'?409:503;
    res.status(status).json({ok:false,error:status===503?'CREATIVE_STORE_UNAVAILABLE':code});
   }
  });
 }
 mount('get','',async(req,res,ledger,actor)=>res.json({ok:true,...await ledger.snapshot(actor),canApprove:canWrite()===true}));
 mount('get','/:sha/artwork',async(req,res,ledger,actor)=>{
  const png=await ledger.artwork(actor,req.params.sha);
  res.setHeader('Content-Type','image/png');res.setHeader('X-Content-Type-Options','nosniff');res.send(png);
 });
 mount('post','/:sha/approve',async(req,res,ledger,actor)=>res.json({ok:true,...await ledger.approve(actor,req.params.sha)}));
}
module.exports={registerCreativeInventory};
