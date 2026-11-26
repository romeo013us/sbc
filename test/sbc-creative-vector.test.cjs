'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderVector}=require('../enterprise/creative-intelligence/vector-design.cjs');
const input={format:'square',brand:'Successful By Choice',headline:'Make your business visible',detail:'Websites designed for your business',cta:'Get started',palette:'midnight'};
test('produces a self-contained deterministic SVG with an integrity hash',()=>{
 const asset=renderVector(input);
 assert.equal(asset.mime,'image/svg+xml');assert.equal(asset.width,1080);assert.equal(asset.height,1080);
 assert.match(asset.svg,/viewBox="0 0 1080 1080"/);assert.match(asset.svg,/Successful By Choice/);
 assert.match(asset.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(renderVector(input),asset);
 assert.doesNotMatch(asset.svg,/<(?:script|foreignObject|image)\b|\b(?:href|src)\s*=/i);
});
test('supports social portrait and website landscape canvas dimensions',()=>{
 assert.deepEqual([renderVector({...input,format:'portrait'}).width,renderVector({...input,format:'portrait'}).height],[1080,1920]);
 assert.deepEqual([renderVector({...input,format:'landscape'}).width,renderVector({...input,format:'landscape'}).height],[1600,900]);
});
test('handles Spanish copy and escapes XML special characters',()=>{
 const {svg}=renderVector({...input,brand:'Diseño & Más',headline:'Tu negocio, más visible',detail:'Calidad < precio',cta:'Contáctanos'});
 assert.match(svg,/Diseño &amp; Más/);assert.match(svg,/Calidad &lt; precio/);assert.match(svg,/Contáctanos/);
});
test('untrusted fields and oversized or malformed inputs are rejected',()=>{
 for(const change of [{format:'custom'},{palette:'url(https://example.com)'},{headline:'x'.repeat(121)},{headline:' '},{detail:'a\u0000b'},{logoUrl:'https://example.com'},{headline:'<script>alert(1)</script>'}])assert.throws(()=>renderVector({...input,...change}),/INVALID_VECTOR_/);
});
test('long copy is wrapped or explicitly rejected, never silently truncated',()=>{
 const headline='Professional websites with thoughtful design for growing local businesses and independent entrepreneurs';
 const {svg}=renderVector({...input,headline});
 assert.match(svg,/entrepreneurs/);assert.match(svg,/<tspan/);
 assert.throws(()=>renderVector({...input,headline:'X'.repeat(100)}),/INVALID_VECTOR_COPY_FIT/);
});
