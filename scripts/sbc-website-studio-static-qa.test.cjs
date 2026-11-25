'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPrivateConcept}=require('../enterprise/website-studio/index.cjs');
const {checkPrivateBundle}=require('../enterprise/website-studio/qa-gate.cjs');
const p={schemaVersion:1,business:{name:'Window Film Shop',category:'Window Tint',city:'Miami',region:'FL'},services:[{name:'Window tint',provenance:{kind:'owner_confirmed'}},{name:'Film consultation',provenance:{kind:'owner_confirmed'}}],reviews:[],contact:{phone:'3055550123'},verification:{approvedBy:'owner-1',approvedAt:'2026-11-13T00:00:00.000Z'}};
const {bundle}=createPrivateConcept({verified_profile:p,quoteEstimatorEnabled:true});
test('private concept passes conservative static preflight without being declared publishable',()=>{
 const out=checkPrivateBundle(bundle);assert.equal(out.passed,true,JSON.stringify(out.issues));assert.equal(out.publicationReady,false);
 assert.equal(out.checks.length>=5,true);
});
test('broken internal links and absent static asset are rejected',()=>{
 const broken={...bundle,files:{...bundle.files,'index.html':bundle.files['index.html'].replace('href="#contact"','href="#missing"')}};
 const a=checkPrivateBundle(broken);assert.equal(a.passed,false);assert(a.issues.some(x=>x.includes('BROKEN_ANCHOR')));
 const missing={...bundle,files:{...bundle.files,'site.js':''}};
 assert.equal(checkPrivateBundle(missing).passed,false);
});
test('remote scripts and accidental index permission fail private preview gate',()=>{
 const remote={...bundle,files:{...bundle.files,'index.html':bundle.files['index.html']+'<script src="https://bad.example/x.js"></script>'}};
 assert.equal(checkPrivateBundle(remote).passed,false);
 const indexable={...bundle,files:{...bundle.files,'index.html':bundle.files['index.html'].replace('noindex,nofollow,noarchive','index,follow')}};
 assert.equal(checkPrivateBundle(indexable).passed,false);
});

test('complete Business Basic package reports every page and verifies cross-page links',()=>{
 const {compileMultiPageConcept}=require('../enterprise/website-studio/multi-page-concept.cjs');
 const multi=compileMultiPageConcept({profile:p,bundle,offerTier:'essentials'});
 const qa=checkPrivateBundle(multi);
 assert.equal(qa.passed,true,JSON.stringify(qa.issues));
 assert.deepEqual(qa.pages.map(x=>x.path).sort(),['about.html','contact.html','index.html','services.html']);
 assert(qa.pages.every(x=>x.passed));assert.equal(qa.publicationReady,false);
 const mutate=(name,fn)=>({...multi,files:{...multi.files,[name]:fn(multi.files[name])}});
 for(const [name,fn,code] of [
  ['contact.html',h=>h.replace('noindex,nofollow,noarchive','index,follow'),'PRIVATE_INDEXING_UNSAFE'],
  ['services.html',h=>h.replace('href="about.html"','href="missing.html"'),'BROKEN_PAGE_LINK'],
  ['about.html',h=>h.replace('href="contact.html"','href="contact.html#missing"'),'BROKEN_PAGE_LINK'],
  ['contact.html',h=>h.replace('</body>', '<script src=//example.test/tracker.js></script></body>'),'UNSAFE_FORM_OR_SCRIPT'],
  ['about.html',h=>h.replace('</body>',"<form action='https://example.test'></form></body>"),'UNSAFE_FORM_OR_SCRIPT'],
  ['services.html',h=>h.replace('</body>','<div id="main"></div></body>'),'BROKEN_ANCHOR_OR_DUPLICATE_ID'],
  ['about.html',h=>h.replace('</body>','<iframe src="https://example.test"></iframe></body>'),'UNSAFE_FORM_OR_SCRIPT'],
  ['contact.html',h=>h.replace('href="styles.css"','href="missing.css"'),'REMOTE_OR_MISSING_ASSET']
 ]){
  const bad=checkPrivateBundle(mutate(name,fn));assert.equal(bad.passed,false,name+' '+code);
  assert(bad.issues.includes(code),JSON.stringify(bad));
  assert(bad.pages.find(x=>x.path===name)?.issues.includes(code),JSON.stringify(bad));
 }
 const missingPage={...multi,files:{...multi.files}};delete missingPage.files['contact.html'];
 assert.equal(checkPrivateBundle(missingPage).passed,false);
 assert(checkPrivateBundle(missingPage).issues.includes('BROKEN_PAGE_LINK'));
 const traversal={...multi,files:{...multi.files,'../index.html':'bad'}};
 assert.equal(checkPrivateBundle(traversal).passed,false);
 assert(checkPrivateBundle(traversal).issues.includes('UNSAFE_BUNDLE_PATH'));
});
