'use strict';
/* SBC V66.137: SMS receipt truth, no external API calls */
const GUIDANCE=Object.freeze({
  30034:'Twilio blocked U.S. SMS because the sender is not associated with an approved A2P 10DLC campaign. Check Messaging registration and sender pool.',
  30035:'Twilio is still registering this sending number. Check registration status before retrying.',
  21610:'Twilio reports the recipient opted out. Do not retry without valid fresh opt-in.',
  21211:'Twilio rejected the recipient phone number. Check phone number and country code.',
  21608:'Twilio trial accounts may only message verified recipients. Check account status.',
  21606:'Twilio does not recognize the sending number as an eligible sender for this account.'
});
function fail(code,message){throw Object.assign(new Error(message||code),{code});}
function destination(raw){
  if(typeof raw!=='string'&&typeof raw!=='number')fail('SMS_DESTINATION_REQUIRED','The customer does not have a valid phone number.');
  let v=String(raw).trim().replace(/[\s().-]/g,'');
  if(/^\d{10}$/.test(v))v='+1'+v;
  else if(/^1\d{10}$/.test(v))v='+'+v;
  if(!/^\+[1-9]\d{7,14}$/.test(v))fail('SMS_INVALID_PHONE','The customer phone number must include a valid country code (for example, +13055550123).');
  return v;
}
function providerError(data={},httpStatus=0){
  const code=Number(data?.code)||null;
  const reason=GUIDANCE[code]||('Twilio rejected this SMS request'+(code?' (error '+code+')':'')+'. Check Messaging Logs and sender registration.');
  const e=new Error(reason);e.code=code?'TWILIO_'+code:'TWILIO_SMS_REJECTED';e.providerCode=code;e.status=Number(httpStatus)||502;
  return e;
}
function receipt(data={}){
  const sid=String(data.sid||'').trim(),status=String(data.status||'unknown').toLowerCase();
  if(!/^SM[a-f0-9]{32}$/i.test(sid))fail('SMS_PROVIDER_RECEIPT_REQUIRED','Twilio did not return a valid message reference. Check Twilio logs before sending again.');
  if(['failed','undelivered','canceled'].includes(status))throw providerError({code:data.error_code||data.errorCode},502);
  return {sid,providerStatus:status,deliveryConfirmed:status==='delivered',
    message:'Twilio accepted the message request. Delivery to the recipient is not yet confirmed.'};
}
function isSuppressed(c){
  const status=String(c?.status||'').trim().toLowerCase();
  return !!(c?.smsOptOut===true||c?.sbcSmsOptOut===true||c?.doNotContact===true||c?.doNotCall===true||
    c?.salesSuppressed===true||c?.isSuppressed===true||['dnc','do not call','do not contact','opt out','unsubscribe'].includes(status));
}
module.exports={destination,receipt,providerError,isSuppressed};
