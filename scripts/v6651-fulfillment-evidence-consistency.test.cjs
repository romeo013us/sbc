'use strict';
// Synthetic executable regressions against the exact reconstructed server.js.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const proof=require(path.join(root,'enterprise/v6640-payment-evidence.cjs'));
assert.match(server,/SBC_V6651_FULFILLMENT_EVIDENCE_CONSISTENCY/);
const direct=server.split('\n').find(x=>x.startsWith("app.post('/api/fulfillment/orders/:orderId/prepare'"));
const kim=server.split('\n').find(x=>x.trim().startsWith("if(name==='prepare_paid_order_fulfillment'"));
assert.ok(direct&&kim,'both fulfillment entrypoints exist');
for(const line of [direct,kim]){
 assert.match(line,/SBC_V6651_REQUIRE_PAID\(o,tenantId\)/);
 assert.match(line,/requireRequestTenant\(req\)/);
 assert.doesNotMatch(line,/o\.status==='Paid'|\|\|o\.status/);
}
function section(a,b){const i=server.indexOf(a),j=server.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'Missing section '+a);return server.slice(i,j)}
const ctx={require:p=>{assert.equal(p,'./enterprise/v6640-payment-evidence.cjs');return proof;},Number,Object,Error};
vm.runInNewContext(section('function SBC_V6651_REQUIRE_PAID(','function fulfillmentItemsForOrder(')+'\nthis.guard=SBC_V6651_REQUIRE_PAID;',ctx);
const guard=ctx.guard;
const paid={id:'paid',tenantId:7,paymentStatus:'PAID',status:'Pending',parsed:{squareOrderId:'sq-verified',squarePaymentId:'sq-payment',squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-26T12:00:00Z'}};
const fake={id:'fake',tenantId:7,paymentStatus:'PENDING',status:'Paid'};
const refund={id:'refund',tenantId:7,paymentStatus:'REFUNDED',status:'Paid'};
for(const o of [fake,refund,{id:'legacy',tenantId:7,status:'Paid'},null])assert.throws(()=>guard(o,7),/PAYMENT_EVIDENCE_REQUIRED|TENANT_CONTEXT_REQUIRED/);
for(const o of [{...paid,tenantId:undefined},{...paid,tenantId:0},{...paid,tenantId:-1}])assert.throws(()=>guard(o,7),/TENANT_CONTEXT_REQUIRED/);
assert.throws(()=>guard(paid,8),/TENANT_CONTEXT_REQUIRED/);
assert.equal(guard(paid,7),paid);
async function route(order,tenantId=7,role='owner'){
 const registered={},calls={created:0,executed:0};
 const api={app:{post:(name,...fns)=>{registered[name]=fns.at(-1)}},auth:()=>{},db:{orders:[order]},
 requireRequestTenant:req=>{if(!req.tenantId)throw Error('TENANT_CONTEXT_REQUIRED');return req.tenantId},
 SBC_V6651_REQUIRE_PAID:guard,createFulfillmentJobsForOrder:async()=>{calls.created++;return []},
 processReadyFulfillmentJobs:async()=>{calls.executed++},vendorCapabilities:()=>({ready:true})};
 vm.runInNewContext(direct,api);
 const result={code:200,status(n){this.code=n;return this},json(v){this.body=v;return this}};
 await registered['/api/fulfillment/orders/:orderId/prepare']({user:{role},tenantId,params:{orderId:order.id}},result);
 return {result,calls};
}
(async()=>{
 let x=await route(fake);assert.equal(x.result.code,409);assert.equal(x.calls.created,0);
 x=await route(refund);assert.equal(x.result.code,409);
 x=await route(paid,8);assert.equal(x.result.code,404);assert.equal(x.calls.created,0);
 x=await route(paid,7,'caller');assert.equal(x.result.code,403);
 x=await route(paid);assert.equal(x.result.code,200);assert.equal(x.calls.created,1);
 let vendorCalls=0;
 const env={db:{orders:[fake]},SBC_V6651_REQUIRE_PAID:guard,
 V569_PRODUCTION_EXPANSION:{OWNER_THRESHOLD:10000,tenantHealth:()=>({quarantined:false})},
 TENANT_DEFAULT_ID:1,fulfillmentAdapterFor:()=>({validateOrder:()=>{},submitOrder:async()=>{vendorCalls++;return {status:'submitted'}}}),Number,String};
 vm.runInNewContext(section('async function submitVendorJob(job){','async function recoverStaleFulfillmentJobs()')+'\nthis.dispatch=submitVendorJob;',env);
 await assert.rejects(()=>env.dispatch({orderId:'fake',tenantId:7,value:100}),/PAYMENT_EVIDENCE_REQUIRED/);
 assert.equal(vendorCalls,0,'No vendor contact without proof');
 env.db.orders=[paid];
 await assert.rejects(()=>env.dispatch({orderId:'paid',tenantId:8,value:100}),/TENANT_CONTEXT_REQUIRED/);
 assert.equal(vendorCalls,0,'No vendor contact across tenants');
 const success=await env.dispatch({orderId:'paid',tenantId:7,value:100,vendor:'internal'});
 assert.equal(success.status,'submitted');assert.equal(vendorCalls,1);
 assert.match(section('async function createFulfillmentJobsForOrder(order){','async function submitVendorJob(job){'),
 /^async function createFulfillmentJobsForOrder\(order\)\{\n  SBC_V6651_REQUIRE_PAID\(order\);/);
 const worker=section('async function processReadyFulfillmentJobs(){','function syncOrderFulfillmentLifecycle(');
 assert.match(worker,/paymentHold=errCode==='PAYMENT_EVIDENCE_REQUIRED'\|\|errCode==='TENANT_CONTEXT_REQUIRED'/);
 assert.match(worker,/job.status=\(ambiguous\|\|paymentHold\)\?'needs_reconciliation'/);
 assert.match(worker,/job.vendorStatus=paymentHold\?'payment_evidence_required'/);
 assert.match(worker,/job.nextAttemptAt=\(ambiguous\|\|paymentHold\)\?''/);
 new vm.Script(server,{filename:'server.js'});
 console.log('[SBC V6651] PASS owner and Kim controls, vendor gate, tenant scope, payment evidence, nonretryable reconciliation');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
