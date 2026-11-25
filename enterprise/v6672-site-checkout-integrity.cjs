'use strict';
// SBC V66.72 — pure, tenant-scoped browser checkout correlation.
// Never infer payment settlement from a browser request, a Square URL or email.
const idPattern=/^sbcweb_[a-f0-9]{32}$/;
const clean=x=>String(x??'').trim();
function notes(order){try{const n=typeof order?.notes==='string'?JSON.parse(order.notes):order?.notes;return n&&typeof n==='object'&&!Array.isArray(n)?n:{}}catch{return {}}}
const blockedState=x=>/^(CANCELLED|CANCELED|REFUNDED|EXPIRED|FAILED|DELETED|ARCHIVED|VOID|VOIDED|PARTIALLY[ _-]REFUNDED)$/.test(clean(x).toUpperCase());
const reconciliation=()=>({found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_RECONCILIATION_REQUIRED',automaticRetry:false});
function requestIdValid(value){return idPattern.test(clean(value))}
function inspectExisting({tenantId,clientRequestId,packageId,email,businessName,orders,customers}){
 const matches=(orders||[]).filter(o=>o&&Number(o.tenantId)===Number(tenantId)&&
  notes(o).websiteCheckoutRequestId===clean(clientRequestId));
 if(matches.length>1)return reconciliation();
 const existing=matches[0];
 if(!existing)return {found:false};
 const linked=(customers||[]).filter(c=>c&&String(c.id)===String(existing.customerId)&&Number(c.tenantId)===Number(tenantId));
 if(linked.length>1)return reconciliation();
 const customer=linked[0];
 const n=notes(existing),buyer=n.websiteCheckoutBuyer||customer||{};
 if(!customer||clean(buyer.email).toLowerCase()!==clean(email).toLowerCase()||
   clean(buyer.businessName).toLowerCase()!==clean(businessName).toLowerCase()||
   clean(n.bundleId)!==clean(packageId))
  return {found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_REQUEST_CONFLICT'};
 if(['PAID','COMPLETED'].includes(clean(existing.paymentStatus).toUpperCase())||
    ['PAID','COMPLETED'].includes(clean(existing.status).toUpperCase()))
  return {found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_ALREADY_PAID'};
 if(blockedState(existing.status)||blockedState(existing.paymentStatus))return reconciliation();
 const orderUrl=clean(existing.paymentUrl),notesUrl=clean(n.squarePaymentLinkUrl);
 if(orderUrl&&notesUrl&&orderUrl!==notesUrl)return reconciliation();
 const url=orderUrl||notesUrl;
 if(!url||!n.squareOrderId)
  return {found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_RECONCILIATION_REQUIRED',
    orderId:existing.id,automaticRetry:false};
 if(!/^https:\/\/(square\.link|checkout\.square\.site|squareup\.com)(?:\/|$)/i.test(url))
  return {found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_LINK_INVALID'};
 return {found:true,ok:true,existing:true,orderId:existing.id,paymentUrl:url,
  paymentStatus:'Pending',noNewOrder:true,noNewPaymentLink:true};
}
module.exports={requestIdValid,inspectExisting,notes};
