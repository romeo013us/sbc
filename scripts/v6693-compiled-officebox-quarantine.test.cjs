'use strict';
/** Exercises the newly installed compiled Square handler using synthetic events.
 * Real-payment APIs, customer email, GoDaddy and business database are NEVER used.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {patchServer,MARKER}=require('../hotfix-assets/apply-v6693-quarantine-legacy-officebox.js');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const compiled=fs.readFileSync(path.join(root,'server.js'),'utf8');
const patched=compiled.includes(MARKER)?compiled:patchServer(compiled);
assert(patched.includes(MARKER));
assert.throws(()=>patchServer(patched),/already installed/);
const start=patched.indexOf("async function handleSquarePaymentEvent(event,baseOverride=''){");
const end=patched.indexOf('\nconst PAYMENT_LINKS =',start);
assert(start>=0&&end>start,'actual compiled Square handler must be present');
const handler=patched.slice(start,end);
assert(handler.includes('sbcOfficeBoxExplicitPurchase'));
assert(handler.indexOf('sbcOfficeBoxExplicitPurchase')<handler.indexOf('sendBig3OfficeBoxHandoff('));
const P=require(path.join(root,'enterprise/v6659-square-webhook-proof.cjs'));
const payment={id:'square_payment_999',order_id:'square_order_999',location_id:'sq_location_999',
 status:'COMPLETED',amount_money:{amount:34900,currency:'USD'}};

function fixture({failSave=false,saveReceipt='verified',readonly=false,recovery=false,lease=true,pool=true,items=null,product='Website Starter',metaSku=''}={}){
 const order={id:'sbc_order_999',customerId:'cust_999',tenantId:7,price:349,paymentStatus:'PENDING',
  status:'Pending',product,notes:JSON.stringify({squareOrderId:'square_order_999',squarePaymentStatus:'PENDING',items,officeBoxSku:metaSku})};
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
 const scenarios=[
  {items:[{sku:'OFFICE_BOX_BUSINESS',quantity:1}]},
  {items:[{sku:'OFFICE_BOX_ENTERPRISE',quantity:1}]},
  {metaSku:'OFFICE_BOX_TEAM'},
  {product:'Office Box Starter'},
  {product:'Website',items:[{sku:'WEBSITE_STARTER',quantity:1}]},
 ];
 for(const [index,options] of scenarios.entries()){
  const f=fixture(options);
  const res=await f.run(payment);
  assert.equal(res.status,'PAID');
  assert.equal(f.order.paymentStatus,'Paid');
  assert.equal(f.events.filter(x=>x==='save').length,1,'payment is still saved exactly once');
  const calls=f.events.filter(x=>x==='handoff').length;
  assert.equal(calls,index===4?1:0,
   'explicit Office Box order cannot use legacy pre-commit handoff: '+JSON.stringify(options));
  const again=await f.run(payment);
  assert.equal(again.duplicate,true);
  assert.equal(f.events.filter(x=>x==='handoff').length,calls,'no duplicate handoff');
 }
 const rejected=fixture({items:[{sku:'OFFICE_BOX_BUSINESS',quantity:1}]});
 const mismatch=await rejected.run({...payment,location_id:'wrong_location'});
 assert.equal(mismatch.code,'SQUARE_LOCATION_MISMATCH');
 assert.equal(rejected.events.includes('handoff'),false);
 assert.equal(rejected.events.includes('save'),false);
 const badSave=fixture({failSave:true,items:[{sku:'OFFICE_BOX_BUSINESS',quantity:1}]});
 await assert.rejects(()=>badSave.run(payment),/MYSQL_RELATIONAL_COMMIT_FAILED/);
 assert.equal(badSave.events.includes('handoff'),false);
 console.log('[SBC V6693 COMPILED OFFICE BOX QUARANTINE] PASS: explicit plans skip legacy precommit send; ordinary SBC fulfillment/payment capture retained; malformed Square fails closed');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
