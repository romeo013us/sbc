'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {NICHE_GROUPS,suggestMedia}=require('../enterprise/website-studio/media-catalog.cjs');
const {mediaURL}=require('../enterprise/website-studio/visual-editor.cjs');
test('V3 media catalog maps more than 50 specific local business niches to safe illustrative candidates',()=>{
 const all=Object.values(NICHE_GROUPS).flat();
 assert(all.length>=50);
 assert.equal(new Set(all.map(x=>x.toLowerCase())).size,all.length);
 for(const niche of all){
  const result=suggestMedia(niche);
  assert(result.candidates.length>=1,niche);
  assert(result.candidates.length<=4,niche);
  assert.equal(result.requiresOwnerRightsReview,true);
  for(const item of result.candidates){
   assert.equal(mediaURL(item.url),item.url);
   assert(item.alt&&item.id&&item.group);
   assert.equal(item.illustrativeOnly,true);
   assert.equal(item.rightsConfirmed,false);
   assert.equal(item.publicationApproved,false);
   assert.match(item.licenseInformation,/unsplash/i);
  }
 }
});
test('media selection is deterministic and never invents customer proofs, AI activity or pricing',()=>{
 const a=suggestMedia('Auto Detailing'),b=suggestMedia('Auto Detailing');
 assert.deepEqual(a,b);
 assert.equal(a.group,'automotive');
 assert.equal(suggestMedia('Hair Salon').group,'beauty');
 assert.equal(suggestMedia('Coffee Shop').group,'dining');
 assert.equal(suggestMedia('Roofing Contractor').group,'trades');
 assert.equal(suggestMedia('Notary').group,'professional');
 assert.equal(suggestMedia('Retail Store').group,'local');
 assert.doesNotMatch(JSON.stringify(NICHE_GROUPS),/4\.9 rated|guaranteed|licensed and insured|same day dispatch/i);
});
