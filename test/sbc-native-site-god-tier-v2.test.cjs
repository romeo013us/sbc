'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Factory=require('../enterprise/sbc-prospect-site-factory.cjs');
const root=path.join(__dirname,'..');
const sample=(industry,extras={})=>({id:'demo_safe-1',slug:'example-safe-1',status:'Draft',offerTier:'essentials',industry,customer:{businessName:'Example Services',city:'Miami'},...extras});
const facts={verified:true,services:['Engine diagnostics','Brake repair','Collision estimates'],phone:'+13055550125',streetAddress:'100 Main Street',city:'Miami',region:'FL',postalCode:'33101',serviceAreas:['33101','33161'],openingHours:'Mon–Fri 9–5'};
test('trade, professional, hospitality and generic previews have meaningfully different layout sections',()=>{
 const checks=[['Auto Repair','trade','SERVICE AREA'],['Insurance Agency','professional','CONSULTATION'],['Restaurant','hospitality','VISIT'],['Software Studio','local','NEXT STEP']];
 for(const [industry,kind,text] of checks){
  const html=Factory.renderPage(sample(industry),'home');
  assert.match(html,new RegExp('data-sbc-layout="'+kind+'"'),industry);
  assert.match(html,new RegExp('sbc-industry-spotlight--'+kind),industry);
  assert.match(html,new RegExp(text,'i'),industry);
  assert.match(html,/Website concept preview/);
  assert.doesNotMatch(html,/24\/7 emergency dispatch|Licensed and insured|Five-star rated/);
 }
});
test('verified website facts appear only in owner-approved website; unverified CRM contact fields never become claims',()=>{
 const unverified=sample('Auto Repair',{verifiedBusinessDetails:facts,customer:{businessName:'Example Auto',city:'Miami',phone:'305-000-0000'}});
 const draft=Factory.renderPage(unverified,'home');
 assert.doesNotMatch(draft,/Engine diagnostics|100 Main Street|33161|tel:\+13055550125/);
 const approved=Factory.renderPage({...unverified,status:'Approved'},'home');
 assert.match(approved,/Engine diagnostics/);
 assert.match(approved,/Brake repair/);
 assert.match(approved,/33161/);
 assert.match(approved,/100 Main Street/);
 assert.doesNotMatch(approved,/305-000-0000/);
 assert.match(approved,/Miami/);
});
test('structured LocalBusiness JSON-LD requires explicit publication approval and confirmed business identity, and rejects script injection',()=>{
 const d=sample('Auto Repair',{status:'Approved',verifiedBusinessDetails:facts});
 for(const options of [{},{staticMode:true},{publicationApproved:true},{staticMode:true,publicationApproved:false}]){
  assert.doesNotMatch(Factory.renderPage(d,'home',options),/application\/ld\+json/,'No SEO schema on presentation-only site');
 }
 const live=Factory.renderPage(d,'home',{staticMode:true,publicationApproved:true});
 const match=live.match(/<script type="application\/ld\+json">([^<]*)<\/script>/);
 assert(match,'owner approved static site should support complete business schema');
 const data=JSON.parse(match[1]);
 assert.equal(data['@type'],'LocalBusiness');
 assert.equal(data.name,'Example Services');
 assert.equal(data.telephone,'+13055550125');
 assert.equal(data.address.postalCode,'33101');
 assert.deepEqual(data.areaServed,['33101','33161']);
 assert.doesNotMatch(live,/noindex,nofollow,noarchive/);
 const attack=Factory.renderPage(sample('Auto Repair',{status:'Approved',verifiedBusinessDetails:{...facts,streetAddress:'</script><script>alert(1)</script>'}}),'home',{staticMode:true,publicationApproved:true});
 assert.doesNotMatch(attack,/<script>alert\(1\)<\/script>/);
 assert.match(attack,/\\u003c/);
});
test('public release remains blocked without trusted complete address and consent; preview mobile CTA never initiates a call',()=>{
 const d=sample('Auto Repair',{status:'Approved',verifiedBusinessDetails:{...facts,verified:false}});
 const html=Factory.renderPage(d,'home',{staticMode:true,publicationApproved:true});
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.doesNotMatch(html,/application\/ld\+json/);
 assert.doesNotMatch(html,/href="tel:/);
 const draft=Factory.renderPage(sample('Auto Repair',{verifiedBusinessDetails:facts}),'home');
 assert.match(draft,/class="sbc-mobile-actionbar"/);
 assert.match(draft,/href="\/api\/website-demos\/demo_safe-1\/preview\?page=contact"/);
 assert.doesNotMatch(draft,/href="tel:/);
 const live=Factory.renderPage(sample('Auto Repair',{status:'Approved',verifiedBusinessDetails:facts}),'home',{staticMode:true,publicationApproved:true});
 assert.match(live,/class="sbc-mobile-actionbar"/);
 assert.match(live,/href="tel:\+13055550125"/);
});
test('native export retains dimensions and self-contained asset paths and responsive high-contrast CSS mirrors',()=>{
 const d=sample('Insurance Agency',{status:'Approved'});
 const html=Factory.renderPage(d,'home',{staticMode:true});
 assert.match(html,/class="art-photo"[^>]*width="1400"[^>]*height="1000"/);
 assert.match(html,/class="sample-gallery-card/);
 assert.match(html,/loading="lazy"[^>]*width="1100"[^>]*height="825"/);
 assert.match(html,/src="site\.js"/);
 assert.match(html,/href="site\.css"/);
 const css=fs.readFileSync(path.join(root,'public/sbc-prospect-site.css'),'utf8');
 assert.equal(css,fs.readFileSync(path.join(root,'browser_public/sbc-prospect-site.css'),'utf8'));
 assert.match(css,/\.sbc-mobile-actionbar/);
 assert.match(css,/sbc-industry-spotlight--trade/);
 assert.match(css,/sbc-industry-spotlight--professional/);
 assert.match(css,/sbc-industry-spotlight--hospitality/);
 assert.match(css,/@media\s*\(prefers-reduced-motion:reduce\)/);
});
