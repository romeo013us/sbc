'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {inspect}=require('../enterprise/v6625-lead-readiness-audit.cjs');
test('owner lead-readiness displays missing lead-temperature coverage without treating records as deleted',()=>{
 const customers=Array.from({length:813},(_,i)=>({id:'private-'+i,tenantId:1,status:'Lead',email:'',phone:''}));
 const result=inspect(customers,1,{limit:0});
 assert.equal(result.totalTenantRecords,813);
 assert.equal(result.activeWarmHot,0);
 assert.equal(result.temperaturePresent,0);
 assert.equal(result.temperatureMissing,813);
 assert.equal(result.temperatureCoverageState,'NONE_IN_SNAPSHOT');
 assert.equal(result.readOnly,true);
 assert.equal(result.manualCallLeadIds.length,0);
});
test('owner lead-readiness distinguishes partial temperature fields and preserves strict tenant scope',()=>{
 const out=inspect([
  {id:'warm',tenantId:1,leadTemperature:'Warm',verificationStatus:'Needs Verification',status:'Lead',phone:'3055551212'},
  {id:'cold',tenantId:1,leadTemperature:'Cold',status:'Lead'},
  {id:'missing',tenantId:1,status:'Lead'},
  {id:'other-tenant',tenantId:2,leadTemperature:'Hot',status:'Lead',verificationStatus:'Sales Ready',phone:'3055559090'}
 ],1);
 assert.equal(out.totalTenantRecords,3);
 assert.equal(out.temperaturePresent,2);
 assert.equal(out.temperatureMissing,1);
 assert.equal(out.temperatureCoverageState,'PARTIAL_IN_SNAPSHOT');
 assert.equal(out.activeWarmHot,1);
 assert.equal(out.needsRecordVerification,1);
 assert.equal(out.verifiedHumanCallReady,0);
 assert.deepEqual(out.manualCallLeadIds,[]);
 const all=inspect([{tenantId:1,leadTemperature:'Cold',status:'Lead'}],1);
 assert.equal(all.temperatureCoverageState,'ALL_IN_SNAPSHOT');
 const empty=inspect([{tenantId:2,leadTemperature:'Hot'}],1);
 assert.equal(empty.temperatureCoverageState,'NO_RECORDS');
});
test('owner Launch Readiness surfaces coverage in both published browser assets',()=>{
 const root=path.resolve(__dirname,'..');
 const publicCode=fs.readFileSync(path.join(root,'public/sbc-launch-readiness-v6621.js'),'utf8');
 const mirror=fs.readFileSync(path.join(root,'browser_public/sbc-launch-readiness-v6621.js'),'utf8');
 assert.equal(publicCode,mirror);
 assert.match(publicCode,/temperatureCoverageState/);
 assert.match(publicCode,/Temperature assigned/);
 assert.match(publicCode,/not evidence of deleted leads/);
 assert.match(publicCode,/Verification alone is not calling\/SMS consent/);
});
