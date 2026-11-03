'use strict';
/**
 * SBC/Office Box V2 handoff: PURE, fail-closed adapter.
 * Does not call Square, send mail, fetch URLs, mutate CRM or activate a tenant.
 * May be invoked by a post-commit reconciler only after independently verified
 * Square provider readback and a durable verified MySQL commit.
 */
const crypto=require('node:crypto');
const PLANS=Object.freeze({OFFICE_BOX_STARTER:'starter',OFFICE_BOX_BUSINESS:'business',OFFICE_BOX_PROFESSIONAL:'professional',OFFICE_BOX_TEAM:'team'});
const fail=code=>{const e=new Error(code);e.code=code;throw e};
const validId=v=>/^[A-Za-z0-9._:-]{6,120}$/.test(String(v||''));
function prepareHandoff({order,customer,squareReadback,commitReceipt,expectedLocationId}={}){
 if(!order||!customer||!squareReadback||!commitReceipt)fail('OFFICEBOX_EVIDENCE_MISSING');
 if(commitReceipt.source!=='COMMITTED_MYSQL'||commitReceipt.commitVerified!==true)fail('OFFICEBOX_COMMIT_NOT_VERIFIED');
 if(!squareReadback.providerVerified||squareReadback.source!=='SQUARE_PROVIDER_READBACK')fail('OFFICEBOX_SQUARE_READBACK_UNVERIFIED');
 const payment=squareReadback.payment||{};
 if(!validId(order.id)||!validId(customer.id)||String(order.customerId)!==String(customer.id))fail('OFFICEBOX_CUSTOMER_ORDER_MISMATCH');
 if(!validId(payment.id)||!validId(payment.order_id)||!validId(expectedLocationId)||payment.location_id!==expectedLocationId)fail('OFFICEBOX_SQUARE_IDENTITY_MISMATCH');
 if(String(payment.status).toUpperCase()!=='COMPLETED'||String(payment.amount_money?.currency).toUpperCase()!=='USD')fail('OFFICEBOX_SQUARE_NOT_SETTLED');
 if(squareReadback.squareOrderId!==payment.order_id||String(order.squareOrderId||'')!==payment.order_id)fail('OFFICEBOX_SQUARE_ORDER_MISMATCH');
 const amount=Number(order.price);
 if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)!==Number(payment.amount_money?.amount))fail('OFFICEBOX_SQUARE_AMOUNT_MISMATCH');
 if(!['PAID','COMPLETED'].includes(String(order.paymentStatus||'').toUpperCase()))fail('OFFICEBOX_ORDER_NOT_PAID');
 const sku=String(order.officeBoxSku||'').toUpperCase(),plan=PLANS[sku];
 if(!plan)fail('OFFICEBOX_EXPLICIT_PURCHASE_SKU_REQUIRED');
 if(order.launchQaOwnerCreated===true||order.sbcLaunchQa===true||String(order.product||'').includes('QA -'))fail('OFFICEBOX_QA_ORDER_NOT_ELIGIBLE');
 const email=String(customer.email||'').trim().toLowerCase(),business=String(customer.businessName||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!business||business.length>120)fail('OFFICEBOX_CUSTOMER_CONTACT_INVALID');
 const correlationId='sbc_officebox_'+crypto.createHash('sha256').update(String(order.id)+'|'+payment.id).digest('hex').slice(0,24);
 return Object.freeze({schema:'sbc.officebox.handoff.v2',eventType:'customer.subscription.paid',correlationId,customerId:String(customer.id),payload:{businessName:business,ownerEmail:email,industry:String(customer.industry||'General Business').slice(0,80),orderId:String(order.id),paymentStatus:'PAID',plan,paymentReference:String(payment.id)}});
}
function signHandoffV2(event,secret,epochSeconds=Math.floor(Date.now()/1000)){
 if(typeof secret!=='string'||secret.length<32)fail('OFFICEBOX_WEBHOOK_SECRET_NOT_CONFIGURED');
 if(!Number.isSafeInteger(epochSeconds)||epochSeconds<1e9||epochSeconds>9999999999)fail('OFFICEBOX_TIMESTAMP_INVALID');
 if(!event||event.eventType!=='customer.subscription.paid'||!validId(event.correlationId)||!validId(event.customerId)||!validId(event.payload?.orderId))fail('OFFICEBOX_EVENT_INVALID');
 const timestamp=String(epochSeconds),body=JSON.stringify(event),raw=Buffer.from(body,'utf8');
 const signature=crypto.createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex');
 return {method:'POST',path:'/api/sbc/handoff',body,headers:{'content-type':'application/json','x-sbc-timestamp':timestamp,'x-sbc-signature-v2':'sha256='+signature}};
}
function interpretAck(reply){
 const data=reply?.data;
 if(reply?.ok!==true||!data||data.accepted!==true)return {accepted:false,reason:'OFFICEBOX_NO_AUTHORITATIVE_ACK'};
 const url=String(data.activation_url||'');
 if(data.duplicate===true)return {accepted:true,duplicate:true,activationUrl:null,reason:'OFFICEBOX_RECONCILE_EXISTING_INVITE'};
 let safeUrl=null;
 try{const u=new URL(url);if(u.protocol==='https:'&&!u.username&&!u.password&&u.searchParams.has('token'))safeUrl=url}catch{}
 return {accepted:true,duplicate:false,activationUrl:safeUrl,reason:safeUrl?'PENDING_CUSTOMER_ACTIVATION':'OFFICEBOX_MISSING_ACTIVATION_URL'};
}
module.exports={PLANS,prepareHandoff,signHandoffV2,interpretAck};
