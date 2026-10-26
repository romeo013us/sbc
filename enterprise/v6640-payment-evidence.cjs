'use strict';
// Revenue must never be inferred from an order's *fulfillment* status.
// This pure read-side classifier does not contact providers, modify records,
// change an existing payment ledger or authorize fulfillment.
const SETTLED=new Set(['PAID','COMPLETED']);
const NEGATIVE=new Set(['REFUNDED','CHARGEBACK','CHARGED_BACK','VOID','VOIDED']);
function norm(x){return String(x??'').trim().toUpperCase();}
function confirmedPaid(o){
 if(!o||typeof o!=='object')return false;
 const payment=norm(o.paymentStatus);
 if(NEGATIVE.has(payment))return false;
 if(SETTLED.has(payment))return true;
 const square=norm(o.squarePaymentStatus||o.metadata?.squarePaymentStatus||o.parsed?.squarePaymentStatus);
 if(NEGATIVE.has(square))return false;
 return SETTLED.has(square);
}
function unverifiedFulfillment(o){
 if(!o||confirmedPaid(o))return false;
 const p=norm(o.paymentStatus),s=norm(o.squarePaymentStatus||o.metadata?.squarePaymentStatus||o.parsed?.squarePaymentStatus);
 if(NEGATIVE.has(p)||NEGATIVE.has(s))return false;
 return /^(PAID|COMPLETED|FULFILLED|DELIVERED)$/i.test(String(o.status||''));
}
function snapshot(orders=[],isTest=()=>false){
 const rows=Array.isArray(orders)?orders.filter(o=>!isTest(o)):[];
 const paid=rows.filter(confirmedPaid);
 const ambiguous=rows.filter(unverifiedFulfillment);
 const sum=paid.reduce((n,o)=>n+Number(o.price||o.total||0),0);
 return {paidOrders:paid.length,recognizedPaidRevenue:Number(sum.toFixed(2)),
  unverifiedFulfillmentOrders:ambiguous.length,
  methodology:'Verified paymentStatus or Square payment status; fulfillment status never implies payment.',
  excludesUnverifiedFulfillment:true};
}
module.exports={confirmedPaid,unverifiedFulfillment,snapshot};
