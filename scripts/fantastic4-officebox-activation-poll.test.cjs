'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {reconcileActivatedOfficeBox:reconcile,requireOrigin}=require('../ecosystem/office-box-activation-reconciliation.cjs');
const {makeActiveEntitlement}=require('../ecosystem/office-box-activation-client.cjs');
(async()=>{
 const tenantId=7,paidEventId='officebox_'+('a'.repeat(40));
 const paidEvent={eventType:'customer.subscription.paid',correlationId:paidEventId,
  customerId:'cust_office_101',payload:{orderId:'sbc_order_101',paymentReference:'sq_payment_101',
    paymentStatus:'PAID',plan:'business',businessName:'Example Fixture',ownerEmail:'owner@example.invalid'}};
 const record={source:'COMMITTED_MYSQL',commitVerified:true,status:'DELIVERED',
  tenantId,eventId:paidEventId,eventType:'customer.subscription.paid',
  paidEvent,expectedAmountCents:34900,currency:'USD',customerId:paidEvent.customerId,
  orderId:paidEvent.payload.orderId,paymentReference:paidEvent.payload.paymentReference};
 const verifiedAt=new Date(Date.now()-60000).toISOString();
 const proof={source:'PAYMENT_PROVIDER_READ_ONLY',settled:true,refunded:false,disputed:false,
  tenantId,customerId:paidEvent.customerId,orderId:paidEvent.payload.orderId,
  paymentReference:paidEvent.payload.paymentReference,currency:'USD',amountCents:34900,verifiedAt};
 const activated={ok:true,data:{schema:'sbc.office-box.activation-status.v1',status:'ACTIVATED',
  correlationId:paidEventId,tenantId:'tenant_'+('d'.repeat(16)),
  customerId:paidEvent.customerId,orderId:paidEvent.payload.orderId,plan:'business'}};
 const pending={ok:true,data:{schema:'sbc.office-box.activation-status.v1',
  status:'INVITATION_PENDING',correlationId:paidEventId}};
 const secret='example-offbox-private-hmac-signing-key-64-long';
 let response=activated,read=0,provider=0,http=0,writes=0, checks=0;
 const ids=new Set();
 const options=()=>({
  tenantId,paidEventId,receiverOrigin:'https://officebox-ci.example.test',secret,
  writerAuthority:async()=>{checks++;return {publishedWriter:true,recoveryVerified:true,writerLeaseHeld:true}},
  readDeliveredPaidEvent:async identity=>{read++;assert.deepEqual(identity,{tenantId,paidEventId});return record},
  verifyLiveSettlement:async identity=>{provider++;
   assert.deepEqual(identity,{tenantId,customerId:paidEvent.customerId,orderId:paidEvent.payload.orderId,
    paymentReference:paidEvent.payload.paymentReference,expectedAmountCents:34900,currency:'USD'});
   return proof;
  },
  transport:async(url,args)=>{
   http++;
   assert.equal(url,'https://officebox-ci.example.test/api/sbc/activation-status');
   assert.equal(args.method,'POST');
   assert.equal(args.redirect,'error');
   assert.equal(args.cache,'no-store');
   const body=JSON.parse(args.body);
   assert.equal(body.correlationId,paidEventId);
   assert.equal(body.customerId,paidEvent.customerId);
   assert.equal(body.orderId,paidEvent.payload.orderId);
   assert.equal(body.plan,'business');
   const h=crypto.createHmac('sha256',secret).update(args.headers['x-sbc-timestamp']+'.'+args.body).digest('hex');
   assert.equal(args.headers['x-sbc-signature-v2'],'sha256='+h);
   return {status:200,json:async()=>response};
  },
  outbox:{enqueueActiveEntitlement:async x=>{
   writes++;
   const event=makeActiveEntitlement(x);
   const created=!ids.has(event.eventId);
   ids.add(event.eventId);
   return {eventId:event.eventId,created};
  }},
  now:()=>Date.now()
 });
 for(const origin of ['http://public.example.test','https://127.0.0.1','https://192.168.1.5',
  'https://[::1]','https://foo.internal','https://foo.local','https://foo.lan',
  'https://user:password@public.example.test','https://public.example.test/redirect']){
  assert.throws(()=>requireOrigin(origin),/OFFICE_BOX_/);
 }
 assert.equal(requireOrigin('https://officebox-ci.example.test'),'https://officebox-ci.example.test');
 await assert.rejects(()=>reconcile({...options(),writerAuthority:null}),/ACTIVATION_LIVE_AUTHORITY_REQUIRED/);
 assert.equal(read,0);assert.equal(http,0);assert.equal(provider,0);
 await assert.rejects(()=>reconcile({...options(),writerAuthority:async()=>({publishedWriter:true,recoveryVerified:false,writerLeaseHeld:true})}),/ACTIVATION_WRITER_NOT_AUTHORIZED/);
 await assert.rejects(()=>reconcile({...options(),writerAuthority:async()=>{throw Error('pool lost')}}),/ACTIVATION_AUTHORITY_UNAVAILABLE/);
 assert.equal(read,0);assert.equal(http,0);
 for(const change of [
  {source:'UNTRUSTED_BROWSER'}, {commitVerified:false},{status:'PENDING'}, {tenantId:8},
  {eventId:'officebox_'+('b'.repeat(40))},{customerId:'different_customer'},
  {orderId:'different_order'},{paymentReference:'different_receipt'},
  {expectedAmountCents:0},{currency:'EUR'}, {paidEvent:{...paidEvent,customerId:'different_customer'}}
 ]){
  await assert.rejects(()=>reconcile({...options(),readDeliveredPaidEvent:async()=>({...record,...change})}),/OFFICE_BOX_/);
 }
 assert.equal(http,0);assert.equal(writes,0);
 response=pending;
 const pendingResult=await reconcile(options());
 assert.equal(pendingResult.status,'INVITATION_PENDING');
 assert.equal(pendingResult.enqueued,false);
 assert.equal(provider,0);assert.equal(writes,0);
 response=activated;
 const first=await reconcile(options());
 assert.equal(first.status,'ACTIVE_QUEUED');
 assert.equal(first.externalSent,false);
 assert.equal(first.activatedRemotely,false);
 assert(/^sbc_evt_[a-f0-9]{40}$/.test(first.eventId));
 const second=await reconcile(options());
 assert.equal(second.status,'ACTIVE_ALREADY_QUEUED');
 assert.equal(first.eventId,second.eventId);
 assert.equal(ids.size,1);
 assert.equal(provider,2);
 for(const change of [
  {settled:false},{refunded:true},{disputed:true},{currency:'EUR'},
  {amountCents:34899},{tenantId:77},{customerId:'different_customer'},
  {orderId:'wrong_order'},{paymentReference:'wrong_square_payment'},
  {verifiedAt:new Date(Date.now()-11*60*1000).toISOString()},
  {verifiedAt:new Date(Date.now()+60000).toISOString()},
  {source:'CACHE_ONLY'}
 ]){
  const before=writes;
  await assert.rejects(()=>reconcile({...options(),verifyLiveSettlement:async()=>({...proof,...change})}),/FRESH_UNREFUNDED_PAYMENT_PROOF_REQUIRED/);
  assert.equal(writes,before,'unverified payment must never queue ACTIVE');
 }
 for(const change of [
  {...activated,data:{...activated.data,customerId:'wrong_customer'}},
  {...activated,data:{...activated.data,orderId:'wrong_order'}},
  {...activated,data:{...activated.data,tenantId:'tenant_'+('x'.repeat(16))}},
  {...activated,data:{...activated.data,plan:'professional'}},
  {...activated,data:{...activated.data,correlationId:'officebox_'+('b'.repeat(40))}},
  {ok:false,data:activated.data}
 ]){
  const before=writes;
  await assert.rejects(()=>reconcile({...options(),transport:async()=>({status:200,json:async()=>change})}),/OFFICE_BOX_/);
  assert.equal(writes,before);
 }
 await assert.rejects(()=>reconcile({...options(),transport:async()=>({status:302,json:async()=>activated})}),/LOOKUP_REJECTED/);
 await assert.rejects(()=>reconcile({...options(),transport:async()=>{throw Error('network down')}}),/LOOKUP_UNAVAILABLE/);
 await assert.rejects(()=>reconcile({...options(),transport:async()=>({status:200,json:async()=>{throw Error('bad body')}})}),/RESPONSE_INVALID/);
 const providerBefore=provider;
 let turn=0;
 await assert.rejects(()=>reconcile({...options(),writerAuthority:async()=>{
  turn++;return {publishedWriter:true,recoveryVerified:true,writerLeaseHeld:turn===1};
 }}),/WRITER_NOT_AUTHORIZED/);
 assert.equal(turn,2);assert.equal(provider,providerBefore);
 turn=0;
 const beforeFinal=writes;
 await assert.rejects(()=>reconcile({...options(),writerAuthority:async()=>{
  turn++;return {publishedWriter:true,recoveryVerified:true,writerLeaseHeld:turn!==4};
 }}),/WRITER_NOT_AUTHORIZED/);
 assert.equal(turn,4);assert.equal(writes,beforeFinal);
 await assert.rejects(()=>reconcile({...options(),outbox:{enqueueActiveEntitlement:async()=>({created:true,eventId:'wrong'})}}),/OUTBOX_ACK_MISMATCH/);
 assert.equal(ids.size,1);
 console.log('OFFICE BOX ACTIVATION POLL PASS: delivered DB proof, signed lookup, pending, fresh unrefunded provider check, strict identity, revoked writer fence and idempotent ACTIVE queue');
})().catch(e=>{console.error(e);process.exitCode=1});
