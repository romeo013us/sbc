'use strict';
/* Unit tests are synthetic only: no production DB, secrets, changes or workers. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const handoff=require('../enterprise/v6681-safe-writer-handoff.cjs');
const stage=require('./v6681-stage-safe-writer-handoff.cjs');
const original=read('server.js'),patched=stage.patchSource(original);
assert.equal(stage.patchSource(patched),patched,'stage must be idempotent');
new vm.Script(patched,{filename:'staged-server.js'});
assert.ok(original.includes('SBC_V6528_RUNTIME_WRITER_LEASE'),'existing lease protection required');
assert.match(patched,/SBC_V6681_SAFE_WRITER_HANDOFF/);
assert.match(patched,/waitForWriterLease\(leaseCandidate,SBC_RUNTIME_WRITER_LOCK_NAME/);
assert.match(patched,/shouldAbort:\(\)=>sbcShutdownStarted/);
assert.match(patched,/MYSQL_RECOVERY_EVALUATED && !MYSQL_RECOVERY_REQUIRED && \(SBC_RUNTIME_READ_ONLY \|\| sbcWriterLeaseReady\)/);
assert.match(patched,/await RUNTIME_GATE.ensureSchema/,'original recovery/schema guard must remain');
assert.match(patched,/VERIFIED_PRE_CORRUPTION_CRM_COUNT/,'minimum CRM census must remain');
assert.match(patched,/SELECT GET_LOCK\(\?, 0\) AS acquired/,'original MySQL named lock remains');
assert.doesNotMatch(read('enterprise/v6681-safe-writer-handoff.cjs'),/RELEASE_LOCK|KILL QUERY|DROP TABLE|UPDATE sbc_customers|DELETE FROM/i,'must not unlock a foreign owner or mutate data');
assert.match(original,/const ready=!fatalRuntimeFault && \(mysqlOk \|\| !configured\)/,'original readiness anchor remains pinned');
let clock=0,polls=0,waits=0;
const log=[],operations=[];
const connection={
 async query(sql,args){
  operations.push([sql,args]);
  polls++;
  return [[{acquired:polls<=2?0:1,connectionId:9812}]];
 }
};
(async()=>{
 const rows=await handoff.waitForWriterLease(connection,'sbc:runtime:writer:v1',{
  now:()=>clock,
  sleep:async(ms)=>{assert.equal(ms,5000);clock+=ms;waits++},
  logger:{warn:(message)=>log.push(message)}
 });
 assert.equal(rows[0].connectionId,9812);
 assert.equal(polls,3);
 assert.equal(waits,2);
 assert.ok(log.some(s=>s.includes('existing process still owns')));
 assert.ok(log.some(s=>s.includes('authoritative MySQL recovery is still required')));
 assert.ok(operations.every(([sql,args])=>sql===handoff.SQL&&args[0]==='sbc:runtime:writer:v1'),'may only acquire original named lock');
 let aborted=false,tries=0;
 await assert.rejects(handoff.waitForWriterLease({async query(){tries++;return [[{acquired:0,connectionId:123}]]}},
 'sbc:runtime:writer:v1',{
  sleep:async()=>{aborted=true},
  shouldAbort:()=>aborted,
  logger:{warn(){}}
 }),e=>e.code==='SBC_WRITER_HANDOFF_CANCELLED');
 assert.equal(tries,1,'must stop polling on shutdown');
 await assert.rejects(handoff.waitForWriterLease({async query(){return [[{acquired:null,connectionId:null}]]}},
  'sbc:runtime:writer:v1',{logger:{warn(){}}}),e=>e.code==='SBC_WRITER_HANDOFF_LOCK_RESULT_UNKNOWN');
 await assert.rejects(handoff.waitForWriterLease({async query(){return [[{acquired:1}]]}},
  'sbc:runtime:writer:v1',{logger:{warn(){}}}),e=>e.code==='SBC_WRITER_HANDOFF_SESSION_UNVERIFIED');
 await assert.rejects(handoff.waitForWriterLease({async query(){throw Error('PROTOCOL_CONNECTION_LOST')}},
  'sbc:runtime:writer:v1',{logger:{warn(){}}}),/PROTOCOL_CONNECTION_LOST/);
 // The writer-independent health check may report "alive", but never
 // claim productionReady while the lock or recovery evaluation is absent.
 const readyBlock=patched.slice(patched.indexOf("app.get('/readyz',"),patched.indexOf("app.get('/api/system/hardening/status'"));
 const healthBlock=patched.slice(patched.indexOf("app.get('/api/health',"),patched.indexOf("const {SBCUnattendedNotifications}"));
 assert.ok(readyBlock.includes('const operational='), 'GET /readyz must be operational, not only MySQL reachable');
 async function healthCase({role='writer',lease=false,evaluated=true,recovery=false,reachable=true}){
  let readyFn,healthFn;
  const context={
   app:{get(url,fn){if(url==='/readyz')readyFn=fn;else if(url==='/api/health')healthFn=fn;else throw Error(url)}},
   mysqlPool:reachable?{async query(){return [[]]}}:null,
   process:{env:{DB_HOST:'localhost',DB_USER:'ci',DB_NAME:'ci'}},
   fatalRuntimeFault:false,
   SBC_RUNTIME_READ_ONLY:role==='readonly',
   sbcWriterLeaseReady:lease,
   MYSQL_RECOVERY_EVALUATED:evaluated,
   MYSQL_RECOVERY_REQUIRED:recovery,
   BUILD_VERSION:'66.0.0',storageMode:'mysql-relational'
  };
  vm.runInNewContext(readyBlock,context);
  vm.runInNewContext(healthBlock,context);
  function response(){return {code:200,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this}}}
  const ready=response(),health=response();
  await readyFn({requestId:'fixture'},ready);
  await healthFn({},health);
  return {ready,health};
 }
 const held=await healthCase({role:'writer',lease:false});
 assert.equal(held.ready.code,503,'healthy MySQL is not proof of writer readiness');
 assert.equal(held.ready.body.writePrerequisitesReported,false);
 assert.equal(held.health.body.productionReady,false);
 const ongoing=await healthCase({role:'writer',lease:true,evaluated:false});
 assert.equal(ongoing.ready.code,503,'lease alone cannot bypass recovery census');
 const recovery=await healthCase({role:'writer',lease:true,recovery:true});
 assert.equal(recovery.ready.code,503,'data recovery guard remains authoritative');
 const successful=await healthCase({role:'writer',lease:true,evaluated:true});
 assert.equal(successful.ready.code,200,'only fully verified writer may be ready');
 assert.equal(successful.health.body.productionReady,true);
 const preview=await healthCase({role:'readonly',lease:false,evaluated:true});
 assert.equal(preview.ready.code,200,'existing verified Preview must not need writer lease');
 const unavailable=await healthCase({role:'writer',lease:true,reachable:false});
 assert.equal(unavailable.ready.code,503,'unreachable database is never ready');
 console.log('[SBC V66.81 HANDOFF] PASS: waiting owner lock, lawful release, fail-closed ambiguity/error/shutdown, recovery gate, durable readiness and unchanged Preview behavior.');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
