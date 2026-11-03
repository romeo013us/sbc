'use strict';
// SBC V66.72 — pure, tenant-scoped browser checkout correlation.
// Never infer payment settlement from a browser request, a Square URL or email.
const idPattern=/^sbcweb_[a-f0-9]{32}$/;
const clean=x=>String(x??'').trim();
function notes(order){try{return typeof order?.notes==='string'?JSON.parse(order.notes):order?.notes||{}}catch{return {}}}
function requestIdValid(value){return idPattern.test(clean(value))}
function inspectExisting({tenantId,clientRequestId,packageId,email,businessName,orders,customers}){
 const existing=(orders||[]).find(o=>Number(o.tenantId)===Number(tenantId)&&
  notes(o).websiteCheckoutRequestId===clean(clientRequestId));
 if(!existing)return {found:false};
 const customer=(customers||[]).find(c=>String(c.id)===String(existing.customerId)&&Number(c.tenantId)===Number(tenantId));
 const n=notes(existing);
 if(!customer||clean(customer.email).toLowerCase()!==clean(email).toLowerCase()||
   clean(customer.businessName).toLowerCase()!==clean(businessName).toLowerCase()||
   clean(n.bundleId)!==clean(packageId))
  return {found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_REQUEST_CONFLICT'};
 if(['PAID','COMPLETED'].includes(clean(existing.paymentStatus).toUpperCase())||
    ['PAID','COMPLETED'].includes(clean(existing.status).toUpperCase()))
  return {found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_ALREADY_PAID'};
 const url=clean(existing.paymentUrl||n.squarePaymentLinkUrl);
 if(!url||!n.squareOrderId)
  return {found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_RECONCILIATION_REQUIRED',
    orderId:existing.id,automaticRetry:false};
 if(!/^https:\/\/(square\.link|checkout\.square\.site|squareup\.com)(?:\/|$)/i.test(url))
  return {found:true,ok:false,status:409,code:'WEBSITE_CHECKOUT_LINK_INVALID'};
 return {found:true,ok:true,existing:true,orderId:existing.id,paymentUrl:url,
  paymentStatus:'Pending',noNewOrder:true,noNewPaymentLink:true};
}
module.exports={requestIdValid,inspectExisting,notes};
