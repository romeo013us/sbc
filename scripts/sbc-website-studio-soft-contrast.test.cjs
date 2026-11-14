'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPrivateConcept}=require('../enterprise/website-studio/index.cjs');
const {checkPrivateBundle}=require('../enterprise/website-studio/qa-gate.cjs');
const {resolveSoftSurfaceInk,contrastRatio}=require('../enterprise/website-studio/elite-v2.cjs');
const mk=(category)=>({schemaVersion:1,business:{name:'Illustrative Verified Business',category,city:'Miami',region:'FL'},
 services:[{name:'Approved Example Service',description:'Only fictional QA content.',provenance:{kind:'owner_confirmed'}}],
 reviews:[],contact:{phone:'305-555-0121'},verification:{approvedBy:'fictional-qa',approvedAt:'2026-11-14T00:00:00Z'}});
test('automotive soft background does not inherit a light-on-light headline',()=>{
 const bundle=createPrivateConcept({verified_profile:mk('Auto Detailing')}).bundle;
 const t=JSON.parse(bundle.files['design-tokens.json']).palette;
 const color=resolveSoftSurfaceInk(t);
 assert(contrastRatio(color,t.soft)>=4.5,JSON.stringify({color,soft:t.soft}));
 const css=bundle.files['styles.css'];
 assert.match(css,/--sbc-v2-soft-contrast-ink:#[0-9A-Fa-f]{6}/);
 assert.match(css,/\.sbc-v2-showcase \.sbc-v2-heading\{color:var\(--sbc-v2-soft-contrast-ink\)/);
 assert.match(css,/\.sbc-v2-questions\{color:var\(--sbc-v2-soft-contrast-ink\)/);
 assert.equal(checkPrivateBundle(bundle).passed,true);
});
test('six business categories generate readable soft-surface heading text without external assets',()=>{
 for(const category of ['Auto Detailing','Hair Salon','Restaurant','Roofing Contractor','Law Firm','Retail Store']){
  const bundle=createPrivateConcept({verified_profile:mk(category)}).bundle;
  const t=JSON.parse(bundle.files['design-tokens.json']).palette;
  assert(contrastRatio(resolveSoftSurfaceInk(t),t.soft)>=4.5,category);
  assert.equal(checkPrivateBundle(bundle).passed,true,category);
 }
});
test('alternate design vibes keep readable soft headings and respect reduced-motion outputs',()=>{
 const bundle=createPrivateConcept({verified_profile:mk('Auto Repair')}).bundle;
 const css=bundle.files['styles.css'];
 for(const [vibe,soft] of [['cinematic','#111c2d'],['minimal','#edf2ed'],['warm','#f1e0d1']]){
  const match=css.match(new RegExp('body\\\\[data-sbc-vibe="'+vibe+'"\\\\]\\\\{--sbc-v2-soft-contrast-ink:(#[A-Fa-f0-9]{6})\\\\}'));
  assert(match,'missing '+vibe+' contrast');
  assert(contrastRatio(match[1],soft)>=4.5,vibe);
 }
 assert.match(css,/prefers-reduced-motion/);
});
