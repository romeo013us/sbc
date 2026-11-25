'use strict';
// Voice response handlers: the server retains its signed callback and route middleware.
function createTwilioVoiceHandlers(getContext){
 if(typeof getContext!=='function')throw Error('Voice context required');
 return {
 status(req,res){const role=String(req.user?.role||'').trim().toLowerCase();if(!['owner','manager','caller'].includes(role))return res.status(403).json({ok:false,error:'VOICE_CALLER_ROLE_REQUIRED'});
 const {secretValue,sbcTwilioWebhookTokenV6619,createSbcTwilioOriginsV6619,sbcTwilioWebhookOriginsV6619}=getContext();
  const requiredSecrets=['TWILIO_ACCOUNT_SID','TWILIO_API_KEY_SID','TWILIO_API_KEY_SECRET','TWILIO_TWIML_APP_SID','TWILIO_PHONE_NUMBER'];
  const vals={TWILIO_ACCOUNT_SID:secretValue('TWILIO_ACCOUNT_SID','SBC_TWILIO_ACCOUNT_SID'),TWILIO_API_KEY_SID:secretValue('TWILIO_API_KEY_SID','TWILIO_API_KEY_SID'),TWILIO_API_KEY_SECRET:secretValue('TWILIO_API_KEY_SECRET','TWILIO_API_KEY_SECRET'),TWILIO_TWIML_APP_SID:secretValue('TWILIO_TWIML_APP_SID','TWILIO_TWIML_APP_SID'),TWILIO_PHONE_NUMBER:secretValue('TWILIO_PHONE_NUMBER','SBC_TWILIO_FROM')};
  const missingSecrets=requiredSecrets.filter(k=>!vals[k]); const configured=missingSecrets.length===0;
  res.json({webhookSignatureReady:Boolean(sbcTwilioWebhookTokenV6619()&&createSbcTwilioOriginsV6619(sbcTwilioWebhookOriginsV6619()).length),configured,mode:configured?'browser-softphone':'not-connected',provider:'Twilio Voice',businessNumber:vals.TWILIO_PHONE_NUMBER||'',features:{clickToCall:configured,callerId:configured,callLogs:true,recording:Boolean(process.env.TWILIO_RECORD_CALLS==='true'),transcription:Boolean(process.env.TWILIO_TRANSCRIBE_CALLS==='true'),callbacks:true},setup:{noPersonalPhoneRequired:true,requiredSecrets,missingSecrets}});
},
 token(req,res){const role=String(req.user?.role||'').trim().toLowerCase();if(!['owner','manager','caller'].includes(role))return res.status(403).json({ok:false,error:'VOICE_CALLER_ROLE_REQUIRED'});
 const {secretValue,makeTwilioVoiceToken,v9CanLiveCall}=getContext();if(role==='caller'&&!v9CanLiveCall(req.user))return res.status(403).json({ok:false,error:'CALLER_ONBOARDING_AND_CERTIFICATION_REQUIRED'});const required=['TWILIO_ACCOUNT_SID','TWILIO_API_KEY_SID','TWILIO_API_KEY_SECRET','TWILIO_TWIML_APP_SID','TWILIO_PHONE_NUMBER'];const vals={TWILIO_ACCOUNT_SID:secretValue('TWILIO_ACCOUNT_SID','SBC_TWILIO_ACCOUNT_SID'),TWILIO_API_KEY_SID:secretValue('TWILIO_API_KEY_SID','TWILIO_API_KEY_SID'),TWILIO_API_KEY_SECRET:secretValue('TWILIO_API_KEY_SECRET','TWILIO_API_KEY_SECRET'),TWILIO_TWIML_APP_SID:secretValue('TWILIO_TWIML_APP_SID','TWILIO_TWIML_APP_SID'),TWILIO_PHONE_NUMBER:secretValue('TWILIO_PHONE_NUMBER','SBC_TWILIO_FROM')};if(required.some(k=>!vals[k]))return res.status(503).json({error:'Twilio Voice is not connected yet.',missingSecrets:required.filter(k=>!vals[k])});try{res.json({token:makeTwilioVoiceToken(req.user.id),identity:req.user.username||req.user.id,expiresIn:3600,businessNumber:vals.TWILIO_PHONE_NUMBER})}catch(e){res.status(503).json({error:e.message})}},
 authorizedTwiml(req,res){
 if(req.verdict?.allowed!==true)return res.status(403).type('text/xml').send('<Response><Say>This call is not permitted.</Say></Response>');
 const {normalizeDialNumber,secretValue,xmlEsc}=getContext();
 const to=normalizeDialNumber(req.body?.To||req.body?.to);const from=normalizeDialNumber(secretValue('TWILIO_PHONE_NUMBER','SBC_TWILIO_FROM'));if(!/^\+\d{10,15}$/.test(to)||!/^\+\d{10,15}$/.test(from))return res.status(400).type('text/xml').send('<Response><Say>Invalid phone number.</Say></Response>');res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${xmlEsc(from)}"><Number>${xmlEsc(to)}</Number></Dial></Response>`)}
 };
}
module.exports={createTwilioVoiceHandlers};
