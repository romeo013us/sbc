'use strict';
/* V66.143: Pure read-side safeguards for legacy Revenue PLAY.
 * The authenticated marketing-email rail is enterprise/sbc-consented-outreach-email.cjs.
 * Legacy batch PLAY must never send promotional email via transactional SMTP.
 */
const MARKETING=require('./sbc-consented-outreach-email.cjs');
const CLOSED=new Set(['do not contact','do not call','unsubscribe','unsubscribed','opt out','opt-out','lost','closed','duplicate','not qualified']);
function notesSuppressed(c){
 const text=[c?.notes,c?.accountNotes,c?.followUp].filter(v=>typeof v==='string').join('\n');
 return /\b(?:do not contact|do not call|unsubscribe|unsubscribed|opt[ -]?out|stop messages)\b/i.test(text);
}
function suppressed(c){
 if(!c||typeof c!=='object')return true;
 if(CLOSED.has(String(c.status||'').trim().toLowerCase()))return true;
 if(c.doNotContact===true||c.doNotCall===true||c.salesSuppressed===true||
    c.isSuppressed===true||c.smsOptOut===true&&c.doNotContact===true)return true;
 const x=c.leadIntelligence?.sbcOutreach;
 if(x?.marketingEmailOptOut===true||x?.emailUnsubscribed===true)return true;
 return notesSuppressed(c);
}
function emailReview(c,env=process.env){
 if(suppressed(c))return {ready:false,reason:'SUPPRESSED'};
 if(!MARKETING.hasConsent(c))return {ready:false,reason:'DOCUMENTED_EMAIL_OPT_IN_REQUIRED'};
 const configured=MARKETING.envStatus(env);
 if(!configured.ready)return {ready:false,reason:'APPROVED_MARKETING_PROVIDER_NOT_READY'};
 // Approval is required for EACH reviewed CRM task; a batch PLAY click is not approval.
 return {ready:true,reason:'SINGLE_OWNER_EMAIL_TASK_REVIEW_REQUIRED'};
}
module.exports={suppressed,emailReview};
