'use strict';
/**
 * Read-only, post-commit MySQL proof for a paid Office Box checkout.
 *
 * Never accepts a client-supplied "committed" flag or an in-memory db snapshot.
 * Does not send email, enqueue, grant an entitlement, alter tables or mutate
 * customer data. The caller must additionally hold the live Published writer
 * lease before any future outbox enqueue; this module is NOT a scheduler.
 */
const {buildPaidHandoff}=require('../enterprise/office-box-paid-handoff.cjs');
const SUPPORTED_PLANS=new Set(['starter','business','professional','team']);
function reject(code){throw Object.assign(new Error(code),{code})}
function text(v){return typeof v==='string'?v.trim():''}
function parseJson(value,code){
 if(value&&typeof value==='object'&&!Buffer.isBuffer(value))return value;
 try{return JSON.parse(Buffer.isBuffer(value)?value.toString('utf8'):String(value||''))}
 catch{reject(code)}
}
function exactMoney(v){const amount=Number(v);return Number.isFinite(amount)&&amount>0&&Math.round(amount*100)===amount*100?amount:null}
function purchasedOfficeBoxSku(notes){
 const items=notes?.items;
 if(!Array.isArray(items)||items.length===0||items.length>100)reject('OFFICE_BOX_TRUSTED_LINE_ITEMS_REQUIRED');
 const matches=items.map(item=>text(item?.sku)).filter(x=>/^OFFICE_BOX_(STARTER|BUSINESS|PROFESSIONAL|TEAM)$/.test(x));
 if(matches.length!==1)reject('OFFICE_BOX_EXACTLY_ONE_PURCHASED_SKU_REQUIRED');
 const sku=matches[0],plan=sku.substring('OFFICE_BOX_'.length).toLowerCase();
 if(!SUPPORTED_PLANS.has(plan)||notes.officeBoxSku&&text(notes.officeBoxSku)!==sku)
  reject('OFFICE_BOX_SKU_CONFLICT');
 return {sku,plan};
}
async function loadCommittedOfficeBoxPayment({pool,orderId,tenantId,payment,expectedLocation}={}){
 if(!pool||typeof pool.getConnection!=='function')reject('OFFICE_BOX_MYSQL_REQUIRED');
 if(!text(orderId)||text(orderId).length>120||!Number.isSafeInteger(tenantId)||tenantId<=0)
  reject('OFFICE_BOX_TRUSTED_ORDER_TENANT_REQUIRED');
 if(!payment||typeof payment!=='object'||!text(expectedLocation))
  reject('OFFICE_BOX_PROVIDER_CAPTURE_REQUIRED');
 const cx=await pool.getConnection();
 if(!cx||typeof cx.query!=='function'||typeof cx.rollback!=='function'||typeof cx.release!=='function'){
  try{cx?.release?.()}catch{}reject('OFFICE_BOX_MYSQL_CONNECTION_INVALID');
 }
 try{
  // READ ONLY transaction makes any accidental future SQL mutation fail.
  // A fresh snapshot sees only data committed before this proof starts.
  await cx.query('START TRANSACTION READ ONLY');
  const [orders]=await cx.query(
   'SELECT id,tenant_id,customer_id,customer_name,product,price,status,notes FROM sbc_orders WHERE id=? AND tenant_id=? LIMIT 1',
   [text(orderId),tenantId]);
  if(!Array.isArray(orders)||orders.length!==1)reject('OFFICE_BOX_COMMITTED_ORDER_MISSING');
  const row=orders[0];
  if(String(row.tenant_id)!==String(tenantId)||text(row.id)!==text(orderId)||
     text(row.status).toUpperCase()!=='PAID')reject('OFFICE_BOX_COMMITTED_ORDER_NOT_PAID');
  const parsed=parseJson(row.notes,'OFFICE_BOX_COMMITTED_ORDER_NOTES_INVALID');
  const {sku,plan}=purchasedOfficeBoxSku(parsed);
  const price=exactMoney(row.price);
  if(price===null)reject('OFFICE_BOX_COMMITTED_ORDER_AMOUNT_INVALID');
  const [customers]=await cx.query(
   'SELECT id,tenant_id,business_name,contact_name,email,industry FROM sbc_customers WHERE id=? AND tenant_id=? LIMIT 1',
   [text(row.customer_id),tenantId]);
  if(!Array.isArray(customers)||customers.length!==1)reject('OFFICE_BOX_COMMITTED_CUSTOMER_MISSING');
  const customer=customers[0];
  if(String(customer.tenant_id)!==String(tenantId)||text(customer.id)!==text(row.customer_id))
   reject('OFFICE_BOX_COMMITTED_CUSTOMER_TENANT_MISMATCH');
  const email=text(customer.email).toLowerCase();
  // Binding the billing email to the paid order prevents a later CRM email
  // edit from silently redirecting a pending Office Box invitation.
  const orderEmail=text(parsed.customerEmail||parsed.billingEmail).toLowerCase();
  if(!orderEmail||!email||email!==orderEmail)reject('OFFICE_BOX_ORDER_BILLING_EMAIL_MISMATCH');
  const [workspace]=await cx.query('SELECT payload FROM sbc_workspace WHERE id=1 LIMIT 1');
  if(!Array.isArray(workspace)||workspace.length!==1)reject('OFFICE_BOX_COMMITTED_WORKSPACE_MISSING');
  const extra=parseJson(workspace[0].payload,'OFFICE_BOX_COMMITTED_WORKSPACE_INVALID');
  if(!Array.isArray(extra.squarePayments))reject('OFFICE_BOX_COMMITTED_CAPTURE_LIST_MISSING');
  const matching=extra.squarePayments.filter(rec=>
   text(rec?.sbcOrderId)===text(row.id)&&
   text(rec?.squarePaymentId)===text(payment.id)&&
   text(rec?.squareOrderId)===text(payment.order_id));
  if(matching.length!==1)reject('OFFICE_BOX_COMMITTED_CAPTURE_AMBIGUOUS_OR_MISSING');
  const rec=matching[0];
  if(String(rec.status||'').toUpperCase()!=='PAID'||
     exactMoney(rec.amount)!==price||
     text(rec.currency).toUpperCase()!=='USD'||
     !parsed.squarePaymentCompletedAt)
    reject('OFFICE_BOX_COMMITTED_CAPTURE_MISMATCH');
  // Compose the existing strict V2 handoff only from relational rows,
  // the committed workspace capture and the configured Square location.
  const order={id:text(row.id),customerId:text(row.customer_id),customerEmail:orderEmail,
   officeBoxSku:sku,paymentStatus:'PAID',price};
  const paymentRecord={...rec,status:'PAID'};
  const verified={order,parsed,payment,paymentRecord,expectedLocation,
   customer:{id:text(customer.id),businessName:text(customer.business_name),
    ownerEmail:email,industry:text(customer.industry)||'General Business'},plan};
  const event=buildPaidHandoff(verified);
  return {verified,event,orderId:order.id,tenantId,sku,plan,
   paymentId:text(payment.id),source:'READ_ONLY_COMMITTED_MYSQL'};
 } finally{
  // READ ONLY proof never commits; transaction ends without changing rows.
  try{await cx.rollback()}finally{cx.release()}
 }
}
module.exports={loadCommittedOfficeBoxPayment,purchasedOfficeBoxSku};
