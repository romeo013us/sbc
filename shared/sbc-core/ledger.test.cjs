'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {ingestPaymentEvidence}=require('./ledger.cjs');
const ev={provider:'square',environment:'sandbox',accountId:'merchant-1',eventId:'event-1',tenantRef:'sbc:1',kind:'capture',amountMinor:19900,currency:'USD',occurredAt:'2026-11-26T12:00:00.000Z',payloadSha256:'a'.repeat(64)};
function fixture(fault){
 const rows=new Map(),outbox=new Map();let leases=0,attempts=0,mutations=0,destroyed=0,active=0;
 const pool={async getConnection(){leases++;active++;let staged=null,notice=null,closed=false;const close=()=>{if(!closed){closed=true;active--;}};return {
 async beginTransaction(){},async execute(sql,p){
 if(sql.startsWith('INSERT INTO sbc_core_transactions_ledger')){attempts++;if(rows.has(p[0]))throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});staged={event_key:p[0],evidence_hash:p[1],tenant_ref:p[2]};return [{affectedRows:1}];}
 if(sql.startsWith('INSERT INTO sbc_core_financial_outbox')){if(fault==='outbox')throw Error('outbox unavailable');notice={payload_json:p[3]};return [{affectedRows:1}];}
 if(sql.startsWith('SELECT')){assert.equal(active,1,'failed transaction released before readback');const r=rows.get(p[1]);return [r?[{...r,payload_json:outbox.get(p[1])?.payload_json??null}]:[]];}
 throw Error('unexpected SQL');},async commit(){if(fault==='before-commit')throw Object.assign(Error('lost'),{code:'ECONNRESET'});rows.set(staged.event_key,staged);outbox.set(staged.event_key,notice);mutations++;if(fault==='after-commit')throw Object.assign(Error('lost'),{code:'SBC_MYSQL_AMBIGUOUS_WRITE'});},async rollback(){staged=null;notice=null;},release:close,destroy(){destroyed++;close();}};}};
 return {pool,rows,outbox,stats:()=>({leases,attempts,mutations,destroyed,active})};
}
test('exact duplicate verifies receipt; altered evidence or tenant fails',async()=>{const f=fixture();const a=await ingestPaymentEvidence(f.pool,ev);assert.equal(a.status,'COMMITTED');assert.equal(a.effect,'none');assert.equal((await ingestPaymentEvidence(f.pool,ev)).status,'DUPLICATE_VERIFIED');for(const change of [{amountMinor:20000},{tenantRef:'sbc:2'},{payloadSha256:'b'.repeat(64)}])await assert.rejects(ingestPaymentEvidence(f.pool,{...ev,...change}),{code:'SBC_EVIDENCE_HASH_MISMATCH'});assert.equal(f.stats().mutations,1);assert.equal(f.stats().active,0);});
test('lost acknowledgement after commit is reconciled without replay',async()=>{const f=fixture('after-commit');assert.equal((await ingestPaymentEvidence(f.pool,ev)).status,'COMMIT_RECONCILED');assert.deepEqual(f.stats(),{leases:2,attempts:1,mutations:1,destroyed:1,active:0});});
test('unconfirmed commit never returns success or retries a write',async()=>{const f=fixture('before-commit');await assert.rejects(ingestPaymentEvidence(f.pool,ev),{code:'SBC_LEDGER_COMMIT_UNCONFIRMED'});assert.equal(f.stats().attempts,1);assert.equal(f.rows.size,0);assert.equal(f.stats().active,0);});
test('outbox insertion failure rolls back evidence',async()=>{const f=fixture('outbox');await assert.rejects(ingestPaymentEvidence(f.pool,ev),/outbox unavailable/);assert.equal(f.rows.size,0);assert.equal(f.outbox.size,0);});
test('missing or altered outbox receipt cannot acknowledge duplicate',async()=>{const f=fixture();const a=await ingestPaymentEvidence(f.pool,ev);f.outbox.delete(a.eventKey);await assert.rejects(ingestPaymentEvidence(f.pool,ev),{code:'SBC_LEDGER_RECEIPT_INCOMPLETE'});});
test('entitlement directives and invalid evidence never reach database',async()=>{const f=fixture();await assert.rejects(ingestPaymentEvidence(f.pool,{...ev,action:'grant'}));await assert.rejects(ingestPaymentEvidence(f.pool,ev,{action:'grant'}));assert.equal(f.stats().leases,0);});
