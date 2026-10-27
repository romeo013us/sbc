'use strict';
// V66.64: side-effect-free Twilio callback preflight. Never return secret values.
const {acceptedOrigins}=require('./v6619-signed-twilio-webhook.js');

function inspect({env={},signatureTokenPresent=false,checkedAt=null}={}){
  const origins=acceptedOrigins([env.SBC_PUBLIC_URL,env.SBC_APP_URL]);
  const signatureReady=signatureTokenPresent===true;
  const trustedHttpsOriginReady=origins.length>0;
  const callbackVerificationConfigured=signatureReady&&trustedHttpsOriginReady;
  const blockers=[];
  if(!signatureReady)blockers.push({
    code:'TWILIO_AUTH_TOKEN_MISSING',
    action:'Configure TWILIO_AUTH_TOKEN or SBC_TWILIO_AUTH_TOKEN in GoDaddy Secrets. Never paste the value into tickets or chats.'
  });
  if(!trustedHttpsOriginReady)blockers.push({
    code:'PUBLIC_HTTPS_CALLBACK_ORIGIN_MISSING',
    action:'Set SBC_PUBLIC_URL or SBC_APP_URL to the actual HTTPS SBC Published origin. The voice callback must use the identical public host.'
  });
  const callbackUrls=origins.map(origin=>origin+'/api/voice/twiml');
  return {
    ok:true,
    mode:'OWNER_READ_ONLY',
    checkedAt:checkedAt||new Date().toISOString(),
    configuredForSignedVoiceCallback:callbackVerificationConfigured,
    checks:{
      signatureTokenPresent:signatureReady,
      trustedHttpsOriginReady,
      configuredCallbackOriginCount:origins.length
    },
    callbackUrls,
    blockers,
    status:callbackVerificationConfigured?'CALLBACK_PREREQUISITES_PRESENT':'CONFIGURATION_BLOCKED',
    remainingChecks:[
      'Confirm the Twilio TwiML Application Voice URL exactly matches the intended callback URL and uses HTTP POST.',
      'Check /api/voice/status and /api/voice/token with an authenticated owner session; never disclose an access token.',
      'Allow microphone access in a secure browser context and confirm the Twilio Voice SDK initializes.',
      'Complete a consented real call to your own phone, verify two-way audio, then verify tenant-bound CRM call logging.'
    ],
    restrictions:{
      realCallMade:false,tokenMinted:false,providerContacted:false,
      crmChanged:false,paymentCreated:false,secretsReturned:false,
      certified:false
    }
  };
}
module.exports={inspect};
