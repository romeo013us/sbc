'use strict';
/* Read-side financial truth for legacy growth dashboards.
 * This never changes payment, order, CRM, or fulfillment records.
 * QA tests and payment-status-only orders are not recognized as customer revenue.
 */
const PAYMENT=require('./v6640-payment-evidence.cjs');
const QA_SOURCE=/^(?:owner launch qa|sbc v\d+(?:\.\d+)* full-cycle test)$/i;
function parseNotes(order){
 try{const value=typeof order?.notes==='string'?JSON.parse(order.notes):order?.notes;
  return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 }catch{return {};}
}
function isQaCustomer(customer){
 if(!customer||typeof customer!=='object')return false;
 const name=String(customer.businessName||customer.contactName||'').trim();
 const source=String(customer.source||'').trim();
 return customer.testOnly===true||customer.isTest===true||
  QA_SOURCE.test(source)||/^SBC SYSTEM TEST\b/i.test(name)||
  /^SBC Launch QA Test Customer$/i.test(name);
}
function isQaOrder(order,customer){
 if(!order||typeof order!=='object')return false;
 const notes=parseNotes(order);
 const name=String(order.customerName||'').trim();
 return /^qaorder_/i.test(String(order.id||''))||
  order.testOnly===true||order.isTestOrder===true||
  Boolean(notes.ownerCheckoutLab)||
  notes.sbcLaunchQa?.kind==='OWNER_ONLY_ONE_DOLLAR_CHECKOUT'||
  /^SBC INTERNAL QA\b/i.test(name)||
  /^SBC SYSTEM TEST\b/i.test(name)||
  /^SBC Launch QA Test Customer$/i.test(name)||
  isQaCustomer(customer);
}
function providerPaid(order,customer){
 const amount=Number(order?.price??order?.total??0);
 return Number.isFinite(amount)&&amount>0&&amount<1e9&&!isQaOrder(order,customer)&&PAYMENT.providerCapturedSquare(order);
}
// One read-side projection. Index by tenant AND identity, never by a global customer id.
const tenantOf=row=>Number(row?.tenantId??row?.tenant_id);
const text=value=>String(value??'').trim();
const key=(tenant,id)=>JSON.stringify([tenant,text(id)]);
function paidSummary(orders,customers=[],{tenantId,start,end}={}){
 const scoped=tenantId!==undefined,tenant=Number(tenantId);
 if(scoped&&(!Number.isSafeInteger(tenant)||tenant<1))throw Error('TENANT_CONTEXT_REQUIRED');
 const boundary=value=>value===undefined?null:new Date(value).getTime();
 const from=boundary(start),to=boundary(end);
 if((from!==null&&!Number.isFinite(from))||(to!==null&&!Number.isFinite(to))||(from!==null&&to!==null&&from>=to))throw Error('REVENUE_WINDOW_INVALID');
 const belongs=row=>row&&(!scoped||tenantOf(row)===tenant);
 const indexed=new Map(),duplicateCustomers=new Set();
 for(const c of (Array.isArray(customers)?customers:[]).filter(belongs)){
  const k=key(tenantOf(c),c.id);if(indexed.has(k))duplicateCustomers.add(k);else indexed.set(k,c);
 }
 const rows=(Array.isArray(orders)?orders:[]).filter(belongs);
 const paymentCounts=new Map(),orderCounts=new Map();
 const records=rows.map(o=>{
  const t=tenantOf(o),proof=PAYMENT.proofFields(o),paymentKey=proof.id?key(t,proof.id):null,orderKey=text(o.id)?key(t,o.id):null;
  if(paymentKey)paymentCounts.set(paymentKey,(paymentCounts.get(paymentKey)||0)+1);
  if(orderKey)orderCounts.set(orderKey,(orderCounts.get(orderKey)||0)+1);
  return {o,proof,paymentKey,orderKey,customerKey:key(t,o.customerId??o.customer_id)};
 });
 let ambiguousOrders=0,revenueCents=0,invalidAmountOrders=0;
 const paid=[];
 for(const {o,proof,paymentKey,orderKey,customerKey} of records){
  if((paymentKey&&paymentCounts.get(paymentKey)>1)||(orderKey&&orderCounts.get(orderKey)>1)||duplicateCustomers.has(customerKey)){ambiguousOrders++;continue;}
  if(!providerPaid(o,indexed.get(customerKey)))continue;
  const captured=Date.parse(proof.completedAt);
  if((from!==null&&captured<from)||(to!==null&&captured>=to))continue;
  const amount=Number(o.price??o.total),cents=Math.round(amount*100);
  if(!Number.isSafeInteger(cents)||cents<=0||Math.abs(amount*100-cents)>0.0001){invalidAmountOrders++;continue;}
  if(!Number.isSafeInteger(revenueCents+cents))throw Error('REVENUE_TOTAL_OUT_OF_RANGE');
  revenueCents+=cents;paid.push(o);
 }
 return {orders:paid,orderCount:paid.length,revenueCents,revenue:revenueCents/100,
  reconciliation:{ambiguousOrders,invalidAmountOrders,paymentIdentityConflicts:[...paymentCounts.values()].filter(n=>n>1).length,orderIdentityConflicts:[...orderCounts.values()].filter(n=>n>1).length,duplicateCustomerIdentities:duplicateCustomers.size},
  proof:'SBC-recorded Square capture metadata; not independent bank settlement',
  excludes:['zero-dollar QA','one-dollar launch QA','known synthetic test accounts','status-only payments','refunds','ambiguous receipt identities','invalid cent amounts']};
}
module.exports={parseNotes,isQaCustomer,isQaOrder,providerPaid,paidSummary};
