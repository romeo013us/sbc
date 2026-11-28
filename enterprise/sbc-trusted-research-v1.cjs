'use strict';
/* SBC owner-trusted research v1. This is a HUMAN ATTESTATION shortcut, NOT
   external verification of identity, numbers, consent, or right to contact. */
const BAD_STATUS=new Set(['customer','active_customer','active','fulfilled','lost','closed','duplicate','dnc','do not contact','do not call','unsubscribe','opt out','opt-out','not qualified']);
const normalize=v=>String(v??'').trim().toLowerCase();
function tenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw Error('TENANT_CONTEXT_REQUIRED');return n;}
function isLorna(user){return Boolean(user&&user.active!==false&&normalize(user.role)==='lead_researcher'&&
 (normalize(user.username)==='lorna'||/^lorna(?:\s|$)/i.test(String(user.name||''))));}
function suppressed(c){const status=normalize(c?.status);
 return !c||BAD_STATUS.has(status)||c.salesSuppressed===true||c.doNotContact===true||c.doNotCall===true||
 c.optedOut===true||c.isSuppressed===true||
 /\b(?:do not contact|do not call|unsubscribe|opt[\s-]?out|stop messages)\b/i.test(String(c.notes||'')+' '+String(c.followUp||''));
}
function synthetic(c){return Boolean(c?.sbcTest===true||c?.testMode===true||c?.testPayment?.realCharge===false||
 /sbc system test|full-cycle test|do not service/i.test(String(c?.source||'')+' '+String(c?.notes||''))||
 /@example\.invalid$/i.test(String(c?.email||'')));}
function phoneKey(v){const d=String(v||'').replace(/\D/g,'');return d.length===11&&d[0]==='1'?d.slice(1):d.length===10?d:'';}
function emailKey(v){const s=normalize(v);return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)?s:'';}
function reason(c){
 if(suppressed(c)||c.deleted===true||c.archived===true||c.duplicate===true||['deleted','archived','bad number','wrong number'].includes(normalize(c.status))||['phone_hold','retired'].includes(normalize(c.salesQueueState)))return 'SUPPRESSED';
 if(!String(c.id??'').trim())return 'MISSING_RECORD_ID';
 if(c.tenantId!=null&&c.tenant_id!=null&&Number(c.tenantId)!==Number(c.tenant_id))return 'TENANT_IDENTITY_CONFLICT';
 if(['failed','rejected'].includes(normalize(c.verificationStatus))||c.researchRejected===true)return 'VERIFICATION_FAILED';
 if(synthetic(c))return 'SYNTHETIC';
 if(!String(c.businessName||'').trim())return 'MISSING_BUSINESS';
 if(!phoneKey(c.phone)&&!emailKey(c.email))return 'MISSING_CONTACT';
 const status=normalize(c.verificationStatus).replace(/[-_]+/g,' ');
 if(['sales ready','verified','passed'].includes(status)||c?.leadIntelligence?.ownerTrust?.basis)return 'ALREADY_APPROVED';
 return '';
}
function plan(customers,tenant,{limit=10000}={}){
 const t=tenantId(tenant),list=Array.isArray(customers)?customers:[];
 const selected=list.filter(c=>Number(c?.tenantId??c?.tenant_id)===t);
 const counts=new Map(),recordCounts=new Map(),skip={},ids=[];
 for(const c of selected){
  const id=String(c.id??'').trim();if(id)recordCounts.set(id,(recordCounts.get(id)||0)+1);
  for(const key of [phoneKey(c.phone)&&'P:'+phoneKey(c.phone),emailKey(c.email)&&'E:'+emailKey(c.email)].filter(Boolean))
   counts.set(key,(counts.get(key)||0)+1);
 }
 for(const c of selected){
  let why=reason(c);
  if(!why&&recordCounts.get(String(c.id??'').trim())>1)why='DUPLICATE_RECORD_ID';
  if(!why){
   const keys=[phoneKey(c.phone)&&'P:'+phoneKey(c.phone),emailKey(c.email)&&'E:'+emailKey(c.email)].filter(Boolean);
   if(keys.some(k=>counts.get(k)>1))why='DUPLICATE_IDENTITY';
  }
  if(why)skip[why]=(skip[why]||0)+1;
  else if(ids.length<limit)ids.push(String(c.id||''));
 }
 return {tenantId:t,totalTenant:selected.length,approvable:ids.length,
  skipped:skip,ids,automaticExternalVerification:false,automaticOutreach:false};
}
function trust(c,{actorId,basis,at}={}){
 if(!['LORNA_RESEARCH_SUBMISSION','OWNER_EXISTING_BATCH'].includes(basis))throw Error('INVALID_TRUST_BASIS');
 if(!String(actorId||'').trim())throw Error('TRUST_ACTOR_REQUIRED');
 const why=reason(c);if(why)return {applied:false,reason:why};
 const timestamp=at||new Date().toISOString();
 if(!Number.isFinite(Date.parse(timestamp)))throw Error('INVALID_TRUST_TIMESTAMP');
 c.leadIntelligence=(c.leadIntelligence&&typeof c.leadIntelligence==='object')?c.leadIntelligence:{};
 c.leadIntelligence.ownerTrust={basis,actorId:String(actorId),approvedAt:timestamp,
  independentVerified:false,externalVerificationPerformed:false,outboundConsentGranted:false};
 c.leadIntelligence.verificationStatus='Sales Ready';
 c.leadIntelligence.autoVerificationStatus='OWNER_TRUSTED_RESEARCH';
 c.verificationStatus='Sales Ready';
 c.leadAssist={...(c.leadAssist||{}),status:'OWNER_TRUSTED_RESEARCH',approvedAt:timestamp,approvedBy:String(actorId)};
 c.updatedAt=timestamp;
 return {applied:true,basis};
}
function isTrusted(c){return Boolean(c?.leadIntelligence?.ownerTrust?.basis&&c?.leadIntelligence?.autoVerificationStatus==='OWNER_TRUSTED_RESEARCH'&&c?.verificationStatus==='Sales Ready');}
module.exports={tenantId,isLorna,suppressed,synthetic,phoneKey,emailKey,reason,plan,trust,isTrusted};
