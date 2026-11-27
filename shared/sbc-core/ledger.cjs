'use strict';
// Trusted provider adapters must verify signatures, readback and tenant mapping first.
// Evidence-only: never grants, revokes, charges, refunds or sends notifications.
const {randomUUID}=require('node:crypto');
const {normalizePaymentEvidence}=require('./index.cjs');
const TOPIC='payment.evidence.recorded';
const error=(code,cause)=>Object.assign(new Error(code,{cause}),{code});
const lost=e=>['SBC_MYSQL_AMBIGUOUS_WRITE','ECONNRESET','ETIMEDOUT','EPIPE','PROTOCOL_CONNECTION_LOST','PROTOCOL_SEQUENCE_TIMEOUT','ECONNABORTED'].includes(e?.code)||e?.fatal===true;
const duplicate=e=>e?.code==='ER_DUP_ENTRY'||e?.errno===1062;
function payload(ev){return {schemaVersion:1,eventKey:ev.eventKey,evidenceHash:ev.evidenceHash,tenantRef:ev.tenantRef,effect:'none'};}
async function reconcile(pool,ev,status){
 const cx=await pool.getConnection();let broken=false;
 try{
  const [rows]=await cx.execute('SELECT l.event_key,l.evidence_hash,l.tenant_ref,o.payload_json FROM sbc_core_transactions_ledger l LEFT JOIN sbc_core_financial_outbox o ON o.tenant_ref=l.tenant_ref AND o.event_key=l.event_key AND o.topic=? WHERE l.event_key=?',[TOPIC,ev.eventKey]);
  if(rows.length!==1)throw error('SBC_LEDGER_COMMIT_UNCONFIRMED');
  const r=rows[0];if(r.event_key!==ev.eventKey||r.evidence_hash!==ev.evidenceHash||r.tenant_ref!==ev.tenantRef)throw error('SBC_EVIDENCE_HASH_MISMATCH');
  let p;try{p=typeof r.payload_json==='string'?JSON.parse(r.payload_json):r.payload_json;}catch{throw error('SBC_LEDGER_RECEIPT_INCOMPLETE');}
  const expected=payload(ev);if(!p||Object.keys(p).length!==Object.keys(expected).length||Object.entries(expected).some(([k,v])=>p[k]!==v))throw error('SBC_LEDGER_RECEIPT_INCOMPLETE');
  return {status,eventKey:ev.eventKey,effect:'none'};
 }catch(e){broken=lost(e);throw e;}finally{if(broken)cx.destroy();else cx.release();}
}
async function ingestPaymentEvidence(pool,rawEvidence,options={}){
 const ev=normalizePaymentEvidence(rawEvidence);
 if(!options||Object.keys(options).some(k=>k!=='correlationId'))throw error('SBC_LEDGER_EVIDENCE_ONLY');
 const correlationId=options.correlationId??randomUUID();if(typeof correlationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(correlationId))throw error('SBC_LEDGER_CORRELATION_INVALID');
 const cx=await pool.getConnection();let stage='begin',broken=false,recovery=null;
 try{
  await cx.beginTransaction();stage='evidence';
  const [insert]=await cx.execute('INSERT INTO sbc_core_transactions_ledger (event_key,evidence_hash,tenant_ref,provider,environment,account_id,event_id,kind,amount_minor,currency,payload_sha256,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[ev.eventKey,ev.evidenceHash,ev.tenantRef,ev.provider,ev.environment,ev.accountId,ev.eventId,ev.kind,ev.amountMinor,ev.currency,ev.payloadSha256,ev.occurredAt.replace('T',' ').replace('Z','')]);
  if(insert.affectedRows!==1)throw error('SBC_LEDGER_INSERT_FAILED');stage='outbox';
  const [notice]=await cx.execute('INSERT INTO sbc_core_financial_outbox (tenant_ref,event_key,topic,payload_json,correlation_id) VALUES (?,?,?,?,?)',[ev.tenantRef,ev.eventKey,TOPIC,JSON.stringify(payload(ev)),correlationId]);
  if(notice.affectedRows!==1)throw error('SBC_LEDGER_OUTBOX_FAILED');stage='commit';await cx.commit();
  return {status:'COMMITTED',eventKey:ev.eventKey,effect:'none'};
 }catch(e){
  broken=lost(e)||stage==='commit';
  if(!broken){try{await cx.rollback();}catch{broken=true;}}
  if(stage==='commit')recovery='COMMIT_RECONCILED';else if(stage==='evidence'&&duplicate(e))recovery='DUPLICATE_VERIFIED';else throw e;
 }finally{if(broken)cx.destroy();else cx.release();}
 return reconcile(pool,ev,recovery);
}
module.exports=Object.freeze({ingestPaymentEvidence});
