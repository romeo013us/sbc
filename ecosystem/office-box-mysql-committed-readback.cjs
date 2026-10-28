'use strict';
/**
 * STAGED ONLY: one consistent, read-only MySQL snapshot of SBC's existing
 * relational orders/customers plus the workspace Square-payment records.
 *
 * The V66 compiled runtime stores sbc_orders and sbc_customers relationally,
 * squarePayments in sbc_workspace row 1, and commits all three alongside
 * __sbc_persistence_epoch. None of these records alone proves Square capture.
 *
 * Caller MUST inject a trusted server-side Square GET Payment / refund/dispute
 * check. Never use browser-supplied payment objects or a cached webhook body.
 * No migration, INSERT/UPDATE, external handoff, or startup registration here.
 */
const EPOCH_KEY='__sbc_persistence_epoch';
function id(value){
 return typeof value==='string'&&value.length>=4&&value.length<=120&&
 /^[a-zA-Z0-9_.:-]+$/.test(value);
}
function positiveTenant(value){return Number.isSafeInteger(value)&&value>0}
function objJson(value,code){
 let parsed;
 try{parsed=typeof value==='string'?JSON.parse(value):value}
 catch{throw Error(code)}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error(code);
 return parsed;
}
function money(value){
 const str=String(value);
 if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(str))throw Error('OFFICE_BOX_MYSQL_PRICE_INVALID');
 const [whole,cents='']=str.split('.');
 const amount=Number(whole)*100+Number((cents+'00').slice(0,2));
 if(!Number.isSafeInteger(amount)||amount<=0)throw Error('OFFICE_BOX_MYSQL_PRICE_INVALID');
 return amount;
}
async function fetchOne(cx,sql,args){
 const [rows]=await cx.query(sql,args);
 if(!Array.isArray(rows)||rows.length!==1)throw Error('OFFICE_BOX_MYSQL_ROW_MISSING_OR_DUPLICATE');
 return rows[0];
}
function createCommittedSquareReader({pool,readSquarePayment,writerAuthority,now=Date.now}={}){
 if(!pool||typeof pool.getConnection!=='function'||typeof readSquarePayment!=='function'||
    typeof writerAuthority!=='function'||typeof now!=='function')
  throw Error('OFFICE_BOX_READBACK_TRUSTED_DEPENDENCIES_REQUIRED');
 async function allowed(){
  let state;
  try{state=await writerAuthority()}catch{throw Error('OFFICE_BOX_READBACK_WRITER_UNAVAILABLE')}
  if(state?.publishedWriter!==true||state?.recoveryVerified!==true||
     state?.writerLeaseHeld!==true)
   throw Error('OFFICE_BOX_READBACK_WRITER_REVOKED');
 }
 return async function readCommitted({tenantId,orderId,squarePaymentId}={}){
  if(!positiveTenant(tenantId)||!id(orderId)||!id(squarePaymentId))
   throw Error('OFFICE_BOX_READBACK_SCOPE_REQUIRED');
  await allowed();
  const cx=await pool.getConnection();
  let inReadTransaction=false;
  let verified;
  try{
   // All read queries must share a consistent point-in-time snapshot.
   await cx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
   await cx.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
   inReadTransaction=true;
   const ord=await fetchOne(cx,
    'SELECT id,tenant_id,customer_id,price,notes,status FROM sbc_orders WHERE id=? AND tenant_id=? LIMIT 2',
    [orderId,tenantId]);
   if(Number(ord.tenant_id)!==tenantId||!id(ord.customer_id))
    throw Error('OFFICE_BOX_READBACK_ORDER_TENANT_MISMATCH');
   const customer=await fetchOne(cx,
    'SELECT id,tenant_id,business_name,email,status FROM sbc_customers WHERE id=? AND tenant_id=? LIMIT 2',
    [ord.customer_id,tenantId]);
   if(Number(customer.tenant_id)!==tenantId||customer.status==='Deleted')
    throw Error('OFFICE_BOX_READBACK_CUSTOMER_TENANT_MISMATCH');
   const parsed=objJson(ord.notes,'OFFICE_BOX_READBACK_ORDER_JSON_INVALID');
   // An editable "Paid" label is NOT Square proof: link to actual persisted event.
   if(parsed.squarePaymentId!==squarePaymentId||!id(parsed.squareOrderId)||
      String(parsed.squarePaymentStatus||'').toUpperCase()!=='PAID'||
      !Number.isFinite(Date.parse(parsed.squarePaymentCompletedAt||'')))
    throw Error('OFFICE_BOX_READBACK_CAPTURE_METADATA_REQUIRED');
   const workspace=await fetchOne(cx,
    'SELECT payload FROM sbc_workspace WHERE id=1 LIMIT 2',[]);
   const payload=objJson(workspace.payload,'OFFICE_BOX_READBACK_WORKSPACE_INVALID');
   if(!Array.isArray(payload.squarePayments))
    throw Error('OFFICE_BOX_READBACK_PERSISTED_PAYMENTS_REQUIRED');
   const matches=payload.squarePayments.filter(p=>
    p&&p.squarePaymentId===squarePaymentId&&p.sbcOrderId===orderId&&
    p.squareOrderId===parsed.squareOrderId);
   if(matches.length!==1)
    throw Error('OFFICE_BOX_READBACK_CAPTURE_RECORD_AMBIGUOUS');
   const paymentRecord=matches[0];
   if(String(paymentRecord.status||'').toUpperCase()!=='PAID'||
      (paymentRecord.tenantId!==undefined&&Number(paymentRecord.tenantId)!==tenantId))
    throw Error('OFFICE_BOX_READBACK_CAPTURE_RECORD_UNVERIFIED');
   const epoch=await fetchOne(cx,
    'SELECT setting_value FROM sbc_settings WHERE setting_key=? LIMIT 2',[EPOCH_KEY]);
   const epochValue=String(epoch.setting_value||'');
   if(!/^[1-9]\d{0,14}$/.test(epochValue)||!Number.isSafeInteger(Number(epochValue)))
    throw Error('OFFICE_BOX_READBACK_PERSISTENCE_EPOCH_REQUIRED');
   const amountCents=money(ord.price);
   verified={
    order:{id:ord.id,tenantId,customerId:customer.id,price:amountCents/100,
      paymentStatus:'PAID',notes:ord.notes},
    parsed,
    paymentRecord:{...paymentRecord},customer:{
      id:customer.id,tenantId,businessName:customer.business_name,
      ownerEmail:customer.email},
    amountCents,epoch:Number(epochValue)
   };
   await cx.query('COMMIT');
   inReadTransaction=false;
  }catch(e){
   if(inReadTransaction){try{await cx.query('ROLLBACK')}catch{}}
   throw e;
  }finally{try{cx.release()}catch{}}
  await allowed(); // a writer lease can change while the database was read
  let fromProvider;
  try{
   fromProvider=await readSquarePayment({
    tenantId,orderId,squarePaymentId,expectedAmountCents:verified.amountCents,
    expectedSquareOrderId:verified.parsed.squareOrderId
   });
  }catch{throw Error('OFFICE_BOX_READBACK_SQUARE_PROVIDER_UNAVAILABLE')}
  const timestamp=Date.parse(fromProvider?.verifiedAt||'');
  const current=now();
  if(fromProvider?.source!=='SQUARE_API_READ_ONLY'||
     fromProvider?.refunded!==false||fromProvider?.disputed!==false||
     fromProvider?.cancelled!==false||
     fromProvider?.payment?.id!==squarePaymentId||
     fromProvider?.payment?.order_id!==verified.parsed.squareOrderId||
     fromProvider?.payment?.status!=='COMPLETED'||
     fromProvider?.payment?.amount_money?.currency!=='USD'||
     fromProvider?.payment?.amount_money?.amount!==verified.amountCents||
     !id(fromProvider?.payment?.location_id)||
     !Number.isFinite(timestamp)||timestamp>current+30000||
     current-timestamp>120000)
   throw Error('OFFICE_BOX_READBACK_SQUARE_PROOF_UNVERIFIED');
  await allowed();
  // The provider data is appended ONLY after a consistent, successful MySQL
  // read and fresh direct read-only Square verification, not from browser input.
  return Object.freeze({source:'COMMITTED_MYSQL',commitVerified:true,
   order:verified.order,parsed:verified.parsed,paymentRecord:verified.paymentRecord,
   customer:verified.customer,payment:fromProvider.payment,persistenceEpoch:verified.epoch});
 };
}
module.exports={createCommittedSquareReader,EPOCH_KEY};
