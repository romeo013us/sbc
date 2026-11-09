'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const truth=require('../enterprise/v66138-fulfillment-truth.cjs'),stage=require('./v66138-stage-fulfillment-truth.cjs');
const base=()=>({id:'ord123456',tenantId:1,status:'Paid',fulfillmentStatus:'Ready',updatedAt:'2026-11-09T12:00:00.000Z'});
const row=(status='Paid',fulfillment_status='Ready for Fulfillment')=>[[{status,fulfillment_status}]];
assert.equal(truth.validReceipt('PO-2026-88642'),true);
for(const fake of ['', 'test123', 'demo', 'pending','unknown','none','TBD','placeholder','manual_123']){
 assert.equal(truth.validReceipt(fake),false,'fake receipt cannot be supplier proof: '+fake);
 assert.throws(()=>truth.requireReceipt(fake),/REAL_VENDOR_ORDER_REFERENCE_REQUIRED/);
}
assert.equal(truth.validShipping('USPS','9400111899223857773333'),true);
assert.equal(truth.validShipping('USPS','TEST123456'),false);
assert.equal(truth.validShipping('','9400111899223857773333'),false);
assert.equal(truth.validDelivery({type:'carrier_delivered',reference:'USPS-2026-077',confirmedAt:'2026-11-09T22:00:00Z'}),true);
assert.equal(truth.validDelivery({type:'carrier_delivered',reference:'unknown',confirmedAt:'2026-11-09T22:00:00Z'}),false);
assert.equal(truth.validDelivery({type:'confirmed_by_ai',reference:'USPS-2026-077',confirmedAt:'2026-11-09T22:00:00Z'}),false);
(async()=>{
 let customer=base(),writes=0,reads=0;
 const good=await truth.commitStage({order:customer,stage:'PAID',paid:()=>true,stamp:'2026-11-09T23:00:00Z',
  pool:{query:async(q,args)=>{reads++;assert.match(q,/tenant_id=\?/);assert.deepEqual(args,['ord123456',1]);return row();}},
  saveData:async()=>{writes++;}});
 assert(good.ok&&good.durable&&writes===1&&reads===1);
 const cases=[
  {name:'read-only',saveData:async()=>({skipped:true}),pool:{query:async()=>row('In Progress','Submitted to Vendor')}},
  {name:'SQL write rejects',saveData:async()=>{throw Error('MYSQL_RELATIONAL_COMMIT_FAILED')},pool:{query:async()=>row('In Progress','Submitted to Vendor')}},
  {name:'readback mismatch',saveData:async()=>{},pool:{query:async()=>row('Paid','Ready for Fulfillment')}},
  {name:'readback missing',saveData:async()=>{},pool:{query:async()=>[[]]}}
 ];
 for(const c of cases){
  customer=base();const before=JSON.stringify(customer);
  await assert.rejects(truth.commitStage({order:customer,stage:'VENDOR_SUBMITTED',paid:()=>true,
    saveData:c.saveData,pool:c.pool}),undefined,c.name);
  assert.equal(JSON.stringify(customer),before,'no false in-memory status on '+c.name);
 }
 customer=base();
 await assert.rejects(truth.commitStage({order:customer,stage:'DELIVERED',paid:()=>false,
  saveData:async()=>{},pool:{query:async()=>row()}}),/PAYMENT_EVIDENCE_REQUIRED/);
 await assert.rejects(truth.commitStage({order:customer,stage:'UNKNOWN',paid:()=>true,
  saveData:async()=>{},pool:{query:async()=>row()}}),/FULFILLMENT_STAGE_INVALID/);
 assert.equal(customer.fulfillmentStatus,'Ready');
 const raw=read('server.js'),compiled=stage.patchServer(raw);
 assert.equal(stage.patchServer(compiled),compiled,'exact-anchor patch idempotent');
 assert(compiled.includes(stage.MARK));
 assert(compiled.includes('FULFILLMENT_AUTHORITATIVE_WRITER_UNAVAILABLE'));
 assert(compiled.includes('providerSubmissionPerformed:false'));
 assert(compiled.includes('v400CommitAction(req,'));
 assert(!compiled.includes('saveData().catch(()=>{})'),'legacy silent persistence failure must be removed');
 assert(!compiled.includes("v400ApplyOrderStage(req.params.id,'VENDOR_SUBMITTED')"),'all callers must await durable commit');
 new vm.Script(compiled,{filename:'server-staged.js'});
 const v400=read('enterprise/kim-fulfillment-control-v400.js');
 new vm.Script(v400,{filename:'V400.js'});
 assert.match(v400,/FULFILLMENT_TRUTH\.requireReceipt\(vendorOrderId\)/);
 assert.match(v400,/DELIVERY_PROOF_REQUIRED/);
 assert.match(v400,/REAL_SHIPPING_EVIDENCE_REQUIRED/);
 assert(!v400.includes("vendorOrderId||id('vendor')"),'never forge vendor receipt');
 const V400=require('../enterprise/kim-fulfillment-control-v400.js');
 const sid='sbc_v66138_synthetic_check',beforeSnapshot=V400.capture(sid);
 try{
  V400.state.orders[sid]={id:sid,stage:'PRODUCTION_READY',vendor:{status:'READY',provider:'vistaprint',orderId:'PO-2026-8844'},checklist:{payment:true,assets:true,preflight:true,proof:false},proofs:[],assets:[],history:[],shipping:{status:'NOT_SHIPPED'},financial:{revenue:199,cost:0,margin:null},updatedAt:new Date().toISOString()};
  assert.throws(()=>V400.submitVendor(sid,'',{}),/REAL_VENDOR_ORDER_REFERENCE_REQUIRED/);
 }finally{V400.restore(beforeSnapshot)}
 if(process.argv.includes('--staged'))assert.equal(compiled,raw,'compiled release must include P0 fulfillment durability');
 console.log('PASS V66.138: no fake vendor receipts, signed MySQL readback, rollback on failure, delivery evidence, no provider calls');
})().catch(e=>{console.error(e);process.exitCode=1});
