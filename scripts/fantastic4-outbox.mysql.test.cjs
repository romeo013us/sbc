'use strict';
/** Disposable CI-only real MySQL outbox lifecycle. NEVER point at business DB. */
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const mysql=require('mysql2/promise');
const {createOutbox}=require('../ecosystem/office-box-outbox.cjs');
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
  const common={pool,receiverOrigin:'https://officebox-ci.example.test',secret,transport,enabled:true,publishedWriter:true};
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
  console.log('FANTASTIC 4 REAL MYSQL8 OUTBOX: PASS (DDL, duplicate, ack, retry, expired lease, ACTIVE entitlement)');
 }finally{await pool.end()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
