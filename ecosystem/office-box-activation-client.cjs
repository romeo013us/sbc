'use strict';
/** A non-networking client contract. Input MUST be an event built from authoritative
 * persisted Square capture via enterprise/office-box-paid-handoff.cjs.
 * This module never charges or delivers a subscription and never trusts the browser.
 */
const crypto=require('node:crypto');
const {signPaidHandoff}=require('../enterprise/office-box-paid-handoff.cjs');
const PLANS=new Set(['starter','business','professional','team']);
const tidOk=v=>typeof v==='string'&&/^tenant_[0-9a-f]{16}$/.test(v);
function source(event){
 if(!event||event.eventType!=='customer.subscription.paid'||!/^officebox_[a-f0-9]{40}$/.test(String(event.correlationId||'')))
  throw Error('UNVERIFIED_OFFICE_BOX_PAID_EVENT_REQUIRED');
 const p=event.payload||{};
 if(!PLANS.has(p.plan)||String(event.customerId||'').length<8||String(p.orderId||'').length<8||
   String(p.paymentReference||'').length<6||p.paymentStatus!=='PAID')
  throw Error('INCOMPLETE_PAID_OFFICE_BOX_EVENT');
 return p;
}
function makeLookup(event){
 const p=source(event);
 return {schema:'sbc.office-box.activation-lookup.v1',correlationId:event.correlationId,customerId:event.customerId,orderId:p.orderId,plan:p.plan};
}
function signLookup(event,secret,options={}){
 const body=JSON.stringify(makeLookup(event));
 const when=options.nowSeconds??Math.floor(Date.now()/1000);
 if(!Number.isSafeInteger(when)||when<1000000000||typeof secret!=='string'||secret.length<32)throw Error('OFFICE_BOX_SIGNING_INPUT_INVALID');
 const timestamp=String(when);
 const signature=crypto.createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
 return {path:'/api/sbc/activation-status',body,headers:{'content-type':'application/json','x-sbc-timestamp':timestamp,'x-sbc-signature-v2':'sha256='+signature}};
}
function verifyActivationLookup(event,response){
 const expected=makeLookup(event);
 const result=response?.data;
 if(response?.ok!==true||result?.schema!=='sbc.office-box.activation-status.v1'||result.correlationId!==expected.correlationId)
  throw Error('OFFICE_BOX_ACTIVATION_RESULT_UNTRUSTED');
 if(result.status==='INVITATION_PENDING'){
  if(result.tenantId!==undefined)throw Error('OFFICE_BOX_PENDING_TENANT_LEAK');
  return {status:result.status};
 }
 if(result.status!=='ACTIVATED'||!tidOk(result.tenantId)||result.customerId!==expected.customerId||
    result.orderId!==expected.orderId||result.plan!==expected.plan)
  throw Error('OFFICE_BOX_ACTIVATION_TENANT_MISMATCH');
 return {status:'ACTIVATED',tenantId:result.tenantId,customerId:result.customerId,orderId:result.orderId,plan:result.plan};
}
function makeActiveEntitlement({paidEvent,activationResponse,verifiedAt}={}){
 const p=source(paidEvent),linked=verifyActivationLookup(paidEvent,activationResponse);
 if(linked.status!=='ACTIVATED')throw Error('OFFICE_BOX_PENDING_ACTIVATION');
 const date=Date.parse(verifiedAt||'');
 if(!Number.isFinite(date)||date<1577836800000||date>Date.now()+300000)throw Error('VERIFIED_SETTLEMENT_TIMESTAMP_REQUIRED');
 const eventId='sbc_evt_'+crypto.createHash('sha256').update(JSON.stringify([
   paidEvent.correlationId,linked.tenantId,p.orderId,p.paymentReference,'ACTIVE'
 ])).digest('hex').slice(0,40);
 return {schema:'sbc.office-box.entitlement.v1',eventId,tenantId:linked.tenantId,
   customerId:paidEvent.customerId,plan:p.plan,status:'ACTIVE',orderId:p.orderId,
   paymentReference:p.paymentReference,verifiedAt:new Date(date).toISOString()};
}
function signActiveEntitlement(entitlement,secret,{nowSeconds=Math.floor(Date.now()/1000)}={}){
 if(!entitlement||entitlement.schema!=='sbc.office-box.entitlement.v1'||entitlement.status!=='ACTIVE'||
   !tidOk(entitlement.tenantId)||typeof secret!=='string'||secret.length<32||
   !Number.isSafeInteger(nowSeconds)||nowSeconds<1000000000)
  throw Error('OFFICE_BOX_ENTITLEMENT_SIGNING_REFUSED');
 const body=JSON.stringify(entitlement),timestamp=String(nowSeconds);
 return {path:'/api/sbc/entitlements',body,headers:{'content-type':'application/json','x-sbc-timestamp':timestamp,
   'x-sbc-signature':'sha256='+crypto.createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex')}};
}
module.exports={makeLookup,signLookup,verifyActivationLookup,makeActiveEntitlement,signActiveEntitlement};
