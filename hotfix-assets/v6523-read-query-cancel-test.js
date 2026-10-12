'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const guardPath=path.resolve(__dirname,'../enterprise/v56133-mysql-query-guard.js');
if(!fs.existsSync(guardPath)){
 const patcher=fs.readFileSync(path.join(__dirname,'apply-v6523-read-query-cancel.js'),'utf8');
 assert(patcher.includes('sbcClassifySql'),'patcher must install conservative SQL classification');
 assert(patcher.includes('SBC_PREVIEW_DDL_BLOCKED'),'patcher must block DDL outside the Published writer runtime');
 assert(patcher.includes("startsWithWith&&verb==='SELECT'"),'only SELECT CTEs may receive read-only timeout handling');
 assert(!patcher.includes('EXPLAIN|WITH)\\b/i.test(normalizedSql)'),'all WITH statements must not be classified as read-only');
 console.log('V65.1.23/V65.1.26 root static test: PASS (safe CTE classification and Preview DDL gate present)');
}else{
 const {wrapPool,classifySql}=require(guardPath);
 (async()=>{
  let destroyed=0,calls=0;
  const conn={query:async(sql)=>{calls++;if(sql==='SELECT SLOW')return new Promise(()=>{});return [[{ok:1}],[]]},execute:async(sql)=>{calls++;return [[{ok:1}],[]]},release(){},destroy(){destroyed++}};
  const guarded=wrapPool({getConnection:async()=>conn},{attempts:3});
  const fast=await guarded.query('SELECT 1');assert.equal(fast[0][0].ok,1);
  const started=Date.now();await assert.rejects(guarded.query('SELECT SLOW'),e=>e.code==='SBC_MYSQL_READ_QUERY_TIMEOUT'&&e.sbcNoRetry===true);
  assert(Date.now()-started<6000,'read query should be bounded');assert(destroyed>=1,'timed out query connection must be destroyed');assert.equal(calls,2,'timed out query must not be retried');
  assert.equal(classifySql('WITH c AS (SELECT 1) SELECT * FROM c').isReadOnly,true,'read-only CTE should retain bounded read timeout');
  assert.equal(classifySql('WITH c AS (SELECT 1) UPDATE target SET value=1').isReadOnly,false,'data-changing CTE must not be classified as a read');
  assert.equal(classifySql('WITH c AS (SELECT 1) DELETE FROM target').isReadOnly,false,'CTE DELETE must not be classified as a read');
  assert.equal(classifySql('CREATE TABLE x(id INT)').isDdl,true,'DDL must be detected');
  const priorRole=process.env.SBC_RUNTIME_ROLE;process.env.SBC_RUNTIME_ROLE='readonly';let acquired=0;
  const ddlGuard=wrapPool({getConnection:async()=>{acquired++;return {query:async()=>{throw new Error('DDL reached database')},execute:async()=>{throw new Error('DDL reached database')},release(){},destroy(){}}}});
  await assert.rejects(ddlGuard.query('CREATE TABLE should_not_run(id INT)'),e=>e.code==='SBC_PREVIEW_DDL_BLOCKED');
  assert.equal(acquired,0,'Preview DDL must be rejected before opening a DB connection');
  if(priorRole===undefined)delete process.env.SBC_RUNTIME_ROLE;else process.env.SBC_RUNTIME_ROLE=priorRole;
  console.log('V65.1.23/V65.1.26 query guard tests: PASS (bounded reads, CTE DML classification, Preview DDL blocked)');
 })().catch(e=>{console.error(e);process.exitCode=1});
}
