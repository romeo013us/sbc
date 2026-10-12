'use strict';
const assert=require('node:assert/strict');
const {wrapPool}=require('../enterprise/v56133-mysql-query-guard');
(async()=>{
 let destroyed=0, released=0, calls=0;
 const conn={query:async(sql)=>{calls++;if(sql==='SELECT SLOW')return new Promise(()=>{});return [[{ok:1}],[]]},execute:async(sql)=>{calls++;return [[{ok:1}],[]]},release(){released++},destroy(){destroyed++}};
 const pool={getConnection:async()=>conn}; const guarded=wrapPool(pool,{attempts:3});
 const fast=await guarded.query('SELECT 1'); assert.equal(fast[0][0].ok,1);
 const started=Date.now(); await assert.rejects(guarded.query('SELECT SLOW'),e=>e.code==='SBC_MYSQL_READ_QUERY_TIMEOUT'&&e.sbcNoRetry===true);
 assert(Date.now()-started<6000,'read query should be bounded'); assert(destroyed>=1,'timed out query connection must be destroyed');
 assert.equal(calls,2,'timed out query must not be retried');
 console.log('V65.1.23 read-query cancellation: PASS (read query bounded, leased connection destroyed, no retry)');
})().catch(e=>{console.error(e);process.exitCode=1});
