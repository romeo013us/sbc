'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../enterprise/v66117-print-fulfillment-truth.cjs');
const stage=require('./v66117-stage-print-desk.cjs');
const server=fs.readFileSync(path.resolve(__dirname,'..','server.js'),'utf8');
const patched=stage.patchServer(server);
assert.equal(stage.patchServer(patched),patched,'staged patch must be idempotent');
assert(stage.verify(patched));
assert(!patched.includes('vendorOrderId||'+String.fromCharCode(96)+'MANUAL-'));
assert.equal((patched.match(/app\.get\('\/api\/owner\/print-desk'/g)||[]).length,1,'single owner-only endpoint');
if(process.argv.includes('--staged'))assert.equal(server,patched,'packaged runtime lacks print desk/receipt patch');
for(const id of ['', 'MANUAL-1739047392','tbd','FAKE-1111','PENDING','TEST-1121','--','n/a'])assert.equal(P.validVendorOrderId(id),false,'invalid/synthetic receipt '+id);
for(const id of ['VP1234567','123456789','4o4-7845','#broken'].slice(0,3))assert.equal(P.validVendorOrderId(id),true,id);
assert.equal(P.vendorName('fourOverFour'),'4OVER4');
assert.equal(P.vendorName('vistaPrint'),'VistaPrint');
const orders=[
 {id:'p1',tenantId:1,customerName:'Synthetic Auto Shop',price:199,paymentStatus:'Paid',proof:true},
 {id:'p2',tenantId:1,customerName:'Synthetic Beauty',price:75,paymentStatus:'Pending',proof:false},
 {id:'x1',tenantId:2,customerName:'OTHER TENANT',price:100000,paymentStatus:'Paid',proof:true}
];
const base={tenantId:1,orderId:'p1',customerName:'Synthetic Auto Shop',quantity:100,product:'100 Business Cards',vendor:'fourOverFour',createdAt:'2026-11-08T12:00:00Z',value:199,cost:0};
const jobs=[
 {id:'ready',...base,status:'ready',requirements:{artworkApproved:true}},
 {id:'proof',...base,status:'ready',requirements:{}},
 {id:'uncertain',...base,status:'needs_reconciliation',vendorStatus:'submission_outcome_unknown'},
 {id:'paidUnknown',...base,orderId:'p2',status:'ready',requirements:{artworkApproved:true}},
 {id:'shipped',...base,status:'shipped',vendorOrderNumber:'VP1234567'},
 {id:'missingReceipt',...base,status:'submitted',vendorOrderNumber:''},
 {id:'tenant2',...base,tenantId:2,orderId:'x1',customerName:'OTHER TENANT',status:'ready'}
];
const paymentConfirmed=o=>o.proof===true;
const results=P.summarize({tenantId:1,orders,jobs,paymentConfirmed});
assert.equal(results.totalPrintJobs,6,'cross-tenant job must not count');
assert(!JSON.stringify(results).includes('OTHER TENANT'),'no cross-tenant leakage');
const byId=Object.fromEntries(results.rows.map(x=>[x.jobId,x]));
assert.equal(byId.ready.status,'READY_FOR_MANUAL_SUPPLIER_ORDER');
assert.equal(byId.proof.status,'PROOF_AND_DETAILS_REVIEW');
assert.equal(byId.uncertain.status,'VENDOR_RECONCILIATION');
assert.equal(byId.paidUnknown.status,'PAYMENT_PROOF_REQUIRED');
assert.equal(byId.shipped.status,'SHIPPED');
assert.equal(byId.missingReceipt.status,'VENDOR_RECEIPT_MISSING');
for(const item of results.rows)assert.equal(item.printLineMargin,null,'bundled order gross must not be misrepresented as print profit');
assert.equal(byId.missingReceipt.vendorOrderNumber,null);
assert.equal(byId.shipped.vendorOrderNumber,'VP1234567');
assert.equal(results.needsOwnerAttention,5);
assert.equal(P.summarize({tenantId:1,orders:[],jobs:[{...base,id:'orphan'}],paymentConfirmed}).rows[0].status,'ORPHAN_ORDER');
assert.throws(()=>P.summarize({tenantId:0,orders,jobs,paymentConfirmed}),/TENANT_REQUIRED/);
let called=0;const sideEffectGuard=()=>{called++;throw Error('External vendor must never be called')};
const empty=P.summarize({tenantId:1,orders,jobs:[],paymentConfirmed:sideEffectGuard});
assert.equal(empty.totalPrintJobs,0);assert.equal(called,0);
const script=fs.readFileSync(path.resolve(__dirname,'../enterprise/v66117-print-fulfillment-truth.cjs'),'utf8');
assert(!/fetch\(|sendEmail\(|createSquarePaymentLinkForOrder\(/.test(script),'pure desk must not call providers');
console.log('[SBC V66.117] PASS: 6 tenant-local print jobs, owner review, no invented margins, real vendor order IDs only, paid guard, no external calls');
