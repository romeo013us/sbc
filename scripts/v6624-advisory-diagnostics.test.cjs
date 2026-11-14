'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createController}=require('../enterprise/v56135-kim-mission-controller.js');

function customer(id,tenantId,leadTemperature,verificationStatus,extras={}){
 return {id,tenantId,leadTemperature,verificationStatus,status:'Lead',...extras};
}
test('advisory explains warm/hot qualification gaps without auto-promoting anyone or leaking records',async()=>{
 const db={orders:[],customers:[
  customer('unverified-sensitive-name',1,'Warm','Needs Verification'),
  customer('sales-ready',1,'Hot','Sales Ready'),
  customer('dnc',1,'Warm','Sales Ready',{doNotContact:true}),
  customer('already-customer',1,'Hot','Sales Ready',{status:'active'}),
  customer('cold',1,'Cold','Needs Verification'),
  customer('another-tenant',2,'Hot','Sales Ready'),
  customer('unresolved',null,'Warm','Sales Ready')
 ]};
 const info=[];const logger={info:(...args)=>info.push(args),warn:()=>{},error:()=>{}};
 const service=createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},logger});
 const out=await service.cycle({tenantId:1,limit:20,advisoryOnly:true});
 assert.equal(out.tenantCustomers,5);
 assert.equal(out.tenantWarmHot,4);
 assert.equal(out.qualifiedWarmHot,1);
 assert.equal(out.prospects,1);
 assert.equal(out.unresolvedTenantRecords,1);
 assert.deepEqual(out.qualificationReasons,{
   warmHotTotal:4,warmHotQualified:1,warmHotNeedsVerification:1,
   warmHotSuppressed:1,warmHotExistingCustomer:1,warmHotOther:0
 });
 assert.equal(out.externalActions,0);
 assert.equal(out.writeAttempts,0);
 const diagnostic=info.find(row=>String(row[0]).includes('eligibility reasons'));
 assert(diagnostic,'safe aggregate eligibility explanation should be logged for the operator');
 const dump=JSON.stringify(diagnostic);
 assert(!dump.includes('unverified-sensitive-name'));
 assert(!dump.includes('another-tenant'));
 assert(!dump.includes('sales-ready'));
});

test('no verified warm/hot customers emits counts but never claims all leads are qualified',async()=>{
 const db={orders:[],customers:[customer('lead1',1,'Hot','Owner Review'),customer('lead2',1,'Warm','Needs Verification')]};
 const out=await createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},logger:{info(){}}}).cycle({tenantId:1,advisoryOnly:true});
 assert.equal(out.qualifiedWarmHot,0);
 assert.equal(out.qualificationReasons.warmHotNeedsVerification,2);
 assert.equal(out.qualificationReasons.warmHotQualified,0);
});
