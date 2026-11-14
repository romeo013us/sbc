'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createPrivateConcept}=require('../enterprise/website-studio/index.cjs');
const {normalizeVisual,applyVisual}=require('../enterprise/website-studio/visual-editor.cjs');
const {checkPrivateBundle}=require('../enterprise/website-studio/qa-gate.cjs');
const p={schemaVersion:1,business:{name:'Sample Detail Studio',category:'Auto Detailing',city:'Miami',region:'FL'},
 services:[{name:'Interior Detailing',description:'Confirmed service.',provenance:{kind:'owner_confirmed'}},{name:'Paint Care',description:'Approved service.',provenance:{kind:'owner_confirmed'}}],
 reviews:[],contact:{phone:'305-555-0198',email:'sample@example.test'},
 verification:{approvedBy:'owner',approvedAt:'2026-11-14T12:00:00Z'}};
const site=()=>createPrivateConcept({verified_profile:p,quoteEstimatorEnabled:true}).bundle;
const sectionOrder=['showcase','path','questions','conversion'];
test('owner may rearrange four private V2 sections without moving verified facts, hero, or contact',()=>{
 const order=['questions','showcase','conversion','path'];
 const v=normalizeVisual({sectionOrder:order});
 assert.deepEqual(v.sectionOrder,order);
 const html=applyVisual(site(),v).files['index.html'];
 const at=name=>html.indexOf('class="sbc-v2-'+name+'"');
 assert(at('facts')>=0&&at('facts')<at('questions'));
 assert(at('questions')<at('showcase')&&at('showcase')<at('conversion')&&at('conversion')<at('path'));
 assert(at('path')<html.indexOf('id="contact"'));
 assert.equal(checkPrivateBundle(applyVisual(site(),v)).passed,true);
 assert.match(html,/noindex,nofollow,noarchive/);
});
test('bounded section reorder rejects duplicates, missing, unexpected or invalid structures',()=>{
 const invalid=[[],['showcase'],['showcase','showcase','path','conversion'],['showcase','path','questions','hero'],['showcase','path','questions','contact'],['<script>','path','questions','conversion'],'showcase,path,questions,conversion',null];
 for(const sectionOrder of invalid)assert.throws(()=>normalizeVisual({sectionOrder}),/INVALID_STUDIO_SECTION_ORDER/);
 assert.deepEqual(normalizeVisual({}).sectionOrder,sectionOrder);
});
test('V3 keeps business fact validation, does not generate invented claims or make network calls',()=>{
 const b=applyVisual(site(),normalizeVisual({sectionOrder:['path','questions','showcase','conversion']}));
 assert.match(b.files['index.html'],/Interior Detailing/);
 assert.doesNotMatch(b.files['index.html'],/4\.9 Rated|Licensed & Insured|Satisfaction Guarantee|Priority Dispatch/i);
 assert.doesNotMatch(b.files['site.js'],/fetch\(|XMLHttpRequest|openai|gemini/i);
 assert.equal(b.publicationReady,false);
});
test('V3 editor exposes tablet preview, section move, and unsaved undo/redo with public/browser mirror parity',()=>{
 const a=fs.readFileSync(path.join(__dirname,'../public/sbc-website-production-v1.js'),'utf8');
 const b=fs.readFileSync(path.join(__dirname,'../browser_public/sbc-website-production-v1.js'),'utf8');
 assert.equal(a,b);
 for(const fragment of ['data-factory-device="tablet"','sbcStudioMoveSectionUp','sbcStudioMoveSectionDown','sbcStudioUndo','sbcStudioRedo','sbcStudioSectionOrder','sbcStudioTryRemix'])
  assert(a.includes(fragment),fragment);
});
