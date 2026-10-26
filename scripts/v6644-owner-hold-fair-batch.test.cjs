'use strict';
// Executed ONLY on compiled runtime: synthetic orders, no provider calls, no live DB.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const missionPath=path.join(root,'enterprise/v56135-kim-mission-controller.js');
const revenuePath=path.join(root,'enterprise/v56134-god-tier-revenue.js');
const missionCode=fs.readFileSync(missionPath,'utf8'),revenueCode=fs.readFileSync(revenuePath,'utf8');
for(const [name,code] of [[missionPath,missionCode],[revenuePath,revenueCode]]){
 assert.match(code,/SBC_V6644_FAIR_OWNER_HOLD_BATCH/);
 new vm.Script(code,{filename:name});
}
const {createController}=require(missionPath),G=require(revenuePath);
const fakeSquareReceipt=id=>({squareOrderId:'sq-'+id,squarePaymentId:'pay-'+id,squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-26T16:00:00Z'});
const holds=Array.from({length:27},(_,i)=>({
 id:'hold-'+i,tenantId:7,status:'Pending',paymentStatus:'Paid',price:10000,parsed:fakeSquareReceipt('hold-'+i),
 metadata:{ownerApprovalRequired:true}
}));
const safe=Array.from({length:3},(_,i)=>({
 id:'small-'+i,tenantId:7,status:'Pending',paymentStatus:'Paid',price:199,parsed:fakeSquareReceipt('small-'+i)
}));
const other=[
 {id:'other-tenant',tenantId:8,status:'Pending',paymentStatus:'Paid',price:199,parsed:fakeSquareReceipt('other-tenant')},
 {id:'unpaid-but-completed',tenantId:7,status:'Completed',paymentStatus:'Pending',price:199},
 {id:'refunded',tenantId:7,status:'Completed',paymentStatus:'REFUNDED',price:199},
 {id:'system-test',tenantId:7,status:'Pending',paymentStatus:'Paid',price:1,testMode:true},
 {id:'already-has-durable-job',tenantId:7,status:'Pending',paymentStatus:'Paid',price:199,parsed:fakeSquareReceipt('already-has-durable-job')}
];
async function testKim(){
 const orders=[...holds.map(x=>({...x})),...safe.map(x=>({...x})),...other.map(x=>({...x}))];
 const db={orders,customers:[],fulfillmentJobs:[{orderId:'already-has-durable-job',id:'job-1'}]};
 let calls=[],saves=0;
 const c=createController({
   db,getCanonicalDb:()=>db,saveData:async()=>{saves++},
   godKim:{orchestrate:async({order})=>{calls.push(order.id);return {stage:'FULFILLMENT'}}},
   tenBrain:{BRAINS:[],evaluate:async()=>({version:'test',action:'CONTINUE_CONVERSATION',nodes:[]})},
   logger:{warn:()=>{}}
 });
 const result=await c.reconcilePaidOrders(2,7);
 assert.deepEqual(calls,['small-0','small-1'],'eligible orders behind >20 owner holds must progress');
 assert.equal(result.heldForOwner,27,'all holds accounted for');
 assert.equal(result.dispatchCandidates,2);
 assert.equal(result.attempted,2);
 assert.equal(result.results.filter(x=>x.status==='OWNER_CLEARANCE_REQUIRED').length,2,'bounded owner-hold notices');
 assert.equal(saves,1,'only actual dispatch writes require persistence');
 assert.ok(orders.filter(x=>x.id.startsWith('hold-')).every(x=>!x.metadata.kimMissionFulfillmentStarted),
  'owner-held orders must not be marked started');
 const second=await c.reconcilePaidOrders(2,7);
 assert.deepEqual(calls,['small-0','small-1','small-2']);
 assert.equal(second.attempted,1);
 assert.equal(saves,2);
 const third=await c.reconcilePaidOrders(2,7);
 assert.equal(third.heldForOwner,27);
 assert.equal(third.attempted,0,'only held orders remain');
 assert.equal(saves,2,'held-only cycle must not write repeatedly to MySQL');
 assert.deepEqual(calls,['small-0','small-1','small-2'],'no redispatch of recorded orders');
 await assert.rejects(c.reconcilePaidOrders(2),/TENANT_CONTEXT_REQUIRED/);
}
async function testGodTier(){
 const orders=[...holds.map(x=>({...x})),...safe.map(x=>({...x}))];
 const db={orders,customers:[],fulfillmentJobs:[]};
 let calls=[];
 const godKim={orchestrate:async({order})=>{calls.push(order.id);return {ok:true,stage:'FULFILLMENT'}}};
 const r=await G.reconcilePaidOrders({db,godKim,limit:2});
 assert.deepEqual(calls,['small-0','small-1'],'God-Tier route must also avoid held-order starvation');
 assert.equal(r.heldForOwner,27);
 assert.equal(r.candidates,2);
 assert.equal(r.results.filter(x=>x.status==='OWNER_CLEARANCE_REQUIRED').length,2);
 assert.ok(orders.filter(x=>x.id.startsWith('hold-')).every(x=>!x.metadata.kimMissionFulfillmentStarted));
}
(async()=>{
 await testKim();
 await testGodTier();
 console.log('[SBC V6644] PASS: 27 owner holds cannot starve 3 paid orders; both controllers progress, no false writes or bypass');
})().catch(e=>{console.error('[SBC V6644]',e);process.exitCode=1});
