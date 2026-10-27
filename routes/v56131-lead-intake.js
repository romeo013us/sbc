'use strict';
const crypto=require('crypto');
const TIER1=require('../enterprise/v562-tier1-architecture');
const INTAKE=require('../enterprise/v56131-lead-intake');
const PUBLIC_ENRICH=require('../enterprise/v56131-public-lead-enrichment');
const ASYNC_INGEST=require('../enterprise/v56140-async-ops');
module.exports=function registerLeadIntake(app,{auth,ownerOnly,getContext}){
  const canIntake=req=>['owner','manager','lead_researcher'].includes(String(req.user?.role||''));
  app.post('/api/v56131/lead-intake/spreadsheet/preview',auth,(req,res)=>{
    if(!canIntake(req))return res.status(403).json({ok:false,error:'Lead intake access required.'});
    try{
      const csv=Buffer.from(String(req.body?.csvBase64||''),'base64');
      const rows=TIER1.parseCsvBinary(csv,{maxBytes:25*1024*1024,maxRows:INTAKE.MAX_ROWS});
      const batchId=String(req.body?.batchId||TIER1.createBatchId('LORNA'));
      const out=INTAKE.enrichRows(rows,{batchId,source:req.body?.source||'Lorna Spreadsheet'});
      res.json({ok:true,mode:'preview',batchId,counts:out.counts,leads:out.leads.slice(0,50),totalScored:out.leads.length});
    }catch(e){res.status(400).json({ok:false,error:e.message||'Spreadsheet preview failed.'});}
  });
  app.post('/api/v56131/lead-intake/spreadsheet/ingest',auth,async(req,res)=>{
    if(!canIntake(req))return res.status(403).json({ok:false,error:'Lead intake access required.'});
    try{
      const csvBase64=String(req.body?.csvBase64||'');
      if(!csvBase64)return res.status(400).json({ok:false,error:'csvBase64 is required.'});
      const batchId=String(req.body?.batchId||TIER1.createBatchId('LORNA'));
      const queued=await ASYNC_INGEST.enqueue({tenantId:global.__SBC_REQUIRE_TENANT(req),batchId,source:req.body?.source||'Lorna Spreadsheet',csvBase64});
      res.status(202).json({ok:true,version:INTAKE.VERSION,batchId,jobId:queued.id,status:queued.status,queue:queued.queue,processing:'ASYNC_WORKER',message:'Bulk lead ingestion accepted; CPU-heavy parsing, scoring, and validation are running outside the web process.',salesReadyNextStep:'/api/v56131/revenue-pipeline/prepare'});
    }catch(e){res.status(e.code==='INGEST_QUEUE_FULL'?429:400).json({ok:false,error:e.message||'Spreadsheet ingest could not be queued.'});}
  });
  app.get('/api/v56131/lead-intake/quarantine',auth,(req,res)=>{
    if(!canIntake(req))return res.status(403).json({ok:false,error:'Lead intake access required.'});
    const ctx=getContext();
    if(!ctx.mysqlPool)return res.status(503).json({ok:false,error:'MySQL is required for quarantine status.'});
    ctx.mysqlPool.query(`SELECT COUNT(*) AS total, SUM(status='QUARANTINED') AS quarantined, SUM(status='RELEASED') AS released FROM sbc_lead_quarantine WHERE tenant_id=?`,[Number(global.__SBC_REQUIRE_TENANT(req))])
      .then(([rows])=>res.json({ok:true,total:Number(rows?.[0]?.total||0),quarantined:Number(rows?.[0]?.quarantined||0),released:Number(rows?.[0]?.released||0)}))
      .catch(e=>res.status(500).json({ok:false,error:e.message||'Quarantine status unavailable.'}));
  });
  app.get('/api/v56131/lead-intake/status',auth,(req,res)=>{
    try{
      const ctx=getContext(); const customers=Array.isArray(ctx.db.customers)?ctx.db.customers:[];
      const scored=customers.filter(c=>Number.isFinite(Number(c.leadScore))).length;
      res.json({ok:true,version:INTAKE.VERSION,totalLeads:customers.length,scored,hot:customers.filter(c=>String(c.leadTemperature).toLowerCase()==='hot').length,warm:customers.filter(c=>String(c.leadTemperature).toLowerCase()==='warm').length,cold:customers.filter(c=>String(c.leadTemperature).toLowerCase()==='cold').length});
    }catch(e){res.status(500).json({ok:false,error:'Lead intake status unavailable.'});}
  });
};
module.exports._test=INTAKE;
