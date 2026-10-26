'use strict';
// Pure, independent of HTTP/network/data storage: validates an inbound Square
// payment BEFORE changing any SBC order or squarePayments record.
const BLOCKED=new Set(['REFUNDED','CHARGEBACK','CHARGED_BACK','VOID','VOIDED']);
const norm=v=>String(v??'').trim().toUpperCase();
const str=v=>String(v??'').trim();
function validateCompleted(payment,order,parsed,record,expectedLocation){
  const p=payment&&typeof payment==='object'?payment:{};
  const o=order&&typeof order==='object'?order:{};
  const x=parsed&&typeof parsed==='object'?parsed:{};
  const id=str(p.id),squareOrderId=str(p.order_id),location=str(p.location_id),configuredLocation=str(expectedLocation);
  if(norm(p.status)!=='COMPLETED'||!id||!squareOrderId)
    return {ok:false,code:'SQUARE_PAYMENT_ID_OR_STATUS_REQUIRED'};
  if(!configuredLocation||!location||location!==configuredLocation)
    return {ok:false,code:'SQUARE_LOCATION_MISMATCH'};
  const linkedOrderId=str(x.squareOrderId||record?.squareOrderId);
  if(!linkedOrderId||squareOrderId!==linkedOrderId||!str(o.id))
    return {ok:false,code:'SQUARE_ORDER_MISMATCH'};
  if(record){
    if(str(record.sbcOrderId)!==str(o.id)|| (str(record.squareOrderId)&&str(record.squareOrderId)!==squareOrderId))
      return {ok:false,code:'SQUARE_RECORD_LINK_MISMATCH'};
    if(str(record.squarePaymentId)&&str(record.squarePaymentId)!==id&&norm(record.status)==='PAID')
      return {ok:false,code:'SQUARE_DIFFERENT_CAPTURE_REQUIRES_RECONCILIATION'};
  }
  if(BLOCKED.has(norm(o.paymentStatus))||BLOCKED.has(norm(x.squarePaymentStatus)))
    return {ok:false,code:'SQUARE_REVERSED_ORDER_REQUIRES_RECONCILIATION'};
  const amount=Number(p.amount_money?.amount),expected=Math.round(Number(o.price)*100);
  if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(expected)||expected<=0||amount!==expected||norm(p.amount_money?.currency)!=='USD')
    return {ok:false,code:'SQUARE_CAPTURE_AMOUNT_MISMATCH'};
  return {ok:true,code:'MATCHED_COMPLETED_PROVIDER_PAYMENT'};
}
function persistedCompletion(parsed,payment){
 const x=parsed&&typeof parsed==='object'?parsed:{};
 const p=payment&&typeof payment==='object'?payment:{};
 return !!str(p.id)&&str(x.squarePaymentId)===str(p.id)&&!!str(p.order_id)&&str(x.squareOrderId)===str(p.order_id)
  &&norm(x.squarePaymentStatus)==='PAID'&&!!str(x.squarePaymentCompletedAt);
}
// An old PENDING/FAILED event for another tender must not undo a recorded capture.
function storedOrderCapture(parsed){
 const x=parsed&&typeof parsed==='object'?parsed:{};
 return !!str(x.squareOrderId)&&!!str(x.squarePaymentId)&&
   norm(x.squarePaymentStatus)==='PAID'&&!!str(x.squarePaymentCompletedAt);
}
module.exports={validateCompleted,persistedCompletion,storedOrderCapture};
