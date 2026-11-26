'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {inspectDocument}=require('../enterprise/creative-intelligence/prospect-brand-auditor.cjs');
test('real inert DOM handles reversed attributes, ignores comments and never executes scripts',()=>{
 const d=new JSDOM('<!doctype html><html lang="en"><head><title>Example Auto</title><meta content="width=device-width" name="VIEWPORT"><meta content="Example description" name="description"><meta content="Example" property="og:title"><script>window.ran=true</script></head><body><!-- <form><a href="tel:123">phone</a></form> --><h1>Example Auto</h1><script type="application/ld+json">{}</script><a hreflang="es" href="/es">Español</a></body></html>');
 try{assert.deepEqual(inspectDocument(d.window.document),{title:true,description:true,viewport:true,h1:true,contactLink:false,form:false,structuredData:true,socialPreview:true,language:true,alternateSpanish:true});assert.equal(d.window.ran,undefined);}finally{d.window.close();}
});
