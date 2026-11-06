'use strict';
// SBC V66.95 — staging-only repair for malformed Twilio Voice Access Tokens.
// The pinned source and Published service must never be modified by this stage script.
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V6695_TWILIO_SDK_TOKEN';
const START='function makeTwilioVoiceToken(identity){';
const END='\nfunction xmlEsc(';
const REPLACEMENT=`function makeTwilioVoiceToken(identity){
  // ${MARK}: let the official Twilio helper generate the full authenticated JWT.
  const accountSid=secretValue('TWILIO_ACCOUNT_SID','SBC_TWILIO_ACCOUNT_SID'),
    keySid=secretValue('TWILIO_API_KEY_SID','TWILIO_API_KEY_SID'),
    keySecret=secretValue('TWILIO_API_KEY_SECRET','TWILIO_API_KEY_SECRET'),
    appSid=secretValue('TWILIO_TWIML_APP_SID','TWILIO_TWIML_APP_SID');
  if(!accountSid||!keySid||!keySecret||!appSid) throw new Error('Twilio Voice is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET and TWILIO_TWIML_APP_SID in GoDaddy Secrets.');
  const AccessToken=require('twilio').jwt.AccessToken;
  const token=new AccessToken(accountSid,keySid,keySecret,{identity:String(identity||'sbc-user'),ttl:3600});
  token.addGrant(new AccessToken.VoiceGrant({outgoingApplicationSid:appSid,incomingAllow:false}));
  return token.toJwt();
}`;
function patchServer(input){
  const src=String(input||'');
  if(src.split(START).length!==2)throw Error('VOICE_TOKEN_FUNCTION_ANCHOR_NOT_UNIQUE');
  if(src.includes(MARK)){
    if(src.split(MARK).length!==2||src.includes("const header={typ:'JWT',alg:'HS256'};"))throw Error('VOICE_TOKEN_PARTIAL_PATCH');
    if(!src.includes(REPLACEMENT))throw Error('VOICE_TOKEN_UNRECOGNIZED_PATCH');
    return src;
  }
  const start=src.indexOf(START),end=src.indexOf(END,start);
  if(end<start)throw Error('VOICE_TOKEN_BOUNDARY_MISSING');
  const original=src.slice(start,end);
  for(const guard of ["const header={typ:'JWT',alg:'HS256'};","crypto.createHmac('sha256',keySecret)","exp:nowSec+3600"]){
    if(!original.includes(guard))throw Error('VOICE_TOKEN_SOURCE_CHANGED: '+guard);
  }
  return src.slice(0,start)+REPLACEMENT+src.slice(end);
}
if(require.main===module){
  const file=path.resolve(__dirname,'../server.js');
  const before=fs.readFileSync(file,'utf8'),after=patchServer(before);
  if(process.argv.includes('--apply')){
    if(process.env.SBC_V6695_ISOLATED_STAGE!=='YES')throw Error('VOICE_TOKEN_STAGE_ONLY');
    fs.writeFileSync(file,after);
    console.log('[SBC V66.95] Official Twilio Voice token generation staged; regenerate release identity and receipt');
  }else console.log('[SBC V66.95] Voice token source can be safely transformed; no changes made');
}
module.exports={MARK,START,END,REPLACEMENT,patchServer};
