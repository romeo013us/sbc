'use strict';
// GoDaddy Node.js Hosting loopback email gateway. No user-configurable URL,
// no arbitrary 'from' header, and no SMTP/network credential handling.
// Contract: https://github.com/godaddy/nodejs-hosting-agent-skill/blob/main/skills/godaddy-nodejs-hosting/email.md
const URL='http://127.0.0.1:2525/api/email/send';
const TIMEOUT_MS=30000;
const emailRx=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeRecipients(value){
 const items=(Array.isArray(value)?value:[value]).filter(v=>v!==undefined&&v!==null).map(v=>String(v).trim());
 if(!items.length||items.length>100||items.some(v=>!emailRx.test(v)))throw Object.assign(new Error('EMAIL_RECIPIENT_INVALID'),{code:'EMAIL_RECIPIENT_INVALID'});
 return items;
}
async function sendEmail({to,subject,text,html,replyTo}={},deps={}){
 const recipients=normalizeRecipients(to);
 const title=String(subject||'').trim();
 if(!title||Buffer.byteLength(title,'utf8')>998)throw Object.assign(new Error('EMAIL_SUBJECT_INVALID'),{code:'EMAIL_SUBJECT_INVALID'});
 if(!text&&!html)throw Object.assign(new Error('EMAIL_BODY_REQUIRED'),{code:'EMAIL_BODY_REQUIRED'});
 const payload={to:recipients,subject:title};
 if(text)payload.text=String(text);
 if(html)payload.html=String(html);
 if(replyTo)payload.replyTo=String(replyTo);
 // Never supply from; platform selects the verified canonical sender.
 const request=deps.fetch||globalThis.fetch;
 if(typeof request!=='function')throw Object.assign(new Error('EMAIL_GATEWAY_FETCH_UNAVAILABLE'),{code:'EMAIL_GATEWAY_FETCH_UNAVAILABLE'});
 const signal=deps.signal || AbortSignal.timeout(TIMEOUT_MS);
 let response,body;
 try{
   response=await request(URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal});
   try{body=await response.json()}catch(e){if(e?.name==='AbortError'||e?.name==='TimeoutError')throw e;body={success:false,error:'non-json gateway response'};}
 }catch(e){const err=new Error('EMAIL_GATEWAY_UNREACHABLE');err.code='EMAIL_GATEWAY_UNREACHABLE';err.cause=e;throw err;}
 if(!response.ok||body?.success!==true||!body?.messageId){
   const err=new Error('EMAIL_GATEWAY_DELIVERY_FAILED');err.code='EMAIL_GATEWAY_DELIVERY_FAILED';err.status=Number(response.status);throw err;
 }
 return {messageId:String(body.messageId)};
}
module.exports={sendEmail,normalizeRecipients};
