'use strict';
/**
 * SBC Prospect Intelligence V2 — entirely offline owner-to-workforce rehearsal.
 * Execute: node scripts/sbc-prospect-handoff-v2-rehearsal.cjs
 * No network, credentials, live customer records, payments or CRM writes.
 */
const assert=require('node:assert/strict');
const H=require('../public/sbc-prospect-handoff-v2.js');
const {prioritize,buildOutreach,buildStrategy}=require('../public/sbc-prospect-intelligence.js');
const at=Date.now(),checked=new Date(at-30*60*1000).toISOString();
const measured={
 status:'measured',website:'https://sample-barber.example.org/',
 source:'Google PageSpeed Insights (Lighthouse lab)',measuredAt:checked,
 scores:{performance:61,accessibility:93,seo:70,bestPractices:91},
 findings:[
  {id:'meta-description',label:'Meta description',result:'opportunity',source:'PageSpeed Insights Lighthouse audit'},
  {id:'document-title',label:'Page title',result:'pass',source:'PageSpeed Insights Lighthouse audit'}
 ]
};
const business={businessName:'SBC OFFLINE REHEARSAL BARBER',industry:'Barber',website:measured.website};
const initial=prioritize({...business,verificationStatus:'Verified'},measured);
const strategy=buildStrategy(business,measured,[],[]);
const ownerPacket=H.createPacket({ownerApproved:true,business,audit:measured,preparedAt:at});
const imported=H.validatePacket(JSON.stringify(ownerPacket),at);
const briefs=Object.fromEntries(['lead_researcher','caller','account_manager'].map(role=>[role,H.buildRoleBrief(imported,role)]));
assert.equal(initial.kind,'research_priority_not_conversion_probability');
assert.equal(imported.business.businessName,business.businessName);
assert(briefs.lead_researcher.includes('RESEARCH CHECKLIST'));
assert(briefs.caller.includes('CALL PREPARATION'));
assert(briefs.account_manager.includes('ACCOUNT EXPANSION'));
assert(briefs.caller.includes('No CRM notes'));
assert.equal(H.createOutreachDraft(imported,{contactPermission:'opt_out'}).startsWith('DO NOT CONTACT'),true);
assert(H.createOutreachDraft(imported,{contactPermission:'unknown'}).includes('Review permission'));
assert(H.createOutreachDraft(imported,{contactPermission:'owner_confirmed_permission'}).includes('DRAFT ONLY'));
assert(strategy.includes('Not verified'));
const text=JSON.stringify({packet:ownerPacket,roles:briefs,score:initial,strategy});
assert.doesNotMatch(text,/\b\d{3}-\d{3}-\d{4}\b|@[a-z0-9.-]+\.[a-z]{2,}|sk-live-/i);
console.log(JSON.stringify({
 status:'OFFLINE_QA_PASS',networkRequests:0,providerCharges:0,crmMutations:0,
 approvedPacket:true,workstations:['Lead Research','Sales Caller','Account Manager'],
 leadPriority:initial.score,measuredSiteSource:ownerPacket.audit.source,
 contactAutomation:false,liveDeploymentTested:false
},null,2));
