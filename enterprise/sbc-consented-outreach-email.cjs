'use strict';
/* SBC consented outbound email adapter.
 * GoDaddy platform mail is for transactional email, NOT cold marketing outreach.
 * SendGrid nontransactional email requires documented affirmative opt-in.
 * No network traffic until owner authorizes a single checked CRM task.
 */
const emailRx=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function clean(v,n=500){return String(v??'').trim().slice(0,n)}
function envStatus(env=process.env){
 const p=clean(env.SBC_MARKETING_POSTAL_ADDRESS,500);
 const privacy=clean(env.SBC_MARKETING_PRIVACY_URL,500);
 const group=Number(env.SBC_SENDGRID_UNSUBSCRIBE_GROUP_ID);
 const privacyOk=(()=>{try{const u=new URL(privacy);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password}catch{return false}})();
 const postalOk=p.length>12 && !/\b(todo|placeholder|example|address here|test)\b/i.test(p) &&
  /\d/.test(p);
 const settings={
  enabled:env.SBC_MARKETING_EMAIL_ENABLED==='true',
  provider:'sendgrid',
  apiKeyReady:clean(env.SENDGRID_API_KEY).length>20,
  senderAttested:env.SBC_MARKETING_SENDER_VERIFIED==='true',
  unsubscribeGroupReady:Number.isSafeInteger(group)&&group>0,
  postalAddressReady:postalOk,privacyPolicyReady:privacyOk,
  sender:'info@sbcmia.com'
 };
 settings.ready=settings.enabled&&settings.apiKeyReady&&settings.senderAttested&&
  settings.unsubscribeGroupReady&&settings.postalAddressReady&&settings.privacyPolicyReady;
 return settings;
}
const {hasConsent}=require('./sbc-outreach-consent-ledger.cjs');

function prepared(c,draft,env=process.env){
 const status=envStatus(env);
 if(!status.ready)throw Object.assign(Error('MARKETING_PROVIDER_NOT_READY'),{status:503});
 if(!hasConsent(c))throw Object.assign(Error('EMAIL_OPT_IN_EVIDENCE_REQUIRED'),{status:422});
 const to=clean(c.email,254);
 if(!emailRx.test(to))throw Object.assign(Error('EMAIL_INVALID'),{status:422});
 const address=clean(env.SBC_MARKETING_POSTAL_ADDRESS,500),privacy=clean(env.SBC_MARKETING_PRIVACY_URL,500);
 const group=Number(env.SBC_SENDGRID_UNSUBSCRIBE_GROUP_ID);
 let text=String(draft?.text||'');
 if(!text||!draft?.subject)throw Object.assign(Error('EMAIL_DRAFT_REQUIRED'),{status:422});
 text=text.replace('[Verified physical mailing address required before sending]',address);
 if(text.includes('[Verified'))throw Object.assign(Error('EMAIL_UNVERIFIED_PLACEHOLDER'),{status:422});
 text=text.replace('To stop receiving marketing emails from SBC, reply unsubscribe.',
   'Advertisement: SBC business services.\nPrivacy policy: '+privacy+
   '\nUnsubscribe from SBC marketing emails: <%asm_group_unsubscribe_raw_url%>\nYou may also reply "unsubscribe".');
 const escapeHtml=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const html='<div style="font:15px/1.6 Arial,Helvetica,sans-serif;max-width:640px">'+
    escapeHtml(text).replace(/\n/g,'<br>')+
    '<p><a href="<%asm_group_unsubscribe_raw_url%>">Unsubscribe from SBC marketing emails</a></p></div>';
 return {to,subject:String(draft.subject).slice(0,140),text,html,
  from:{email:'info@sbcmia.com',name:'Jonathan Jones | Successful By Choice'},
  reply_to:{email:'info@sbcmia.com',name:'Successful By Choice'},
  asm:{group_id:group},settings:status};
}
async function submit(c,draft,{env=process.env,transport=globalThis.fetch,taskId='',tenantId=''}={}){
 const m=prepared(c,draft,env);
 if(typeof transport!=='function')throw Object.assign(Error('EMAIL_HTTPS_UNAVAILABLE'),{status:503});
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await transport('https://api.sendgrid.com/v3/mail/send',{
   method:'POST',redirect:'error',signal:controller.signal,
   headers:{Authorization:'Bearer '+env.SENDGRID_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({
    personalizations:[{to:[{email:m.to}],custom_args:{sbc_task_id:clean(taskId,120),sbc_tenant_id:clean(tenantId,30)}}],
    from:m.from,reply_to:m.reply_to,subject:m.subject,
    content:[{type:'text/plain',value:m.text},{type:'text/html',value:m.html}],
    asm:m.asm,tracking_settings:{open_tracking:{enable:false},click_tracking:{enable:false}},
    categories:['sbc-consented-outbound']
   })
  });
  if(response.status!==202)throw Object.assign(Error('SENDGRID_SUBMISSION_REJECTED'),{status:502});
  const id=response.headers?.get?.('x-message-id')||'';
  return {accepted:true,provider:'sendgrid',providerMessageId:clean(id,190),
   status:'PROVIDER_ACCEPTED_NOT_DELIVERED',recipient:m.to};
 }finally{clearTimeout(timeout);}
}
module.exports={envStatus,hasConsent,prepared,submit};
