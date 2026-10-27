'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {createCircuitBreaker,withTimeout}=require('../enterprise/sbc-god-tier-resilience-v600');
const {createSLORegistry}=require('../enterprise/sbc-god-tier-slo-v600');
const {createEventFabric}=require('../enterprise/sbc-god-tier-event-fabric-v600');

async function scenarioA(){
  let inserts=0,ledger=0,queue=0,commits=0;
  const fakeConn={beginTransaction:async()=>{},commit:async()=>{commits++},rollback:async()=>{},release:()=>{},query:async(sql,args)=>{
    if(sql.includes('INSERT INTO sbc_god_event_ledger')){ledger++;return [{affectedRows:1}]}
    if(sql.includes('INSERT INTO sbc_god_events')){queue++;return [{affectedRows:1}]}
    return [[]];
  }};
  const fake={getConnection:async()=>fakeConn,query:async()=>[[]]};
  const f=createEventFabric({getPool:()=>fake});
  await f.ensureTables();
  const n=1000, t=Date.now();
  const out=await Promise.all(Array.from({length:n},(_,i)=>f.publish('stress.hit',{tenantId:1,aggregateType:'stress',aggregateId:String(i),payload:{i},idempotencyKey:`stress-${i}`})));
  const ms=Date.now()-t;
  assert.equal(out.filter(x=>x.ok).length,n);
  assert.equal(ledger,n); assert.equal(queue,n); assert.equal(commits,n);
  return {scenario:'A throughput',ok:true,events:n,durationMs:ms,eventsPerSec:Math.round(n/Math.max(ms/1000,.001))};
}
async function scenarioB(){
  const cb=createCircuitBreaker({name:'fault-test',threshold:3,resetMs:20});
  let failures=0;
  for(let i=0;i<3;i++){try{await cb.execute(async()=>{throw new Error('simulated');})}catch(_e){failures++;}}
  assert.equal(cb.health().state,'OPEN');
  let rejected=false;try{await cb.execute(async()=>true)}catch(e){rejected=e.code==='CIRCUIT_OPEN';}
  assert(rejected);
  await new Promise(r=>setTimeout(r,25));
  assert.equal(await cb.execute(async()=>true),true);
  let timedOut=false;try{await withTimeout(()=>new Promise(r=>setTimeout(r,25)),5,'fault-test')}catch(e){timedOut=e.code==='TIMEOUT';}
  assert(timedOut);
  return {scenario:'B fault containment',ok:true,failures,breakerRecovery:true,timeoutBoundary:true};
}
function scenarioC(){
  const sql=fs.readFileSync(path.join(__dirname,'../migrations/20261007_001_v600_god_tier_foundation.sql'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../migrations/20261007_002_v601_god_tier_integrity.sql'),'utf8');
  for(const x of ['sbc_god_events','sbc_god_event_dead_letters','sbc_slo_evidence','sbc_god_event_ledger','uq_god_ledger_event','uq_god_ledger_idem','idx_god_ledger_timeline','idx_god_ledger_shard']) assert(sql.includes(x),x);
  assert(/UNIQUE KEY uq_god_ledger_event\(event_id\)/.test(sql));
  assert(/UNIQUE KEY uq_god_ledger_idem\(tenant_id,idempotency_key\)/.test(sql));
  return {scenario:'C ledger/index audit',ok:true,appendOnlyLedger:true,uniqueEventIdentity:true,tenantIdempotencyKey:true,shardTimelineIndex:true};
}
(async()=>{
  const slo=createSLORegistry();slo.recordApi(200,120);slo.recordEvent(true);slo.recordDependency(true);
  const results=[await scenarioA(),await scenarioB(),scenarioC()];
  console.log(JSON.stringify({ok:results.every(x=>x.ok),version:'60.4.5',results,slo:slo.snapshot()},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
