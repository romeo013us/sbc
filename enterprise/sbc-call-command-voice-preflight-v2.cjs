'use strict';
// SBC Call Command V2: read-only, tenant-scoped, fail-closed call preflight.
// CRM assignment, a phone number, or a client-side flag NEVER grants dialing rights.
const BLOCKED=new Set(['do not call','do not contact','dnc','opt out','unsubscribe','lost','bad number','wrong number','deleted']);
const phone=v=>{
 let s=String(v??'').trim().replace(/[().\s-]/g,'');
 if(/^\d{10}$/.test(s))s='+1'+s;
 else if(/^1\d{10}$/.test(s))s='+'+s;
 return /^\+[1-9]\d{7,14}$/.test(s)?s:'';
};
function preflight({account,user,tenantId,flags={},now=new Date()}={}){
 const reasons=[];
 const tenant=Number(tenantId),actor=String(user?.id||'');
 if(!Number.isSafeInteger(tenant)||tenant<1||!actor||!['owner','account_manager'].includes(user?.role)||user?.active===false)
  reasons.push('CALLER_NOT_AUTHORIZED');
 if(!account||Number(account.tenant_id??account.tenantId)!==tenant)reasons.push('ACCOUNT_TENANT_MISMATCH');
 if(user?.role==='account_manager'&&String(account?.assigned_to??account?.assignedTo??'')!==actor)
  reasons.push('ACCOUNT_NOT_ASSIGNED');
 if(!phone(account?.phone))reasons.push('PHONE_INVALID');
 if(BLOCKED.has(String(account?.status||'').trim().toLowerCase())||flags.doNotContact===true||flags.doNotCall===true||flags.salesSuppressed===true)
  reasons.push('CONTACT_SUPPRESSED');
 // These are authoritative, server-verified records, never browser booleans.
 if(flags.phoneVerified!==true)reasons.push('PHONE_NOT_VERIFIED');
 if(flags.dncChecked!==true)reasons.push('DNC_SCREENING_REQUIRED');
 if(flags.callingAuthorized!==true)reasons.push('OUTREACH_AUTHORIZATION_REQUIRED');
 if(flags.consentOrLegalBasisVerified!==true)reasons.push('CALLING_BASIS_UNVERIFIED');
 const tz=flags.prospectTimeZone;
 let hour=-1;
 if(typeof tz==='string'&&tz.length<=65){
  try{hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'2-digit',hourCycle:'h23'}).format(now))}catch{}
 }
 if(hour<0)reasons.push('PROSPECT_TIME_ZONE_UNVERIFIED');
 else if(hour<9||hour>=20)reasons.push('OUTSIDE_CALL_WINDOW');
 if(flags.providerReady!==true)reasons.push('VOICE_PROVIDER_NOT_READY');
 if(flags.durableLoggingReady!==true)reasons.push('CALL_LOG_NOT_READY');
 return Object.freeze({ok:true,allowed:reasons.length===0,reasons,
  mode:'READ_ONLY_PREFLIGHT',outboundAttempted:false,tokenMinted:false,callLogged:false});
}
module.exports=Object.freeze({phone,preflight});
