// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.10 — Whitelabel Commerce Fabric
 * Additive orchestration layer over the proven V56.9.2 runtime.
 *
 * Safety:
 * - No new hosting secrets.
 * - Vendor execution remains adapter/credential gated and fail-closed.
 * - $10,000+ fulfillment remains owner-gated by the existing persistent vault.
 * - Storefront rendering uses the existing controlled templates.
 * - No arbitrary executable tenant HTML is accepted.
 */
const crypto = require('crypto');
const SEC = require('../enterprise/v569-production-expansion');
const VERSION = '56.10.2';
const OWNER_THRESHOLD = 10000;
const id = (p='v5610') => `${p}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
const clean = (v,n=500) => String(v ?? '').trim().slice(0,n);
const now = () => new Date().toISOString();
const sqlDateTime = value => new Date(value || Date.now()).toISOString().slice(0,19).replace('T',' ');
const safeJson = value => JSON.stringify(value ?? {});

function normalizeProvider(provider){
  const p=String(provider||'').toLowerCase().trim();
  if(['4over4','four_over_four','four-over-four'].includes(p))return '4over4';
  if(['vistaprint','vista_print','vista-print'].includes(p))return 'vistaprint';
  if(p==='internal')return 'internal';
  return '';
}
function storefrontProfile({customer={},order={},brand={},template='print-reseller'}={}){
  const allowed=['print-reseller','design-agency'];
  const chosen=allowed.includes(String(template))?String(template):'print-reseller';
  return {
    businessName:clean(brand.businessName||customer.businessName||order.customerName||'Business',120),
    primary:clean(brand.primary||brand.primaryColor||'#0b74d1',20),
    accent:clean(brand.accent||brand.accentColor||'#f28b22',20),
    logoUrl:clean(brand.logoUrl||'',500),
    supportEmail:clean(brand.supportEmail||customer.email||'',320),
    supportPhone:clean(brand.supportPhone||customer.phone||'',80),
    template:chosen
  };
}
function orderTotal(order={}){
  const direct=Number(order.total||order.amount||order.totalAmount||0);
  if(Number.isFinite(direct)&&direct>0)return direct;
  return (Array.isArray(order.items)?order.items:[]).reduce((n,x)=>n+Number(x.total||x.price||0)*Number(x.quantity||x.qty||1),0);
}
function providerReadiness(provider, ctx){
  const p=normalizeProvider(provider);
  if(!p)return {provider:'',status:'UNSUPPORTED',liveSubmission:false,note:'Provider is not allowlisted.'};
  if(p==='internal')return {provider:p,status:'READY',liveSubmission:true,note:'Internal fulfillment path.'};
  const fourOver4Endpoint=ctx?.secretValue ? ctx.secretValue('FOUROVER4_ORDER_ENDPOINT','FOUROVER4_API_URL') : (process.env.FOUROVER4_ORDER_ENDPOINT||process.env.FOUROVER4_API_URL||'');
  const fourOver4Key=ctx?.secretValue ? ctx.secretValue('FOUROVER4_API_KEY','FOUR_OVER_FOUR_API_KEY','FOUROVER4_API_TOKEN') : (process.env.FOUROVER4_API_KEY||process.env.FOUR_OVER_FOUR_API_KEY||process.env.FOUROVER4_API_TOKEN||'');
  const vistaKey=ctx?.secretValue ? ctx.secretValue('VISTAPRINT_API_KEY','VISTAPRINT_PROSHOP_API_KEY','VISTAPRINT_API_TOKEN') : (process.env.VISTAPRINT_API_KEY||process.env.VISTAPRINT_PROSHOP_API_KEY||process.env.VISTAPRINT_API_TOKEN||'');
  const configured = p==='4over4' ? Boolean(fourOver4Key && fourOver4Endpoint) : Boolean(vistaKey);
  return {provider:p,status:configured?'CREDENTIAL_PRESENT_VERIFY_PROVIDER_CONTRACT':'STAGED_ONLY',liveSubmission:false,note:'V56.10 never invents a vendor endpoint or assumes a reseller API contract.'};
}

module.exports=function registerV5610(app,{auth,ownerOnly,getContext={}}={}){
  const ctx=()=>getContext?getContext():{};
  async function ensureTables(){
    const pool=ctx().mysqlPool;if(!pool)return;
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_tenant_storefronts (
      id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,customer_id VARCHAR(100) NOT NULL DEFAULT '',order_id VARCHAR(100) NOT NULL DEFAULT '',slug VARCHAR(120) NOT NULL,
      template VARCHAR(60) NOT NULL,brand_json LONGTEXT NOT NULL,storefront_html LONGTEXT NOT NULL,status VARCHAR(40) NOT NULL DEFAULT 'STAGED',created_at DATETIME NOT NULL,updated_at DATETIME NOT NULL,
      UNIQUE KEY uq_storefront_order(order_id),INDEX idx_storefront_tenant(tenant_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_commerce_order_ledger (
      id VARCHAR(100) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,order_id VARCHAR(100) NOT NULL,event_type VARCHAR(100) NOT NULL,state VARCHAR(60) NOT NULL,provider VARCHAR(80) NOT NULL DEFAULT '',amount DECIMAL(14,2) NOT NULL DEFAULT 0,
      idempotency_key VARCHAR(180) NOT NULL,detail_json LONGTEXT,created_at DATETIME NOT NULL,UNIQUE KEY uq_commerce_ledger_idem(idempotency_key),INDEX idx_commerce_order(order_id,created_at),INDEX idx_commerce_tenant(tenant_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  async function ledger(event){
    const pool=ctx().mysqlPool;if(!pool)return;
    const idem=clean(event.idempotencyKey||`${event.orderId||'none'}:${event.eventType}:${event.state}`,180);
    await pool.query(`INSERT INTO sbc_commerce_order_ledger(id,tenant_id,order_id,event_type,state,provider,amount,idempotency_key,detail_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE detail_json=VALUES(detail_json)`,[
      event.id||id('ledger'),Number(__sbcRequireTenantId(event.tenantId)),clean(event.orderId||'',100),clean(event.eventType,100),clean(event.state,60),clean(event.provider||'',80),Number(event.amount||0),idem,safeJson(event.detail||{}),sqlDateTime(event.createdAt||now())
    ]);
  }

  app.get('/api/v5610/commerce/overview',auth,ownerOnly,async(req,res)=>{
    try{
      await ensureTables(); const c=ctx(); const db=c.db||{}; const pool=c.mysqlPool;
      const orders=Array.isArray(db.orders)?db.orders:[]; const jobs=Array.isArray(db.fulfillmentJobs)?db.fulfillmentJobs:[];
      let storefronts=0,ledger=0,staged=0;
      if(pool){[[{count:storefronts}],[{count:ledger}],[{count:staged}]] = await Promise.all([
        pool.query('SELECT COUNT(*) count FROM sbc_tenant_storefronts WHERE tenant_id=?',[global.__SBC_REQUIRE_TENANT(req)]),
        pool.query('SELECT COUNT(*) count FROM sbc_commerce_order_ledger WHERE tenant_id=?',[global.__SBC_REQUIRE_TENANT(req)]),
        pool.query("SELECT COUNT(*) count FROM sbc_vendor_outbox WHERE tenant_id=? AND status IN ('STAGED','OWNER_CLEARANCE_REQUIRED')",[global.__SBC_REQUIRE_TENANT(req)])
      ].map(async p=>{const [rows]=await p;return rows;}));}
      const activeOrders=orders.filter(o=>!['Delivered','Cancelled'].includes(String(o.status||''))).length;
      const ownerLocks=jobs.filter(j=>Number(j.value||0)>=OWNER_THRESHOLD && !j.ownerClearanceAt).length;
      const providers=['4over4','vistaprint','internal'].map(p=>providerReadiness(p,c));
      res.setHeader('Cache-Control','no-store');res.json({ok:true,version:VERSION,threshold:OWNER_THRESHOLD,metrics:{orders:orders.length,activeOrders,fulfillmentJobs:jobs.length,ownerLocks,storefronts:Number(storefronts||0),ledgerEvents:Number(ledger||0),stagedProviderJobs:Number(staged||0)},providers});
    }catch(e){res.status(500).json({ok:false,version:VERSION,error:e.message});}
  });

  app.post('/api/v5610/storefront/provision',auth,ownerOnly,async(req,res)=>{
    try{
      await ensureTables(); const c=ctx(); const b=req.body||{}; const customer=(c.db?.customers||[]).find(x=>String(x.id)===String(b.customerId))||b.customer||{}; const order=(c.db?.orders||[]).find(x=>String(x.id)===String(b.orderId))||b.order||{};
      if(!order.id&&!b.orderId)throw new Error('Order is required for storefront provisioning.');
      const tenantId=Number(b.tenantId||global.__SBC_REQUIRE_TENANT(req)); const profile=storefrontProfile({customer,order,brand:b.brand||{},template:b.template});
      const result=SEC.provisionStorefront({tenantId,customer,order,brand:profile,template:profile.template});
      const row={id:id('store'),tenantId,customerId:String(customer.id||b.customerId||''),orderId:String(order.id||b.orderId||''),slug:clean(result.slug||result.profile?.slug||result.file?.split('/').pop()?.replace(/global.__SBC_REQUIRE_TENANT(req).html$/,'')||'storefront',120),template:profile.template,brand:profile,html:result.html||'',status:'STAGED',createdAt:now()};
      const pool=c.mysqlPool;if(pool){await pool.query(`INSERT INTO sbc_tenant_storefronts(id,tenant_id,customer_id,order_id,slug,template,brand_json,storefront_html,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE slug=VALUES(slug),template=VALUES(template),brand_json=VALUES(brand_json),storefront_html=VALUES(storefront_html),status=VALUES(status),updated_at=VALUES(updated_at)`,[row.id,row.tenantId,row.customerId,row.orderId,row.slug,row.template,safeJson(row.brand),row.html||'',row.status,sqlDateTime(row.createdAt),sqlDateTime(now())]);}
      await ledger({tenantId,orderId:row.orderId,eventType:'storefront_provisioned',state:'STAGED',amount:orderTotal(order),idempotencyKey:`storefront:${row.orderId}`,detail:{storefrontId:row.id,slug:row.slug,template:row.template}});
      if(c.audit)c.audit(req.user,'v5610_storefront_provisioned',`Provisioned branded storefront for ${row.orderId}`,{tenantId,orderId:row.orderId,storefrontId:row.id,template:row.template});
      res.status(201).json({ok:true,version:VERSION,storefront:{id:row.id,tenantId:row.tenantId,orderId:row.orderId,slug:row.slug,template:row.template,status:row.status,brand:row.brand},source:result});
    }catch(e){res.status(400).json({ok:false,version:VERSION,error:e.message});}
  });

  app.get('/api/v5610/storefronts',auth,ownerOnly,async(req,res)=>{
    try{await ensureTables();const pool=ctx().mysqlPool;if(!pool)return res.json({ok:true,version:VERSION,rows:[]});const [rows]=await pool.query('SELECT id,tenant_id,customer_id,order_id,slug,template,status,created_at,updated_at FROM sbc_tenant_storefronts WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100',[global.__SBC_REQUIRE_TENANT(req)]);res.json({ok:true,version:VERSION,rows});}
    catch(e){res.status(500).json({ok:false,error:e.message});}
  });


  app.get('/api/v5610/fulfillment/wholesale-gasket',auth,ownerOnly,(req,res)=>{
    try{
      const gateway=ctx().wholesaleGateway;
      if(!gateway)return res.status(503).json({ok:false,version:VERSION,error:'Wholesale gateway unavailable.'});
      res.json({ok:true,version:VERSION,gasket:gateway.readiness('4over4'),policy:{noNewSecrets:true,providerFailClosed:true,explicitAutoExecuteFlag:'SBC_FOUROVER4_AUTO_EXECUTE',ownerBreakpoint:OWNER_THRESHOLD}});
    }catch(e){res.status(500).json({ok:false,version:VERSION,error:e.message});}
  });
  app.post('/api/v5610/fulfillment/wholesale-preview/:orderId',auth,ownerOnly,async(req,res)=>{
    try{
      const c=ctx(); const order=(c.db?.orders||[]).find(x=>String(x.id)===String(req.params.orderId));
      if(!order)return res.status(404).json({ok:false,error:'Order not found.'});
      const jobs=Array.isArray(c.db?.megaOpsStore?.fulfillmentJobs)?c.db.megaOpsStore.fulfillmentJobs.filter(x=>String(x.orderId)===String(order.id)):[];
      const job=jobs.find(x=>String(x.vendor)==='fourOverFour')||jobs[0];
      if(!job)return res.status(409).json({ok:false,error:'Prepare fulfillment first; no durable job exists.'});
      const gateway=c.wholesaleGateway;if(!gateway)return res.status(503).json({ok:false,error:'Wholesale gateway unavailable.'});
      res.json({ok:true,version:VERSION,preview:gateway.buildDispatchPlan(job,'4over4'),externalSubmission:false});
    }catch(e){res.status(409).json({ok:false,version:VERSION,error:e.message});}
  });

  app.post('/api/v5610/fulfillment/prepare/:orderId',auth,ownerOnly,async(req,res)=>{
    try{
      const c=ctx(); const order=(c.db?.orders||[]).find(x=>String(x.id)===String(req.params.orderId)); if(!order)return res.status(404).json({ok:false,error:'Order not found.'});
      if(typeof c.createFulfillmentJobsForOrder!=='function')throw new Error('Fulfillment orchestration binding is unavailable.');
      const jobs=await c.createFulfillmentJobsForOrder(order);
      await ledger({tenantId:Number(order.tenantId||global.__SBC_REQUIRE_TENANT(req)),orderId:String(order.id),eventType:'fulfillment_prepared',state:'STAGED',amount:orderTotal(order),idempotencyKey:`fulfillment:${order.id}`,detail:{jobIds:(jobs||[]).map(x=>x.id),count:(jobs||[]).length}});
      res.status(201).json({ok:true,version:VERSION,orderId:order.id,jobs:jobs||[],ownerThreshold:OWNER_THRESHOLD});
    }catch(e){res.status(409).json({ok:false,version:VERSION,error:e.message});}
  });

  app.post('/api/v5610/fulfillment/run-ready',auth,ownerOnly,async(req,res)=>{
    try{if(typeof ctx().processReadyFulfillmentJobs!=='function')throw new Error('Fulfillment worker binding is unavailable.');const result=await ctx().processReadyFulfillmentJobs();res.status(202).json({ok:true,version:VERSION,result});}
    catch(e){res.status(409).json({ok:false,version:VERSION,error:e.message});}
  });

  app.get('/api/v5610/fulfillment/providers',auth,ownerOnly,(req,res)=>res.json({ok:true,version:VERSION,providers:['4over4','vistaprint','internal'].map(p=>providerReadiness(p,ctx()))}));
};
