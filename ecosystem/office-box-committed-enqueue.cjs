'use strict';
/**
 * Explicit, OFF-BY-DEFAULT reconciliation of committed paid Office Box order.
 * No scheduler or HTTP endpoint is registered here. A caller must supply a
 * server-side Square GET payment verifier and current Published writer fence.
 * Only durable queue insertion is permitted; no direct email or workspace grant.
 */
const {loadCommittedOfficeBoxPayment}=require('./office-box-committed-readback.cjs');
function required(code){throw Object.assign(new Error(code),{code})}
const safeStr=v=>typeof v==='string'?v.trim():'';
async function enqueueVerifiedCommittedOfficeBox({
 pool,orderId,tenantId,payment,expectedLocation,outbox,
 publishedWriter=false,enabled=false,writerAuthority,verifyLiveSettlement,clock=Date.now
}={}){
 if(enabled!==true||publishedWriter!==true)required('OFFICE_BOX_PAYMENT_RECONCILIATION_DISABLED');
 if(!outbox||typeof outbox.enqueue!=='function'||typeof writerAuthority!=='function'||
    typeof verifyLiveSettlement!=='function'||typeof clock!=='function')
  required('OFFICE_BOX_RECONCILIATION_DEPENDENCY_REQUIRED');
 const live=async()=>{
  let status;
  try{status=await writerAuthority()}catch{required('OFFICE_BOX_PUBLISHED_WRITER_UNAVAILABLE')}
  if(status?.publishedWriter!==true||status?.recoveryVerified!==true||status?.writerLeaseHeld!==true)
   required('OFFICE_BOX_PUBLISHED_WRITER_REVOKED');
 };
 await live();
 const committed=await loadCommittedOfficeBoxPayment({pool,orderId,tenantId,payment,expectedLocation});
 let provider;
 try{provider=await verifyLiveSettlement({paymentId:committed.paymentId})}
 catch{required('OFFICE_BOX_SQUARE_LIVE_READBACK_UNAVAILABLE')}
 // A caller-supplied JavaScript flag is NOT a replacement for a fresh Square
 // API GET. Production must connect verifyLiveSettlement directly to Square.
 const observed=Date.parse(provider?.verifiedAt||'');
 const now=Number(clock());
 const expectedCents=Math.round(Number(committed.verified.order.price)*100);
 if(provider?.source!=='SQUARE_PAYMENT_PROVIDER_GET'||
    provider?.status!=='COMPLETED'||provider?.settled!==true||
    provider?.refunded!==false||provider?.disputed!==false||
    safeStr(provider?.paymentId)!==committed.paymentId||
    safeStr(provider?.squareOrderId)!==safeStr(payment.order_id)||
    safeStr(provider?.locationId)!==safeStr(expectedLocation)||
    provider?.currency!=='USD'||provider?.amountCents!==expectedCents||
    !Number.isFinite(now)||!Number.isFinite(observed)||observed>now+30000||
    now-observed>300000)
  required('OFFICE_BOX_FRESH_SQUARE_SETTLEMENT_REQUIRED');
 await live(); // lease may have expired during the outbound read
 // Outbox.enqueue independently applies the same live fence and uses
 // deterministic event ID, payload collision checks and a durable MySQL row.
 const queued=await outbox.enqueue(committed.verified);
 if(!queued||queued.eventId!==committed.event.correlationId)
  required('OFFICE_BOX_OUTBOX_RECEIPT_MISMATCH');
 return {eventId:queued.eventId,created:queued.created===true,
  state:'PENDING_DISPATCH',source:committed.source};
}
module.exports={enqueueVerifiedCommittedOfficeBox};
