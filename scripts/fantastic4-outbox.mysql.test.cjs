'use strict';
/** Disposable CI-only real MySQL outbox lifecycle. NEVER point at business DB. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const mysql=require('mysql2/promise');
const {createOutbox}=require('../ecosystem/office-box-outbox.cjs');
const {reconcileActivatedOfficeBox}=require('../ecosystem/office-box-activation-reconciliation.cjs');
if(process.env.FANTASTIC4_DISPOSABLE_MYSQL!=='1'||!/_ci$|_test$/.test(process.env.MYSQL_DATABASE||'')){
 console.error('FANTASTIC4 DISPOSABLE MYSQL ONLY: refusing non-CI database');process.exit(3);
}
const proof=id=>{
 const order={id:'sbc_order_'+id,price:349,paymentStatus:'PAID',officeBoxSku:'OFFICE_BOX_BUSINESS',customerId:'sbc_customer_200',customerEmail:'owner@fixture.invalid'};
 return {order,payment:{id:'square_payment_'+id,order_id:'square_order_'+id,location_id:'square_location_100',status:'COMPLETED',
    amount_money:{amount:34900,currency:'USD'}},parsed:{squareOrderId:'square_order_'+id,squarePaymentId:'square_payment_'+id,
    squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-27T10:00:00.000Z'},
   paymentRecord:{sbcOrderId:order.id,squareOrderId:'square_order_'+id,squarePaymentId:'square_payment_'+id,status:'PAID'},
   customer:{id:'sbc_customer_200',businessName:'Disposable CI Business',ownerEmail:'owner@fixture.invalid'},
   expectedLocation:'square_location_100',plan:'business'};
};
async function main(){
 const pool=mysql.createPool({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),
  user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,
  waitForConnections:true,connectionLimit:4});
 try{
  const ddl=fs.readFileSync(path.join(__dirname,'../migrations/20261027_002_fantastic4_officebox_outbox.sql'),'utf8');
  await pool.query(ddl);
  const suffix=crypto.randomBytes(5).toString('hex'),secret='disposable-officebox-bridge-key-long-enough-2026';
  let rejectOnce=false;
  const transport=async(url,opt)=>{
   const event=JSON.parse(opt.body);
   assert(url.startsWith('https://officebox-ci.example.test/api/sbc/'));
   if(rejectOnce){rejectOnce=false;return {status:503,json:async()=>({ok:false})}}
   return {status:200,json:async()=>url.endsWith('/api/sbc/handoff')
     ?{ok:true,data:{accepted:true,correlationId:event.correlationId}}
     :{ok:true,accepted:true,status:'ACTIVE'}};
  };
  let writerLeaseHeld=true;
  const writerAuthority=async()=>({publishedWriter:true,recoveryVerified:true,writerLeaseHeld});
  const common={pool,receiverOrigin:'https://officebox-ci.example.test',secret,transport,enabled:true,publishedWriter:true,writerAuthority};
  const worker=createOutbox(common);
  const a=await worker.enqueue(proof('aa'+suffix));
  assert(a.created);
  assert(!(await worker.enqueue(proof('aa'+suffix))).created,'dedupe must persist in real MySQL');
  assert.equal((await worker.dispatchOne()).status,'DELIVERED');
  const [[row]]=await pool.query('SELECT status,attempts FROM sbc_office_box_outbox WHERE event_id=?',[a.eventId]);
  assert.equal(row.status,'DELIVERED');assert.equal(row.attempts,1);
  const b=await worker.enqueue(proof('bb'+suffix));
  rejectOnce=true;
  assert.equal((await worker.dispatchOne()).status,'RETRY_SCHEDULED');
  await pool.execute('UPDATE sbc_office_box_outbox SET next_attempt_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE event_id=?',[b.eventId]);
  assert.equal((await worker.dispatchOne()).status,'DELIVERED');
  const [[brow]]=await pool.query('SELECT status,attempts FROM sbc_office_box_outbox WHERE event_id=?',[b.eventId]);
  assert.equal(brow.status,'DELIVERED');assert.equal(brow.attempts,2);
  const c=await worker.enqueue(proof('cc'+suffix));
  await pool.execute('UPDATE sbc_office_box_outbox SET status=\'IN_FLIGHT\',attempts=attempts+1,lease_until=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND),lease_owner=? WHERE event_id=?',
   ['simulated_dead_worker',c.eventId]);
  assert.equal((await worker.dispatchOne()).status,'DELIVERED','Expired lease must recover after process death');
  const [[crow]]=await pool.query('SELECT attempts,status FROM sbc_office_box_outbox WHERE event_id=?',[c.eventId]);
  assert.equal(crow.status,'DELIVERED');assert.equal(crow.attempts,2);
  const [[saved]]=await pool.query('SELECT payload_json FROM sbc_office_box_outbox WHERE event_id=?',[a.eventId]);
  const paidEvent=typeof saved.payload_json==='string'?JSON.parse(saved.payload_json):saved.payload_json;
  const tenantId='tenant_'+('c'.repeat(16));
  const linked={ok:true,data:{schema:'sbc.office-box.activation-status.v1',status:'ACTIVATED',correlationId:paidEvent.correlationId,
   tenantId,customerId:paidEvent.customerId,orderId:paidEvent.payload.orderId,plan:'business'}};
  const active=await worker.enqueueActiveEntitlement({paidEvent,activationResponse:linked,verifiedAt:'2026-10-27T10:00:00Z'});
  assert(active.created);
  assert(!(await worker.enqueueActiveEntitlement({paidEvent,activationResponse:linked,verifiedAt:'2026-10-27T10:00:00Z'})).created);
  assert.equal((await worker.dispatchOne()).status,'DELIVERED');
  const [[activeRow]]=await pool.query('SELECT status,event_type FROM sbc_office_box_outbox WHERE event_id=?',[active.eventId]);
  assert.equal(activeRow.status,'DELIVERED');
  assert.equal(activeRow.event_type,'sbc.office-box.entitlement.v1');
  assert.equal((await worker.dispatchOne()).status,'EMPTY');
  // No production DB; explicit live lease revocation on disposable MySQL 8.
  writerLeaseHeld=false;
  const beforeRevoked=await pool.query('SELECT COUNT(*) AS n FROM sbc_office_box_outbox');
  await assert.rejects(()=>worker.enqueue(proof('revoked'+suffix)),/OFFICE_BOX_LIVE_WRITER_AUTHORITY_REVOKED/);
  await assert.rejects(()=>worker.dispatchOne(),/OFFICE_BOX_LIVE_WRITER_AUTHORITY_REVOKED/);
  const afterRevoked=await pool.query('SELECT COUNT(*) AS n FROM sbc_office_box_outbox');
  assert.equal(afterRevoked[0][0].n,beforeRevoked[0][0].n,'fenced attempt must not write outbox rows');
  writerLeaseHeld=true;
  const race=await worker.enqueue(proof('lease_race'+suffix));
  let checks=0, networkCount=0;
  const racedWorker=createOutbox({...common,writerAuthority:async()=>{
    checks++;return {publishedWriter:true,recoveryVerified:true,writerLeaseHeld:checks===1};
  },transport:async()=>{networkCount++;throw Error('network must not be called')}});
  await assert.rejects(()=>racedWorker.dispatchOne(),/OFFICE_BOX_LIVE_WRITER_AUTHORITY_REVOKED/);
  assert.equal(checks,2);assert.equal(networkCount,0);
  const [[fencedRow]]=await pool.query('SELECT status,attempts FROM sbc_office_box_outbox WHERE event_id=?',[race.eventId]);
  assert.equal(fencedRow.status,'IN_FLIGHT');assert.equal(fencedRow.attempts,1);
  await pool.execute('UPDATE sbc_office_box_outbox SET lease_until=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE event_id=?',[race.eventId]);
  assert.equal((await worker.dispatchOne()).status,'DELIVERED','authorized writer safely reclaims expired lease');
  // Real MySQL delivery receipt -> signed read-only activation status ->
  // fresh verified provider proof -> idempotent ACTIVE queue. Never live data.
  const activation=await worker.enqueue(proof('activate'+suffix));
  assert.equal((await worker.dispatchOne()).status,'DELIVERED');
  let lookupResult=null,providerLookups=0,activationLookups=0;
  const activationRecord=await pool.execute(
   'SELECT status,event_type,payload_json FROM sbc_office_box_outbox WHERE event_id=?',[activation.eventId]);
  const stored=activationRecord[0][0];
  assert.equal(stored.status,'DELIVERED');
  const event=typeof stored.payload_json==='string'?JSON.parse(stored.payload_json):stored.payload_json;
  const remote={ok:true,data:{schema:'sbc.office-box.activation-status.v1',status:'ACTIVATED',
   correlationId:event.correlationId,tenantId:'tenant_'+('d'.repeat(16)),
   customerId:event.customerId,orderId:event.payload.orderId,plan:event.payload.plan}};
  const activateOpts={
   tenantId:7,paidEventId:activation.eventId,receiverOrigin:'https://officebox-ci.example.test',secret,
   writerAuthority,
   readDeliveredPaidEvent:async()=>{
    const [[saved]]=await pool.query('SELECT status,event_type,payload_json FROM sbc_office_box_outbox WHERE event_id=?',[activation.eventId]);
    return {source:'COMMITTED_MYSQL',commitVerified:true,tenantId:7,eventId:activation.eventId,
     status:saved.status,eventType:saved.event_type,
     paidEvent:typeof saved.payload_json==='string'?JSON.parse(saved.payload_json):saved.payload_json,
     expectedAmountCents:34900,currency:'USD',customerId:event.customerId,
     orderId:event.payload.orderId,paymentReference:event.payload.paymentReference};
   },
   verifyLiveSettlement:async()=>{
    providerLookups++;
    return {source:'PAYMENT_PROVIDER_READ_ONLY',settled:true,refunded:false,disputed:false,
     tenantId:7,customerId:event.customerId,orderId:event.payload.orderId,
     paymentReference:event.payload.paymentReference,currency:'USD',amountCents:34900,
     verifiedAt:new Date(Date.now()-1000).toISOString()};
   },
   transport:async(_url,_request)=>{
    activationLookups++;
    assert(_url.endsWith('/api/sbc/activation-status'));
    assert.equal(_request.redirect,'error');
    return {status:200,json:async()=>lookupResult};
   },
   outbox:worker,
  };
  lookupResult={ok:true,data:{schema:'sbc.office-box.activation-status.v1',status:'INVITATION_PENDING',correlationId:event.correlationId}};
  const pending=await reconcileActivatedOfficeBox(activateOpts);
  assert.equal(pending.status,'INVITATION_PENDING');assert.equal(providerLookups,0);
  lookupResult=remote;
  const activeOne=await reconcileActivatedOfficeBox(activateOpts);
  assert.equal(activeOne.status,'ACTIVE_QUEUED');
  const activeReplay=await reconcileActivatedOfficeBox(activateOpts);
  assert.equal(activeReplay.status,'ACTIVE_ALREADY_QUEUED');
  assert.equal(activeOne.eventId,activeReplay.eventId);
  const [[activeQueued]]=await pool.query('SELECT status,event_type FROM sbc_office_box_outbox WHERE event_id=?',[activeOne.eventId]);
  assert.equal(activeQueued.status,'PENDING');
  assert.equal(activeQueued.event_type,'sbc.office-box.entitlement.v1');
  assert.equal((await worker.dispatchOne()).status,'DELIVERED');
  // Refund or writer lease revocation must never enqueue a new entitlement.
  const invalid=await worker.enqueue(proof('refund'+suffix));
  assert.equal((await worker.dispatchOne()).status,'DELIVERED');
  const refundedEventId=invalid.eventId;
  const [[refundedRow]]=await pool.query('SELECT payload_json FROM sbc_office_box_outbox WHERE event_id=?',[refundedEventId]);
  const refundEvent=typeof refundedRow.payload_json==='string'?JSON.parse(refundedRow.payload_json):refundedRow.payload_json;
  const forbidden={...activateOpts,paidEventId:refundedEventId,
   readDeliveredPaidEvent:async()=>({source:'COMMITTED_MYSQL',commitVerified:true,
    tenantId:7,eventId:refundedEventId,status:'DELIVERED',eventType:'customer.subscription.paid',
    paidEvent:refundEvent,expectedAmountCents:34900,currency:'USD',
    customerId:refundEvent.customerId,orderId:refundEvent.payload.orderId,
    paymentReference:refundEvent.payload.paymentReference}),
   transport:async()=>({status:200,json:async()=>({
    ...remote,data:{...remote.data,correlationId:refundedEventId,orderId:refundEvent.payload.orderId}
   })}),
   verifyLiveSettlement:async()=>({source:'PAYMENT_PROVIDER_READ_ONLY',settled:true,refunded:true,disputed:false,
    tenantId:7,customerId:refundEvent.customerId,orderId:refundEvent.payload.orderId,
    paymentReference:refundEvent.payload.paymentReference,currency:'USD',amountCents:34900,
    verifiedAt:new Date().toISOString()}),
  };
  const [[beforeRefund]]=await pool.query('SELECT COUNT(*) AS n FROM sbc_office_box_outbox');
  await assert.rejects(()=>reconcileActivatedOfficeBox(forbidden),/FRESH_UNREFUNDED_PAYMENT_PROOF_REQUIRED/);
  const [[afterRefund]]=await pool.query('SELECT COUNT(*) AS n FROM sbc_office_box_outbox');
  assert.equal(afterRefund.n,beforeRefund.n);
  writerLeaseHeld=false;
  await assert.rejects(()=>reconcileActivatedOfficeBox(activateOpts),/ACTIVATION_WRITER_NOT_AUTHORIZED/);
  writerLeaseHeld=true;
  assert.equal(providerLookups,2);
  assert.equal(activationLookups,3);

  console.log('FANTASTIC 4 REAL MYSQL8 OUTBOX: PASS (DDL, duplicate, ack, retry, expired lease, ACTIVE entitlement)');
 }finally{await pool.end()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
