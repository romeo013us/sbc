'use strict';
// Capture evidence only. All dependencies are server-owned, never request-supplied.
const {createHash}=require('node:crypto');
const {normalizePaymentEvidence}=require('./index.cjs');
const fail=code=>{throw Object.assign(Error(code),{code});};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(x);
function createCaptureAdapter({provider,accountId,environment,verifySignature,resolveBinding,readPayment,ingest}){
 if(!['square','stripe'].includes(provider)||!id(accountId)||!['production','sandbox'].includes(environment)||![verifySignature,resolveBinding,readPayment,ingest].every(f=>typeof f==='function'))fail('SBC_CAPTURE_CONFIG_INVALID');
 const square=provider==='square',live=environment==='production';
 return async function recordCapture(raw,signature,{correlationId}={}){
  if(!Buffer.isBuffer(raw)||raw.length===0||raw.length>1024*1024||await verifySignature(raw,signature)!==true)fail('SBC_CAPTURE_SIGNATURE_INVALID');
  let event;try{event=JSON.parse(raw.toString('utf8'));}catch{fail('SBC_CAPTURE_JSON_INVALID');}
  if(!event||typeof event!=='object'||Array.isArray(event))fail('SBC_CAPTURE_JSON_INVALID');
  if(square?event.type!=='payment.updated':event.type!=='payment_intent.succeeded')return {status:'IGNORED',effect:'none'};
  if(square?event.merchant_id!==accountId:(event.livemode!==live||(event.account!==undefined&&event.account!==accountId)))fail('SBC_CAPTURE_ACCOUNT_MISMATCH');
  const p=square?event.data?.object?.payment:event.data?.object;
  const paymentId=p?.id,eventId=square?event.event_id:event.id;
  if(!id(paymentId)||!id(eventId)||(square?event.data?.id!==paymentId:(!/^pi_/.test(paymentId)||!/^evt_/.test(eventId))))fail('SBC_CAPTURE_ID_INVALID');
  const b=await resolveBinding({provider,accountId,environment,paymentId});
  if(!b||b.provider!==provider||b.accountId!==accountId||b.environment!==environment||b.paymentId!==paymentId||!id(b.tenantRef)||!Number.isSafeInteger(b.amountMinor)||b.amountMinor<=0||!/^([A-Z]{3})$/.test(b.currency||'')||(square?(!id(b.orderId)||!id(b.locationId)):!id(b.customerId)))fail('SBC_CAPTURE_BINDING_INVALID');
  const snapshot=await readPayment({provider,accountId,environment,paymentId});
  if(!snapshot||snapshot.accountId!==accountId||snapshot.environment!==environment)fail('SBC_CAPTURE_ACCOUNT_MISMATCH');
  const matches=x=>!!x&&x.id===paymentId&&(square?x.status==='COMPLETED'&&x.order_id===b.orderId&&x.location_id===b.locationId&&x.amount_money?.amount===b.amountMinor&&x.amount_money?.currency===b.currency:x.object==='payment_intent'&&x.status==='succeeded'&&x.livemode===live&&x.customer===b.customerId&&x.amount_received===b.amountMinor&&x.currency===b.currency.toLowerCase());
  if(!matches(p)||!matches(snapshot.payment))fail('SBC_CAPTURE_READBACK_MISMATCH');
  const at=square?Date.parse(event.created_at):Number.isSafeInteger(event.created)&&event.created>0?event.created*1000:NaN;
  if(!Number.isFinite(at)||at<=0||at>8640000000000000)fail('SBC_CAPTURE_TIME_INVALID');
  const evidence={provider,environment,accountId,eventId,tenantRef:b.tenantRef,kind:'capture',amountMinor:b.amountMinor,currency:b.currency,occurredAt:new Date(at).toISOString(),payloadSha256:createHash('sha256').update(raw).digest('hex')};
  normalizePaymentEvidence(evidence);
  return ingest(evidence,correlationId===undefined?{}:{correlationId});
 };
}
module.exports={createCaptureAdapter};
