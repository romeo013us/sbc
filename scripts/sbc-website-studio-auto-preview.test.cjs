'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDraftConcept,deriveDraftProfile}=require('../enterprise/website-studio/draft-concept.cjs');
function lead(name,industry){return {id:'draft-test',tenantId:12,status:'Draft',industry,
 customer:{businessName:name,city:'Miami',phone:'3055550145',email:'not-approved@example.org',websiteVerifiedDetails:{services:['Audio installation']}},researchNotes:'Award-winning business'};}
test('first-run drafts get seven industry-aware private layouts with no verified services invented',()=>{
 const list=[['CJ Window Tinters','Window Tinting'],['Apex Motor','Mechanic'],['Velvet Studio','Hair Salon'],
  ['Morning Table','Restaurant'],['Swift Roofing','Roofing Contractor'],['Civic Advisors','Insurance Agency'],['North Shop','Retail']];
 const compositions=new Set();
 for(const [name,category] of list){
  const site=lead(name,category),copy=structuredClone(site);
  const result=createDraftConcept(site),html=result.bundle.files['index.html'];
  assert.equal(result.approvalState,'UNVERIFIED_DRAFT');assert.equal(result.qa.passed,true);assert.equal(result.publicationReady,false);
  assert.match(html,/UNVERIFIED DESIGN CONCEPT/);assert.match(html,/DESIGN PLANNING ONLY/);
  assert.match(html,/noindex,nofollow,noarchive/);assert.match(html,new RegExp(name));
  assert.doesNotMatch(html,/Audio installation|Award-winning|3055550145|not-approved@example.org/i);
  assert.deepEqual(site,copy,'no persistence and no approved-data mutation');
  compositions.add(html.match(/data-sbc-composition="([^"]+)"/)[1]);
 }
 assert.equal(compositions.size,6);
});
test('HTML injection is escaped and unverified facts stay outside compilation',()=>{
 const result=createDraftConcept(lead('<script>alert(1)</script>','<img src=x onerror=alert(1)>'));
 assert.doesNotMatch(result.bundle.files['index.html'],/<script>alert\(1\)<\/script>/);
 assert.equal(deriveDraftProfile(lead('Fresh Business','Window Tinting')).services.length,0);
});
test('approved and archived customer websites are preserved unchanged',()=>{
 assert.throws(()=>createDraftConcept({...lead('Already Live','Restaurant'),status:'Approved'}),/STUDIO_DRAFT_UNAVAILABLE/);
 assert.throws(()=>createDraftConcept({...lead('Archived','Roofing'),archived:true}),/STUDIO_DRAFT_UNAVAILABLE/);
});

test('owner-selected design themes 1, 2 and 3 change the private smart website identity',()=>{
 const site=lead('Silverline Window Studio','Window Tinting');
 const variants=[1,2,3].map(themeVariant=>createDraftConcept({...site,siteEdits:{themeVariant}}).bundle.files['index.html'].match(/data-sbc-design-variant="([^"]+)"/)[1]);
 assert.deepEqual(variants,['tint-1','tint-2','tint-3']);
 assert.equal(createDraftConcept({...site,siteEdits:{themeVariant:3}}).publicationReady,false);
});
