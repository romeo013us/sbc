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
