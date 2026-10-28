'use strict';
/** Pure, non-dispatching bridge between a persisted verified Square capture
 * and Office Box provisioning. Never call this with browser-supplied evidence.
 * No payment, database, HTTP, DNS or tenant mutation occurs here.
 */
const crypto=require('node:crypto');
const {validateCompleted,persistedCompletion}=require('./v6659-square-webhook-proof.cjs');
const PLANS=new Set(['starter','business','professional','team']);
const emailOk=v=>typeof v==='string'&&v.length<=180&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max?v.trim():null;
function buildPaidHandoff({order,parsed,payment,paymentRecord,expectedLocation,customer,plan}={}){
 if(!order||!parsed||!payment||!paymentRecord||!customer)throw Error('OFFICE_BOX_PAYMENT_EVIDENCE_REQUIRED');
 const proof=validateCompleted(payment,order,parsed,paymentRecord,expectedLocation);
 if(!proof.ok||!persistedCompletion(parsed,payment)||String(paymentRecord.status||'').toUpperCase()!=='PAID'||
    String(paymentRecord.squarePaymentId||'')!==String(payment.id||'')||
    String(paymentRecord.sbcOrderId||'')!==String(order.id||'')||
    String(order.paymentStatus||'').toUpperCase()!=='PAID')throw Error('OFFICE_BOX_VERIFIED_CAPTURE_REQUIRED');
 if(order.isTest===true||parsed.isTest===true||paymentRecord.isTest===true)throw Error('OFFICE_BOX_TEST_ORDER_REJECTED');
 const sku=text(order.officeBoxSku||order.metadata?.officeBoxSku,80);
 if(!PLANS.has(plan)||sku!=='OFFICE_BOX_'+plan.toUpperCase())throw Error('OFFICE_BOX_PURCHASED_SKU_MISMATCH');
 const customerId=text(customer.id,120),businessName=text(customer.businessName,120),ownerEmail=text(customer.ownerEmail,180);
 if(!customerId||!businessName||!emailOk(ownerEmail))throw Error('OFFICE_BOX_VERIFIED_CUSTOMER_REQUIRED');
 const orderId=text(order.id,120),receipt=text(payment.id,120);
 if(!orderId||!receipt)throw Error('OFFICE_BOX_PAYMENT_REFERENCE_REQUIRED');
 const eventId='officebox_'+crypto.createHash('sha256').update(JSON.stringify([orderId,receipt,customerId,sku])).digest('hex').slice(0,40);
 return {eventType:'customer.subscription.paid',correlationId:eventId,customerId,payload:{businessName,ownerEmail,orderId,paymentReference:receipt,paymentStatus:'PAID',plan,industry:text(customer.industry,80)||'General Business'}};
}
function signPaidHandoff(event,secret,{nowSeconds=Math.floor(Date.now()/1000)}={}){
 if(typeof secret!=='string'||secret.length<32)throw Error('OFFICE_BOX_SIGNING_SECRET_REQUIRED');
 if(!event||event.eventType!=='customer.subscription.paid'||!/^officebox_[a-f0-9]{40}$/.test(String(event.correlationId||'')))throw Error('OFFICE_BOX_EVENT_NOT_VERIFIED');
 if(!Number.isSafeInteger(nowSeconds)||nowSeconds<1000000000)throw Error('OFFICE_BOX_TIMESTAMP_INVALID');
 const body=JSON.stringify(event),timestamp=String(nowSeconds),raw=Buffer.from(body);
 const legacy=crypto.createHmac('sha256',secret).update(raw).digest('hex');
 const signedV2=crypto.createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex');
 return {path:'/api/sbc/handoff',body,headers:{'content-type':'application/json','x-sbc-timestamp':timestamp,'x-sbc-signature':'sha256='+legacy,'x-sbc-signature-v2':'sha256='+signedV2}};
}
module.exports={buildPaidHandoff,signPaidHandoff};
