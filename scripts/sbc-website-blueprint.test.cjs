'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assessResearch}=require('../enterprise/website-studio/research-classifier.cjs');
const {createDesignTokens}=require('../enterprise/website-studio/creative-director.cjs');
const {architectSite}=require('../enterprise/website-studio/website-architect.cjs');
const {compileStaticSite}=require('../enterprise/website-studio/static-compiler.cjs');

const profile={schemaVersion:1,business:{name:'CJ Window Tinters',category:'Window Tinting Service',city:'Miami',region:'FL'},services:[{name:'Automotive Window Tinting',description:'Review window-film options for your vehicle.'},{name:'Commercial Window Film',description:'Discuss film choices for commercial spaces.'}],reviews:[],contact:{phone:'+13055550123',email:null},verification:{approvedBy:'owner-1',approvedAt:'2026-11-13T17:00:00Z'}};

test('research stays unverified and requires evidence before website classification',()=>{
 const noSearch=assessResearch({researchCompleted:false,signals:[]});
 assert.equal(noSearch.websiteStatus,null);
 const r=assessResearch({researchCompleted:true,signals:[{type:'service',value:'Car Audio',source_url:'https://example.com/listing',confidence_score:0.8,status:'unverified'}]});
 assert.equal(r.websiteStatus,'no_web_presence_found');
 assert.equal(r.signals[0].status,'unverified');
 assert.throws(()=>assessResearch({signals:[{type:'service',value:'X',source_url:'javascript:alert(1)',confidence_score:0.8,status:'approved'}]}));
});

test('blueprint is deterministic and never consumes unverified secondary services',()=>{
 const tokens=createDesignTokens(profile);
 assert.deepEqual(createDesignTokens(profile),tokens);
 assert.match(tokens.palette.accent,/^#[0-9a-fA-F]{6}$/);
 const ast=architectSite(profile,{quoteEstimatorEnabled:true,research_signals:[{status:'approved',value:'Car Audio'}]});
 assert(!JSON.stringify(ast).includes('Car Audio'));
 assert(ast.sections.some(s=>s.type==='quoteRequest'));
 assert(!ast.sections.some(s=>s.type==='socialProof'));
 assert(ast.sections.some(s=>s.type==='services'));
 assert.deepEqual(architectSite(profile,{quoteEstimatorEnabled:true}),ast);
});

test('social proof requires reviews included in the approved profile',()=>{
 const ast=architectSite({...profile,reviews:[{quote:'Very helpful',attribution:'Verified customer',approved:true}]});
 assert(ast.sections.some(s=>s.type==='socialProof'));
 const bad=architectSite({...profile,reviews:[{quote:'Fake claim',attribution:'Nobody',approved:false}]});
 assert(!bad.sections.some(s=>s.type==='socialProof'));
});

test('compiler produces portable static files with no live submission or invented guarantees',()=>{
 const ast=architectSite(profile,{quoteEstimatorEnabled:true});
 const built=compileStaticSite({profile,designTokens:createDesignTokens(profile),layoutAst:ast});
 assert.deepEqual(Object.keys(built.files).sort(),['design-tokens.json','index.html','layout-ast.json','site.js','styles.css']);
 assert.match(built.files['index.html'],/noindex,nofollow/);
 assert.match(built.files['index.html'],/Automotive Window Tinting/);
 assert.match(built.files['index.html'],/Commercial Window Film/);
 assert.doesNotMatch(built.files['index.html'],/Car Audio|lifetime warranty|5-star/i);
 assert.match(built.files['site.js'],/addEventListener/);
 assert.doesNotMatch(built.files['index.html'],/action="https?:/);
 assert.doesNotMatch(built.files['index.html'],/https?:\/\/.*(?:\.js|\.css)/);
});

test('untrusted profile content is escaped in the static compiler',()=>{
 const hostile={...profile,business:{...profile.business,name:'<img src=x onerror=alert(1)>'},services:[{name:'<script>alert(1)</script>',description:'Service <special>'}]};
 const built=compileStaticSite({profile:hostile,designTokens:createDesignTokens(hostile),layoutAst:architectSite(hostile)});
 assert.doesNotMatch(built.files['index.html'],/<script>alert\(1\)<\/script>/);
 assert.doesNotMatch(built.files['index.html'],/<img src=x/);
 assert.match(built.files['index.html'],/&lt;script&gt;/);
});

test('invalid verification, invalid section types and approved raw signals cannot bypass rules',()=>{
 assert.throws(()=>architectSite({...profile,verification:{approvedBy:'',approvedAt:'not-a-date'}}),/INVALID_VERIFIED_PROFILE/);
 assert.throws(()=>compileStaticSite({profile,designTokens:createDesignTokens(profile),layoutAst:{schemaVersion:1,sections:[{type:'script',html:'<script/>'}]}}),/INVALID_LAYOUT_AST/);
 assert.throws(()=>createDesignTokens({...profile,services:[{name:'not-verified',description:'',research_signals:[]}]}),/INVALID_VERIFIED_PROFILE/);
});


test('no-service concepts contain no dead service navigation and uncertain website signals remain unclassified',()=>{
 const empty={...profile,services:[]};
 const site=compileStaticSite({profile:empty,designTokens:createDesignTokens(empty),layoutAst:architectSite(empty)});
 assert(!site.files['index.html'].includes('href="#services"'));
 const pending=assessResearch({researchCompleted:true,signals:[{type:'social',value:'Social page',source_url:'https://example.org/profile',confidence_score:0.6,status:'unverified'}]});
 assert.equal(pending.websiteStatus,null);
});

test('compiler rejects tampered component trees that insert fake proof or services',()=>{
 const designTokens=createDesignTokens(profile),layoutAst=architectSite(profile);
 const malicious={...layoutAst,sections:[layoutAst.sections[0],{type:'socialProof',title:'What people say',items:[{title:'The best in Florida',attribution:'Invented'}]},...layoutAst.sections.slice(1)]};
 assert.throws(()=>compileStaticSite({profile,designTokens,layoutAst:malicious}),/UNAPPROVED_SITE_COPY/);
 const forgedService={...layoutAst,sections:layoutAst.sections.map(s=>s.type==='services'?{...s,items:[...s.items,{title:'Car Audio',description:'We do car audio'}]}:s)};
 assert.throws(()=>compileStaticSite({profile,designTokens,layoutAst:forgedService}),/UNAPPROVED_SITE_COPY/);
});
