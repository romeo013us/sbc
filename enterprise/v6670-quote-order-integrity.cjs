'use strict';
// SBC V66.70 — pure quote-to-order acceptance. No SQL, Square, email or external effects.
// The result is checked BEFORE customer/order mutation inside the legacy V25 sales-order route.
const ID_RE=/^[A-Za-z0-9_-]{12,90}$/;
const norm=v=>String(v??'').trim();
function cents(value){
 const n=Number(value);
 return Number.isFinite(n)&&n>0?Math.round(n*100):NaN;
}
function savedRequestId(order){
 if(!order)return '';
 if(order.clientRequestId)return norm(order.clientRequestId);
 try{
  const notes=typeof order.notes==='string'?JSON.parse(order.notes):order.notes;
  return norm(notes?.clientRequestId);
 }catch{return ''}
}
function fail(status,code){return Object.freeze({ok:false,status,code});}
function examine({tenantId,customerId='',quoteId='',clientRequestId='',total,quotes=[],orders=[],customers=[],email=''}={}){
 const tenant=Number(tenantId),cid=norm(customerId),qid=norm(quoteId),requestId=norm(clientRequestId);
 const amount=cents(total),buyer=norm(email).toLowerCase();
 if(!Number.isSafeInteger(tenant)||tenant<1)return fail(403,'TENANT_CONTEXT_REQUIRED');
 if(!Number.isSafeInteger(amount)||amount<1)return fail(422,'SALES_ORDER_TOTAL_INVALID');
 if(requestId&&!ID_RE.test(requestId))return fail(422,'SALES_ORDER_REQUEST_ID_INVALID');
 if(qid&&(qid.length>100||!/^[-A-Za-z0-9_]+$/.test(qid)))return fail(422,'QUOTE_ID_INVALID');
 if(cid){
  const customer=customers.find(c=>norm(c.id)===cid&&Number(c.tenantId)===tenant);
  if(!customer)return fail(404,'CUSTOMER_NOT_FOUND_IN_TENANT');
  // A salesperson must not silently replace another customer's contact identity.
  if(buyer&&norm(customer.email).toLowerCase()&&buyer!==norm(customer.email).toLowerCase())
   return fail(409,'CUSTOMER_EMAIL_MISMATCH');
 }
 if(qid){
  const quote=quotes.find(q=>norm(q.id)===qid&&Number(q.tenantId)===tenant);
  if(!quote)return fail(404,'QUOTE_NOT_FOUND_IN_TENANT');
  if(!cid||!norm(quote.customerId)||norm(quote.customerId)!==cid)
   return fail(409,'QUOTE_CUSTOMER_LINK_REQUIRED');
  if(!['Sent','Won'].includes(norm(quote.status)))return fail(409,'QUOTE_NOT_APPROVED_FOR_CHECKOUT');
  if(cents(quote.total)!==amount)return fail(409,'QUOTE_ORDER_AMOUNT_MISMATCH');
 }
 const tenantOrders=orders.filter(o=>Number(o.tenantId)===tenant);
 const byQuote=qid?tenantOrders.find(o=>norm(o.quoteId)===qid):null;
 const byRequest=requestId?tenantOrders.find(o=>savedRequestId(o)===requestId):null;
 if(byQuote&&byRequest&&byQuote.id!==byRequest.id)return fail(409,'ORDER_REFERENCE_CONFLICT');
 const existing=byQuote||byRequest;
 if(existing){
  if(cid&&norm(existing.customerId)!==cid)return fail(409,'ORDER_IDEMPOTENCY_CONFLICT');
  if(qid&&norm(existing.quoteId)!==qid)return fail(409,'ORDER_IDEMPOTENCY_CONFLICT');
  if(requestId&&savedRequestId(existing)&&savedRequestId(existing)!==requestId)
   return fail(409,'ORDER_IDEMPOTENCY_CONFLICT');
  if(cents(existing.price)!==amount)return fail(409,'ORDER_IDEMPOTENCY_CONFLICT');
  const linkedCustomer=customers.find(c=>norm(c.id)===norm(existing.customerId)&&Number(c.tenantId)===tenant);
  if(!linkedCustomer||buyer&&norm(linkedCustomer.email).toLowerCase()!==buyer)
   return fail(409,'ORDER_IDEMPOTENCY_CONFLICT');
  return Object.freeze({ok:true,existing});
 }
 return Object.freeze({ok:true,existing:null});
}
module.exports={examine,cents,savedRequestId};