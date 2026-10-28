'use strict';
/**
 * P0 trusted Square-into-Office-Box adapter.
 * Invoked ONLY by the Published single writer AFTER the verified Square order,
 * payment record and parsed order metadata are saved successfully to MySQL.
 * Never reads a browser event, dispatches HTTP, modifies a payment or grants access.
 * This is a staged adapter, not a runtime event-listener registration.
 */
const {buildPaidHandoff}=require('../enterprise/office-box-paid-handoff.cjs');
const ALLOWED=new Set(['starter','business','professional','team']);
function nonempty(value){return typeof value==='string'&&value.trim().length>0?value.trim():''}
function purchasedPlan(items){
  if(!Array.isArray(items)||!items.length)throw Error('OFFICE_BOX_PURCHASED_LINE_ITEMS_REQUIRED');
  const matching=items.filter(x=>x&&typeof x==='object'&&/^OFFICE_BOX_[A-Z]+$/.test(nonempty(x.sku)));
  if(matching.length!==1)throw Error('OFFICE_BOX_SINGLE_EXPLICIT_SKU_REQUIRED');
  const line=matching[0],sku=nonempty(line.sku);
  const plan=sku.slice('OFFICE_BOX_'.length).toLowerCase();
  if(!ALLOWED.has(plan)||Number(line.quantity)!==1)throw Error('OFFICE_BOX_APPROVED_ONE_SEAT_PLAN_REQUIRED');
  return {sku,plan};
}
function tenantIdOf(record){
 const n=Number(record?.tenantId);
 return Number.isSafeInteger(n)&&n>0?n:null;
}
async function enqueueCommittedOfficeBoxCapture({
  tenantId,orderId,squarePaymentId,expectedLocation,readCommitted,outbox,
  publishedWriter=false,recoveryVerified=false,writerLeaseHeld=false
}={}){
 if(!publishedWriter||!recoveryVerified||!writerLeaseHeld)
   throw Error('OFFICE_BOX_PUBLISHED_COMMITTED_WRITER_REQUIRED');
 const tenant=tenantIdOf({tenantId}),oid=nonempty(orderId),pid=nonempty(squarePaymentId);
 if(!tenant||!oid||!pid||!nonempty(expectedLocation)||
    typeof readCommitted!=='function'||!outbox||typeof outbox.enqueue!=='function')
   throw Error('OFFICE_BOX_COMMITTED_CAPTURE_DEPENDENCIES_REQUIRED');
 // Fresh authoritative database read AFTER save/commit. No caller-supplied order,
 // customer, amount, provider receipt or other untrusted event objects are accepted.
 const snapshot=await readCommitted({tenantId:tenant,orderId:oid,squarePaymentId:pid});
 if(!snapshot||snapshot.source!=='COMMITTED_MYSQL'||snapshot.commitVerified!==true)
   throw Error('OFFICE_BOX_AUTHORITATIVE_COMMIT_REQUIRED');
 const {order,parsed,payment,paymentRecord,customer}=snapshot;
 if(!order||!parsed||!payment||!paymentRecord||!customer||
    String(order.id)!==oid||String(payment.id)!==pid||
    tenantIdOf(order)!==tenant||tenantIdOf(customer)!==tenant||
    (paymentRecord.tenantId!==undefined&&tenantIdOf(paymentRecord)!==tenant))
   throw Error('OFFICE_BOX_COMMITTED_TENANT_IDENTITY_MISMATCH');
 if(String(order.customerId)!==String(customer.id)||String(paymentRecord.sbcOrderId)!==oid)
   throw Error('OFFICE_BOX_COMMITTED_CUSTOMER_ORDER_MISMATCH');
 // Requires canonical saved order-item evidence; metadata-only SKU is not enough.
 const {sku,plan}=purchasedPlan(parsed.items);
 if((nonempty(order.officeBoxSku)||nonempty(order.metadata?.officeBoxSku))&&
    (nonempty(order.officeBoxSku)||nonempty(order.metadata?.officeBoxSku))!==sku)
   throw Error('OFFICE_BOX_SKU_METADATA_CONFLICT');
 // The existing verified-payment contract checks Square location, USD amount,
 // Square payment ID, order ownership, captured status and purchased SKU.
 const verifiedPayment={order:{...order,officeBoxSku:sku},parsed,payment,paymentRecord,
  expectedLocation,customer,plan};
 const event=buildPaidHandoff(verifiedPayment);
 const queued=await outbox.enqueue(verifiedPayment); // only persistent outbox insert; no external HTTP
 if(!queued||queued.eventId!==event.correlationId||typeof queued.created!=='boolean')
   throw Error('OFFICE_BOX_OUTBOX_ACK_INCONSISTENT');
 return Object.freeze({status:queued.created?'QUEUED':'ALREADY_QUEUED',
  eventId:queued.eventId,orderId:oid,tenantId:tenant,externalSent:false,tenantActivated:false});
}
module.exports={purchasedPlan,enqueueCommittedOfficeBoxCapture};
