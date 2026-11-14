'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizeVisual,applyVisual}=require('../enterprise/website-studio/visual-editor.cjs');
const {createDraftConcept}=require('../enterprise/website-studio/draft-concept.cjs');
const site={id:'site-test',tenantId:4,offerTier:'starter',status:'Draft',industry:'Window Tinting',
 customer:{businessName:'CJ Window Tinters',city:'Miami'}};
test('visual editor safely applies approved owner headline, subtitle and design density to a private preview',()=>{
 const style=normalizeVisual({headline:'Tint with intention',subheadline:'Explore our confirmed window film options',density:'airy',photoUrl:'',photoAlt:'',rightsConfirmed:false});
 const {bundle}=createDraftConcept(site);
 const changed=applyVisual(bundle,style);
 const html=changed.files['index.html'];
 assert.match(html,/<h1>Tint with intention<\/h1>/);
 assert.match(html,/Explore our confirmed window film options/);
 assert.match(html,/sbc-layout-airy/);
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.equal(changed.publicationReady,false);
 assert.match(changed.files['styles.css'],/sbc-layout-airy/);
});
test('HTML injection, external tracking, and uncontrolled image sources are rejected',()=>{
 assert.throws(()=>normalizeVisual({headline:'<script>alert(1)</script>'}),/INVALID_STUDIO_COPY/);
 assert.throws(()=>normalizeVisual({photoUrl:'https://evil.example/photo.jpg',photoAlt:'Car',rightsConfirmed:true}),/INVALID_STUDIO_PHOTO/);
 assert.throws(()=>normalizeVisual({photoUrl:'https://images.unsplash.com/photo-123',photoAlt:'Car',rightsConfirmed:false}),/STUDIO_MEDIA_RIGHTS_REQUIRED/);
 assert.throws(()=>normalizeVisual({photoUrl:'https://images.unsplash.com/photo-123',photoAlt:'',rightsConfirmed:true}),/STUDIO_MEDIA_ALT_REQUIRED/);
 assert.throws(()=>normalizeVisual({photoUrl:'javascript:alert(1)',photoAlt:'X',rightsConfirmed:true}),/INVALID_STUDIO_PHOTO/);
 assert.throws(()=>normalizeVisual({density:'<script>'}),/INVALID_STUDIO_LAYOUT/);
});
test('approved media is displayed with truthful attribution and cannot send data',()=>{
 const v=normalizeVisual({headline:'A fresh direction',subheadline:'',density:'original',photoUrl:'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=75',photoAlt:'Illustrative car in a studio',rightsConfirmed:true});
 const result=applyVisual(createDraftConcept(site).bundle,v);
 assert.match(result.files['index.html'],/Illustrative car in a studio/);
 assert.match(result.files['index.html'],/PHOTO PROVIDED FOR CONCEPT/);
 assert.match(result.files['index.html'],/images\.unsplash\.com/);
 assert.doesNotMatch(result.files['index.html'],/<form[^>]+action=/);
 assert.equal(result.publicationReady,false);
});
