'use strict';
// SBC V66.25: read-only lead eligibility classification for human review.
// This module never verifies a person, records consent, authorizes contact, or writes CRM data.
const NO_CONTACT=new Set(['customer','lost','do not call','do not contact','closed','duplicate','not qualified','unsubscribe','opt out']);
const digits=s=>String(s||'').replace(/\D/g,'');
function phoneOk(v){const x=digits(v);return x.length===10||(x.length===11&&x.startsWith('1'));}
function emailOk(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v||'').trim());}
function liveLead(c){const status=String(c?.status||'lead').trim().toLowerCase();return !NO_CONTACT.has(status);}
function suppressed(c){
 const status=String(c?.status||'').trim().toLowerCase();
 if(NO_CONTACT.has(status)||c?.salesSuppressed===true||c?.doNotContact===true||c?.isSuppressed===true)return true;
 const info=[c?.notes,c?.followUp].map(v=>String(v||'')).join(' ').toLowerCase();
 return /(?:\bdo not contact\b|\bdo not call\b|\bunsubscribe\b|\bopt[ -]?out\b|\bstop messages\b)/.test(info);
}
function verified(c){
 const direct=String(c?.verificationStatus||'').trim().toLowerCase().replace(/[-_]+/g,' ');
 if(['verified','sales ready'].includes(direct))return true;
 const note=String(c?.notes||'');
 return /(?:^|\n)\s*verification\s*:\s*(verified|sales ready)\s*(?:$|\n)/i.test(note);
}
function synthetic(c){
 return c?.sbcTest===true||c?.testMode===true||c?.testPayment?.realCharge===false||
 /sbc system test|sbc full-cycle test|v47 full-cycle test|do not service/i.test([c?.source,c?.notes].join(' '))||
 /@example\.invalid$/i.test(String(c?.email||''));
}
function inspect(customers,tenantId,opts={}){
 const n=Number(tenantId);
 if(!Number.isSafeInteger(n)||n<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});
 const list=Array.isArray(customers)?customers:[];
 const out={source:'canonical-in-memory-crm',readOnly:true,tenantId:n,metricMeaning:'Counts are categories, not migrations or completed sales.',totalTenantRecords:0,activeWarmHot:0,suppressedOrTerminal:0,synthetic:0,needsRecordVerification:0,invalidOrMissingContact:0,verifiedHumanCallReady:0,verifiedEmailReviewReady:0,verifiedNoPhone:0,manualResearchQueue:0,manualCallLeadIds:[],researchLeadIds:[],noAutomaticCalls:true,noAutomaticSMS:true,paidSalesNotInferred:true};
 const sample=Math.max(0,Math.min(50,Number(opts.limit)||20));
 for(const c of list){
   if(!c||Number(c.tenantId)!==n)continue;
   out.totalTenantRecords++;
   if(synthetic(c)){out.synthetic++;continue;}
   if(suppressed(c)){out.suppressedOrTerminal++;continue;}
   if(!liveLead(c))continue;
   if(!['warm','hot'].includes(String(c.leadTemperature||'').trim().toLowerCase()))continue;
   out.activeWarmHot++;
   const phone=phoneOk(c.phone),email=emailOk(c.email),passed=verified(c);
   if(!phone&&!email){out.invalidOrMissingContact++;continue;}
   if(!passed){
     out.needsRecordVerification++;
     if(phone){out.manualResearchQueue++;if(out.researchLeadIds.length<sample)out.researchLeadIds.push(String(c.id||''));}
     continue;
   }
   if(phone){out.verifiedHumanCallReady++;if(out.manualCallLeadIds.length<sample)out.manualCallLeadIds.push(String(c.id||''));}
   else out.verifiedNoPhone++;
   if(email)out.verifiedEmailReviewReady++;
 }
 out.readiness='REVIEW_ONLY';
 return out;
}
module.exports={inspect,phoneOk,emailOk,verified,suppressed};
