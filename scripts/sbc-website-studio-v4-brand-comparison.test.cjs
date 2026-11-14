'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizeBrand,normalizeComparison}=require('../enterprise/website-studio/v4-brand-comparison.cjs');
const {createPrivateConcept}=require('../enterprise/website-studio/index.cjs');
const {normalizeVisual,applyVisual}=require('../enterprise/website-studio/visual-editor.cjs');
const {checkPrivateBundle}=require('../enterprise/website-studio/qa-gate.cjs');
const fs=require('node:fs'),path=require('node:path');
const profile={schemaVersion:1,business:{name:'Verified Detail Co',category:'Auto Detailing',city:'Miami',region:'FL'},services:[{name:'Interior Detail',description:'Confirmed service',provenance:{kind:'owner_confirmed'}}],reviews:[],contact:{phone:'305-555-0190'},verification:{approvedBy:'owner',approvedAt:'2026-11-14T00:00:00Z'}};
const concept=()=>createPrivateConcept({verified_profile:profile}).bundle;
const sourceImage=code=>'https://res.cloudinary.com/sbc-client-demo/image/upload/v11223344/'+code+'.jpg';
const approved={
 title:'Customer-authorized project comparison',
 beforeUrl:sourceImage('before'),afterUrl:sourceImage('after'),
 beforeAlt:'Vehicle interior before detailing',afterAlt:'Same vehicle interior after detailing',
 rightsConfirmed:true,actualWorkConfirmed:true
};
test('V4 requires explicit approved brand colors with readable contrast and CSS-safe syntax',()=>{
 assert.equal(normalizeBrand().enabled,false);
 const brand=normalizeBrand({primary:'#163047',accent:'#99440D',ownerConfirmed:true});
 assert.equal(brand.enabled,true);
 assert.equal(brand.primary,'#163047');
 for(const invalid of [
 {primary:'red',accent:'#99440D',ownerConfirmed:true},
 {primary:'#FFFFFF',accent:'#99440D',ownerConfirmed:true},
 {primary:'#163047',accent:'#FFFFFF',ownerConfirmed:true},
 {primary:'#163047;body{display:none}',accent:'#99440D',ownerConfirmed:true},
 {primary:'#163047',accent:'#99440D',ownerConfirmed:false},
 {primary:'#163047',accent:'#99440D',ownerConfirmed:'true'},
 ])assert.throws(()=>normalizeBrand(invalid),/INVALID_STUDIO_BRAND/);
});
test('V4 comparison requires two owner-attested actual-work photos and accessible descriptions',()=>{
 assert.equal(normalizeComparison().enabled,false);
 assert.equal(normalizeComparison(approved).enabled,true);
 for(const invalid of [
 {...approved,actualWorkConfirmed:false},{...approved,rightsConfirmed:false},
 {...approved,beforeUrl:'https://evil.example/tracker.jpg'},
 {...approved,beforeUrl:'javascript:alert(1)'},
 {...approved,afterUrl:approved.beforeUrl},
 {...approved,afterAlt:'<script>'},{...approved,beforeAlt:''},
 {...approved,title:'a'.repeat(200)},
 {...approved,extraneous:true}
 ])assert.throws(()=>normalizeComparison(invalid),/INVALID_STUDIO_COMPARISON/);
});
test('V4 brand kit and real-work comparison compile into private responsive, keyboard-operable preview without network writes',()=>{
 const visual=normalizeVisual({brandKit:{primary:'#163047',accent:'#99440D',ownerConfirmed:true},beforeAfter:approved});
 const bundle=applyVisual(concept(),visual);
 const html=bundle.files['index.html'],css=bundle.files['styles.css'],js=bundle.files['site.js'];
 assert.equal(bundle.publicationReady,false);
 assert.equal(checkPrivateBundle(bundle).passed,true,JSON.stringify(checkPrivateBundle(bundle).issues));
 assert.match(html,/data-sbc-v4-comparison/);
 assert.match(html,/type="range"/);
 assert.match(html,/aria-label="Compare before and after images"/);
 assert.match(html,/actual customer project/i);
 assert.match(html,/Customer-authorized project comparison/);
 assert.match(css,/#163047/i);
 assert.match(css,/#99440D/i);
 assert.match(css,/@media\s*\(max-width:\s*750px\)/);
 assert.match(js,/input/);
 assert.doesNotMatch(js,/fetch\s*\(|XMLHttpRequest|api\.openai|squareup\.com/i);
 assert.doesNotMatch(html,/<form[^>]+action=/i);
 assert.match(html,/noindex,nofollow,noarchive/);
});
test('V4 no brand nor comparison preserves baseline zero-AI site and existing V3 preview',()=>{
 const original=concept(),styled=applyVisual(original,normalizeVisual({vibe:'warm'}));
 assert.doesNotMatch(styled.files['index.html'],/data-sbc-v4-comparison/);
 assert.equal(checkPrivateBundle(styled).passed,true);
 assert.deepEqual(normalizeVisual({}).brandKit,{enabled:false});
 assert.deepEqual(normalizeVisual({}).beforeAfter,{enabled:false});
});
test('V4 owner editing UI keeps mirror parity and explicit no-auto-rights-approval',()=>{
 const a=fs.readFileSync(path.join(__dirname,'../public/sbc-website-production-v1.js'),'utf8');
 const b=fs.readFileSync(path.join(__dirname,'../browser_public/sbc-website-production-v1.js'),'utf8');
 assert.equal(a,b);
 for(const part of ['sbcStudioBrandPrimary','sbcStudioBrandAccent','sbcStudioComparisonBefore','sbcStudioComparisonAfter','sbcStudioActualWorkConfirmed','sbcStudioComparisonRights'])
  assert(a.includes(part),part);
 assert(a.includes('Save Design & Preview'));
});
