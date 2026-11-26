'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPool}=require('mysql2/promise');
const {runMigrations}=require('./migrate.cjs');
const {ingestPaymentEvidence}=require('./ledger.cjs');
const {normalizePaymentEvidence}=require('./index.cjs');
const {randomUUID}=require('node:crypto');
const ev={provider:'square',environment:'sandbox',accountId:'merchant-ci',eventId:'evt-ci-1',tenantRef:'sbc:1',kind:'capture',amountMinor:19900,currency:'USD',occurredAt:'2026-11-26T12:00:00.000Z',payloadSha256:'a'.repeat(64)};
test('isolated MySQL 8: migration, concurrent replay, tamper, ambiguous commit, atomic rollback, tenant FK',async()=>{
 assert.equal(process.env.SBC_LEDGER_DISPOSABLE_CI,'1','explicit disposable database required');
 // Fixed loopback address, fixed isolated database and test-only credentials. Never read application DB config.
 const pool=createPool({host:'127.0.0.1',port:3306,user:'root',password:'sbc_ledger_disposable_ci_password',database:'sbc_ledger_ci',connectionLimit:4,timezone:'Z'});
 try{
  assert.deepEqual(await runMigrations(pool,{mode:'writer',assertWriter:()=>true}),{verified:4,applied:4});
  assert.deepEqual(await runMigrations(pool,{mode:'reader'}),{verified:4,applied:0});
  const results=await Promise.all(Array.from({length:4},()=>ingestPaymentEvidence(pool,ev)));
  assert.equal(results.filter(r=>r.status==='COMMITTED').length,1);
  assert.equal(results.filter(r=>r.status==='DUPLICATE_VERIFIED').length,3);
  for(const patch of [{amountMinor:20000},{tenantRef:'sbc:2'},{payloadSha256:'b'.repeat(64)}])await assert.rejects(ingestPaymentEvidence(pool,{...ev,...patch}),{code:'SBC_EVIDENCE_HASH_MISMATCH'});
  await assert.rejects(pool.execute('INSERT INTO sbc_core_financial_outbox (tenant_ref,event_key,topic,payload_json,correlation_id) VALUES (?,?,?,?,?)',['sbc:2',results[0].eventKey,'test','{}',randomUUID()]),{code:'ER_NO_REFERENCED_ROW_2'});
  // Inject acknowledgement loss AFTER the genuine InnoDB commit, not a mocked database.
  let first=true;
  const lostAck={async getConnection(){const c=await pool.getConnection();if(!first)return c;first=false;return {beginTransaction:()=>c.beginTransaction(),execute:(...args)=>c.execute(...args),rollback:()=>c.rollback(),release:()=>c.release(),destroy:()=>c.destroy(),async commit(){await c.commit();throw Object.assign(Error('injected lost acknowledgement'),{code:'SBC_MYSQL_AMBIGUOUS_WRITE'});}};}};
  const stripe={...ev,provider:'stripe',eventId:'evt-ci-2'};
  assert.equal((await ingestPaymentEvidence(lostAck,stripe)).status,'COMMIT_RECONCILED');
  assert.equal((await ingestPaymentEvidence(pool,stripe)).status,'DUPLICATE_VERIFIED');
  // Fail the second insert before commit; the real first insert must roll back.
  const failure={async getConnection(){const c=await pool.getConnection();return {beginTransaction:()=>c.beginTransaction(),execute:(sql,args)=>{if(sql.startsWith('INSERT INTO sbc_core_financial_outbox'))throw Error('injected outbox failure');return c.execute(sql,args);},rollback:()=>c.rollback(),release:()=>c.release(),destroy:()=>c.destroy(),commit:()=>c.commit()};}};
  const aborted={...ev,eventId:'evt-ci-3'};
  await assert.rejects(ingestPaymentEvidence(failure,aborted),/injected outbox failure/);
  const [[missing]]=await pool.execute('SELECT COUNT(*) AS n FROM sbc_core_transactions_ledger WHERE event_key=?',[normalizePaymentEvidence(aborted).eventKey]);assert.equal(Number(missing.n),0);
  for(const [table,count] of [['sbc_core_transactions_ledger',2],['sbc_core_financial_outbox',2],['sbc_core_entitlement_events',0],['sbc_core_entitlement_grants',0]]){
   const [[row]]=await pool.query('SELECT COUNT(*) AS n FROM '+table);assert.equal(Number(row.n),count,table);
  }
 }finally{await pool.end();}
});
