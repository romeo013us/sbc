'use strict';
const crypto = require('crypto');

const VERSION='56.25.3';
const KILL_STATES=['AUTONOMOUS_OUTREACH','AGENT_WORKERS','REVENUE_AUTOPILOT','FULFILLMENT_AUTOMATION','NEW_CHECKOUTS','ROUTINE_AUTOMATION'];
const DEFAULT_SPEND_CAP=Number(process.env.SBC_AI_DAILY_SPEND_CAP_USD||50);

function requestId(req,res,next){
  const incoming=String(req.get('x-request-id')||'').trim();
  const id=/^[A-Za-z0-9._:-]{8,120}$/.test(incoming)?incoming:crypto.randomUUID();
  req.requestId=id; res.setHeader('X-Request-ID',id); next();
}
function securityHeaders(req,res,next){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  if(req.secure || String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy-Report-Only',"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; font-src 'self' data: https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  next();
}
function requireTenant(tenantId){
  const n=Number(tenantId);
  if(!Number.isInteger(n)||n<=0) throw new Error('TENANT_CONTEXT_REQUIRED');
  return n;
}
function exposure({transactionAmount=0,vendorCommitment=0,cumulativeExposure=0}={}){
  const transaction=Number(transactionAmount)||0, vendor=Number(vendorCommitment)||0, cumulative=Number(cumulativeExposure)||0;
  return {transactionAmount:transaction,vendorCommitment:vendor,cumulativeExposure:cumulative,exposureAmount:Math.max(transaction+vendor,cumulative)};
}
function createRuntimeGate({pool,logger=console}={}){
  let state={globalKill:false,stops:Object.fromEntries(KILL_STATES.map(k=>[k,false])),aiSpendToday:0,spendDate:new Date().toISOString().slice(0,10)};
  let loaded=false;
  async function ensureSchema(){
    if(!pool) return false;
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_runtime_controls (control_key VARCHAR(80) PRIMARY KEY, control_value LONGTEXT NOT NULL, updated_at DATETIME NOT NULL, updated_by VARCHAR(120) NOT NULL DEFAULT 'system') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_ai_spend_ledger (id VARCHAR(100) PRIMARY KEY, tenant_id BIGINT NOT NULL, provider VARCHAR(80) NOT NULL, purpose VARCHAR(120) NOT NULL, amount_usd DECIMAL(12,4) NOT NULL DEFAULT 0, idempotency_key VARCHAR(180) NOT NULL, created_at DATETIME NOT NULL, UNIQUE KEY uq_ai_spend_idem(idempotency_key), INDEX idx_ai_spend_tenant_date(tenant_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_consent_ledger (id VARCHAR(100) PRIMARY KEY, tenant_id BIGINT NOT NULL, contact_id VARCHAR(120) NOT NULL, channel VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL, source VARCHAR(180) NOT NULL DEFAULT '', wording TEXT, captured_at DATETIME NOT NULL, metadata_json LONGTEXT, INDEX idx_consent_contact(tenant_id,contact_id,channel), INDEX idx_consent_status(tenant_id,status,channel)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    if(!loaded){
      const [rows]=await pool.query('SELECT control_key,control_value FROM sbc_runtime_controls');
      for(const r of rows){try{state[r.control_key]=JSON.parse(r.control_value)}catch{}}
      loaded=true;
    }
    return true;
  }
  function resetSpendDay(){const d=new Date().toISOString().slice(0,10);if(state.spendDate!==d){state.spendDate=d;state.aiSpendToday=0;}}
  async function persist(key,value,by='system'){if(!pool)return;await pool.query('INSERT INTO sbc_runtime_controls(control_key,control_value,updated_at,updated_by) VALUES(?,?,UTC_TIMESTAMP(),?) ON DUPLICATE KEY UPDATE control_value=VALUES(control_value),updated_at=UTC_TIMESTAMP(),updated_by=VALUES(updated_by)',[key,JSON.stringify(value),String(by)]);}
  function blocked(kind){return Boolean(state.globalKill||state.stops[kind]);}
  async function setKill(globalKill,stops,by='owner'){
    state.globalKill=Boolean(globalKill);
    for(const k of KILL_STATES) if(stops&&Object.prototype.hasOwnProperty.call(stops,k)) state.stops[k]=Boolean(stops[k]);
    await persist('globalKill',state.globalKill,by); await persist('stops',state.stops,by); return snapshot();
  }
  async function recordSpend({tenantId,provider='openai',purpose='ai',amountUsd=0,idempotencyKey}={}){
    requireTenant(tenantId); resetSpendDay(); const amount=Math.max(0,Number(amountUsd)||0); if(amount>0&&state.aiSpendToday+amount>DEFAULT_SPEND_CAP) throw new Error('AI_DAILY_SPEND_CAP_EXCEEDED');
    if(pool){await ensureSchema(); const idem=String(idempotencyKey||`${tenantId}:${provider}:${purpose}:${Date.now()}`);const id='aispend_'+crypto.randomBytes(8).toString('hex');const [r]=await pool.query('INSERT INTO sbc_ai_spend_ledger(id,tenant_id,provider,purpose,amount_usd,idempotency_key,created_at) VALUES(?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id=id',[id,tenantId,provider,purpose,amount,idem]);if(r.affectedRows===1)state.aiSpendToday+=amount;}
    else state.aiSpendToday+=amount;
    return {ok:true,dailyCap:DEFAULT_SPEND_CAP,spentToday:state.aiSpendToday,remaining:Math.max(0,DEFAULT_SPEND_CAP-state.aiSpendToday)};
  }
  async function addConsent({tenantId,contactId,channel,status='UNKNOWN',source='',wording='',metadata={}}={}){
    requireTenant(tenantId); if(!pool) throw new Error('CONSENT_LEDGER_REQUIRES_MYSQL'); await ensureSchema();
    const id='cons_'+crypto.randomBytes(8).toString('hex'); await pool.query('INSERT INTO sbc_consent_ledger(id,tenant_id,contact_id,channel,status,source,wording,captured_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?)',[id,tenantId,String(contactId||''),String(channel||'').toLowerCase(),String(status||'UNKNOWN').toUpperCase(),String(source||''),String(wording||''),new Date(),JSON.stringify(metadata||{})]); return {ok:true,id};
  }
  async function consent(tenantId,contactId,channel){requireTenant(tenantId);if(!pool)throw new Error('CONSENT_LEDGER_REQUIRES_MYSQL');await ensureSchema();const [rows]=await pool.query('SELECT status,source,captured_at FROM sbc_consent_ledger WHERE tenant_id=? AND contact_id=? AND channel=? ORDER BY captured_at DESC LIMIT 1',[tenantId,String(contactId),String(channel).toLowerCase()]);return rows[0]||{status:'UNKNOWN'};}
  function snapshot(){resetSpendDay();return {version:VERSION,globalKill:state.globalKill,stops:{...state.stops},aiSpend:{dailyCapUsd:DEFAULT_SPEND_CAP,spentTodayUsd:state.aiSpendToday,remainingUsd:Math.max(0,DEFAULT_SPEND_CAP-state.aiSpendToday),date:state.spendDate},autonomousAllowed:!state.globalKill,loaded};}
  return {ensureSchema,requestId,securityHeaders,requireTenant,exposure,setKill,blocked,recordSpend,addConsent,consent,snapshot};
}
module.exports={VERSION,KILL_STATES,DEFAULT_SPEND_CAP,requestId,securityHeaders,requireTenant,exposure,createRuntimeGate};
