'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPrivateConcept}=require('../enterprise/website-studio/index.cjs');
const {normalizeVisual,applyVisual}=require('../enterprise/website-studio/visual-editor.cjs');
const {checkPrivateBundle}=require('../enterprise/website-studio/qa-gate.cjs');
const profile=(category,name='Example Company')=>({schemaVersion:1,
 business:{name,category,city:'Miami',region:'FL'},
 services:[{name:'Service One',description:'Business-confirmed service details.',provenance:{kind:'owner_confirmed'}},
 {name:'Service Two',description:'Business-confirmed second service.',provenance:{kind:'owner_confirmed'}}],
 reviews:[],contact:{phone:'305-555-0110',email:'office@example.test'},
 verification:{approvedBy:'owner-demo',approvedAt:'2026-11-01T00:00:00Z'}
});
test('V2 site generator creates distinctive, zero-AI, private responsive sections from verified facts',()=>{
 const kinds=['Auto Body Repair','Hair Salon','Local Restaurant','Roofing Contractor','Law Firm','Neighborhood Store'];
 const renders=kinds.map(category=>createPrivateConcept({verified_profile:profile(category)}).bundle);
 const signatures=new Set();
 for(const b of renders){
  assert.equal(b.publicationReady,false);
  assert.equal(checkPrivateBundle(b).passed,true,JSON.stringify(checkPrivateBundle(b).issues));
  const html=b.files['index.html'],css=b.files['styles.css'];
  assert.match(html,/data-sbc-studio-version="2"/);
  assert.match(html,/sbc-v2-facts/);
  assert.match(html,/sbc-v2-path/);
  assert.match(html,/sbc-v2-questions/);
  assert.match(html,/Business-confirmed service details/);
  assert.match(html,/noindex,nofollow,noarchive/);
  assert.doesNotMatch(html,/guaranteed results|five star|award.winning|fictional testimonial/i);
  assert.match(css,/@media\s*\(max-width:\s*750px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(css,/@import\s+url\(https?:/);
  signatures.add(html.match(/data-sbc-v2-direction="([^"]+)"/)?.[1]);
 }
 assert(signatures.size>=4,'business categories should produce differentiated design directions');
});
test('V2 visual editor supports bounded live art direction controls, rejecting arbitrary code',()=>{
 const base=createPrivateConcept({verified_profile:profile('Barber Shop')}).bundle;
 const visual=normalizeVisual({vibe:'cinematic',serviceLayout:'bento',heroStyle:'split'});
 const edited=applyVisual(base,visual);
 assert.match(edited.files['index.html'],/data-sbc-vibe="cinematic"/);
 assert.match(edited.files['index.html'],/data-sbc-service-layout="bento"/);
 assert.match(edited.files['index.html'],/data-sbc-hero-style="split"/);
 assert.equal(checkPrivateBundle(edited).passed,true);
 for(const [key,value] of [['vibe','url(https://evil.example)'],['heroStyle','<script>'],['serviceLayout','grid;body{display:none}']])
  assert.throws(()=>normalizeVisual({[key]:value}),/INVALID_STUDIO_/);
});
test('V2 has no required paid AI or remote image calls and permits truthful confirmed facts only',()=>{
 const b=createPrivateConcept({verified_profile:profile('Auto Repair')}).bundle;
 assert.doesNotMatch(b.files['site.js'],/fetch\(|XMLHttpRequest|api\.openai/i);
 assert.doesNotMatch(b.files['index.html'],/images\.unsplash\.com|images\.pexels\.com|<script[^>]+src="https?:/i);
 assert.equal(checkPrivateBundle(b).passed,true);
});
