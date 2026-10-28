'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createOutbox,validateTarget}=require('../ecosystem/office-box-outbox.cjs');
const {buildPaidHandoff}=require('../enterprise/office-box-paid-handoff.cjs');
const rows=new Map(),sent=[];let shouldReject=false,ackWrong=false;
const pool={
 async execute(sql,args){
  if(sql.includes('INSERT IGNORE')){
   const [event_id,order_id,customer_id,event_type,payload_json]=args;
   if(rows.has(event_id))return [{affectedRows:0}];
   rows.set(event_id,{event_id,order_id,customer_id,event_type,payload_json,status:'PENDING',attempts:0});
   return [{affectedRows:1}];
  }
  const event=rows.get(args[sql.includes("status='DELIVERED'")?1:4]);
  assert(event,'row must exist');
  const owner=args[sql.includes("status='DELIVERED'")?2:5];
  assert.equal(owner,event.lease_owner,'lease owner mismatch');
  assert.equal(event.status,'IN_FLIGHT','only in-flight item may be acked');
  if(sql.includes("status='DELIVERED'")){event.status='DELIVERED';event.acked_at='now'}
  else{event.status=args[0];event.last_error_code=args[3];}
  event.lease_owner=null;return [{affectedRows:1}];
 },
 async getConnection(){
  return {
   async beginTransaction(){},
   async query(sql,args=[]){
    if(sql.includes('SELECT event_id,payload_json')){
     const row=[...rows.values()].find(x=>x.status==='PENDING');
     return [row?[{event_id:row.event_id,payload_json:row.payload_json,attempts:row.attempts}]:[]];
    }
    if(sql.includes('status=\'IN_FLIGHT\'')){
     const [owner,_seconds,eventId]=args;const row=rows.get(eventId);
     row.status='IN_FLIGHT';row.attempts++;row.lease_owner=owner;return [{affectedRows:1}];
    }
    throw Error('Unexpected SQL '+sql.slice(0,90));
   },
   async commit(){},async rollback(){},release(){}
  }
 }
};
const order={id:'sbc_order_100',price:349,paymentStatus:'PAID',officeBoxSku:'OFFICE_BOX_BUSINESS',customerId:'sbc_customer_100',customerEmail:'owner@fixture.invalid'};
const payment={id:'square_payment_100',order_id:'square_order_100',location_id:'square_location_100',status:'COMPLETED',amount_money:{amount:34900,currency:'USD'}};
const parsed={squareOrderId:'square_order_100',squarePaymentId:'square_payment_100',squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-27T10:00:00.000Z'};
const paymentRecord={sbcOrderId:order.id,squareOrderId:payment.order_id,squarePaymentId:payment.id,status:'PAID'};
const customer={id:'sbc_customer_100',businessName:'Fixture Test Co',ownerEmail:'owner@fixture.invalid'};
const proof={order,payment,parsed,paymentRecord,customer,expectedLocation:'square_location_100',plan:'business'};
const secret='sbc-officebox-verification-secret-64-characters-long';
const transport=async(url,options)=>{
 assert.equal(options.redirect,'error','signed Office Box events must NEVER follow HTTP redirects');
 assert.equal(options.cache,'no-store');
 sent.push({url,options});
 if(shouldReject)return {status:503,json:async()=>({ok:false})};
 const payload=JSON.parse(options.body);
 if(url.endsWith('/api/sbc/entitlements'))return {status:200,json:async()=>({ok:true,accepted:true,status:'ACTIVE'})};
 return {status:200,json:async()=>({ok:true,data:{accepted:true,correlationId:ackWrong?'other_event':payload.correlationId}})};
};
const granted=()=>({publishedWriter:true,recoveryVerified:true,writerLeaseHeld:true});
const options={pool,receiverOrigin:'https://office.example.test',secret,enabled:true,publishedWriter:true,writerAuthority:granted,transport};
async function main(){
 for(const url of ['http://office.example.test','https://localhost','https://127.0.0.1','https://192.168.1.12','https://[::1]','https://site.internal','https://site.local','https://site.lan','https://office.example.test/path','https://x:p@office.example.test']){
  assert.throws(()=>validateTarget(url),/HTTPS_ORIGIN_REQUIRED/);
 }
 const disabled=createOutbox({...options,enabled:false});
 await assert.rejects(()=>disabled.enqueue(proof),/WRITER_ONLY/);
 await assert.rejects(()=>disabled.dispatchOne(),/WRITER_ONLY/);
 const noWriter=createOutbox({...options,publishedWriter:false});
 await assert.rejects(()=>noWriter.enqueue(proof),/WRITER_ONLY/);
 const outbox=createOutbox(options);
 await assert.rejects(()=>outbox.enqueue({...proof,order:{...order,officeBoxSku:'UNRELATED_WEBSITE'}}),/SKU_MISMATCH/);
 const queued=await outbox.enqueue(proof);
 assert.equal(queued.created,true);assert.equal(rows.size,1);
 const dupe=await outbox.enqueue(proof);assert.equal(dupe.created,false);
 assert.equal(rows.size,1,'Duplicate cannot add a new event');
 const delivered=await outbox.dispatchOne();
 assert.equal(delivered.status,'DELIVERED');
 assert.equal(rows.get(queued.eventId).attempts,1);
 assert.equal(await outbox.dispatchOne().then(x=>x.status),'EMPTY');
 assert.equal(sent[0].url,'https://office.example.test/api/sbc/handoff');
 const signed=sent[0].options;
 const timestamp=signed.headers['x-sbc-timestamp'];
 const wanted=crypto.createHmac('sha256',secret).update(timestamp+'.'+signed.body).digest('hex');
 assert.equal(signed.headers['x-sbc-signature-v2'],'sha256='+wanted);
 const paidEvent=JSON.parse(rows.get(queued.eventId).payload_json),tenantId='tenant_'+('a'.repeat(16));
 const linked={ok:true,data:{schema:'sbc.office-box.activation-status.v1',status:'ACTIVATED',correlationId:paidEvent.correlationId,
  tenantId,customerId:paidEvent.customerId,orderId:paidEvent.payload.orderId,plan:'business'}};
 await assert.rejects(()=>outbox.enqueueActiveEntitlement({paidEvent,activationResponse:{...linked,data:{...linked.data,customerId:'other_customer_100'}},
  verifiedAt:'2026-10-27T10:00:00Z'}),/MISMATCH/);
 const active=await outbox.enqueueActiveEntitlement({paidEvent,activationResponse:linked,verifiedAt:'2026-10-27T10:00:00Z'});
 assert(active.created,'Verified activation must enqueue one ACTIVE entitlement');
 assert.equal((await outbox.enqueueActiveEntitlement({paidEvent,activationResponse:linked,verifiedAt:'2026-10-27T10:00:00Z'})).created,false);
 assert.equal((await outbox.dispatchOne()).status,'DELIVERED');
 assert.equal(sent[1].url,'https://office.example.test/api/sbc/entitlements');
 const entitlementRequest=sent[1].options,entitlementBody=JSON.parse(entitlementRequest.body);
 assert.equal(entitlementBody.tenantId,tenantId);
 assert.equal(entitlementBody.status,'ACTIVE');
 assert.equal(entitlementRequest.headers['x-sbc-signature'],'sha256='+crypto.createHmac('sha256',secret)
  .update(entitlementRequest.headers['x-sbc-timestamp']+'.'+entitlementRequest.body).digest('hex'));
 const nextProof={...proof,order:{...order,id:'sbc_order_200'},paymentRecord:{...paymentRecord,sbcOrderId:'sbc_order_200'}};
 const second=await outbox.enqueue(nextProof);
 shouldReject=true;
 const failed=await outbox.dispatchOne();
 assert.equal(failed.status,'RETRY_SCHEDULED');assert.equal(rows.get(second.eventId).status,'PENDING');
 shouldReject=false;ackWrong=true;
 const wrongAck=await outbox.dispatchOne();
 assert.equal(wrongAck.status,'RETRY_SCHEDULED');
 assert.equal(wrongAck.reason,'OFFICE_BOX_ACK_MISMATCH');
 ackWrong=false;
 assert.equal((await outbox.dispatchOne()).status,'DELIVERED');
 assert.equal(rows.get(second.eventId).attempts,3);
 const lastProof={...proof,order:{...order,id:'sbc_order_300'},paymentRecord:{...paymentRecord,sbcOrderId:'sbc_order_300'}};
 const last=await outbox.enqueue(lastProof);
 const oneTry=createOutbox({...options,maxAttempts:1});
 shouldReject=true;
 assert.equal((await oneTry.dispatchOne()).status,'DEAD');
 assert.equal(rows.get(last.eventId).status,'DEAD');
 assert.equal((await oneTry.dispatchOne()).status,'EMPTY','DEAD records must not be redelivered');
 // Fail closed if the long-running scheduler forgot to wire a live lease inspector.
 const unfenced=createOutbox({...options,writerAuthority:null});
 const beforeUnfenced=rows.size, sentBeforeUnfenced=sent.length;
 await assert.rejects(()=>unfenced.enqueue(proof),/OFFICE_BOX_LIVE_WRITER_FENCE_REQUIRED/);
 await assert.rejects(()=>unfenced.dispatchOne(),/OFFICE_BOX_LIVE_WRITER_FENCE_REQUIRED/);
 assert.equal(rows.size,beforeUnfenced);assert.equal(sent.length,sentBeforeUnfenced);
 // A lease or recovery failure blocks enqueue and ALL outbound network I/O.
 const revoked=createOutbox({...options,writerAuthority:async()=>({publishedWriter:true,recoveryVerified:true,writerLeaseHeld:false})});
 await assert.rejects(()=>revoked.enqueue(proof),/OFFICE_BOX_LIVE_WRITER_AUTHORITY_REVOKED/);
 await assert.rejects(()=>revoked.enqueueActiveEntitlement({paidEvent,activationResponse:linked,verifiedAt:'2026-10-27T10:00:00Z'}),/OFFICE_BOX_LIVE_WRITER_AUTHORITY_REVOKED/);
 await assert.rejects(()=>revoked.dispatchOne(),/OFFICE_BOX_LIVE_WRITER_AUTHORITY_REVOKED/);
 assert.equal(sent.length,sentBeforeUnfenced);
 // Even if the writer loses its lease after claiming, it MUST NOT send.
 const raceProof={...proof,order:{...order,id:'sbc_order_400'},paymentRecord:{...paymentRecord,sbcOrderId:'sbc_order_400'}};
 const raced=await outbox.enqueue(raceProof);
 let authorityChecks=0;
 const volatile=createOutbox({...options,writerAuthority:async()=>{
  authorityChecks++;
  return {publishedWriter:true,recoveryVerified:true,writerLeaseHeld:authorityChecks===1};
 }});
 await assert.rejects(()=>volatile.dispatchOne(),/OFFICE_BOX_LIVE_WRITER_AUTHORITY_REVOKED/);
 assert.equal(authorityChecks,2);
 assert.equal(rows.get(raced.eventId).status,'IN_FLIGHT','expired lease reclaims without remote side effect');
 assert.equal(sent.length,sentBeforeUnfenced,'no transport request after losing writer authority');
 const inspectorError=createOutbox({...options,writerAuthority:async()=>{throw Error('database unavailable')}});
 await assert.rejects(()=>inspectorError.dispatchOne(),/OFFICE_BOX_LIVE_WRITER_AUTHORITY_UNAVAILABLE/);
 // A generic HTTP 200 is NOT proof that Office Box accepted the correct event.
 const tamperedProof={...proof,order:{...order,id:'sbc_order_910'},paymentRecord:{...paymentRecord,sbcOrderId:'sbc_order_910'}};
 const forgedAck=createOutbox({...options,transport:async(_url,req)=>{
  assert.equal(req.redirect,'error');
  return {status:200,json:async()=>({ok:true,data:{accepted:true}})};
 }});
 await forgedAck.enqueue(tamperedProof);
 const missingId=await forgedAck.dispatchOne();
 assert.equal(missingId.status,'RETRY_SCHEDULED');
 assert.equal(missingId.reason,'OFFICE_BOX_ACK_MISMATCH');
 rows.get(missingId.eventId).status='DEAD'; // isolate next test event; real DB would retry on its schedule
 const wrongEntitlementProof={...proof,order:{...order,id:'sbc_order_911'},paymentRecord:{...paymentRecord,sbcOrderId:'sbc_order_911'}};
 const newerPaid=buildPaidHandoff(wrongEntitlementProof);
 const newerLinked={ok:true,data:{schema:'sbc.office-box.activation-status.v1',status:'ACTIVATED',
  correlationId:newerPaid.correlationId,tenantId:'tenant_'+('b'.repeat(16)),
  customerId:newerPaid.customerId,orderId:newerPaid.payload.orderId,plan:'business'}};
 const wrongEntitlement=createOutbox({...options,transport:async(_url,req)=>{
  assert.equal(req.redirect,'error');
  return {status:200,json:async()=>({ok:true,accepted:true,status:'PAST_DUE'})};
 }});
 const ent=await wrongEntitlement.enqueueActiveEntitlement({paidEvent:newerPaid,activationResponse:newerLinked,verifiedAt:'2026-10-27T10:00:00Z'});
 assert(ent.created);
 const invalidAck=await wrongEntitlement.dispatchOne();
 assert.equal(invalidAck.status,'RETRY_SCHEDULED');
 assert.equal(invalidAck.reason,'OFFICE_BOX_ACK_MISMATCH');
 console.log('FANTASTIC 4 DURABLE OUTBOX CONTRACT: PASS (writer gate, idempotency, signed delivery, paid-to-active entitlement, lease, retry, wrong ack, dead letter)');
}
main().catch(e=>{console.error(e);process.exitCode=1});
