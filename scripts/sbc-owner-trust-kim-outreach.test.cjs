'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createController}=require('../enterprise/v56135-kim-mission-controller.js');
test('owner-trusted research is eligible for advisory sales queue but cannot trigger autonomous missions or external actions',async()=>{
 const previous=process.env.SBC_KIM_MISSION_AUTONOMOUS_OUTBOUND;
 process.env.SBC_KIM_MISSION_AUTONOMOUS_OUTBOUND='true';
 try{
  const lead={id:'trusted-one',tenantId:1,status:'Lead',leadTemperature:'Hot',
    businessName:'Trusted Research',phone:'3055557777',verificationStatus:'Sales Ready',
    leadIntelligence:{ownerTrust:{basis:'LORNA_RESEARCH_SUBMISSION',outboundConsentGranted:false}}};
  const db={customers:[lead],orders:[]};
  let calls=0,writes=0;
  const controller=createController({db,getCanonicalDb:()=>db,
   saveData:async()=>{writes++},tenBrain:{BRAINS:[],evaluate:async()=>{calls++;throw Error('Autonomous call was attempted')}}});
  const readOnly=await controller.cycle({tenantId:1,advisoryOnly:true});
  assert.equal(readOnly.qualifiedWarmHot,1);
  const result=await controller.cycle({tenantId:1,limit:10});
  assert.equal(result.ok,true);
  assert.equal(calls,0,'no autonomous ten-brain execution for owner-trusted research');
  assert.equal(result.missions,0,'human sales queue must not be misreported as autonomous missions');
  assert.equal(result.humanSalesReview,1);
 }finally{
  if(previous===undefined)delete process.env.SBC_KIM_MISSION_AUTONOMOUS_OUTBOUND;
  else process.env.SBC_KIM_MISSION_AUTONOMOUS_OUTBOUND=previous;
 }
});
