'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Q=require('../public/sbc-prospect-opportunity-v3.js');
const source='Google PageSpeed Insights (Lighthouse lab)';
const measured={status:'measured',website:'https://sample.example.org/',source,measuredAt:'2026-11-16T15:00:00.000Z',scores:{seo:57,performance:49,accessibility:81,bestPractices:95},
 findings:[{id:'meta-description',label:'Meta description',result:'opportunity',source}]};
const customer={businessName:'Offline Sample Barber',industry:'Barber',website:'https://sample.example.org/'};
test('only measured fresh evidence may create positive findings; missing/stale scores never become zero',()=>{
 const a=Q.evaluate(customer,measured,Date.parse('2026-11-16T18:00:00Z'));
 assert.equal(a.verification,'measured');assert(a.opportunities.length>0);
 const stale=Q.evaluate(customer,measured,Date.parse('2027-01-16T18:00:00Z'));
 assert.equal(stale.verification,'expired');assert.equal(stale.opportunities.length,0);
 const missing=Q.evaluate(customer,{status:'unavailable',scores:null},Date.now());
 assert.equal(missing.verification,'unverified');assert.equal(missing.opportunities.length,0);
 assert.equal(missing.score,null);
});
test('package matching is based on verified opportunities, not fake purchase probabilities',()=>{
 const a=Q.evaluate(customer,measured,Date.parse('2026-11-16T18:00:00Z'));
 assert(a.offerIdeas.every(x=>x.requiresOwnerQuote===true));
 assert(a.offerIdeas.some(x=>x.service==='Website Improvement Review'));
 assert(!JSON.stringify(a).includes('guaranteed'));
 assert.equal(a.kind,'audited_opportunity_not_conversion_probability');
});
test('confirmed exclusions and suppression prevent outreach planning',()=>{
 const a=Q.evaluate({...customer,doNotContact:true},measured,Date.parse('2026-11-16T18:00:00Z'));
 assert.equal(a.outreach.allowed,false);assert.equal(a.outreach.action,'DO_NOT_CONTACT');
 const b=Q.evaluate(customer,measured,Date.parse('2026-11-16T18:00:00Z'));
 assert.equal(b.outreach.allowed,false);assert.equal(b.outreach.action,'VERIFY_PERMISSION');
});
test('batch triage stable sort, prevents unverified prospects outranking measured evidence',()=>{
 const now=Date.parse('2026-11-16T18:00:00Z');
 const rows=Q.triage([
  {business:customer,audit:{status:'unavailable'}},
  {business:{...customer,businessName:'Measured Co'},audit:measured},
  {business:{...customer,businessName:'Suppressed Co',doNotContact:true},audit:measured}
 ],now);
 assert.equal(rows[0].businessName,'Measured Co');
 assert.equal(rows.at(-1).businessName,'Suppressed Co');
 assert.equal(rows[1].score,null);
});
test('owner-reviewed client report includes provenance, limitations, and no invented competitor ranks',()=>{
 const report=Q.report(customer,measured,Date.parse('2026-11-16T18:00:00Z'));
 assert.match(report,/Source: Google PageSpeed Insights/);
 assert.match(report,/Not verified: Google Business Profile/);
 assert.match(report,/Owner review required/);
 assert.doesNotMatch(report,/guaranteed|#1 on Google|market leader|highest conversion/i);
 assert.match(report,/Website Improvement Review/);
});
test('offline rehearsal is deterministic and has no fetch, provider or CRM side effects',()=>{
 const a=Q.offlineRehearsal();
 assert.equal(a.mode,'OFFLINE_ONLY');assert.equal(a.networkCalls,0);
 assert.equal(a.payments,0);assert.equal(a.crmWrites,0);
 assert.equal(a.scenarioCount,4);assert.equal(a.pass,true);
});
test('owner Market Intelligence loads v3 additively with exactly mirrored browser code',()=>{
 const ui=fs.readFileSync('public/sbc-prospect-intelligence.js','utf8');
 assert.match(ui,/sbc-prospect-opportunity-v3\.js\?v=3-offline/);
 assert.match(ui,/Offline opportunity plan/);
 for(const file of ['sbc-prospect-intelligence.js','sbc-prospect-opportunity-v3.js']){
  assert.equal(fs.readFileSync('public/'+file,'utf8'),fs.readFileSync('browser_public/'+file,'utf8'));
 }
});
