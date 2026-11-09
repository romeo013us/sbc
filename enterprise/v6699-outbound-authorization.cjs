'use strict';
const SBC_PHONE_RECOVERY=require('./sbc-phone-recovery-v66137.cjs');
/* SBC V66.99: server-side outbound Voice authorization, pure and fail closed.
 * Twilio signature verification must occur BEFORE this function is called.
 * No mutation, provider access or privileged role escalation.
 */
const normPhone=v=>{
 let n=String(v??'').trim().replace(/[\s().-]/g,'');
 if(/^\d{10}$/.test(n))n='+1'+n;
 else if(/^1\d{10}$/.test(n))n='+'+n;
 return /^\+[1-9]\d{7,14}$/.test(n)?n:'';
};
function suppressed(c){
 const st=String(c?.status||'').trim().toLowerCase();
 return c?.doNotContact===true||c?.salesSuppressed===true||c?.isSuppressed===true||
  ['do not call','do not contact','dnc','opt out','unsubscribe'].includes(st);
}
function authorize({from,to,users,customers,canLiveCall,badCallLogs=[]}){
 const target=normPhone(to);
 if(!target)return {allowed:false,code:'INVALID_DESTINATION'};
 const match=String(from||'').match(/^client:([A-Za-z0-9_.:-]{1,120})$/);
 if(!match)return {allowed:false,code:'VOICE_IDENTITY_REQUIRED'};
 const actor=(users||[]).find(u=>String(u.id)===match[1]);
 if(!actor||actor.active===false)return {allowed:false,code:'VOICE_USER_NOT_ACTIVE'};
 if(actor.expiresAt&&(!Number.isFinite(Date.parse(actor.expiresAt))||Date.parse(actor.expiresAt)<=Date.now()))
  return {allowed:false,code:'VOICE_ACCOUNT_EXPIRED'};
 const tenantId=Number(actor.tenantId??actor.tenant_id);
 if(!Number.isSafeInteger(tenantId)||tenantId<=0)return {allowed:false,code:'VOICE_TENANT_REQUIRED'};
 const role=String(actor.role||'').toLowerCase();
 if(!['owner','manager','caller'].includes(role))return {allowed:false,code:'VOICE_ROLE_DENIED'};
 if(role==='caller'&&(!canLiveCall||canLiveCall(actor)!==true))
  return {allowed:false,code:'VOICE_CERTIFICATION_REQUIRED'};
 const tenantMatches=(customers||[]).filter(c=>Number(c.tenantId??c.tenant_id)===tenantId && normPhone(c.phone)===target);
 if(tenantMatches.some(c=>SBC_PHONE_RECOVERY.isHeld(c)||SBC_PHONE_RECOVERY.hasUnreachableLog(c,badCallLogs)))return {allowed:false,code:'VOICE_PHONE_VERIFICATION_HOLD'};
 if(tenantMatches.some(suppressed))return {allowed:false,code:'VOICE_DNC_BLOCKED'};
 if(role==='caller' && !tenantMatches.some(c=>String(c.assignedTo||'')===String(actor.id)&&!suppressed(c)))
  return {allowed:false,code:'VOICE_LEAD_NOT_ASSIGNED'};
 return {allowed:true,code:'AUTHORIZED',to:target,tenantId,role,userId:String(actor.id)};
}
module.exports={normPhone,suppressed,authorize};
