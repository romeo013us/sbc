'use strict';
// Synthetic integration tests of the *compiled* AI mission controller.
// No live customer records, credentials, third-party calls, or MySQL writes.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const missionFile=path.join(root,'enterprise/v56135-kim-mission-controller.js');
const source=fs.readFileSync(missionFile,'utf8');
assert.match(source,/SBC_V6642_KIM_MISSION_FINANCIAL_GOVERNANCE/);
new vm.Script(source,{filename:'v56135-kim-mission-controller.js'});
const {createController}=require(missionFile);
(async()=>{
 const orders=[
  {id:'fake-fulfillment',tenantId:7,status:'Completed',paymentStatus:'Pending',price:999},
  {id:'wrong-tenant',tenantId:8,status:'Pending',paymentStatus:'Paid',price:55,parsed:{squareOrderId:'sq-wrong-tenant',squarePaymentId:'pay-wrong-tenant',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-10-26T16:00:00Z'}},
  {id:'system-test',tenantId:7,status:'Pending',paymentStatus:'Paid',price:1,testMode:true},
  {id:'sbc-test',tenantId:7,status:'Pending',paymentStatus:'Paid',price:1,sbcTest:true},
  {id:'refunded',tenantId:7,status:'Completed',paymentStatus:'REFUNDED',price:99},
  {id:'already-fulfilled',tenantId:7,status:'Pending',paymentStatus:'Paid',price:199,parsed:{squareOrderId:'sq-already-fulfilled',squarePaymentId:'pay-already-fulfilled',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-10-26T16:00:00Z'}},
  {id:'needs-owner-clearance',tenantId:7,status:'Pending',paymentStatus:'Paid',price:10000,parsed:{squareOrderId:'sq-needs-owner-clearance',squarePaymentId:'pay-needs-owner-clearance',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-10-26T16:00:00Z'}},
  {id:'valid-paid',tenantId:7,status:'Pending',paymentStatus:'Paid',price:349,parsed:{squareOrderId:'sq-valid-paid',squarePaymentId:'pay-valid-paid',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-10-26T16:00:00Z'}},
  {id:'done-status-only',tenantId:7,status:'Fulfilled',paymentStatus:'Pending',price:500}
 ];
 const customers=[{id:'prospect-1',tenantId:7,businessName:'Example',status:'lead'}];
 const db={customers,orders,fulfillmentJobs:[{id:'existing-job',orderId:'already-fulfilled',tenantId:7}]};
 let calls=[],saves=0;
 const controller=createController({
  db,getCanonicalDb:()=>db,saveData:async()=>{saves++},
  godKim:{orchestrate:async({order})=>{calls.push(order.id);return {stage:'FULFILLMENT'}}},
  tenBrain:{BRAINS:['PROSPECT_BRAIN'],evaluate:async()=>({version:'test',action:'CONTINUE_CONVERSATION',nodes:[]})},
  logger:{warn:()=>{}}
 });
 const overview=controller.overview(7);
 assert.throws(()=>controller.overview(),/TENANT_CONTEXT_REQUIRED/,'tenantless overview must fail closed');
 assert.equal(overview.missions.length,0);
 assert.equal(overview.metrics.paidOrders,3,'no cross-tenant paid revenue exposed');
 assert.equal(overview.metrics.recognizedRevenue,10548,'Kim revenue includes only confirmed payments from tenant 7');
 const first=await controller.reconcilePaidOrders(20,7);
 assert.equal(first.processed,2,'only owner hold and legitimate single paid order should be considered');
 assert.equal(first.results.find(x=>x.orderId==='needs-owner-clearance').status,'OWNER_CLEARANCE_REQUIRED');
 assert.deepEqual(calls,['valid-paid'],'no tenant leaks, false revenue, duplicate jobs, or system tests');
 assert.equal(orders.find(o=>o.id==='fake-fulfillment').metadata,undefined,'unpaid order must remain untouched');
 assert.equal(orders.find(o=>o.id==='valid-paid').metadata.kimMissionFulfillmentStarted,'true');
 assert.equal(saves,1);
 const second=await controller.reconcilePaidOrders(20,7);
 assert.equal(second.results.filter(x=>x.status==='FULFILLMENT_ORCHESTRATED').length,0,'no re-dispatch after recorded fulfillment');
 assert.deepEqual(calls,['valid-paid']);
 await assert.rejects(controller.reconcilePaidOrders(),/TENANT_CONTEXT_REQUIRED/,'tenantless autonomous reconcile is forbidden');
 const broken=createController({
  db,getCanonicalDb:()=>db,saveData:async()=>{throw Error('SYNTHETIC_MYSQL_DOWN')},
  godKim:{orchestrate:async()=>{throw Error('unexpected')}},
  tenBrain:{BRAINS:['PROSPECT_BRAIN'],evaluate:async()=>({version:'test',action:'CONTINUE_CONVERSATION',nodes:[]})},
  logger:{warn:()=>{}}
 });
 await assert.rejects(broken.runMission(customers[0]),/SYNTHETIC_MYSQL_DOWN/,'save failure must never be reported as success');
 console.log('[SBC V6642] PASS: Kim excludes unpaid/test/other-tenant and duplicate jobs, holds >$10K, fails on MySQL outage');
})().catch(e=>{console.error('[SBC V6642]',e);process.exitCode=1});
