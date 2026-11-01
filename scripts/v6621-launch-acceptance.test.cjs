'use strict';
// SBC V66.21: independent Phase 1-4 read-only evidence checks, mocked data only.
// No real endpoints, account credentials, database writes or Square charges.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=x=>fs.readFileSync(path.join(root,x),'utf8');
const src=read('public/sbc-launch-readiness-v6621.js');
assert.equal(src,read('browser_public/sbc-launch-readiness-v6621.js'),'browser twin must be identical');
const html=read('public/index.html');
assert.equal(html,read('browser_public/index.html'),'HTML twins must be identical');
assert.match(html,/id="sbc-launch-readiness-topbar"[^>]*hidden/);
assert.match(html,/sbc-launch-readiness-v6621\.js\?v=66\.0\.21-read-only-acceptance/);
assert.match(html,/launch\.hidden=!isOwner/);
assert.match(html,/if\(launch\)launch\.hidden=true/);
assert.doesNotMatch(src,/setInterval\(|location\.reload\(|localStorage\.clear\(/);
assert.doesNotMatch(src,/\bfetch\s*\(|\bpostMessage\s*\(/);
new vm.Script(src);
const expected=[
 '/api/owner/launch-gates','/api/users','/api/fantastic4/summary',
 '/api/owner/lead-readiness?limit=0','/api/payments/square/readiness'
];
function fixture(role,fail=''){
 const elements={},calls=[],alerts=[];
 const document={getElementById(id){return elements[id]||(elements[id]={id,textContent:'',hidden:false,replaceChildren(){this.replaced=true;}})}};
 const payload={
  [expected[0]]:{ok:true,coreWritePrerequisitesVerified:true,checks:{mysqlReachable:true,writerLeaseSessionVerified:true,recoveryEvaluated:true,recoveryClear:true},records:{customers:530}},
  [expected[1]]:[{role:'lead_researcher',active:true},{role:'demo',active:true}],
  [expected[2]]:{ok:true,providerGates:{wordpress:true,hosting:false,vault:true,edgeCache:false}},
  [expected[3]]:{ok:true,totalTenantRecords:530,verifiedHumanCallReady:0,needsRecordVerification:275,suppressedOrTerminal:20,tenantHydrationDelta:0},
  [expected[4]]:{ok:true,preflightReady:false,environment:'production',triage:{blockers:[{code:'SQUARE_WEBHOOK_NOT_CONFIGURED'}]}}
 };
 const window={state:{me:{role}},toast:s=>alerts.push(s),openModal:(title,body)=>{window.dialog={title,body}},api:async(url,options)=>{
   calls.push({url,options});
   if(url===fail)throw Error('SYNTHETIC_READ_FAILURE');
   return payload[url];
 }};
 vm.runInNewContext(src,{window,document,Number,String,Object,Array,console},{timeout:1200});
 return {window,elements,calls,alerts};
}
(async()=>{
 const guest=fixture('lead_researcher');
 await guest.window.sbcOpenLaunchReadiness();
 assert.equal(guest.calls.length,0,'researcher cannot query owner endpoints');
 assert.equal(guest.alerts.length,1,'researcher is explicitly refused');
 const demo=fixture('demo');
 await demo.window.sbcOpenLaunchReadiness();
 assert.equal(demo.calls.length,0,'demo cannot query owner endpoints');
 const owner=fixture('owner');
 await owner.window.sbcOpenLaunchReadiness();
 assert.deepEqual(owner.calls.map(x=>x.url),expected,'Only existing read-only endpoints may be called');
 assert.ok(owner.calls.every(x=>x.options.method==='GET'),'No POST or financial action permitted');
 assert.ok(owner.calls.every(x=>x.options.timeoutMs<=10000),'Read-only requests must be bounded');
 assert.match(owner.window.dialog.title,/Launch Readiness/);
 assert.match(owner.window.dialog.body,/does not change records/);
 assert.match(owner.elements['sbc-launch-core'].textContent,/Core write prerequisites observed/);
 assert.match(owner.elements['sbc-launch-staff'].textContent,/login untested/);
 assert.match(owner.elements['sbc-launch-f4-detail'].textContent,/Separate live checks required/);
 assert.match(owner.elements['sbc-launch-leads-detail'].textContent,/no outreach was sent/);
 assert.match(owner.elements['sbc-launch-square'].textContent,/blocked/);
 assert.match(owner.elements['sbc-launch-footer'].textContent,/NOT certified/);
 const failure=fixture('owner',expected[0]);
 await failure.window.sbcOpenLaunchReadiness();
 assert.equal(failure.calls.length,5,'One failing GET must not cancel other evidence checks');
 assert.match(failure.elements['sbc-launch-core'].textContent,/Not confirmed/);
 assert.match(failure.elements['sbc-launch-footer'].textContent,/NOT certified/);
 const roleChanged=fixture('owner');
 const original=roleChanged.window.api;
 roleChanged.window.api=async(url,opt)=>{if(url===expected[0])roleChanged.window.state.me.role='demo';return original(url,opt)};
 await roleChanged.window.sbcOpenLaunchReadiness();
 assert.equal(roleChanged.calls.length,1,'Stop after owner role changes');
 assert.match(roleChanged.elements['sbc-launch-footer'].textContent,/session changed/);
 console.log('[SBC V6621 PHASE 1-4 ACCEPTANCE] PASS owner-only, read-only GETs, failure handling, demo/research exclusion, no false certification');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
