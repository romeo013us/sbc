'use strict';
// Fail-closed Twilio Voice webhook validator; no new environment variable required.
// Uses existing TWILIO_AUTH_TOKEN / SBC_TWILIO_AUTH_TOKEN, verified with Twilio's SDK.
function acceptedOrigins(values){
 const origins=[];
 for(const candidate of values||[]){
  if(!candidate)continue;
  try{const url=new URL(String(candidate));if(url.protocol!=='https:'||url.username||url.password)continue;if(!origins.includes(url.origin))origins.push(url.origin)}catch{}
 }
 return origins;
}
function createSignedTwilioVoiceGuard({getToken,getOrigins,validateRequest}){
 if(typeof getToken!=='function'||typeof getOrigins!=='function'||typeof validateRequest!=='function')throw Error('Twilio webhook verifier not configured');
 return (req,res,next)=>{
  const token=String(getToken()||''),origins=acceptedOrigins(getOrigins());
  if(!token||!origins.length)return res.status(503).json({ok:false,error:'TWILIO_WEBHOOK_VERIFICATION_UNCONFIGURED'});
  if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/x-www-form-urlencoded'))return res.status(415).json({ok:false,error:'TWILIO_WEBHOOK_FORM_REQUIRED'});
  const url=String(req.originalUrl||req.url||'');
  if(!/^\/api\/voice\/twiml(?:\?|$)/.test(url))return res.status(403).json({ok:false,error:'TWILIO_WEBHOOK_PATH_DENIED'});
  const signature=String(req.headers?.['x-twilio-signature']||req.get?.('x-twilio-signature')||'');
  if(!signature||!req.body||typeof req.body!=='object'||Array.isArray(req.body))return res.status(403).json({ok:false,error:'TWILIO_WEBHOOK_SIGNATURE_REQUIRED'});
  let verified=false;
  try{verified=origins.some(origin=>validateRequest(token,signature,origin+url,req.body)===true)}catch{verified=false}
  if(!verified)return res.status(403).json({ok:false,error:'TWILIO_WEBHOOK_SIGNATURE_INVALID'});
  next();
 };
}
module.exports={acceptedOrigins,createSignedTwilioVoiceGuard};
