'use strict';
// SBC V66.51: all fulfillment entrypoints and vendor dispatch must use the same
// tenant-scoped, canonical payment-evidence classifier. No provider operations.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6651_FULFILLMENT_EVIDENCE_CONSISTENCY';
function once(s,a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error(MARKER+': '+label+' expected one anchor, found '+n);
 return s.replace(a,b);
}
const PRELUDE=[
 '// '+MARKER+': evidence and tenant identity precede fulfillment.',
 'function SBC_V6651_REQUIRE_PAID(order,expectedTenantId){',
 ' const tenantId=Number(order?.tenantId);',
 ' const expected=expectedTenantId===undefined?tenantId:Number(expectedTenantId);',
 " if(!Number.isSafeInteger(tenantId)||tenantId<=0||!Number.isSafeInteger(expected)||expected<=0||tenantId!==expected)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});",
 " if(!require('./enterprise/v6640-payment-evidence.cjs').confirmedPaid(order))throw Object.assign(new Error('PAYMENT_EVIDENCE_REQUIRED'),{code:'PAYMENT_EVIDENCE_REQUIRED'});",
 ' return order;',
 '}'
].join('\n');
function patchServer(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate install');
 s=once(s,'function fulfillmentItemsForOrder(order){',PRELUDE+'\nfunction fulfillmentItemsForOrder(order){','shared proof guard');
 s=once(s,'async function createFulfillmentJobsForOrder(order){\n  const m=megaData(), items=fulfillmentItemsForOrder(order);',
  'async function createFulfillmentJobsForOrder(order){\n  SBC_V6651_REQUIRE_PAID(order);\n  const m=megaData(), items=fulfillmentItemsForOrder(order);','no unverified job creation');
 s=once(s,'async function submitVendorJob(job){\n  const amount=Number(job?.value||0);',
  "async function submitVendorJob(job){\n  const sourceOrder=(db.orders||[]).find(o=>String(o.id)===String(job?.orderId));\n  SBC_V6651_REQUIRE_PAID(sourceOrder,job?.tenantId);\n  const amount=Number(job?.value||0);",'no unverified vendor dispatch');
 const oldDirect="app.post('/api/fulfillment/orders/:orderId/prepare',auth,async(req,res)=>{if(req.user.role!=='owner')return res.status(403).json({error:'Only Romeo / owner can operate fulfillment.'});const o=db.orders.find(x=>x.id===req.params.orderId);if(!o)return res.status(404).json({error:'Order not found.'});const paid=String(o.paymentStatus||orderParsed(o).squarePaymentStatus||'').toUpperCase()==='PAID'||o.status==='Paid';if(!paid)return res.status(409).json({error:'Order is not verified as paid. Fulfillment remains blocked.'});const jobs=await createFulfillmentJobsForOrder(o);await processReadyFulfillmentJobs();res.json({ok:true,created:jobs,capabilities:vendorCapabilities()})});";
 const newDirect="app.post('/api/fulfillment/orders/:orderId/prepare',auth,async(req,res)=>{if(req.user.role!=='owner')return res.status(403).json({error:'Only owner can operate fulfillment.'});let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED',error:'Tenant context is required.'})}const o=(db.orders||[]).find(x=>String(x.id)===String(req.params.orderId)&&Number(x.tenantId)===tenantId);if(!o)return res.status(404).json({error:'Order not found in this tenant.'});try{SBC_V6651_REQUIRE_PAID(o,tenantId)}catch(_){return res.status(409).json({ok:false,code:'PAYMENT_EVIDENCE_REQUIRED',error:'Confirmed payment required before fulfillment.'})}try{const jobs=await createFulfillmentJobsForOrder(o);await processReadyFulfillmentJobs();return res.json({ok:true,created:jobs,capabilities:vendorCapabilities()})}catch(_){return res.status(503).json({ok:false,code:'FULFILLMENT_PREPARATION_UNAVAILABLE',error:'Fulfillment preparation could not be committed; check operations status.'})}});";
 s=once(s,oldDirect,newDirect,'owner fulfillment API');
 const oldKim="if(name==='prepare_paid_order_fulfillment'){if(!kimCoOwnerSession(req))throw new Error(\"Kim fulfillment operations require Romeo's authenticated owner session.\");const o=(db.orders||[]).find(x=>x.id===String(a.orderId));if(!o)throw new Error('Order not found.');const paid=String(o.paymentStatus||orderParsed(o).squarePaymentStatus||'').toUpperCase()==='PAID'||o.status==='Paid';if(!paid)throw new Error('Order is not verified as paid. Fulfillment remains blocked.');const jobs=await createFulfillmentJobsForOrder(o);await processReadyFulfillmentJobs();return {ok:true,orderId:o.id,createdJobs:jobs,readiness:vendorCapabilities()};}";
 const newKim="if(name==='prepare_paid_order_fulfillment'){if(!kimCoOwnerSession(req))throw new Error('Kim fulfillment requires authenticated owner access.');const tenantId=requireRequestTenant(req);const o=(db.orders||[]).find(x=>String(x.id)===String(a.orderId)&&Number(x.tenantId)===tenantId);if(!o)throw new Error('Order not found in this tenant.');SBC_V6651_REQUIRE_PAID(o,tenantId);const jobs=await createFulfillmentJobsForOrder(o);await processReadyFulfillmentJobs();return {ok:true,orderId:o.id,createdJobs:jobs,readiness:vendorCapabilities()};}";
 s=once(s,oldKim,newKim,'Kim fulfillment tool');
 s=once(s,"const ambiguous=['ETIMEDOUT','ESOCKETTIMEDOUT'","const paymentHold=errCode==='PAYMENT_EVIDENCE_REQUIRED'||errCode==='TENANT_CONTEXT_REQUIRED';const ambiguous=['ETIMEDOUT','ESOCKETTIMEDOUT'",'non-retryable payment hold');
 s=once(s,"job.status=ambiguous?'needs_reconciliation':'failed';job.vendorStatus=ambiguous?'submission_outcome_unknown':'failed';job.lastError=(ambiguous?'Vendor submission outcome is ambiguous; automatic retry is paused to prevent a duplicate external order. ':'')+String(e.message||e);",
 "job.status=(ambiguous||paymentHold)?'needs_reconciliation':'failed';job.vendorStatus=paymentHold?'payment_evidence_required':ambiguous?'submission_outcome_unknown':'failed';job.lastError=(paymentHold?'Payment evidence or tenant scope is missing; vendor was not contacted. ':ambiguous?'Vendor submission outcome is ambiguous; automatic retry is paused to prevent a duplicate external order. ':'')+String(e.message||e);",'hold invalid old jobs');
 s=once(s,"job.nextAttemptAt=ambiguous?'':new Date(Date.now()+Math.min(60*60*1000,Math.pow(2,Math.min(job.attempts,6))*60*1000)).toISOString();",
 "job.nextAttemptAt=(ambiguous||paymentHold)?'':new Date(Date.now()+Math.min(60*60*1000,Math.pow(2,Math.min(job.attempts,6))*60*1000)).toISOString();",'never automatically retry unpaid jobs');
 new vm.Script(s,{filename:'server.js'});
 return s;
}
function apply(root){
 const file=path.join(root,'server.js');
 if(!fs.existsSync(file))throw Error(MARKER+': no compiled server.js');
 const modified=patchServer(fs.readFileSync(file,'utf8'));
 fs.writeFileSync(file,modified);
 return {marker:MARKER,files:['server.js'],paymentEvidenceBeforeJobs:true,vendorDispatchProtected:true,tenantIsolated:true,automaticUnpaidRetries:false,schemaChanges:false,providerCalls:false};
}
module.exports={MARKER,once,patchServer,apply};
