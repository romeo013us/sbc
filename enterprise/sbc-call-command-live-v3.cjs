'use strict';
// SBC Call Command V3: bounded, human-initiated, server-authorized voice adapter.
// Does not itself place calls. All live Twilio webhooks must independently
// validate Twilio signatures AND the one-use durable attempt before returning Dial.
const {createHash}=require('node:crypto');
const {acceptedOrigins}=require('./v6619-signed-twilio-webhook');
const v2=require('./sbc-call-command-voice-preflight-v2.cjs');
const authKind='SBC_CALL_AUTH_V3',revokedKind='SBC_CALL_AUTH_V3_REVOKED';
function phone(value){return v2.phone(value)}
function authorizationRecord(notes,account,now=new Date()){
 if(!Array.isArray(notes)||!account||!phone(account.phone))return null;
 const records=notes.filter(x=>x&&(x.kind===authKind||x.kind===revokedKind))
  .sort((a,b)=>Date.parse(b.authorizedAt||0)-Date.parse(a.authorizedAt||0));
 if(!records.length||records[0].kind!==authKind)return null;
 const r=records[0];
 if(!r.verifiedBy||phone(r.phone)!==phone(account.phone)||r.phoneVerified!==true||
  r.dncChecked!==true||r.callingAuthorized!==true||r.consentOrLegalBasisVerified!==true)return null;
 const since=Date.parse(r.authorizedAt||''),expiry=Date.parse(r.expiresAt||'');
 if(!Number.isFinite(since)||!Number.isFinite(expiry)||since>now.getTime()+60000||
  expiry<=now.getTime()||expiry-since>8*86400000)return null;
 return r;
}
function evaluate({account,user,tenantId,cert,providerReady=false,loggingReady=false,
 enabled=false,now=new Date(),suppressed=false}={}){
 const evidence=cert&&authorizationRecord([cert],account,now);
 const flags={
  phoneVerified:Boolean(evidence?.phoneVerified),dncChecked:Boolean(evidence?.dncChecked),
  callingAuthorized:Boolean(evidence?.callingAuthorized),
  consentOrLegalBasisVerified:Boolean(evidence?.consentOrLegalBasisVerified),
  prospectTimeZone:evidence?.prospectTimeZone,providerReady:Boolean(providerReady),
  durableLoggingReady:Boolean(loggingReady),
  doNotContact:Boolean(suppressed)
 };
 const result=v2.preflight({account,user,tenantId,flags,now});
 const reasons=[...result.reasons];
 if(!enabled)reasons.push('CALL_COMMAND_NOT_ENABLED');
 return Object.freeze({allowed:reasons.length===0,reasons,readOnly:true});
}
function identityFor(tenant,actorId){
 if(!Number.isSafeInteger(Number(tenant))||Number(tenant)<1||!String(actorId||''))throw Error('INVALID_IDENTITY');
 return 'sbc-cc-'+String(tenant)+'-'+createHash('sha256').update(String(actorId)).digest('hex').slice(0,20);
}
function escapeXml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function dialXml({phone:destination,from,statusUrl}={}){
 const to=phone(destination),callerId=phone(from);
 if(!to||!callerId)throw Error('VALID_NUMBERS_REQUIRED');
 let status;try{status=new URL(statusUrl)}catch{throw Error('VALID_CALLBACK_REQUIRED')}
 if(status.protocol!=='https:'||status.username||status.password||status.hash)throw Error('HTTPS_CALLBACK_REQUIRED');
 return '<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="'+escapeXml(callerId)+'">'+
  '<Number statusCallback="'+escapeXml(status.href)+'" statusCallbackMethod="POST" '+
  'statusCallbackEvent="initiated ringing answered completed">'+escapeXml(to)+'</Number></Dial></Response>';
}
const allowedWebhooks=new Set(['/api/v6606/crm/call-command/twiml',
 '/api/v6606/crm/call-command/status']);
function verifyTwilioForm(req,{authToken,origins,validateRequest}={}){
 const url=String(req?.originalUrl||req?.url||'');
 let pathname;try{pathname=new URL(url,'https://example.invalid').pathname}catch{return false}
 if(!allowedWebhooks.has(pathname)||typeof validateRequest!=='function'||!authToken||
  !String(req?.headers?.['content-type']||'').toLowerCase().startsWith('application/x-www-form-urlencoded')||
  !req?.body||typeof req.body!=='object'||Array.isArray(req.body))return false;
 const sig=String(req.headers?.['x-twilio-signature']||'');
 if(!sig)return false;
 try{return acceptedOrigins(origins||[]).some(origin=>validateRequest(String(authToken),sig,origin+url,req.body)===true)}
 catch{return false}
}
function settings(env=process.env){
 const get=(a,b)=>String(env[a]||env[b]||'').trim();
 const origin=acceptedOrigins([env.SBC_PUBLIC_URL,env.SBC_APP_URL])[0]||'';
 const accountSid=get('TWILIO_ACCOUNT_SID','SBC_TWILIO_ACCOUNT_SID');
 const apiKeySid=get('TWILIO_API_KEY_SID','TWILIO_API_KEY_SID');
 const apiKeySecret=get('TWILIO_API_KEY_SECRET','TWILIO_API_KEY_SECRET');
 const appSid=get('SBC_CALL_COMMAND_TWIML_APP_SID','SBC_CALL_COMMAND_TWIML_APP_SID');
 const callerId=phone(get('TWILIO_PHONE_NUMBER','SBC_TWILIO_FROM'));
 const authToken=get('TWILIO_AUTH_TOKEN','SBC_TWILIO_AUTH_TOKEN');
 // Normal operation is ready when the dedicated provider configuration is
 // complete. An explicit emergency stop still overrides readiness, and
 // malformed switch values never accidentally authorize dialing.
 const missingSettings=Object.entries({
  SBC_PUBLIC_URL:!!origin,TWILIO_ACCOUNT_SID:/^AC[0-9a-f]{32}$/i.test(accountSid),
  TWILIO_API_KEY_SID:/^SK[0-9a-f]{32}$/i.test(apiKeySid),TWILIO_API_KEY_SECRET:!!apiKeySecret,
  SBC_CALL_COMMAND_TWIML_APP_SID:/^AP[0-9a-f]{32}$/i.test(appSid),
  TWILIO_PHONE_NUMBER:!!callerId,TWILIO_AUTH_TOKEN:!!authToken
 }).filter(([,valid])=>!valid).map(([key])=>key);
 const configured=missingSettings.length===0;
 const flag=String(env.SBC_CALL_COMMAND_V3_ENABLED??'').trim();
 const activationState=flag==='0'?'PAUSED_BY_OWNER':flag!==''&&flag!=='1'?'INVALID_SETTING':
  !configured?'PROVIDER_SETUP_REQUIRED':'CONFIGURED';
 return {origin,accountSid,apiKeySid,apiKeySecret,appSid,callerId,authToken,configured,
  enabled:activationState==='CONFIGURED',activationState,missingSettings};
}
function voiceToken(cfg,identity,twilio=require('twilio')){
 if(!cfg?.configured||!identity)throw Error('VOICE_NOT_CONFIGURED');
 const AccessToken=twilio.jwt.AccessToken;
 const jwt=new AccessToken(cfg.accountSid,cfg.apiKeySid,cfg.apiKeySecret,
  {identity,ttl:300});
 jwt.addGrant(new AccessToken.VoiceGrant({
  outgoingApplicationSid:cfg.appSid,incomingAllow:false
 }));
 return jwt.toJwt();
}
function parseNotes(row){
 try{const x=row?.account_notes_json?JSON.parse(row.account_notes_json):[];return Array.isArray(x)?x:null}
 catch{return null}
}
function isSuppressed(row,cached){
 return ['do not call','do not contact','dnc','opt out','unsubscribe','lost','bad number','wrong number','deleted']
  .includes(String(row?.status||'').trim().toLowerCase())||
  cached?.doNotContact===true||cached?.doNotCall===true||cached?.salesSuppressed===true;
}
function validateActor(user,row,tenant,staff){
 if(!user||user.active===false||!['owner','account_manager'].includes(user.role)||
  Number(row?.tenant_id)!==Number(tenant))return false;
 if(user.role==='owner')return true;
 return String(row?.assigned_to||'')===String(user.id||'')&&
  Array.isArray(staff)&&staff.some(s=>String(s.id)===String(user.id)&&
    Number(s.tenantId??s.tenant_id)===Number(tenant)&&s.role==='account_manager'&&s.active!==false);
}
module.exports=Object.freeze({authorizationRecord,evaluate,identityFor,dialXml,
 verifyTwilioForm,settings,voiceToken,parseNotes,isSuppressed,validateActor,phone,
 authKind,revokedKind});
