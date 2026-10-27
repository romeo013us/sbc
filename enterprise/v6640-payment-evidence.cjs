'use strict';
// Revenue must never be inferred from an order's *fulfillment* status.
// This pure read-side classifier does not contact providers, modify records,
// change an existing payment ledger or authorize fulfillment.
const SETTLED=new Set(['PAID','COMPLETED']);
const NEGATIVE=new Set(['REFUNDED','CHARGEBACK','CHARGED_BACK','VOID','VOIDED']);
function norm(x){return String(x??'').trim().toUpperCase();}
// SBC_V6652_MANUAL_PAYMENT_PROOF: a manually entered reference is not Square capture.
function manualEvidence(o){
 if(!o||typeof o!=='object')return false;
 let parsed={};try{if(typeof o.notes==='string'&&o.notes.trim().startsWith('{'))parsed=JSON.parse(o.notes)}catch(_){}
 return [o,o.parsed||{},parsed].some(x=>x.manualPaymentEvidence===true||x.manualPaymentConfirmation===true);
}
function verifiedSquareAfterManual(o){
 let parsed={};try{if(typeof o?.notes==='string'&&o.notes.trim().startsWith('{'))parsed=JSON.parse(o.notes)}catch(_){}
 const p=o?.parsed&&typeof o.parsed==='object'?o.parsed:{};
 const state=norm(o?.squarePaymentStatus||p.squarePaymentStatus||parsed.squarePaymentStatus);
 const paymentId=String(o?.squarePaymentId||p.squarePaymentId||parsed.squarePaymentId||'').trim();
 return SETTLED.has(state)&&Boolean(paymentId);
}
// SBC_V6657_SQUARE_TENANT_BOUNDARIES: status flags are not sufficient for Square-linked orders.
function proofFields(o){
 let n={};try{if(typeof o?.notes==='string'&&o.notes.trim().startsWith('{'))n=JSON.parse(o.notes)}catch(_){}
 const p=o?.parsed&&typeof o.parsed==='object'?o.parsed:{};
 const m=o?.metadata&&typeof o.metadata==='object'?o.metadata:{};
 return {order:String(o?.squareOrderId||p.squareOrderId||m.squareOrderId||n.squareOrderId||'').trim(),
  id:String(o?.squarePaymentId||p.squarePaymentId||m.squarePaymentId||n.squarePaymentId||'').trim(),
  state:norm(o?.squarePaymentStatus||p.squarePaymentStatus||m.squarePaymentStatus||n.squarePaymentStatus),
  completedAt:String(o?.squarePaymentCompletedAt||p.squarePaymentCompletedAt||m.squarePaymentCompletedAt||n.squarePaymentCompletedAt||'').trim(),
  link:String(o?.squarePaymentLinkId||p.squarePaymentLinkId||m.squarePaymentLinkId||n.squarePaymentLinkId||'').trim()};
}
function squareLinked(o){const x=proofFields(o);return !!(x.order||x.link||x.id);}
function providerCapturedSquare(o){
 if(!o||typeof o!=='object')return false;
 const x=proofFields(o),payment=norm(o.paymentStatus);
 return !NEGATIVE.has(payment)&&!NEGATIVE.has(x.state)&&!!x.order&&!!x.id&&SETTLED.has(x.state)&&!!x.completedAt&&Number.isFinite(Date.parse(x.completedAt));
}
function statusOnlyPayment(o){
 if(!o||typeof o!=='object')return false;
 const p=norm(o.paymentStatus),x=proofFields(o);
 return (SETTLED.has(p)||SETTLED.has(x.state))&&!providerCapturedSquare(o);
}
function confirmedPaid(o){
 if(!o||typeof o!=='object')return false;
 // SBC_V6658_PROVENANCE_REVENUE_FULFILLMENT: refunds dominate older paid labels.
 const proof=proofFields(o);
 if(NEGATIVE.has(norm(o.paymentStatus))||NEGATIVE.has(proof.state))return false;
 if(squareLinked(o)&&!providerCapturedSquare(o))return false;
 if(manualEvidence(o)&&!verifiedSquareAfterManual(o))return false;
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
 const paid=rows.filter(providerCapturedSquare);
 const historicalPaid=rows.filter(confirmedPaid);
 const ambiguous=rows.filter(unverifiedFulfillment);
 const amount=o=>{const n=Number(o?.price??o?.total??0);return Number.isFinite(n)&&n>0&&n<1e9?n:0;};
 const sum=paid.reduce((n,o)=>n+amount(o),0);
 return {paidOrders:paid.length,recognizedPaidRevenue:Number(sum.toFixed(2)),
  historicalStatusPaidOrders:historicalPaid.length,statusOnlyPaidNeedsReview:rows.filter(statusOnlyPayment).length,
  unverifiedFulfillmentOrders:ambiguous.length,
  methodology:'SBC-recorded Square settlement metadata only; not independent Square/bank verification. Status-only paid labels excluded.',
  excludesUnverifiedFulfillment:true,providerVerificationPending:true};
}
module.exports={confirmedPaid,unverifiedFulfillment,snapshot,manualEvidence,verifiedSquareAfterManual,providerCapturedSquare,squareLinked,statusOnlyPayment,proofFields};
