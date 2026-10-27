// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.22 — Autonomous Revenue Operations + Economic Control Plane
 *
 * Durable economic control plane over V56.14–V56.21.
 * MySQL is authoritative; in-memory state is derived/cache only.
 *
 * Scope:
 * - unify funnel, paid orders, recurring revenue, operating cost and acquisition spend
 * - persist an auditable economic snapshot
 * - surface exceptions requiring owner action
 * - provide bounded, idempotent owner controls
 * - continuously reconcile against existing V56.20/V56.21 rails
 */
const crypto=require('crypto');
const VERSION='56.22.0';
const OWNER_THRESHOLD=10000;
const POLL_MS=Math.max(15000,Number(process.env.SBC_V56220_ECONOMIC_INTERVAL_MS||30000));
const MAX_EXCEPTIONS=100;
let ctx=null,timer=null,running=false,lastRun=null;

const iso=()=>new Date().toISOString();
const sqlNow=()=>ctx?.sqlDateTime?ctx.sqlDateTime(iso()):iso();
const id=(p='eco')=>`${p}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
const n=v=>{const x=Number(v);return Number.isFinite(x)?x:0;};
const clean=(v,m=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,m);
const month=()=>iso().slice(0,7);

async function ensureTables(){
    if (typeof global.SBC_ECONOMIC_CONTROL_SCHEMA_ALLOWED === 'function' && !global.SBC_ECONOMIC_CONTROL_SCHEMA_ALLOWED()) return false; // SBC_V6558_ECONOMIC_CONTROL_DDL_GATE

  if(!ctx?.mysqlPool)return false;
  const q=ctx.mysqlPool.query.bind(ctx.mysqlPool);
  await q(`CREATE TABLE IF NOT EXISTS sbc_v56220_economic_ledger (
    id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL, event_type VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60) NOT NULL DEFAULT '', entity_id VARCHAR(120) NOT NULL DEFAULT '',
    amount DECIMAL(14,2) NOT NULL DEFAULT 0, direction VARCHAR(20) NOT NULL DEFAULT 'INFO',
    source VARCHAR(80) NOT NULL DEFAULT '', idempotency_key VARCHAR(180) NOT NULL,
    metadata_json LONGTEXT, created_at DATETIME NOT NULL,
    UNIQUE KEY uq_eco_idem(tenant_id,idempotency_key),
    INDEX idx_eco(tenant_id,event_type,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await q(`CREATE TABLE IF NOT EXISTS sbc_v56220_economic_snapshots (
    id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL, snapshot_key VARCHAR(40) NOT NULL,
    gross_mrr DECIMAL(14,2) NOT NULL DEFAULT 0, operating_costs DECIMAL(14,2) NOT NULL DEFAULT 0,
    acquisition_spend DECIMAL(14,2) NOT NULL DEFAULT 0, net_mrr DECIMAL(14,2) NOT NULL DEFAULT 0,
    cash_in DECIMAL(14,2) NOT NULL DEFAULT 0, cash_out DECIMAL(14,2) NOT NULL DEFAULT 0,
    net_cash_flow DECIMAL(14,2) NOT NULL DEFAULT 0, paid_customers INT NOT NULL DEFAULT 0,
    paid_orders INT NOT NULL DEFAULT 0, active_customers INT NOT NULL DEFAULT 0,
    demos INT NOT NULL DEFAULT 0, checkouts INT NOT NULL DEFAULT 0, activated INT NOT NULL DEFAULT 0,
    exceptions INT NOT NULL DEFAULT 0, status VARCHAR(30) NOT NULL DEFAULT 'HEALTHY',
    metadata_json LONGTEXT, created_at DATETIME NOT NULL,
    UNIQUE KEY uq_eco_snapshot(tenant_id,snapshot_key),
    INDEX idx_eco_snapshot(tenant_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await q(`CREATE TABLE IF NOT EXISTS sbc_v56220_owner_exceptions (
    id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL, exception_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    entity_type VARCHAR(60) NOT NULL DEFAULT '', entity_id VARCHAR(120) NOT NULL DEFAULT '',
    amount DECIMAL(14,2) NOT NULL DEFAULT 0, reason VARCHAR(500) NOT NULL,
    metadata_json LONGTEXT, created_at DATETIME NOT NULL, resolved_at DATETIME NULL,
    INDEX idx_exception(tenant_id,status,severity,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  return true;
}

async function ledger(eventType,{tenantId=1,entityType='',entityId='',amount=0,direction='INFO',source='system',idempotencyKey='',metadata={}}={}){
  if(!ctx?.mysqlPool)return {ok:false,reason:'durable_storage_unavailable'};
  const key=clean(idempotencyKey||`${eventType}:${entityType}:${entityId}:${amount}:${month()}`,180);
  const ts=sqlNow();
  const out={id:id('eco'),tenantId:Number(tenantId),eventType:clean(eventType,80),entityType:clean(entityType,60),entityId:clean(entityId,120),amount:n(amount),direction:clean(direction,20),source:clean(source,80),idempotencyKey:key};
  await ctx.mysqlPool.query(
    `INSERT INTO sbc_v56220_economic_ledger(id,tenant_id,event_type,entity_type,entity_id,amount,direction,source,idempotency_key,metadata_json,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE metadata_json=VALUES(metadata_json)`,
    [out.id,out.tenantId,out.eventType,out.entityType,out.entityId,out.amount,out.direction,out.source,key,JSON.stringify(metadata||{}),ts]
  );
  return {ok:true,...out};
}

async function exception(type,{tenantId=1,severity='MEDIUM',entityType='',entityId='',amount=0,reason='',metadata={}}={}){
  if(!ctx?.mysqlPool)return {ok:false,reason:'durable_storage_unavailable'};
  const key=`${clean(type,100)}:${clean(entityType,60)}:${clean(entityId,120)}:${month()}`;
  const idv=id('exc');
  await ctx.mysqlPool.query(
    `INSERT INTO sbc_v56220_owner_exceptions(id,tenant_id,exception_type,severity,status,entity_type,entity_id,amount,reason,metadata_json,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [idv,Number(tenantId),clean(type,100),clean(severity,20),'OPEN',clean(entityType,60),clean(entityId,120),n(amount),clean(reason,500),JSON.stringify(metadata||{}),sqlNow()]
  );
  return {ok:true,id:idv,type,tenantId:Number(tenantId),severity};
}

function customerMrr(c){
  const direct=n(c?.mrr??c?.monthlyRecurringRevenue);
  if(direct>0)return direct;
  const active=Boolean(c?.activeSubscription||String(c?.status||'').toUpperCase()==='ACTIVE');
  const p=String(c?.subscriptionPlan||c?.plan||c?.packageId||c?.package||'').toLowerCase();
  const prices={entry:99,starter:199,essentials:349,professional:599,completeLaunch:699};
  const price=prices[p]||0;
  return active?price:0;
}

async function calculate(tenantId=1){
  const tid=Number(tenantId)||1;
  const customers=(ctx?.db?.customers||[]).filter(c=>Number(__sbcRequireTenantId(c?.tenantId))===tid);
  const orders=(ctx?.db?.orders||[]).filter(o=>Number(__sbcRequireTenantId(o?.tenantId))===tid);
  const paid=orders.filter(o=>String(o?.paymentStatus||o?.status||'').toUpperCase()==='PAID' && n(o?.amount??o?.price)>0);
  const active=customers.filter(c=>customerMrr(c)>0);
  const grossMrr=customers.reduce((s,c)=>s+customerMrr(c),0);
  const cashIn=paid.reduce((s,o)=>s+n(o?.amount??o?.price),0);
  let operatingCosts=0, acquisitionSpend=0;
  let demos=0,checkouts=0,activated=0;
  if(ctx?.mysqlPool){
    const [cost]=await ctx.mysqlPool.query(`SELECT COALESCE(SUM(amount),0) total FROM sbc_v56200_cost_ledger WHERE tenant_id=? AND created_at>=DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-01')`,[tid]);
    operatingCosts=n(cost?.[0]?.total);
    const [spend]=await ctx.mysqlPool.query(`SELECT COALESCE(SUM(amount),0) total FROM sbc_v56210_acquisition_spend WHERE tenant_id=? AND month_key=?`,[tid,month()]);
    acquisitionSpend=n(spend?.[0]?.total);
    const [f]=await ctx.mysqlPool.query(`SELECT event_name,COUNT(*) c FROM sbc_v56200_funnel_events WHERE tenant_id=? AND created_at>=DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-01') GROUP BY event_name`,[tid]);
    for(const row of f||[]){
      const k=String(row.event_name||'').toUpperCase(), c=n(row.c);
      if(k.includes('DEMO'))demos+=c;
      if(k.includes('CHECKOUT'))checkouts+=c;
      if(k.includes('ACTIVAT'))activated+=c;
    }
  }
  const cashOut=operatingCosts+acquisitionSpend;
  return {
    tenantId:tid,snapshotKey:`${month()}:${new Date().toISOString().slice(0,13)}`,
    monthKey:month(),grossMrr:Number(grossMrr.toFixed(2)),
    operatingCosts:Number(operatingCosts.toFixed(2)),acquisitionSpend:Number(acquisitionSpend.toFixed(2)),
    netMrr:Number((grossMrr-operatingCosts).toFixed(2)),cashIn:Number(cashIn.toFixed(2)),
    cashOut:Number(cashOut.toFixed(2)),netCashFlow:Number((cashIn-cashOut).toFixed(2)),
    paidCustomers:new Set(paid.map(o=>String(o.customerId||o.customer_id||''))).size,
    paidOrders:paid.length,activeCustomers:active.length,demos,checkouts,activated
  };
}

async function snapshot(tenantId=1){
  if(!ctx?.mysqlPool)return {ok:false,reason:'durable_storage_unavailable'};
  const e=await calculate(tenantId);
  const exceptions=[];
  if(e.netCashFlow<0)exceptions.push(await exception('NEGATIVE_NET_CASH_FLOW',{tenantId,severity:'HIGH',amount:Math.abs(e.netCashFlow),reason:'Current-month cash out exceeds observed cash in.',metadata:e}));
  if(e.grossMrr>0 && e.netMrr<0)exceptions.push(await exception('OPERATING_COSTS_EXCEED_MRR',{tenantId,severity:'HIGH',amount:Math.abs(e.netMrr),reason:'Operating costs exceed gross recurring revenue.',metadata:e}));
  if(e.paidOrders>0 && e.activeCustomers===0)exceptions.push(await exception('PAID_WITHOUT_ACTIVE_CUSTOMER',{tenantId,severity:'HIGH',reason:'Paid orders exist but no active recurring customer is observed.',metadata:e}));
  if(e.cashIn>=OWNER_THRESHOLD)await exception('OWNER_FINANCIAL_REVIEW',{tenantId,severity:'CRITICAL',amount:e.cashIn,reason:'Observed cash-in reached the protected owner review threshold.',metadata:{threshold:OWNER_THRESHOLD}});
  const open=ctx.mysqlPool?await ctx.mysqlPool.query(`SELECT COUNT(*) c FROM sbc_v56220_owner_exceptions WHERE tenant_id=? AND status='OPEN'`,[Number(tenantId)]):[[{c:0}]];
  const openCount=n(open?.[0]?.[0]?.c);
  const status=openCount?'ATTENTION':'HEALTHY';
  const ts=sqlNow(), key=e.snapshotKey;
  await ctx.mysqlPool.query(
    `INSERT INTO sbc_v56220_economic_snapshots(id,tenant_id,snapshot_key,gross_mrr,operating_costs,acquisition_spend,net_mrr,cash_in,cash_out,net_cash_flow,paid_customers,paid_orders,active_customers,demos,checkouts,activated,exceptions,status,metadata_json,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE gross_mrr=VALUES(gross_mrr),operating_costs=VALUES(operating_costs),acquisition_spend=VALUES(acquisition_spend),net_mrr=VALUES(net_mrr),cash_in=VALUES(cash_in),cash_out=VALUES(cash_out),net_cash_flow=VALUES(net_cash_flow),paid_customers=VALUES(paid_customers),paid_orders=VALUES(paid_orders),active_customers=VALUES(active_customers),demos=VALUES(demos),checkouts=VALUES(checkouts),activated=VALUES(activated),exceptions=VALUES(exceptions),status=VALUES(status),metadata_json=VALUES(metadata_json)`,
    [id('snap'),e.tenantId,key,e.grossMrr,e.operatingCosts,e.acquisitionSpend,e.netMrr,e.cashIn,e.cashOut,e.netCashFlow,e.paidCustomers,e.paidOrders,e.activeCustomers,e.demos,e.checkouts,e.activated,openCount,status,JSON.stringify({version:VERSION}),ts]
  );
  return {ok:true,version:VERSION,status,economics:e,openExceptions:openCount,newExceptions:exceptions};
}

async function status(tenantId=1){
  if(!ctx?.mysqlPool)return {ok:false,version:VERSION,durable:false};
  const [rows]=await ctx.mysqlPool.query(`SELECT * FROM sbc_v56220_economic_snapshots WHERE tenant_id=? ORDER BY created_at DESC LIMIT 1`,[Number(tenantId)]);
  const [ex]=await ctx.mysqlPool.query(`SELECT id,exception_type,severity,status,entity_type,entity_id,amount,reason,created_at FROM sbc_v56220_owner_exceptions WHERE tenant_id=? AND status='OPEN' ORDER BY FIELD(severity,'CRITICAL','HIGH','MEDIUM','LOW'),created_at DESC LIMIT ?`,[Number(tenantId),MAX_EXCEPTIONS]);
  return {ok:true,version:VERSION,durable:true,running,lastRun,snapshot:rows?.[0]||null,exceptions:ex||[]};
}

async function resolveException(idv){
  if(!ctx?.mysqlPool)throw new Error('durable_storage_unavailable');
  const [r]=await ctx.mysqlPool.query(`UPDATE sbc_v56220_owner_exceptions SET status='RESOLVED',resolved_at=? WHERE id=? AND status='OPEN'`,[sqlNow(),clean(idv,120)]);
  return {ok:true,resolved:r?.affectedRows||0,id:clean(idv,120)};
}

async function recordCash({tenantId=1,eventType='CASH_ADJUSTMENT',amount=0,direction='IN',referenceId='',metadata={}}={}){
  const value=n(amount);
  if(value<0)throw new Error('cash_amount_invalid');
  if(!['IN','OUT'].includes(String(direction).toUpperCase()))throw new Error('cash_direction_invalid');
  return ledger(eventType,{tenantId,amount:value,direction:String(direction).toUpperCase(),source:'owner',entityType:'cash',entityId:clean(referenceId,120),idempotencyKey:`cash:${tenantId}:${eventType}:${referenceId}:${value}:${month()}`,metadata});
}

async function run(tenantId=1){
  if(running)return {ok:false,skipped:true,reason:'already_running'};
  running=true;
  try{
    await ensureTables();
    const out=await snapshot(tenantId);
    lastRun={at:iso(),...out};
    return lastRun;
  }finally{running=false;}
}

function start(){
  if(timer)return;
  run(1).catch(e=>console.warn('[V56.22 ECONOMIC CONTROL] initial:',e.message));
  timer=setInterval(()=>run(1).catch(e=>console.warn('[V56.22 ECONOMIC CONTROL] cycle:',e.message)),POLL_MS);
  if(timer.unref)timer.unref();
}
function stop(){if(timer){clearInterval(timer);timer=null;}}
function init(context={}){ctx=context;ensureTables().catch(e=>console.warn('[V56.22 ECONOMIC CONTROL] tables:',e.message));start();return {version:VERSION,pollMs:POLL_MS};}
function statusMeta(){return {version:VERSION,pollMs:POLL_MS,ownerThreshold:OWNER_THRESHOLD,durable:Boolean(ctx?.mysqlPool)};}

module.exports={VERSION,OWNER_THRESHOLD,init,start,stop,ensureTables,ledger,recordCash,calculate,snapshot,status,resolveException,run,statusMeta};
