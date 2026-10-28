'use strict';
/**
 * Staged Office Box post-activation reconciler.
 *
 * This library is NOT registered on a running server or scheduled as a worker.
 * It may only be called by the Published single-writer after authoritative
 * database delivery evidence and a fresh, READ-ONLY payment-provider check.
 * It does not collect funds, create accounts or call customer channels.
 */
const {net}=require('node:net');
const {validateTarget}=require('./office-box-outbox.cjs');
const {signLookup,verifyActivationLookup,makeActiveEntitlement}=require('./office-box-activation-client.cjs');

const TEN_MINUTES=10*60*1000;
const strictId=(x,max=120)=>typeof x==='string'&&x.length>=8&&x.length<=max&&/^[A-Za-z0-9._:-]+$/.test(x);
const tid=x=>Number.isSafeInteger(x)&&x>0;
function requireOrigin(value){
 const origin=validateTarget(value);
 const host=new URL(origin).hostname;
 // Do not allow arbitrary private-IP / loopback targets even if they present TLS.
 if(net.isIP(host)||host.endsWith('.internal')||host.endsWith('.local')||host.endsWith('.lan'))
  throw Error('OFFICE_BOX_UNTRUSTED_NETWORK_TARGET');
 return origin;
}
function authority(state){
 if(!state||state.publishedWriter!==true||state.recoveryVerified!==true||state.writerLeaseHeld!==true)
  throw Error('OFFICE_BOX_ACTIVATION_WRITER_NOT_AUTHORIZED');
}
async function liveAuthority(inspector){
 if(typeof inspector!=='function')throw Error('OFFICE_BOX_ACTIVATION_LIVE_AUTHORITY_REQUIRED');
 let state;
 try{state=await inspector()}catch{throw Error('OFFICE_BOX_ACTIVATION_AUTHORITY_UNAVAILABLE')}
 authority(state);
}
function committedDelivery(record,expectedTenant,eventId){
 if(!record||record.source!=='COMMITTED_MYSQL'||record.commitVerified!==true||
    record.status!=='DELIVERED'||record.tenantId!==expectedTenant||
    record.eventId!==eventId||record.eventType!=='customer.subscription.paid')
  throw Error('OFFICE_BOX_COMMITTED_DELIVERY_REQUIRED');
 const event=record.paidEvent;
 if(event?.eventType!=='customer.subscription.paid'||event?.correlationId!==eventId||
    !strictId(event.customerId)||!strictId(event.payload?.orderId)||!strictId(event.payload?.paymentReference))
  throw Error('OFFICE_BOX_PAID_EVENT_IDENTITY_MISMATCH');
 if(!Number.isSafeInteger(record.expectedAmountCents)||record.expectedAmountCents<=0||
    record.currency!=='USD'||record.customerId!==event.customerId||
    record.orderId!==event.payload.orderId||record.paymentReference!==event.payload.paymentReference)
  throw Error('OFFICE_BOX_COMMITTED_PAYMENT_CONTEXT_MISMATCH');
 return event;
}
function currentProviderProof(verification,{tenantId,paidEvent,expectedAmountCents,clock}){
 const at=Date.parse(verification?.verifiedAt||'');
 if(!verification||verification.source!=='PAYMENT_PROVIDER_READ_ONLY'||verification.settled!==true||
    verification.refunded!==false||verification.disputed!==false||
    verification.tenantId!==tenantId||
    verification.customerId!==paidEvent.customerId||
    verification.orderId!==paidEvent.payload.orderId||
    verification.paymentReference!==paidEvent.payload.paymentReference||
    verification.currency!=='USD'||verification.amountCents!==expectedAmountCents||
    !Number.isFinite(at)||at>clock+30000||clock-at>TEN_MINUTES)
  throw Error('OFFICE_BOX_FRESH_UNREFUNDED_PAYMENT_PROOF_REQUIRED');
 return new Date(at).toISOString();
}
async function reconcileActivatedOfficeBox({
 tenantId,paidEventId,receiverOrigin,secret,writerAuthority,readDeliveredPaidEvent,
 verifyLiveSettlement,outbox,transport=globalThis.fetch,now=Date.now,
}={}){
 if(!tid(tenantId)||!/^officebox_[a-f0-9]{40}$/.test(String(paidEventId||''))||
    typeof readDeliveredPaidEvent!=='function'||typeof verifyLiveSettlement!=='function'||
    typeof transport!=='function'||typeof now!=='function'||!outbox||
    typeof outbox.enqueueActiveEntitlement!=='function')
  throw Error('OFFICE_BOX_ACTIVATION_DEPENDENCIES_REQUIRED');
 const origin=requireOrigin(receiverOrigin);
 if(typeof secret!=='string'||secret.length<32)
  throw Error('OFFICE_BOX_ACTIVATION_SIGNING_KEY_REQUIRED');
 await liveAuthority(writerAuthority);
 // Read from the committed persistent outbox, not a browser or caller-supplied event.
 const record=await readDeliveredPaidEvent({tenantId,paidEventId});
 const paidEvent=committedDelivery(record,tenantId,paidEventId);
 const signed=signLookup(paidEvent,secret);
 // This endpoint is READ-ONLY; authenticated request redirects are forbidden.
 await liveAuthority(writerAuthority);
 let response;
 try{
  response=await transport(origin+signed.path,{
   method:'POST',headers:signed.headers,body:signed.body,redirect:'error',
   cache:'no-store',signal:AbortSignal.timeout(12000),
  });
 }catch{throw Error('OFFICE_BOX_ACTIVATION_LOOKUP_UNAVAILABLE')}
 if(response?.status!==200)throw Error('OFFICE_BOX_ACTIVATION_LOOKUP_REJECTED');
 let body;
 try{body=await response.json()}catch{throw Error('OFFICE_BOX_ACTIVATION_RESPONSE_INVALID')}
 const result=verifyActivationLookup(paidEvent,body); // checks exact event, customer, order, plan
 if(result.status==='INVITATION_PENDING')
  return Object.freeze({status:'INVITATION_PENDING',eventId:paidEventId,enqueued:false});
 // The purchaser may have refunded/cancelled since the original payment.
 // Require a fresh read-only provider verification before requesting ACTIVE.
 await liveAuthority(writerAuthority);
 const proof=await verifyLiveSettlement({
  tenantId,customerId:paidEvent.customerId,orderId:paidEvent.payload.orderId,
  paymentReference:paidEvent.payload.paymentReference,
  expectedAmountCents:record.expectedAmountCents,currency:'USD',
 });
 const verifiedAt=currentProviderProof(proof,{tenantId,paidEvent,
  expectedAmountCents:record.expectedAmountCents,clock:now()});
 // A credential or lease can be revoked while waiting for the payment provider.
 await liveAuthority(writerAuthority);
 const expected=makeActiveEntitlement({paidEvent,activationResponse:body,verifiedAt});
 const queued=await outbox.enqueueActiveEntitlement({
  paidEvent,activationResponse:body,verifiedAt,
 });
 if(!queued||queued.eventId!==expected.eventId||typeof queued.created!=='boolean')
  throw Error('OFFICE_BOX_ACTIVATION_OUTBOX_ACK_MISMATCH');
 return Object.freeze({status:queued.created?'ACTIVE_QUEUED':'ACTIVE_ALREADY_QUEUED',
  eventId:queued.eventId,paidEventId,tenantId,activatedRemotely:false,externalSent:false});
}
module.exports={reconcileActivatedOfficeBox,currentProviderProof,committedDelivery,requireOrigin};
