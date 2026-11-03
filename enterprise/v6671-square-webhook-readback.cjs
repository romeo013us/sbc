'use strict';
// SBC V66.71: webhook signatures authenticate Square's notification, not merchant
// payment settlement. Authoritative GET /v2/payments/:id readback is required.
const str=v=>String(v??'').trim();
const norm=v=>str(v).toUpperCase();
function verifyReadback(notification,fromProvider){
 const n=notification&&typeof notification==='object'?notification:{};
 const p=fromProvider&&typeof fromProvider==='object'?fromProvider:{};
 if(!str(n.id)||!str(p.id)||str(n.id)!==str(p.id))
  return {ok:false,code:'SQUARE_PAYMENT_ID_READBACK_MISMATCH'};
 if(norm(n.status)!=='COMPLETED'||norm(p.status)!=='COMPLETED')
  return {ok:false,code:'SQUARE_PROVIDER_CAPTURE_NOT_COMPLETED'};
 if(!str(p.order_id)||str(n.order_id)!==str(p.order_id))
  return {ok:false,code:'SQUARE_PROVIDER_ORDER_READBACK_MISMATCH'};
 if(!str(p.location_id)||str(n.location_id)!==str(p.location_id))
  return {ok:false,code:'SQUARE_PROVIDER_LOCATION_READBACK_MISMATCH'};
 if(!Number.isSafeInteger(Number(p.amount_money?.amount))||
    Number(p.amount_money.amount)!==Number(n.amount_money?.amount)||
    norm(p.amount_money?.currency)!==norm(n.amount_money?.currency))
  return {ok:false,code:'SQUARE_PROVIDER_AMOUNT_READBACK_MISMATCH'};
 return {ok:true};
}
function outcome(result){
 if(result?.status==='RECONCILIATION_REQUIRED' || result?.status==='AMOUNT_MISMATCH')
  return 'RECONCILIATION_REQUIRED';
 if(result?.ok===false)return 'RECONCILIATION_REQUIRED';
 return 'PROCESSED';
}
module.exports={verifyReadback,outcome};
