'use strict';
const assert=require('assert');
const {createCircuitBreaker}=require('../enterprise/sbc-god-tier-resilience-v600');
const {createSLORegistry}=require('../enterprise/sbc-god-tier-slo-v600');
const {createEventFabric}=require('../enterprise/sbc-god-tier-event-fabric-v600');
(async()=>{
  const cb=createCircuitBreaker({name:'test',threshold:3,resetMs:20});
  for(let i=0;i<3;i++){try{await cb.execute(async()=>{throw new Error('x')})}catch{}}
  assert.equal(cb.health().state,'OPEN');
  let blocked=false;try{await cb.execute(async()=>true)}catch(e){blocked=e.code==='CIRCUIT_OPEN'} assert(blocked);
  await new Promise(r=>setTimeout(r,25));
  assert.equal(await cb.execute(async()=>true),true); assert.equal(cb.health().state,'CLOSED');
  const sloFailureProbe=createSLORegistry(); sloFailureProbe.recordApi(200,100); sloFailureProbe.recordApi(500,1000); const failureSnap=sloFailureProbe.snapshot(); assert(failureSnap.checks.api_success.value<1); assert(failureSnap.checks.api_p95.value>=0);
  const slo=createSLORegistry(); slo.recordApi(200,100); slo.recordApi(200,110); slo.recordEvent(true); slo.recordDependency(true); const snap=slo.snapshot(); assert(snap.pass===true); assert(snap.checks.api_success.pass===true);
  const rows=[];
  const fake={query:async(sql,args)=>{rows.push({sql,args});if(/^INSERT INTO sbc_god_events/.test(sql))return [{affectedRows:1}];return [[]];}};
  const fabric=createEventFabric({getPool:()=>fake});
  const pub=await fabric.publish('test.event',{tenantId:1,aggregateType:'test',aggregateId:'1',payload:{ok:true},idempotencyKey:'test-1'});assert(pub.ok&&pub.eventId);assert(rows.length>=1);
  console.log(JSON.stringify({ok:true,tests:['circuit-open-reset','slo-recording','event-publish','slo-failure-detection','slo-healthy-state'],metrics:fabric.metrics,slo:snap,failureDetection:{apiSuccessFailureObserved:failureSnap.checks.api_success.value<1}},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
