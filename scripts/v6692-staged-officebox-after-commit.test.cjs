'use strict';
/* Offline only: test a candidate patch against genuine compiled V66 server.js.
 * No network, no real Square payment and NO runtime patch registration.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {patchServer,MARKER}=require('../hotfix-assets/staged-v6692-officebox-after-commit.cjs');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const original=fs.readFileSync(path.join(root,'server.js'),'utf8');
const patched=patchServer(original);
assert(patched.includes(MARKER));
assert.throws(()=>patchServer(patched),/previously patched/,'a patch may not run twice');
assert.throws(()=>patchServer(original.replace('try{const handoff=await sendBig3OfficeBoxHandoff(order','try{const handoff=await sendUnknownOfficeBoxHandoff(order')),/expected exactly one legacy paid handoff/);
const start=patched.indexOf("async function handleSquarePaymentEvent(event,baseOverride=''){");
const end=patched.indexOf('\nconst PAYMENT_LINKS =',start);
const handler=patched.slice(start,end);
assert(start>=0&&end>start);
assert(handler.indexOf('const sbcOfficeBoxCommit=await saveData()')<handler.indexOf("try{const handoff=await sendBig3OfficeBoxHandoff"),
 'actual compiled handler must commit before invoking legacy Office Box side effect');
const P=require(path.join(root,'enterprise/v6659-square-webhook-proof.cjs'));
const payment={id:'square_payment_999',order_id:'square_order_999',location_id:'sq_location_999',
 status:'COMPLETED',amount_money:{amount:34900,currency:'USD'}};
function fixture({failSave=false,saveReceipt='verified',readonly=false,recovery=false,lease=true,pool=true}={}){
 const order={id:'sbc_order_999',customerId:'cust_999',tenantId:7,price:349,paymentStatus:'PENDING',
  status:'Pending',notes:JSON.stringify({squareOrderId:'square_order_999',squarePaymentStatus:'PENDING'})};
 const record={id:'rec_999',sbcOrderId:order.id,squareOrderId:'square_order_999',squarePaymentId:'',status:'PENDING'};
 const db={orders:[order],squarePayments:[record],customers:[],tasks:[]};
 const events=[];
 const now=()=>new Date().toISOString();
 const orderParsed=x=>{try{return JSON.parse(x.notes||'{}')}catch{return {}}};
 const updateOrderParsed=(x,p)=>{x.notes=JSON.stringify({...orderParsed(x),...p});x.updatedAt=now()};
 const ctx={
  db,now,id:()=> 'fixture_only_id',String,Number,Object,Date,Math,
  process:{env:{SQUARE_LOCATION_ID:'sq_location_999',SBC_PUBLIC_URL:'https://invalid.example.test'}},
  squarePaymentRecords:()=>db.squarePayments,squareMoneyCents:n=>Math.round(n*100),orderParsed,updateOrderParsed,
  SBC_V6659_SQUARE_PROOF:P,
  SBC_RUNTIME_READ_ONLY:readonly,MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:recovery,
  sbcWriterLeaseReady:lease,sbcWriterLeaseConn:lease?{}:null,mysqlPool:pool?{}:null,
  saveData:async()=>{
   events.push('save');
   if(failSave)throw Error('MYSQL_RELATIONAL_COMMIT_FAILED');
   if(saveReceipt==='verified')return {source:'COMMITTED_MYSQL',commitVerified:true};
   if(saveReceipt==='undefined')return undefined;
   if(saveReceipt==='skipped')return {skipped:true};
   if(saveReceipt==='forged')return {source:'BROWSER',commitVerified:true};
   if(saveReceipt==='flag_only')return {committed:true};
   if(saveReceipt==='unverified')return {source:'COMMITTED_MYSQL',commitVerified:false};
   throw Error('UNKNOWN_FIXTURE_RECEIPT');
  },
  addActivity:()=>{},
  REVENUE_AUTOPILOT_V56150:{recordFunnelEvent:async()=>{}},
  SBC_COMMERCIAL:{provisionTenant:async()=>{throw Error('no commercial provider in fixture')}},
  V569_PRODUCTION_EXPANSION:{provisionStorefront:()=>{throw Error('no storefront provider in fixture')}},
  ensureCommissionForSale:()=>{},GOD_KIM:{orchestrate:async()=>{events.push('kim')}},
  createFulfillmentJobsForOrder:async()=>[],processReadyFulfillmentJobs:async()=>{},
  vendorCapabilities:()=>({}),audit:()=>{},CATALOG:{},
  sendBig3OfficeBoxHandoff:async()=>{events.push('handoff');return {ok:true,skipped:true}},
  sendOrderIntake:async()=>({sent:false}),
  TENANT_DEFAULT_ID:7,ensureProjectForCustomer:()=>{throw Error('no customer provisioning')},
  V566_RAILS:{subscriptionRecovery:()=>({eligible:false})},V562NEXT:{billingFriction:()=>null},
 };
 vm.runInNewContext(handler+'\nthis.runSquareCapture=handleSquarePaymentEvent;',ctx,{timeout:3000});
 return {order,events,db,run:p=>ctx.runSquareCapture({type:'payment.updated',event_id:'fixture-only',data:{object:{payment:p}}})};
}
(async()=>{
 const f=fixture(),res=await f.run(payment);
 assert.equal(res.status,'PAID');
 assert.deepEqual(f.events.filter(x=>x==='save'||x==='handoff'),['save','handoff','save']);
 const priorHandoffs=f.events.filter(x=>x==='handoff').length;
 const dup=await f.run(payment);
 assert.equal(dup.duplicate,true);
 assert.equal(f.events.filter(x=>x==='handoff').length,priorHandoffs,'replayed provider callback must not send again');
 const fail=fixture({failSave:true});
 await assert.rejects(()=>fail.run(payment),/MYSQL_RELATIONAL_COMMIT_FAILED/);
 assert.equal(fail.events.includes('handoff'),false,'cannot send on failed MySQL commit');
 for(const options of [{readonly:true},{recovery:true},{lease:false},{pool:false},
  {saveReceipt:'undefined'},{saveReceipt:'skipped'},{saveReceipt:'forged'},
  {saveReceipt:'flag_only'},{saveReceipt:'unverified'}]){
  const state=fixture(options);
  await state.run(payment);
  assert.equal(state.events.includes('handoff'),false,'missing live authority or save must stop external call: '+JSON.stringify(options));
 }
 for(const changes of [{location_id:'other'},{amount_money:{amount:1,currency:'USD'}},{status:'FAILED'}]){
  const state=fixture();
  await state.run({...payment,...changes});
  assert.equal(state.events.includes('handoff'),false,'invalid/pending provider state cannot send');
 }
 console.log('[SBC V6692 STAGED POST-COMMIT] PASS actual compiled server: explicit MySQL commit proof, failed/undefined/skipped/forged save refusal, duplicate and writer gates; NOT production wired');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
