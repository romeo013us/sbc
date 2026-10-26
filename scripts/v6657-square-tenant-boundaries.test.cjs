'use strict';
// Runs on the exact compiled runtime. All orders, tenants and providers are fake.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const E=require(path.join(root,'enterprise/v6640-payment-evidence.cjs'));
assert.match(server,/SBC_V6657_SQUARE_TENANT_BOUNDARIES/);
const proof={squareOrderId:'so7',squarePaymentId:'pay7',squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-26T17:00:00Z'};
const own={id:'own',tenantId:7,price:349,customerId:'c7',paymentStatus:'Paid',parsed:proof};
const foreign={...own,id:'foreign',tenantId:8,parsed:{...proof,squareOrderId:'so8'}};
const forged={...own,id:'forged',parsed:{squareOrderId:'so-forged',squarePaymentStatus:'PAID'}};
assert.equal(E.confirmedPaid(own),true);
assert.equal(E.providerCapturedSquare(own),true);
assert.equal(E.confirmedPaid(forged),false);
assert.equal(E.statusOnlyPayment(forged),true);
assert.equal(E.confirmedPaid({...own,parsed:{...proof,squarePaymentStatus:'REFUNDED'}}),false);
assert.equal(E.confirmedPaid({...own,parsed:{...proof,squarePaymentId:''}}),false);
assert.equal(E.confirmedPaid({...own,parsed:{...proof,squarePaymentCompletedAt:''}}),false);
assert.equal(E.statusOnlyPayment({paymentStatus:'Paid'}),true);
function section(a,b){const i=server.indexOf(a),j=server.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return server.slice(i,j)}
const guardCtx={require:p=>{assert.equal(p,'./enterprise/v6640-payment-evidence.cjs');return E},Error,Number,Object};
vm.runInNewContext(section('function SBC_V6651_REQUIRE_PAID(','function fulfillmentItemsForOrder(')+'\nthis.guard=SBC_V6651_REQUIRE_PAID;',guardCtx);
assert.throws(()=>guardCtx.guard(forged,7),/PAYMENT_EVIDENCE_REQUIRED/);
assert.throws(()=>guardCtx.guard(own,8),/TENANT_CONTEXT_REQUIRED/);
assert.equal(guardCtx.guard(own,7),own);
const routes={},orders=[own,foreign,forged],payments=[
 {sbcOrderId:'own',status:'PENDING',squareOrderId:'so7'},
 {sbcOrderId:'foreign',status:'PENDING',squareOrderId:'so8'},
 {sbcOrderId:'forged',status:'PENDING',squareOrderId:'so-forged'}
];let linkCalls=0,squareCalls=0,webhookCalls=0;
const ctx={
 app:{get:(p,...x)=>routes['GET '+p]=x.at(-1),post:(p,...x)=>routes['POST '+p]=x.at(-1)},
 auth(){},ownerOnly(){},v25SalesAccess(){},FINANCIAL_GOVERNOR:{middleware:()=>()=>{}},
 db:{orders,customers:[],squarePayments:payments},String,Number,Set,
 process:{env:{SQUARE_LOCATION_ID:'ci-location',SQUARE_SUCCESS_REDIRECT_URL:''}},
 requireRequestTenant:req=>{if(!Number.isInteger(req.tenantId)||req.tenantId<=0)throw Error('TENANT_CONTEXT_REQUIRED');return req.tenantId},
 squareConfigured:()=>true,squareWebhookConfigured:()=>true,squareEnvironment:()=>'sandbox',SQUARE_API_VERSION:'2026-09-16',
 createSquarePaymentLinkForOrder:async o=>{linkCalls++;return {url:'https://example.invalid/'+o.id}},
 orderParsed:o=>o.parsed||{},squarePaymentRecords:()=>payments,
 squareApi:async()=>{squareCalls++;return {order:{tenders:[]}}},
 squareMoneyCents:p=>Math.round(p*100),
 SBC_SQUARE_SAFETY:{findCapturedTender:async()=>null},
 handleSquarePaymentEvent:async()=>{webhookCalls++;return {ok:true}}
};
for(const [a,b] of [
 ["app.get('/api/payments/square/status'","app.get('/api/payments/square/readiness'"],
 ["app.post('/api/payments/square/create-link/:orderId'","app.get('/api/payments/square/order/:orderId'"],
 ["app.get('/api/payments/square/order/:orderId'","app.post('/api/payments/square/refresh/:orderId'"],
 ["app.post('/api/payments/square/refresh/:orderId'","app.post('/api/payments/square/owner-mark-paid/:orderId'"]
])vm.runInNewContext(section(a,b),ctx,{timeout:4000});
function response(){return {code:200,status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(){}}}
async function call(method,route,tenantId,orderId){
 const fn=routes[method+' '+route];assert.equal(typeof fn,'function',route);
 const r=response();await fn({tenantId,params:{orderId},user:{role:'owner',id:'owner'}},r);return r;
}
(async()=>{
 const endpoints=[
  ['POST','/api/payments/square/create-link/:orderId'],
  ['GET','/api/payments/square/order/:orderId'],
  ['POST','/api/payments/square/refresh/:orderId']
 ];
 for(const [method,route] of endpoints){
  const foreignResult=await call(method,route,7,'foreign');assert.equal(foreignResult.code,404,route);
  const missing=await call(method,route,undefined,'own');assert.equal(missing.code,403,route);
  assert.ok(!JSON.stringify(foreignResult.body).includes('so8'));
 }
 assert.equal(linkCalls,0,'no cross-tenant payment links');
 assert.equal(squareCalls,0,'no cross-tenant provider calls');
 assert.equal(webhookCalls,0,'no fake webhook writes');
 let status=await call('GET','/api/payments/square/status',7);assert.equal(status.body.pending,2);
 status=await call('GET','/api/payments/square/status',8);assert.equal(status.body.pending,1);
 status=await call('GET','/api/payments/square/status',undefined);assert.equal(status.code,403);
 let ownResult=await call('POST','/api/payments/square/create-link/:orderId',7,'own');assert.equal(ownResult.code,200);assert.equal(linkCalls,1);
 ownResult=await call('GET','/api/payments/square/order/:orderId',7,'own');assert.equal(ownResult.body.order.id,'own');
 ownResult=await call('POST','/api/payments/square/refresh/:orderId',7,'own');assert.equal(ownResult.body.verification,'NO_CONFIRMED_MATCHING_PAYMENT');assert.equal(squareCalls,1);assert.equal(webhookCalls,0);
 const ownerReport=section("app.get('/api/owner/revenue-integrity'","app.post('/api/v32-2/payment-reconciliation'");
 assert.match(ownerReport,/providerCapturedSquare/);
 assert.match(ownerReport,/statusOnlyPaidNeedsReview/);
 assert.match(ownerReport,/Not authoritative MySQL certification/);
 console.log('[SBC V6657] PASS: 4 Square routes deny missing/foreign tenants, no unauthorized Square calls, Square capture evidence gate and reconciliation signal');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
