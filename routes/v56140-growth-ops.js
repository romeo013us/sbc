'use strict';
const G=require('../enterprise/v56140-growth-ops');
module.exports=function register(app,{auth,ownerOnly,getContext}={}){
  const ctx=()=>getContext();
  app.get('/api/v56140/growth/live',auth,ownerOnly,async(req,res)=>{try{const c=ctx();const out=await G.live({db:c.db,pool:c.mysqlPool,tenantId:Number(global.__SBC_REQUIRE_TENANT(req)),days:req.query.days||30});res.json({ok:true,version:G.VERSION,policy:'compliant-acquisition-only',...out});}catch(e){res.status(500).json({ok:false,error:'Growth telemetry unavailable.'});}});
  app.get('/api/v56140/growth/ledger',auth,ownerOnly,async(req,res)=>{try{const c=ctx();if(!c.mysqlPool)return res.status(503).json({ok:false,error:'Durable ledger unavailable.'});await G.ensureTables(c.mysqlPool);const [rows]=await c.mysqlPool.query('SELECT ledger_date,leads,qualified,customers,orders,revenue,calls,answered_calls,call_connect_rate,conversion_rate,source_json FROM sbc_growth_ledger WHERE tenant_id=? ORDER BY ledger_date DESC LIMIT 90',[Number(global.__SBC_REQUIRE_TENANT(req))]);res.json({ok:true,version:G.VERSION,rows});}catch(e){res.status(500).json({ok:false,error:'Growth ledger unavailable.'});}});
  app.post('/api/v56140/growth/ledger/run',auth,ownerOnly,async(req,res)=>{try{const c=ctx();if(!c.mysqlPool)return res.status(503).json({ok:false,error:'Durable ledger unavailable.'});await G.ensureTables(c.mysqlPool);const date=req.body?.date?new Date(req.body.date):new Date(Date.now()-86400000);const out=await G.buildSnapshot({db:c.db,pool:c.mysqlPool,tenantId:Number(global.__SBC_REQUIRE_TENANT(req)),date});res.json(out);}catch(e){res.status(400).json({ok:false,error:e.message||'Ledger run failed.'});}});
};
module.exports.ENGINE=G;
