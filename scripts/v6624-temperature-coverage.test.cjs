'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createController}=require('../enterprise/v56135-kim-mission-controller.js');
function run(customers,tenantId=1){
  const logs=[];
  const db={customers,orders:[]};
  const controller=createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},logger:{info:(...args)=>logs.push(args)}});
  return controller.cycle({tenantId,advisoryOnly:true}).then(out=>({out,logs}));
}
test('restart snapshot distinguishes absent lead-temperature input from zero leads',async()=>{
  const customers=Array.from({length:813},(_,i)=>({id:`private-lead-${i}`,tenantId:1,status:'Lead',verificationStatus:'Needs Verification'}));
  const {out,logs}=await run(customers);
  assert.equal(out.tenantCustomers,813);
  assert.equal(out.tenantWarmHot,0);
  assert.deepEqual(out.temperatureCoverage,{withTemperature:0,withoutTemperature:813,state:'NONE_IN_SNAPSHOT'});
  assert.equal(out.prospects,0);
  assert.equal(out.externalActions,0);
  assert.equal(out.writeAttempts,0);
  const report=JSON.stringify(logs);
  assert.match(report,/NONE_IN_SNAPSHOT/);
  assert(!report.includes('private-lead-'));
});
test('hydrated warmth is measured without authorizing unverified outreach',async()=>{
  const {out}=await run([
    {tenantId:1,leadTemperature:'Warm',status:'Lead',verificationStatus:'Needs Verification'},
    {tenantId:1,leadTemperature:'HOT',status:'Lead',verificationStatus:'Needs Verification'},
    {tenantId:1,leadTemperature:'Cold',status:'Lead',verificationStatus:'Needs Verification'},
    {tenantId:1,status:'Lead',verificationStatus:'Needs Verification'},
    {tenantId:2,leadTemperature:'Hot',status:'Lead',verificationStatus:'Sales Ready'}
  ]);
  assert.deepEqual(out.temperatureCoverage,{withTemperature:3,withoutTemperature:1,state:'PARTIAL_IN_SNAPSHOT'});
  assert.equal(out.tenantCustomers,4);
  assert.equal(out.tenantWarmHot,2);
  assert.equal(out.qualificationReasons.warmHotNeedsVerification,2);
  assert.equal(out.qualifiedWarmHot,0);
  assert.equal(out.prospects,0);
});
test('all classified and empty tenant datasets have distinct coverage states',async()=>{
  const full=(await run([{tenantId:1,leadTemperature:'cold',status:'Lead'}])).out;
  assert.deepEqual(full.temperatureCoverage,{withTemperature:1,withoutTemperature:0,state:'ALL_IN_SNAPSHOT'});
  assert.equal(full.tenantWarmHot,0);
  const empty=(await run([{tenantId:2,leadTemperature:'Hot',verificationStatus:'Sales Ready'}])).out;
  assert.deepEqual(empty.temperatureCoverage,{withTemperature:0,withoutTemperature:0,state:'NO_RECORDS'});
  assert.equal(empty.tenantCustomers,0);
});
