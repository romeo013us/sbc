'use strict';
/** Verify actual reconstructed owner-only $1 QA route, no live provider/DB. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const src=fs.readFileSync(path.join(root,'server.js'),'utf8');
const prefix="app.post('/api/owner/launch-qa/create-order'";
const suffix="\napp.post('/api/orders',auth,ownerOnly,";
const start=src.indexOf(prefix),end=src.indexOf(suffix,start);
assert(start>=0&&end>start,'compiled runtime must include owner QA order endpoint');
assert.equal(src.indexOf(prefix,start+1),-1,'one owner QA endpoint only');
const route=src.slice(start,end);
assert.match(route,/auth,ownerOnly/);
assert.match(route,/sbcWriterLeaseReady/);
assert.match(route,/await saveData\(\)/);
assert.doesNotMatch(route,/createSquarePaymentLinkForOrder|sendEmail|fetch\(|provisionTenant|sendBig3/);
function setup({locked=false,tenant=7,saveFails=false}={}){
 let seq=0,saves=0;
 const db={customers:[],orders:[]},activities=[];
 const app={post:(name,auth,ownerOnly,handler)=>{
  assert.equal(name,'/api/owner/launch-qa/create-order');
  assert.equal(auth,'AUTH');assert.equal(ownerOnly,'OWNER_ONLY');
  app.handler=handler;
 }};
 const ctx={app,auth:'AUTH',ownerOnly:'OWNER_ONLY',db,
  SBC_RUNTIME_READ_ONLY:locked,sbcShutdownStarted:false,mysqlPool:{},
  MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true,
  RUNTIME_GATE:{blocked:()=>false},
  requireRequestTenant:()=>{if(tenant<1)throw Error('NO_TENANT');return tenant},
  id:()=>String(++seq)+'-fixture',now:()=>new Date().toISOString(),
  orderParsed:o=>{try{return JSON.parse(o.notes||'{}')}catch{return {}}},
  addActivity:(kind,desc,meta)=>activities.push({kind,desc,meta}),
  saveData:async()=>{saves++;if(saveFails)throw Error('TEST_SAVE_FAIL')},
  String,Number,Date,JSON,Object,Array,encodeURIComponent
 };
 vm.runInNewContext(route,ctx,{timeout:4000});
 const call=async(email)=>{
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},
    status(code){this.statusCode=code;return this},
    json(body){this.payload=body;return this}};
  await app.handler({body:{email},user:{role:'owner'}},res);
  return res;
 };
 return {db,activities,call,getSaves:()=>saves};
}
(async()=>{
 const f=setup();
 const first=await f.call('OWNER+test@example.com');
 assert.equal(first.statusCode,201);
 assert.equal(first.payload.amountCents,100);
 assert.equal(first.payload.existing,false);
 assert.equal(first.payload.paymentStatus,'Pending');
 assert.match(first.payload.next,/^\/api\/payments\/square\/create-link\//);
 assert.equal(first.headers['Cache-Control'],'no-store');
 assert.equal(f.db.orders.length,1);assert.equal(f.db.customers.length,1);
 assert.equal(f.db.orders[0].tenantId,7);
 assert.equal(f.db.orders[0].price,1);
 assert.equal(f.db.orders[0].launchQaOwnerCreated,true);
 assert.equal(f.db.customers[0].status,'Internal Test');
 assert.equal(f.db.customers[0].email,'owner+test@example.com');
 assert.equal(f.activities.length,1);
 // Only the relational columns survive restart; top-level QA marker is ephemeral.
 // The owner may retry after a restart, but may NOT create a second test order.
 f.db.orders[0]={
  id:first.payload.orderId,tenantId:7,customerId:first.payload.customerId,
  customerName:'SBC Launch QA Test Customer',product:'SBC Launch QA - $1 Test Service',
  status:'New',price:1,notes:f.db.orders[0].notes,fulfillmentStatus:'QA - NO VENDOR FULFILLMENT'
 };
 const again=await f.call('owner+test@example.com');
 assert.equal(again.statusCode,200);
 assert.equal(again.payload.existing,true);
 assert.equal(again.payload.orderId,first.payload.orderId);
 assert.equal(f.db.orders.length,1);assert.equal(f.getSaves(),1);
 const bad=await f.call('test@example.invalid');
 assert.equal(bad.statusCode,400);assert.equal(f.db.orders.length,1);
 const locked=setup({locked:true});
 assert.equal((await locked.call('owner@example.com')).statusCode,423);
 assert.equal(locked.db.orders.length,0);
 const untrusted=setup({tenant:0});
 assert.equal((await untrusted.call('owner@example.com')).statusCode,403);
 const save=setup({saveFails:true});
 const uncertain=await save.call('owner@example.com');
 assert.equal(uncertain.statusCode,503);
 assert.equal(uncertain.payload.automaticRetry,false);
 assert.equal(save.db.orders.length,1);
 const second=await save.call('owner@example.com');
 assert.equal(second.statusCode,200);
 assert.equal(second.payload.existing,true);
 assert.equal(save.db.orders.length,1);
 // Stored MySQL payment status must be visible after readRelational() drops
 // the in-memory paymentStatus property; otherwise a paid order looks Pending.
 const getStart=src.indexOf("app.get('/api/payments/square/order/:orderId',auth,async(req,res)=>{");
 const getEnd=src.indexOf("\napp.post('/api/payments/square/refresh/:orderId'",getStart);
 assert(getStart>=0&&getEnd>getStart,'compiled Square owner status route present');
 const getSource=src.slice(getStart,getEnd);
 const paymentOrder={
  id:'QA_SQL_ORDER_1',tenantId:7,price:1,customerId:'QA_SQL_CUSTOMER_1',
  fulfillmentStatus:'QA VERIFIED - NO FULFILLMENT',
  notes:JSON.stringify({squarePaymentStatus:'PAID',squarePaymentId:'sq_payment_1',squareOrderId:'sq_order_1'})
 };
 const statusApp={get:(route,auth,handler)=>{
  assert.equal(route,'/api/payments/square/order/:orderId');
  statusApp.handler=handler;
 }};
 vm.runInNewContext(getSource,{app:statusApp,auth:'AUTH',db:{orders:[paymentOrder]},
  requireRequestTenant:()=>7,orderParsed:o=>JSON.parse(o.notes),
  squarePaymentRecords:()=>[],Number,String},{timeout:4000});
 const response={payload:null,statusCode:200,json(j){this.payload=j;return this},
  status(n){this.statusCode=n;return this}};
 await statusApp.handler({params:{orderId:'QA_SQL_ORDER_1'}},response);
 assert.equal(response.payload?.order?.paymentStatus,'Paid',
  'owner GET derives paid truth from MySQL notes after server restart');
 assert.equal(response.payload?.order?.fulfillmentStatus,'QA VERIFIED - NO FULFILLMENT');
 console.log('[SBC OWNER $1 QA] PASS: compiled owner middleware, $1, tenant, anti-double-charge, writer lock, failure, no money movement');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
