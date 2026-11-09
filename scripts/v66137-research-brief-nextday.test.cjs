'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../enterprise/sbc-nextday-candidate-readiness-v1.cjs');
const NEXT=require('../routes/sbc-nextday-outbound-v1.cjs');
const CALLER=require('../enterprise/sales-caller-workspace-v6697.cjs');
const sample={
 id:'lead-a',tenantId:1,businessName:'Example Auto Body Shop',contactName:'Example Owner',
 phone:'1 305-555-0198',email:'',industry:'Auto Body Shop',source:'Lead Research',
 website:'',status:'Lead',
 leadIntelligence:{
  verificationStatus:'Sales Ready',
  researchSource:'State business registry',
  researchBrief:{
   version:1,websitePresence:'not_checked',googleBusinessPresence:'not_checked',
   yearsInBusiness:'Not verified',specificServices:'',
   likelyCustomerTypes:'Potential nearby automotive customers',
   likelyCustomerTypesStatus:'industry_estimate',
   suggestedSbcOffer:'Business Starter · $199 only if needed',
   offerCondition:'Confirm website needs with the prospect',
   openingQuestion:'How easily do customers find your business?',
   researchEvidenceUrl:'https://search.sunbiz.org/example',
   originalBrief:'Specific services and history have not been independently checked.'
  }
 }
};
assert.equal(R.quality(sample).temperature,'Warm','SQL-loaded fields produce warm temperature');
assert.equal(R.analyze(sample).eligible,true,'verified lead does not need transient temperature');
assert.equal(R.analyze({...sample,verificationStatus:undefined,leadIntelligence:{...sample.leadIntelligence,verificationStatus:'Unverified'}}).reason,'needs_verification');
assert.equal(R.analyze({...sample,notes:'Verification: Verified',verificationStatus:'Needs Verification',
 leadIntelligence:{...sample.leadIntelligence,verificationStatus:'Unverified'}}).eligible,false,'researcher notes never grant verification');
assert.equal(R.analyze({...sample,status:'Do Not Call'}).reason,'suppressed');
assert.equal(R.analyze({...sample,phone:''}).reason,'phone_missing');
assert.equal(R.analyze({...sample,id:'sbc-test-1',source:'SBC SYSTEM TEST'}).reason,'synthetic');
const db={customers:[
 sample,{...sample,id:'queued',businessName:'Other Business'},
 {...sample,id:'unverified',businessName:'Unverified Business',leadIntelligence:{verificationStatus:'Unverified'}},
 {...sample,id:'missing',businessName:'Missing Phone',phone:''},
 {...sample,id:'foreign',tenantId:2,businessName:'Other Tenant'}
]};
const found=R.report(db.customers,1,new Set(['queued']),20);
assert.equal(found.summary.total,4);
assert.equal(found.summary.ready,2);
assert.equal(found.summary.queued,1);
assert.equal(found.summary.needs_verification,1);
assert.equal(found.summary.phone_missing,1);
assert.equal(found.candidates.length,1);
assert.equal(found.research.length,2);
assert.equal(NEXT.leadsFor(db,1).length,2);
const projected=CALLER.projectAssigned([{...sample,assignedTo:'rep-1'},
 {...sample,id:'cross',tenantId:2,assignedTo:'rep-1'}],{id:'rep-1'},1);
assert.equal(projected.length,1);
assert.equal(projected[0].researchBrief.suggestedSbcOffer,'Business Starter · $199 only if needed');
assert.equal(projected[0].researchBrief.websitePresence,'not_checked');
assert.match(projected[0].researchBrief.originalBrief,/not been independently checked/);
assert.equal(projected[0].researchBrief.researchEvidenceUrl,'https://search.sunbiz.org/example');
assert.equal(projected[0].canCall,true,'research metadata does not alter existing caller authorization');
for(const base of ['public','browser_public']){
 const html=fs.readFileSync(path.join(__dirname,'..',base,'lead-research.html'),'utf8');
 const checklist=fs.readFileSync(path.join(__dirname,'..',base,'sbc-lorna-checklist.js'),'utf8');
 const client=fs.readFileSync(path.join(__dirname,'..',base,'sbc-nextday-sales-prep-v1.js'),'utf8');
 const caller=fs.readFileSync(path.join(__dirname,'..',base,'sales-caller.js'),'utf8');
 assert.match(html,/name="googleBusinessPresence"/);
 assert.match(html,/name="originalResearchBrief"/);
 assert.match(html,/name="openingQuestion"/);
 assert.match(html,/name="researchEvidenceUrl"/);
 assert.match(checklist,/window.SBCResearchBriefV1/);
 assert.match(client,/sbc-nextday-lead-diagnostics/);
 assert.match(caller,/sbc-caller-research-content/);
}
const researcher=fs.readFileSync(path.join(__dirname,'..','public/lead-research.js'),'utf8');
assert.match(researcher,/researchBrief:brief/,'full form brief travels through canonical intake API');
const vm=require('node:vm');
const fake={window:{},URL,document:{
 readyState:'loading',addEventListener(){},getElementById(){return null}
}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public/sbc-lorna-checklist.js'),'utf8'),fake);
const values={},form={elements:{namedItem(name){
 if(!values[name])values[name]={value:'',maxLength:1200};return values[name];
}}};
const paste=[
 'CRM category: Auto Body Shop. Specific services and business history have not been independently checked.',
 '**Years in business**','Not verified',
 '**Likely customer types**','Possibly local drivers (industry estimate)',
 '**Website**','Not recorded — confirm before recommending a website',
 '**Suggested SBC offer**','Business Starter · $199 (only if a website is needed)',
 '**Suggested opening question**','How easily can customers find you?',
 '**Owner:** Example Contact','**Phone:** 3055550148',
 '**Notes:** Research source: https://search.sunbiz.org/example'
].join('\n');
fake.window.SBCResearchBriefV1.parseBrief(paste,form);
assert.equal(values.contactName.value,'Example Contact');
assert.equal(values.phone.value,'3055550148');
assert.equal(values.industry.value,'Auto Body Shop');
assert.equal(values.yearsInBusiness.value,'Not verified');
assert.match(values.businessHistory.value,/not been independently checked/i);
assert.match(values.suggestedOffer.value,/Business Starter/);
assert.match(values.researchEvidenceUrl.value,/search\.sunbiz\.org/);
assert.equal(values.websitePresence.value,'not_checked','not recorded is never classified as not found');
const brief=fake.window.SBCResearchBriefV1.collect(form);
assert.equal(brief.websitePresence,'not_checked');
assert.equal(brief.googleBusinessPresence,'not_checked');
assert.equal(brief.claimedBusinessFactsVerified,false);
assert.match(brief.suggestedSbcOffer,/Business Starter/);

console.log('PASS SBC Prepare Tomorrow and Lorna: SQL-hydrated lead quality, role-scoped research brief, missing-checklist preview, authoritative verification, no DNC bypass');
