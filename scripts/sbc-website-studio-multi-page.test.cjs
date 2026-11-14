'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDraftConcept,deriveDraftProfile}=require('../enterprise/website-studio/draft-concept.cjs');
const {compileMultiPageConcept}=require('../enterprise/website-studio/multi-page-concept.cjs');
const site={status:'Draft',offerTier:'essentials',industry:'Window Tinting',customer:{businessName:'CJ Window Tinters',city:'Miami'}};
test('Business Basic produces four linked private art-directed pages',()=>{
 const profile=deriveDraftProfile(site),{bundle}=createDraftConcept(site);
 const output=compileMultiPageConcept({profile,bundle,offerTier:'essentials',isDraft:true});
 assert.deepEqual(Object.keys(output.files).filter(x=>/\.html$/.test(x)).sort(),['about.html','contact.html','index.html','services.html']);
 for(const name of ['index.html','services.html','about.html','contact.html']){
  const html=output.files[name];
  assert.match(html,/noindex,nofollow,noarchive/);
  assert.match(html,/href="services.html"/);
  assert.match(html,/href="about.html"/);
  assert.match(html,/href="contact.html"/);
  assert.doesNotMatch(html,/<form[^>]+action=/i);
 }
 assert.match(output.files['services.html'],/EXAMPLE ONLY/);
 assert.match(output.files['about.html'],/Never invent a founding date/);
 assert.match(output.files['contact.html'],/NOT ACTIVE IN PREVIEW/);
 assert.equal(output.publicationReady,false);
});
test('Business Starter stays one page',()=>{
 const profile=deriveDraftProfile({...site,offerTier:'starter'}),{bundle}=createDraftConcept(site);
 assert.equal(compileMultiPageConcept({profile,bundle,offerTier:'starter'}),bundle);
});
