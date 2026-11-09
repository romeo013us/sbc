'use strict';
/* Derived quality only; never grants call permission, verification or consent. */
const R=require('./v6625-lead-readiness-audit.cjs');
const n=v=>String(v??'').trim();
function quality(c){
 let score=0;
 if(n(c?.businessName))score+=20;
 if(n(c?.phone))score+=20;
 if(n(c?.contactName))score+=15;
 if(n(c?.email))score+=15;
 if(n(c?.website))score+=10;
 if(n(c?.industry))score+=5;
 if(n(c?.source))score+=5;
 if(c?.sbcOpportunity||/\bsbc opportunity\s*:/i.test(String(c?.notes||'')))score+=5;
 if(n(c?.city)||/\bcity\s*:\s*\S/i.test(String(c?.notes||'')))score+=3;
 if(n(c?.zip)||/\bzip\s*:\s*\S/i.test(String(c?.notes||'')))score+=2;
 return {score,temperature:score>=75?'Hot':score>=50?'Warm':'Cold'};
}
function verified(c){
 // Only trust the authoritative root or SQL-backed lead intelligence status.
 // A researcher can edit notes; a note saying 'Verification: Verified' is NOT proof.
 const root=n(c?.verificationStatus).toLowerCase().replace(/[-_]+/g,' ');
 const durable=n(c?.leadIntelligence?.verificationStatus).toLowerCase().replace(/[-_]+/g,' ');
 return root?['verified','sales ready'].includes(root):['verified','sales ready'].includes(durable);
}
function synthetic(c){
 return c?.sbcTest===true||c?.testMode===true||c?.testPayment?.realCharge===false||
 /sbc system test|sbc full-cycle test|v47 full-cycle test|do not service/i.test([c?.source,c?.notes].join(' '))||
 /@example\.invalid$/i.test(String(c?.email||''));
}
function blocked(c){
 const st=n(c?.status).toLowerCase();
 return c?.doNotContact===true||c?.salesSuppressed===true||c?.isSuppressed===true||
 c?.doNotCall===true||['dnc','do not contact','do not call','unsubscribe','opt out','lost','customer','duplicate','closed','not qualified'].includes(st)||
 R.suppressed(c);
}
function analyze(c){
 if(synthetic(c))return {eligible:false,reason:'synthetic'};
 if(blocked(c))return {eligible:false,reason:'suppressed'};
 if(!n(c?.id)||!n(c?.businessName||c?.business_name||c?.contactName))return {eligible:false,reason:'identity_missing'};
 if(!R.phoneOk(c?.phone))return {eligible:false,reason:'phone_missing'};
 if(quality(c).temperature==='Cold')return {eligible:false,reason:'needs_research'};
 if(!verified(c))return {eligible:false,reason:'needs_verification'};
 return {eligible:true,reason:'ready'};
}
function report(customers,tenant,queuedIds=new Set(),limit=20){
 const summary={total:0,ready:0,queued:0,synthetic:0,suppressed:0,identity_missing:0,
  phone_missing:0,needs_research:0,needs_verification:0};
 const candidates=[],research=[];
 for(const c of customers||[]){
  if(Number(c?.tenantId??c?.tenant_id)!==Number(tenant))continue;
  summary.total++;
  const state=analyze(c);
  if(state.eligible){
   summary.ready++;
   if(queuedIds.has(String(c.id))){summary.queued++;continue;}
   if(candidates.length<limit)candidates.push(c);
  }else{
   summary[state.reason]++;
   if(['needs_research','needs_verification','phone_missing'].includes(state.reason)&&research.length<limit)
    research.push({id:String(c.id),businessName:n(c.businessName||c.business_name||c.contactName).slice(0,150),
     reason:state.reason,quality:quality(c).temperature,source:n(c.source).slice(0,100),
     nextAction:state.reason==='phone_missing'?'Research a valid number and contact restrictions':
      state.reason==='needs_research'?'Complete business/contact information':'Complete independent Lead Assist/owner verification'});
  }
 }
 return {summary,candidates,research};
}
module.exports={quality,verified,synthetic,blocked,analyze,report};
