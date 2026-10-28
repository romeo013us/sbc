'use strict';
/** Disposable MySQL8 post-commit readback. No business DB or provider access. */
const assert=require('node:assert/strict');
const mysql=require('mysql2/promise');
const {loadCommittedOfficeBoxPayment}=require('../ecosystem/office-box-committed-readback.cjs');
if(process.env.FANTASTIC4_DISPOSABLE_MYSQL!=='1'||!/_ci$|_test$/.test(process.env.MYSQL_DATABASE||'')){
 console.error('REFUSE_OFFICE_BOX_MYSQL_NON_CI');process.exit(3);
}
(async()=>{
 const pool=mysql.createPool({host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),
  user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,
  database:process.env.MYSQL_DATABASE,connectionLimit:3});
 try{
  // Genuine MySQL transaction and JSON data types, but isolated test-only tables.
  await pool.query(`CREATE TABLE IF NOT EXISTS sbc_orders (
   id VARCHAR(80) PRIMARY KEY,tenant_id BIGINT NOT NULL,
   customer_id VARCHAR(80) NOT NULL,customer_name VARCHAR(255),
   product VARCHAR(255),price DECIMAL(12,2),status VARCHAR(40),notes TEXT
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sbc_customers (
   id VARCHAR(80) PRIMARY KEY,tenant_id BIGINT NOT NULL,
   business_name VARCHAR(255),contact_name VARCHAR(255),
   email VARCHAR(254),industry VARCHAR(120)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sbc_workspace (
   id BIGINT PRIMARY KEY,payload JSON NOT NULL
  ) ENGINE=InnoDB`);
  const orderId='sbc_order_disposable_readback';
  const custId='sbc_customer_disposable_readback';
  const payId='square_payment_disposable_readback';
  const sqOrder='square_order_disposable_readback';
  const email='owner@example.invalid';
  const notes={squareOrderId:sqOrder,squarePaymentId:payId,
   squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-10-28T15:00:00Z',
   customerEmail:email,officeBoxSku:'OFFICE_BOX_BUSINESS',
   items:[{sku:'OFFICE_BOX_BUSINESS',quantity:1}]};
  await pool.execute('INSERT INTO sbc_customers(id,tenant_id,business_name,contact_name,email,industry) VALUES (?,?,?,?,?,?)',
   [custId,7,'CI Fictional Company','CI Owner',email,'Services']);
  await pool.execute('INSERT INTO sbc_orders(id,tenant_id,customer_id,customer_name,product,price,status,notes) VALUES (?,?,?,?,?,?,?,?)',
   [orderId,7,custId,'CI Fictional Company','Office Box',349,'Paid',JSON.stringify(notes)]);
  const payments=[{sbcOrderId:orderId,squareOrderId:sqOrder,squarePaymentId:payId,
   amount:349,currency:'USD',status:'PAID'}];
  await pool.execute('INSERT INTO sbc_workspace(id,payload) VALUES (1,?)',[JSON.stringify({squarePayments:payments})]);
  const payment={id:payId,order_id:sqOrder,status:'COMPLETED',location_id:'ci_location',
   amount_money:{amount:34900,currency:'USD'}};
  const req={pool,tenantId:7,orderId,payment,expectedLocation:'ci_location'};
  let proof=await loadCommittedOfficeBoxPayment(req);
  assert.equal(proof.source,'READ_ONLY_COMMITTED_MYSQL');
  assert.equal(proof.event.payload.plan,'business');
  assert.equal(proof.event.payload.ownerEmail,email);
  assert.equal(proof.event.payload.paymentReference,payId);
  const [[orderBefore]]=await pool.query('SELECT status,notes FROM sbc_orders WHERE id=?',[orderId]);
  // A caller-provided in-memory flag cannot replace database evidence.
  await assert.rejects(()=>loadCommittedOfficeBoxPayment({...req,tenantId:8}),/OFFICE_BOX_COMMITTED_ORDER_MISSING/);
  await assert.rejects(()=>loadCommittedOfficeBoxPayment({...req,payment:{...payment,id:'wrong'}}),
   /OFFICE_BOX_COMMITTED_CAPTURE_AMBIGUOUS_OR_MISSING/);
  await assert.rejects(()=>loadCommittedOfficeBoxPayment({...req,payment:{...payment,location_id:'other'}}),
   /SQUARE_LOCATION_MISMATCH|OFFICE_BOX_VERIFIED_CAPTURE_REQUIRED/);
  await pool.execute('UPDATE sbc_orders SET status=? WHERE id=?',['Pending',orderId]);
  await assert.rejects(()=>loadCommittedOfficeBoxPayment(req),/OFFICE_BOX_COMMITTED_ORDER_NOT_PAID/);
  await pool.execute('UPDATE sbc_orders SET status=? WHERE id=?',['Paid',orderId]);
  await pool.execute('UPDATE sbc_customers SET email=? WHERE id=?',['attacker@example.invalid',custId]);
  await assert.rejects(()=>loadCommittedOfficeBoxPayment(req),/OFFICE_BOX_ORDER_BILLING_EMAIL_MISMATCH/);
  await pool.execute('UPDATE sbc_customers SET email=? WHERE id=?',[email,custId]);
  await pool.execute('UPDATE sbc_workspace SET payload=? WHERE id=1',[JSON.stringify({squarePayments:[]})]);
  await assert.rejects(()=>loadCommittedOfficeBoxPayment(req),/OFFICE_BOX_COMMITTED_CAPTURE_AMBIGUOUS_OR_MISSING/);
  await pool.execute('UPDATE sbc_workspace SET payload=? WHERE id=1',[JSON.stringify({squarePayments:payments})]);
  proof=await loadCommittedOfficeBoxPayment(req);
  assert.equal(proof.event.payload.orderId,orderId);
  const [[after]]=await pool.query('SELECT status,notes FROM sbc_orders WHERE id=?',[orderId]);
  assert.deepEqual(after,orderBefore,'read-only proof never changes persisted order');
  console.log('[SBC COMMITTED OFFICE BOX MYSQL8] PASS: settled capture, tenant, email, plan, mismatch, no writes');
 }finally{await pool.end()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
