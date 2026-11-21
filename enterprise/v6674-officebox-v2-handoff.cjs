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
function interpretAck(reply,{correlationId,origin}={}){
 const data=reply?.data;
 if(reply?.ok!==true||!data||data.accepted!==true)
   return {accepted:false,activationUrl:null,reason:'OFFICEBOX_NO_AUTHORITATIVE_ACK'};
 // The ACK is not proof of the payment unless it identifies the exact
 // original signed handoff; a generic accepted:true is never enough.
 if(!validId(correlationId)||data.correlationId!==correlationId)
   return {accepted:false,activationUrl:null,reason:'OFFICEBOX_ACK_CORRELATION_MISMATCH'};
 let expected;
 try{expected=new URL(String(origin||''))}catch{
   return {accepted:false,activationUrl:null,reason:'OFFICEBOX_TRUSTED_ORIGIN_MISSING'};
 }
 if(expected.protocol!=='https:'||expected.username||expected.password||
    expected.search||expected.hash||expected.pathname!=='/'||
    !expected.hostname||expected.port&&expected.port!=='443')
   return {accepted:false,activationUrl:null,reason:'OFFICEBOX_TRUSTED_ORIGIN_INVALID'};
 // Replay is idempotent: the recipient must not create or resend another
 // activation token merely because Office Box acknowledged a duplicate.
 if(data.duplicate===true)
   return {accepted:true,duplicate:true,activationUrl:null,reason:'OFFICEBOX_RECONCILE_EXISTING_INVITE'};
 const rawUrl=String(data.activation_url||'');
 try{
   const u=new URL(rawUrl);
   // Office Box generates 32 cryptographically random bytes as a 43-character
   // base64url token at the exact /activate path on its configured origin.
   if(u.protocol==='https:'&&u.origin===expected.origin&&!u.username&&!u.password&&
      !u.hash&&u.pathname==='/activate'&&u.searchParams.size===1&&
      /^[A-Za-z0-9_-]{43}$/.test(String(u.searchParams.get('token')||'')))
     return {accepted:true,duplicate:false,activationUrl:u.toString(),reason:'PENDING_CUSTOMER_ACTIVATION'};
 }catch{}
 return {accepted:false,activationUrl:null,reason:'OFFICEBOX_UNTRUSTED_ACTIVATION_URL'};
}

module.exports={PLANS,prepareHandoff,signHandoffV2,interpretAck};
