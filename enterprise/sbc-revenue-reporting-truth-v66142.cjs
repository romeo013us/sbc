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
function paidSummary(orders,customers=[]){
 const indexed=new Map((customers||[]).map(c=>[String(c.id),c]));
 const paid=(orders||[]).filter(o=>providerPaid(o,indexed.get(String(o.customerId||''))));
 return {orders:paid,orderCount:paid.length,
  revenue:Math.round(paid.reduce((sum,o)=>sum+Number(o.price??o.total??0),0)*100)/100,
  proof:'SBC-recorded Square capture metadata; not independent bank settlement',
  excludes:['zero-dollar QA','one-dollar launch QA','known synthetic test accounts','status-only payments','refunds']};
}
module.exports={parseNotes,isQaCustomer,isQaOrder,providerPaid,paidSummary};
