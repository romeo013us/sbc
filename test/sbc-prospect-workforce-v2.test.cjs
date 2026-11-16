'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const file=x=>fs.readFileSync(path.join(ROOT,x),'utf8');
const H=require('../public/sbc-prospect-handoff-v2.js');
const measured={
 status:'measured',website:'https://barber.example.org/',source:'Google PageSpeed Insights (Lighthouse lab)',
 measuredAt:'2026-11-16T11:15:00.000Z',scores:{seo:64,performance:53,accessibility:89,bestPractices:97},
 findings:[{id:'meta-description',label:'Meta description',result:'opportunity',source:'PageSpeed Insights Lighthouse audit'},
  {id:'document-title',label:'Page title',result:'pass',source:'PageSpeed Insights Lighthouse audit'}]
};
const at=Date.parse('2026-11-16T12:00:00.000Z');
function packet(){return H.createPacket({
 ownerApproved:true,business:{businessName:"Artisan Barber Shop",industry:'Barbering',website:'https://barber.example.org/'},
 audit:measured,competitors:[{...measured,website:'https://nearbybarber.example.org/',scores:{...measured.scores,seo:78}}],
 preparedAt:at
});}
test('offline handoff must require owner review and strip CRM contacts, credentials and unauthorized fields',()=>{
 assert.throws(()=>H.createPacket({business:{businessName:'A'},ownerApproved:false,audit:measured,preparedAt:at}),/OWNER_REVIEW_REQUIRED/);
 const p=H.createPacket({ownerApproved:true,business:{businessName:'Artisan Barber Shop',industry:'Barbering',website:'https://barber.example.org/',email:'private@example.com',phone:'305-555-0198',address:'Private address',password:'supersecret',customerId:'hidden-id'},audit:measured,preparedAt:at});
 assert.equal(p.schema,'SBC-PROSPECT-HANDOFF-V2');
 assert.equal(p.reviewStatus,'owner_marked_not_cryptographically_signed');
 assert(!JSON.stringify(p).includes('private@example.com'));assert(!JSON.stringify(p).includes('305-555-0198'));
 assert(!JSON.stringify(p).includes('hidden-id'));assert(!JSON.stringify(p).includes('supersecret'));
 assert.equal(p.business.website,'https://barber.example.org/');
});
test('audit scores and provenance preserved, no claims about Google rankings or purchases',()=>{
 const p=packet();
 assert.equal(p.audit.scores.performance,53);
 assert.equal(p.audit.scores.seo,64);
 assert.equal(p.audit.source,'Google PageSpeed Insights (Lighthouse lab)');
 assert.equal(p.competitors.length,1);
 assert.equal(p.audit.findings[0].label,'Meta description');
 assert(!/guaranteed|market share|search rankings/i.test(JSON.stringify(p)));
 const parsed=H.validatePacket(JSON.stringify(p),at);
 assert.equal(parsed.business.businessName,'Artisan Barber Shop');
});
test('schema validation rejects forged structure, unsafe values and stale / future handoffs',()=>{
 const p=packet();
 for(const corrupted of [
  {...p,schema:'SBC-PROSPECT-HANDOFF-V0'},
  {...p,reviewStatus:'not_reviewed'},
  {...p,preparedAt:'2025-11-01T00:00:00Z'},
  {...p,preparedAt:'2027-11-01T00:00:00Z'},
  {...p,business:{...p.business,website:'http://localhost:8080'}},
  {...p,audit:{...p.audit,scores:{...p.audit.scores,seo:999}}},
  {...p,secret:'do_not_allow'},
  {...p,competitors:new Array(9).fill(measured)}
 ])assert.throws(()=>H.validatePacket(JSON.stringify(corrupted),at),/HANDOFF_/);
 assert.throws(()=>H.validatePacket('{"a":"'+ 'x'.repeat(50000)+'"}',at),/HANDOFF_TOO_LARGE/);
});
test('unknown source, unavailable audit and competitor data remain unverified',()=>{
 const p=H.createPacket({ownerApproved:true,business:{businessName:'Sample Co'},audit:{status:'unavailable',reason:'UPSTREAM_RATE_LIMITED'},preparedAt:at});
 assert.equal(p.audit.status,'unavailable');
 assert.equal(p.audit.scores,null);
 const x=H.buildRoleBrief(p,'lead_researcher');
 assert.match(x,/not verified|unavailable/i);
 assert.doesNotMatch(x,/measured 0\/100|Google rank|guaranteed lead/i);
});
test('role-specific output is read-only and contains research, calling and account-manager steps',()=>{
 const p=packet();
 for(const role of ['lead_researcher','researcher','caller','account_manager','owner']){
  const text=H.buildRoleBrief(p,role);
  assert.match(text,/Artisan Barber Shop/);
  assert.match(text,/owner-marked|owner-reviewed|not cryptographically/i);
  assert.match(text,/approval/i);
  assert.doesNotMatch(text,/auto[- ]?send|already contacted|guaranteed sales/i);
 }
 assert.match(H.buildRoleBrief(p,'lead_researcher'),/research checklist/i);
 assert.match(H.buildRoleBrief(p,'caller'),/call preparation/i);
 assert.match(H.buildRoleBrief(p,'account_manager'),/account expansion/i);
 assert.throws(()=>H.buildRoleBrief(p,'guest'),/ROLE_NOT_SUPPORTED/);
});
test('outreach suppressed when consent status is unknown or opt-out; never initiates calls',()=>{
 const p=packet();
 const unknown=H.createOutreachDraft(p,{contactPermission:'unknown'});
 assert.match(unknown,/review permission/i);
 assert.doesNotMatch(unknown,/Hi .*Artisan/i);
 const opted=H.createOutreachDraft(p,{contactPermission:'opt_out'});
 assert.match(opted,/do not contact/i);
 const allowed=H.createOutreachDraft(p,{contactPermission:'owner_confirmed_permission'});
 assert.match(allowed,/meta description/i);
 assert.match(allowed,/draft only/i);
});
test('installed in research, sales and account-manager workspaces without source code edits to existing workers',()=>{
 for(const name of ['lead-research.html','sales-caller.html','sbc-account-manager-v1.html']){
  const html=file('public/'+name);
  assert.match(html,/sbc-prospect-handoff-v2\.js\?v=2/);
  assert.match(html,/sbc-prospect-handoff-v2\.css\?v=2/);
  assert.equal(html,file('browser_public/'+name));
 }
 assert.equal(file('public/sbc-prospect-handoff-v2.js'),file('browser_public/sbc-prospect-handoff-v2.js'));
 assert.equal(file('public/sbc-prospect-handoff-v2.css'),file('browser_public/sbc-prospect-handoff-v2.css'));
 assert.match(file('public/sbc-prospect-intelligence.js'),/Export owner-reviewed research handoff/);
 assert.match(file('public/sbc-prospect-intelligence.js'),/SBCProspectHandoffV2/);
});
