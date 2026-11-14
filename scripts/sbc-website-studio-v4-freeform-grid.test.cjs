'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createPrivateConcept}=require('../enterprise/website-studio/index.cjs');
const {checkPrivateBundle}=require('../enterprise/website-studio/qa-gate.cjs');
const {normalizeVisual,applyVisual}=require('../enterprise/website-studio/visual-editor.cjs');
const {normalizeGrid,snapColumnSpan}=require('../enterprise/website-studio/freeform-grid-compiler.cjs');
const profile={schemaVersion:1,business:{name:'Miami Verified Auto',category:'Auto Detailing',city:'Miami',region:'FL'},
 services:['Inside','Outside','Polish'].map(n=>({name:n+' Service',description:'Business approved.',provenance:{kind:'owner_confirmed'}})),
 reviews:[],contact:{phone:'305-555-0123'},verification:{approvedBy:'owner',approvedAt:'2026-11-14T00:00:00Z'}};
const site=()=>createPrivateConcept({verified_profile:profile}).bundle;
const grid={enabled:true,nodes:[{id:'service-1',grid:{colSpan:8,rowSpan:2},
 style:{paddingPx:30,radiusPx:18,shadow:'soft',align:'center'},motion:'hover-lift',
 breakpoints:{tablet:{colSpan:12},mobile:{colSpan:12,paddingPx:18}}}]};
test('bounded 12-column grid is opt-in and keeps pre-existing V2-V4 visual output byte-identical',()=>{
 const original=site(),v=normalizeVisual({});
 assert.deepEqual(v.freeformGrid,{enabled:false,nodes:[]});
 const rendered=applyVisual(original,v);
 const baseline=applyVisual(original,{});
 assert.deepEqual(rendered.files,baseline.files);
 assert.equal(checkPrivateBundle(rendered).passed,true);
});
test('validated grid renders only verified service cards, never arbitrary HTML, with mobile reflow',()=>{
 const b=applyVisual(site(),normalizeVisual({freeformGrid:grid}));
 const html=b.files['index.html'],css=b.files['styles.css'];
 assert.equal(checkPrivateBundle(b).passed,true,JSON.stringify(checkPrivateBundle(b).issues));
 assert.match(html,/data-sbc-grid-node="service-1"/);
 assert.match(html,/Inside Service/);
 assert.match(html,/Outside Service/);
 assert.match(css,/grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
 assert.match(css,/grid-column:\s*span 8/);
 assert.doesNotMatch(css,/grid-auto-flow:\s*row dense/,'visual and keyboard order must agree');
 assert.match(css,/@media\s*\(max-width:\s*1024px\)/);
 assert.match(css,/@media\s*\(max-width:\s*640px\)/);
 assert.match(css,/prefers-reduced-motion:\s*reduce/);
 assert.match(css,/--sbc-studio-gap/);
 assert.doesNotMatch(css,/<script|javascript:|https?:\/\//i);
 assert.doesNotMatch(html,/data-sbc-grid-node="verified-facts"/);
 assert.equal(b.publicationReady,false);
});
test('layout rejects CSS injection, untrusted markup, duplicate nodes, bad spans and hiding verified services',()=>{
 const bad=[
 {id:'service-1;body{display:none}',grid:{colSpan:6}},
 {id:'contact',grid:{colSpan:6}},
 {id:'service-13',grid:{colSpan:6}},
 {id:'service-1',grid:{colSpan:0}},
 {id:'service-1',grid:{colSpan:13}},
 {id:'service-1',grid:{colSpan:6,colStart:10}},
 {id:'service-1',grid:{colSpan:6},style:{paddingPx:'calc(500vh)'}},
 {id:'service-1',grid:{colSpan:6},style:{accentOverride:'url(https://evil.invalid)'}},
 {id:'service-1',grid:{colSpan:6},motion:'onload=alert(1)'},
 {id:'service-1',grid:{colSpan:6},breakpoints:{mobile:{hide:true}}},
 {id:'service-1',grid:{colSpan:6},breakpoints:{mobile:{colSpan:3}}},
 {id:'service-1',grid:{colSpan:6},lockedVerifiedFact:false},
 ];
 for(const node of bad)assert.throws(()=>normalizeGrid({enabled:true,nodes:[node]}),/INVALID_STUDIO_GRID/,JSON.stringify(node));
 assert.throws(()=>normalizeGrid({enabled:true,nodes:[grid.nodes[0],grid.nodes[0]]}),/INVALID_STUDIO_GRID/);
 assert.throws(()=>normalizeGrid({enabled:true,nodes:Array.from({length:13},(_,i)=>({id:'service-'+(i+1),grid:{colSpan:6}}))}),/INVALID_STUDIO_GRID/);
});
test('snap-to-grid math clamps drag-resize without fractional or over-wide spans',()=>{
 assert.equal(snapColumnSpan(6,125,1200),7);
 assert.equal(snapColumnSpan(6,-230,1200),4);
 assert.equal(snapColumnSpan(11,9000,1200),12);
 assert.equal(snapColumnSpan(1,-9000,1200),1);
 assert.equal(snapColumnSpan(7,NaN,1200),7);
 assert.equal(snapColumnSpan(7,100,0),7);
});
test('stored visual grid normalizes idempotently and follows existing versioned snapshots',()=>{
 const one=normalizeVisual({freeformGrid:grid});
 const two=normalizeVisual(one);
 assert.deepEqual(two.freeformGrid,one.freeformGrid);
 const concept=applyVisual(site(),two);
 assert.equal(checkPrivateBundle(concept).passed,true);
 assert.deepEqual(normalizeGrid({enabled:false,nodes:[]}),{enabled:false,nodes:[]});
});
test('owner-only inspector/resize UI and opaque sandbox message bridge remain mirrored',()=>{
 const a=fs.readFileSync(path.join(__dirname,'../public/sbc-website-production-v1.js'),'utf8');
 const b=fs.readFileSync(path.join(__dirname,'../browser_public/sbc-website-production-v1.js'),'utf8');
 const routes=fs.readFileSync(path.join(__dirname,'../enterprise/website-studio/studio-owner-routes.cjs'),'utf8');
 assert.equal(a,b);
 for(const marker of ['sbcStudioGridInspector','sbcStudioGridSpan','sbcStudioGridPadding','sbcStudioGridRadius','sbcStudioGridMobile','SBC_STUDIO_GRID_SELECT','SBC_STUDIO_GRID_RESIZE','event.source!==frame.contentWindow','rememberStudioDraft()'])assert(a.includes(marker),marker);
 for(const marker of ['data-sbc-grid-handle','SBC_STUDIO_GRID_SELECT','SBC_STUDIO_GRID_RESIZE','sandbox allow-scripts'])assert(routes.includes(marker),marker);
 assert(!a.includes('SBC_GRID_PUBLISH_IMMEDIATELY'));
});
