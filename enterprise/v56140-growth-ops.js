// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto=require('crypto');
const REVENUE_TRUTH=require('./sbc-revenue-reporting-truth-v66142.cjs');
const PAYMENT_PROOF=require('./v6640-payment-evidence.cjs');
const VERSION='56.14.0-GROWTH-OPS';
const DAY=86400000;
const clean=v=>String(v??'').slice(0,120);
const money=v=>Math.round(Number(v||0)*100)/100;
function dayKey(d=new Date()){return new Date(d).toISOString().slice(0,10);}
function inRange(value,start,end){const t=new Date(value||0).getTime();return Number.isFinite(t)&&t>=start.getTime()&&t<end.getTime();}
function funnel({customers=[],orders=[],calls=[],attribution=[],start,end}){
  const leads=customers.filter(c=>!REVENUE_TRUTH.isQaCustomer(c)&&inRange(c.createdAt||c.created_at,start,end));
  const qualified=leads.filter(c=>['warm','hot'].includes(String(c.leadIntelligence?.leadTemperature||c.leadTemperature||'').toLowerCase()));
  // Count real provider-captured payments by capture time, never an order's shipping or synthetic QA status.
  const wonOrders=REVENUE_TRUTH.paidSummary(orders,customers).orders.filter(o=>
    inRange(PAYMENT_PROOF.proofFields(o).completedAt,start,end));
  const revenue=money(wonOrders.reduce((n,o)=>n+Number(o.price??o.total??0),0));
  const callsInRange=calls.filter(c=>inRange(c.created_at||c.createdAt,start,end));
  const answered=callsInRange.filter(c=>['COMPLETED','IN-PROGRESS'].includes(String(c.state||'').toUpperCase())).length;
  const paidCustomerIds=new Set(wonOrders.map(o=>String(o.customerId||'')).filter(Boolean));
  const positive=leads.filter(c=>paidCustomerIds.has(String(c.id))).length;
  const conversion=leads.length?Math.round((positive/leads.length)*1000)/10:0;
  const callConnect=callsInRange.length?Math.round((answered/callsInRange.length)*1000)/10:0;
  const source={};
  for(const c of leads){const s=clean(c.source||'Unknown');source[s]??={source:s,leads:0,qualified:0,customers:0,revenue:0};source[s].leads++;if(qualified.includes(c))source[s].qualified++;}
  const creditedCustomers=new Set();
  for(const o of wonOrders){const c=customers.find(x=>String(x.id)===String(o.customerId));const s=clean(c?.source||'Unknown');source[s]??={source:s,leads:0,qualified:0,customers:0,revenue:0};source[s].revenue=money(source[s].revenue+Number(o.price??o.total??0));const key=s+':'+String(o.customerId||'');if(c&&!creditedCustomers.has(key)){source[s].customers++;creditedCustomers.add(key);}}
  // Usage-metering/overage events are not settled payments. Never add them to revenue.
  return {start:start.toISOString(),end:end.toISOString(),leads:leads.length,qualified:qualified.length,customers:positive,orders:wonOrders.length,revenue,calls:callsInRange.length,answeredCalls:answered,callConnectRate:callConnect,conversionRate:conversion,sourceBreakdown:Object.values(source).sort((a,b)=>b.revenue-a.revenue),revenuePolicy:'provider-captured Square metadata; QA and status-only excluded; bank settlement not independently verified',qualificationPolicy:'warm/hot indicators, not independently verified callable prospects'};
}
function snapshotId(tenantId,date){return `GROWTH-${Number(__sbcRequireTenantId(tenantId))}-${date}`;}
async function ensureTables(pool){
  if(!pool)return;
  await pool.query(`CREATE TABLE IF NOT EXISTS sbc_growth_ledger (id VARCHAR(140) PRIMARY KEY,tenant_id BIGINT NOT NULL DEFAULT 1,ledger_date DATE NOT NULL,leads INT NOT NULL DEFAULT 0,qualified INT NOT NULL DEFAULT 0,customers INT NOT NULL DEFAULT 0,orders INT NOT NULL DEFAULT 0,revenue DECIMAL(14,2) NOT NULL DEFAULT 0,calls INT NOT NULL DEFAULT 0,answered_calls INT NOT NULL DEFAULT 0,call_connect_rate DECIMAL(7,2) NOT NULL DEFAULT 0,conversion_rate DECIMAL(7,2) NOT NULL DEFAULT 0,source_json LONGTEXT,created_at DATETIME NOT NULL,UNIQUE KEY uq_growth_ledger_day(tenant_id,ledger_date),INDEX idx_growth_ledger_date(ledger_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
async function buildSnapshot({db,pool,tenantId=1,date=new Date()}){
  const day=dayKey(date), start=new Date(`${day}T00:00:00.000Z`), end=new Date(start.getTime()+DAY);
  const customers=Array.isArray(db?.customers)?db.customers.filter(c=>Number(c.tenantId??c.tenant_id)===Number(tenantId)):[];
  const orders=Array.isArray(db?.orders)?db.orders.filter(o=>Number(o.tenantId??o.tenant_id)===Number(tenantId)):[];
  let calls=[]; let attribution=[];
  if(pool){
    try{const [r]=await pool.query('SELECT state,lead_id,created_at,updated_at FROM sbc_voice_call_state WHERE tenant_id=? AND created_at>=? AND created_at<?',[tenantId,start,end]);calls=r;}catch{}
    try{const [r]=await pool.query('SELECT * FROM sbc_monetization_events WHERE tenant_id=? AND created_at>=? AND created_at<?',[tenantId,start,end]);attribution=r;}catch{}
  }
  const metrics=funnel({customers,orders,calls,attribution,start,end});
  const id=snapshotId(tenantId,day);
  if(pool)await pool.query(`INSERT INTO sbc_growth_ledger(id,tenant_id,ledger_date,leads,qualified,customers,orders,revenue,calls,answered_calls,call_connect_rate,conversion_rate,source_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE leads=VALUES(leads),qualified=VALUES(qualified),customers=VALUES(customers),orders=VALUES(orders),revenue=VALUES(revenue),calls=VALUES(calls),answered_calls=VALUES(answered_calls),call_connect_rate=VALUES(call_connect_rate),conversion_rate=VALUES(conversion_rate),source_json=VALUES(source_json)`,[id,tenantId,day,metrics.leads,metrics.qualified,metrics.customers,metrics.orders,metrics.revenue,metrics.calls,metrics.answeredCalls,metrics.callConnectRate,metrics.conversionRate,JSON.stringify(metrics.sourceBreakdown)]);
  return {ok:true,id,ledgerDate:day,metrics};
}
async function live({db,pool,tenantId=1,days=30}){
  const end=new Date(),start=new Date(end.getTime()-Math.max(1,Math.min(90,Number(days||30)))*DAY);
  let calls=[],attribution=[];
  if(pool){try{const [r]=await pool.query('SELECT state,lead_id,created_at,updated_at FROM sbc_voice_call_state WHERE tenant_id=? AND created_at>=?',[tenantId,start]);calls=r;}catch{} try{const [r]=await pool.query('SELECT * FROM sbc_monetization_events WHERE tenant_id=? AND created_at>=?',[tenantId,start]);attribution=r;}catch{}}
  const customers=(db?.customers||[]).filter(c=>Number(c.tenantId??c.tenant_id)===Number(tenantId));
  const orders=(db?.orders||[]).filter(o=>Number(o.tenantId??o.tenant_id)===Number(tenantId));
  return funnel({customers,orders,calls,attribution,start,end});
}
module.exports={VERSION,ensureTables,buildSnapshot,live};
