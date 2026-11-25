'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSLORegistry}=require('../enterprise/sbc-god-tier-slo-v600');
test('no telemetry is not a passing SLO',()=>{
 const s=createSLORegistry().snapshot();
 assert.equal(s.pass,false);assert.equal(s.checks.api_success.value,null);
 assert.equal(s.checks.api_p95.status,'INSUFFICIENT_EVIDENCE');
});
test('rolling metrics expire even when traffic stops',()=>{
 let time=Date.UTC(2026,10,25);const r=createSLORegistry({clock:()=>time});
 r.recordApi(200,100);r.recordEvent(true);r.recordDependency(true);
 assert.equal(r.snapshot().pass,true);
 time+=86400000;const s=r.snapshot();
 assert.deepEqual(s.sampleCounts,{api:0,events:0,dependencies:0});
 assert.equal(s.pass,false);
});
test('nearest rank p95 correctly fails on the slowest of two samples',()=>{
 const r=createSLORegistry();r.recordApi(200,100);r.recordApi(200,1000);
 assert.equal(r.snapshot().checks.api_p95.pass,false);
 assert.equal(r.snapshot().checks.api_p95.value,1000);
});
test('one million requests use bounded state and preserve exact error counts',()=>{
 let time=Date.UTC(2026,10,25);const r=createSLORegistry({clock:()=>time});
 for(let i=0;i<1000000;i++){r.recordApi(i%100===0?503:200,i%20===0?400:100);time+=50;}
 const s=r.snapshot();assert.equal(s.sampleCounts.api,1000000);
 assert.equal(s.checks.api_success.value,.99);
 assert.equal(s.checks.api_p95.pass,true);
 assert(s.storage.activeBuckets<=1440);
 assert.equal(s.storage.retainedRequestObjects,0);
});
test('invalid inputs do not manufacture healthy evidence',()=>{
 const r=createSLORegistry();
 for(const pair of [[200,-1],[200,NaN],[0,10],[200,Infinity]])assert.equal(r.recordApi(...pair),false);
 assert.equal(r.recordEvent('true'),false);assert.equal(r.recordDependency(1),false);
 assert.deepEqual(r.snapshot().sampleCounts,{api:0,events:0,dependencies:0});
});
