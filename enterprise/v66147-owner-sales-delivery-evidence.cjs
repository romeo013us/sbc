'use strict';
/* V66.147 owner-only activation PREVIEW. No prospect becomes verified, no automatic
 * calls/emails/SMS, no payment/provider activity, no order status transitions.
 * Deliberately reuses the strict V66.25 verification and V66.143 suppression rules.
 */
const LEAD=require('./v6625-lead-readiness-audit.cjs');
const OUTREACH=require('./v66143-revenue-play-outreach-policy.cjs');
const FORENSICS=require('./v66144-crm-forensics.cjs');
const PAYMENT=require('./v6640-payment-evidence.cjs');
const QA=require('./sbc-revenue-reporting-truth-v66142.cjs');
const norm=v=>String(v??'').trim();
const digits=v=>norm(v).replace(/\D/g,'');
const tag=v=>norm(v).toLowerCase();
const ts=v=>Number.isFinite(Date.parse(norm(v)))?Date.parse(norm(v)):0;
const LIVE=new Set(['lead','prospect','qualified','sales ready','contacted']);
const PLACEHOLDER=/^(?:unknown|n\/a|none|null|test|untitled|missing|no business|unnamed)$/i;
function assertTenant(t){
 const n=Number(t);
 if(!Number.isSafeInteger(n)||n<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{status:403,code:'TENANT_CONTEXT_REQUIRED'});
 return n;
}
function eligible(c){
 if(!c||!LIVE.has(tag(c.status)))return {ok:false,reason:'NOT_ACTIVE_LEAD'};
 if(LEAD.synthetic(c)||QA.isQaCustomer(c))return {ok:false,reason:'INTERNAL_TEST'};
 if(OUTREACH.suppressed(c)||FORENSICS.suspicious(c))return {ok:false,reason:'SUPPRESSED_OR_TEXT_INTEGRITY'};
 const name=norm(c.businessName);
 if(name.length<3||PLACEHOLDER.test(name))return {ok:false,reason:'BUSINESS_IDENTITY_MISSING'};
 if(!LEAD.phoneOk(c.phone))return {ok:false,reason:'USABLE_PHONE_REQUIRED_FOR_CALL_REVIEW'};
 return {ok:true,reason:LEAD.verified(c)?'EXISTING_VERIFICATION_REVIEW_REQUIRED':'SOURCE_AND_IDENTITY_REVIEW_REQUIRED'};
}
function inspect({tenantId,customers=[],orders=[],limit=20}={}){
 const tid=assertTenant(tenantId);
 const count=Math.max(1,Math.min(20,Math.trunc(Number(limit)||20)));
 const own=(Array.isArray(customers)?customers:[]).filter(c=>c&&Number(c.tenantId??c.tenant_id)===tid);
 const all=(Array.isArray(orders)?orders:[]).filter(o=>o&&Number(o.tenantId??o.tenant_id)===tid);
 const byId=new Map(own.map(c=>[norm(c.id),c]));
 const counters={tenantLeads:0,reviewEligible:0,alreadyVerifiedNeedsOwnerCheck:0,needsSourceVerification:0,missingCallablePhone:0,textOrSuppressionHeld:0,internalTestSkipped:0};
 const matches=[];
 for(const c of own){
  if(!LIVE.has(tag(c.status)))continue;
  counters.tenantLeads++;
  const result=eligible(c);
  if(!result.ok){
   if(result.reason==='USABLE_PHONE_REQUIRED_FOR_CALL_REVIEW')counters.missingCallablePhone++;
   else if(result.reason==='INTERNAL_TEST')counters.internalTestSkipped++;
   else counters.textOrSuppressionHeld++;
   continue;
  }
  counters.reviewEligible++;
  if(LEAD.verified(c))counters.alreadyVerifiedNeedsOwnerCheck++;else counters.needsSourceVerification++;
  matches.push(c);
 }
 const rank=x=>{
  const temp=tag(x.leadTemperature);
  return temp==='hot'?0:temp==='warm'?1:2;
 };
 matches.sort((a,b)=>rank(a)-rank(b)||ts(b.updatedAt??b.updated_at)-ts(a.updatedAt??a.updated_at)||
  norm(a.id).localeCompare(norm(b.id)));
 const shortlist=matches.slice(0,count).map(c=>({
  id:norm(c.id),businessName:norm(c.businessName).slice(0,160),source:norm(c.source).slice(0,120),
  temperature:tag(c.leadTemperature).slice(0,20),phoneLast4:digits(c.phone).slice(-4),
  verificationFlagPresent:LEAD.verified(c),reviewReason:eligible(c).reason,
  nextAction:'Review source, phone ownership, business identity, DNC/permissions and contact timing before authorizing a human call'
 }));
 const paid=all.filter(o=>QA.providerPaid(o,byId.get(norm(o.customerId)))&&Number(o.tenantId??o.tenant_id)===tid);
 paid.sort((a,b)=>ts(b.createdAt??b.created_at)-ts(a.createdAt??a.created_at)||norm(a.id).localeCompare(norm(b.id)));
 const readyOrders=paid.slice(0,10).map(o=>({
  orderId:norm(o.id),customerId:norm(o.customerId),product:norm(o.product).slice(0,140),
  recordedAmount:Number(o.price??o.total)||0,
  recordedSquareCapture:true,
  fulfillmentStatus:norm(o.fulfillmentStatus).slice(0,60),
  nextAction:'Run Delivery Acceptance and independently verify provider payment, fulfillment and customer receipt'
 }));
 const qaCount=all.filter(o=>QA.isQaOrder(o,byId.get(norm(o.customerId)))).length;
 const statusOnlyCount=all.filter(o=>!QA.isQaOrder(o,byId.get(norm(o.customerId)))&&PAYMENT.statusOnlyPayment(o)).length;
 return {ok:true,readOnly:true,noCustomersChanged:true,noOrdersChanged:true,
  tenantId:tid,scope:'TENANT_ONLY',counts:counters,reviewTarget:count,reviewedAutomatically:0,
  callAuthorizedAutomatically:0,autoMessages:0,leadShortlist:shortlist,
  paidOrderCandidates:readyOrders,paidOrderCandidateCount:paid.length,
  excludedQaOrders:qaCount,statusOnlyOrdersNeedIndependentPaymentProof:statusOnlyCount,
  paymentEvidence:'SBC-stored Square metadata, NOT independent Square/bank confirmation',
  warning:'A lead review candidate is not call-ready. Human verification, calling permissions, national/state DNC screening and owner approval remain required. No records, providers or queues were changed.'};
}
module.exports={inspect,eligible,assertTenant};
