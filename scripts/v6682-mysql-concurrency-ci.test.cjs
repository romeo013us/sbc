'use strict';
// V66.82: disposable GitHub Actions MySQL 8 fixture; never points to production.
const assert=require('node:assert/strict');
const mysql=require('mysql2/promise');
const finance=require('../enterprise/v569-production-expansion.js');
if(process.env.SBC_V6682_MYSQL_TEST!=='YES')throw Error('V6682_MYSQL_TEST_OPT_IN_REQUIRED');
const cfg={host:'127.0.0.1',port:3306,user:'root',password:process.env.SBC_V6682_CI_MYSQL_PASSWORD,database:'sbc_v6682_ci',waitForConnections:true,connectionLimit:20};
if(!cfg.password)throw Error('CI_MYSQL_PASSWORD_MISSING');
let pool;
async function run(){
  pool=mysql.createPool(cfg);
  await pool.query("CREATE TABLE sbc_financial_vault_locks (lock_id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL, action VARCHAR(160) NOT NULL, amount DECIMAL(14,2) NOT NULL, resource_id VARCHAR(180) NOT NULL, status VARCHAR(40) NOT NULL, owner_required TINYINT(1) NOT NULL, automation_allowed TINYINT(1) NOT NULL, owner_authorized_by VARCHAR(120) NOT NULL DEFAULT '', owner_authorized_at DATETIME NULL, metadata_json LONGTEXT, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, INDEX idx_vault_tenant (tenant_id,status,created_at)) ENGINE=InnoDB");
  await pool.query("CREATE TABLE sbc_fulfillment_jobs (id VARCHAR(120) PRIMARY KEY,status VARCHAR(40) NOT NULL, vendor_status VARCHAR(40), claimed_at DATETIME NULL, processing_started_at DATETIME NULL, lease_until DATETIME NULL, updated_at DATETIME NULL) ENGINE=InnoDB");
  await pool.query("INSERT INTO sbc_financial_vault_locks (lock_id,tenant_id,action,amount,resource_id,status,owner_required,automation_allowed,metadata_json,created_at,updated_at) VALUES ('lock-1',1,'vendor_fulfillment',10000.00,'job-1','OWNER_LOCKED',1,0,'{}',UTC_TIMESTAMP(),UTC_TIMESTAMP())");
  let results=await Promise.all(Array.from({length:25},()=>finance.authorizePersistentFinancialExecution(pool,'lock-1','ci-owner',{tenantId:1})));
  assert.equal(results.filter(r=>r.approvalOutcome==='AUTHORIZED').length,1,'Only one approval should win conditional UPDATE');
  assert.equal(results.filter(r=>r.approvalOutcome==='ALREADY_AUTHORIZED').length,24,'All others idempotent');
  const [rows]=await pool.query("SELECT * FROM sbc_financial_vault_locks WHERE lock_id='lock-1'");
  assert.equal(rows[0].status,'OWNER_AUTHORIZED');
  assert.equal(rows[0].owner_authorized_by,'ci-owner');
  const allowed={pool,amount:10000,tenantId:1,resourceId:'job-1',lockId:'lock-1',action:'vendor_fulfillment'};
  assert.equal((await finance.financialExecutionGate(allowed)).authorized,true);
  for(const [label,delta,pattern] of [
    ['resource',{resourceId:'job-other'},/RESOURCE_MISMATCH/],
    ['amount',{amount:25000},/AMOUNT_MISMATCH/],
    ['action',{action:'domain_purchase'},/ACTION_MISMATCH/],
    ['tenant',{tenantId:2},/OWNER_HARD_BREAKPOINT/],
    ['lockId',{lockId:'lock-other'},/OWNER_HARD_BREAKPOINT/]
  ]){
    await assert.rejects(finance.financialExecutionGate({...allowed,...delta}),pattern,label);
  }
  const replay=await finance.authorizePersistentFinancialExecution(pool,'lock-1','ci-owner',{tenantId:1});
  assert.equal(replay.approvalOutcome,'ALREADY_AUTHORIZED');
  await pool.query("INSERT INTO sbc_fulfillment_jobs (id,status) VALUES ('job-1','ready')");
  const claims=await Promise.all(Array.from({length:25},()=>pool.query("UPDATE sbc_fulfillment_jobs SET status='processing',vendor_status='processing',claimed_at=UTC_TIMESTAMP(),processing_started_at=UTC_TIMESTAMP(),lease_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),updated_at=UTC_TIMESTAMP() WHERE id=? AND status='ready'",['job-1'])));
  assert.equal(claims.filter(([r])=>r.affectedRows===1).length,1,'Exactly one vendor job claim may win');
  assert.equal(claims.filter(([r])=>r.affectedRows===0).length,24,'No duplicate claims');
  console.log('PASS isolated MySQL 8: 25-way owner approval, exact scope, replay, 25-way fulfillment claim');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{
  if(pool){try{await pool.end()}catch(e){console.error('MySQL cleanup error',e.message);process.exitCode=1}}
});
