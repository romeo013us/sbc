'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPrivateConcept}=require('../enterprise/website-studio/index.cjs');
const {checkPrivateBundle}=require('../enterprise/website-studio/qa-gate.cjs');
const {evaluateCompletion}=require('../enterprise/website-studio/completion-gate.cjs');
function profile(name,category){return {schemaVersion:1,business:{name,category,city:'Miami',region:'FL'},services:[{name:'First approved service',description:'Approved description',provenance:{kind:'owner_confirmed'}},{name:'Second approved service',description:'Verified before generating',provenance:{kind:'owner_confirmed'}},{name:'Third approved service',description:'Confirmed work scope',provenance:{kind:'owner_confirmed'}}],reviews:[],contact:{phone:'3055550100'},verification:{approvedBy:'owner',approvedAt:'2026-11-13T00:00:00Z'}}}
test('different industries select fundamentally different HTML compositions, not palette swaps',()=>{
 const input=[['Test Tint Lab','Window Tinting','performance-bay'],['Example Hair Atelier','Hair Salon','editorial-atlas'],['Sample Bistro','Restaurant','menu-story'],['Example Roofing','Roofing Contractor','project-brief'],['Sample Insurance','Insurance Agency','consultation-desk']];
 const html=input.map(([name,industry,composition])=>{const b=createPrivateConcept({verified_profile:profile(name,industry),quoteEstimatorEnabled:true}).bundle;assert.match(b.files['index.html'],new RegExp('data-sbc-composition="'+composition+'"'));assert.equal(checkPrivateBundle(b).passed,true,composition);return b.files['index.html']});
 assert.equal(new Set(html.map(h=>(h.match(/data-sbc-hero="([^"]+)"/)||[])[1])).size,5,'different hero structures');
 assert.equal(new Set(html.map(h=>(h.match(/data-sbc-services="([^"]+)"/)||[])[1])).size,5,'different services structures');
 html.forEach(h=>assert.doesNotMatch(h,/class="visual-circle"|class="cards /));
});
test('specific business verified services are displayed, invented customer claims are absent',()=>{
 const b=createPrivateConcept({verified_profile:profile('Test Tint Lab','Window Tinting'),research_signals:[{type:'service',value:'Car Audio',source_url:'https://example.com',confidence_score:0.9,status:'unverified'}],quoteEstimatorEnabled:true});
 const html=b.bundle.files['index.html'];assert.match(html,/First approved service/);assert.match(html,/Second approved service/);assert.doesNotMatch(html,/Car Audio|5-star rated|100% guaranteed|lifetime warranty/i);assert.match(html,/noindex,nofollow,noarchive/);assert.match(html,/data-quote-preview/);assert.doesNotMatch(html,/action="https?:/);
});
test('safe escaping applies across the new art-directed components',()=>{
 const p=profile('<img src=x onerror=alert(1)>','Hair Salon');p.services[0].name='<script>alert(1)</script>';
 const built=createPrivateConcept({verified_profile:p});const html=built.bundle.files['index.html'];assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<img src=x/);
});
test('the site completion gate refuses to label concept as delivered without independent evidence',()=>{
 const status=evaluateCompletion({});assert.equal(status.readyToPublish,false);assert.equal(status.complete,false);assert(status.missing.length>=7);
 const forged=evaluateCompletion({contentApproved:true,mediaApproved:true,formsTested:true,domainAuthorized:true,sslVerified:true,accessibilityPassed:true,seoPassed:true,performancePassed:true,customerSignedOff:true,rollbackReady:true});assert.equal(forged.complete,false,'bare booleans are not auditable receipts');
});

test('20 representative local businesses all generate intact private sites without outside API calls',()=>{
 const industries=['Window Tinting','Auto Repair','Auto Detailing','Barber Shop','Hair Salon','Nail Spa','Restaurant','Bakery','Roofing Contractor','Plumbing','HVAC','Landscaping','Electrician','Insurance Agency','Law Firm','Tax Preparation','Retail Store','Pet Groomer','Photography Studio','Fitness Coach'];
 for(const [i,category] of industries.entries()){
  const p=profile('Example Business '+(i+1),category);
  const result=createPrivateConcept({verified_profile:p,quoteEstimatorEnabled:i%2===0});
  const gate=checkPrivateBundle(result.bundle);
  assert.equal(gate.passed,true,category+' failed: '+gate.issues.join(','));
  assert.equal(result.bundle.publicationReady,false);
  assert.match(result.bundle.files['index.html'],/First approved service/);
 }
});
