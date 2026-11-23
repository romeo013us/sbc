'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('server compiles and both new routes are bound to authenticated staff',()=>{
 const s=read('server.js');new vm.Script(s);
 assert.match(s,/require\('\.\/enterprise\/sbc-call-routing-v1\.cjs'\)/);
 assert.match(s,/require\('\.\/enterprise\/sbc-voice-ledger-v1\.cjs'\)/);
 assert.match(s,/app\.get\('\/api\/sales\/call-history',auth,/);
 assert.match(s,/app\.post\('\/api\/sales\/spanish-callbacks\/\:id\/move',auth,/);
 assert.match(s,/SBC_CALL_ROUTING\.eligibleForEnglish\(c,db\.callLogs\|\|\[\],tenant/);
 assert.match(s,/SBC_CALL_ROUTING\.routingUpdate\(customer,log,stamp\)/);
 assert.match(s,/const allowedOutcome=new Set\(\[[^\n]*'Spanish callback needed'/);
});
test('Call Center has the owner-requested explicit Spanish buttons and searchable number history',()=>{
 const p=read('public/app.js'),b=read('browser_public/app.js');
 new vm.Script(p);new vm.Script(b);assert.equal(p,b);
 for(const x of ['Move to Spanish Queue','moveSbcLeadToSpanishQueue','loadSbcSpanishCallbackQueue','loadSbcCallLedger','Spanish callback needed'])
  assert.ok(p.includes(x),x);
 assert.match(p,/if\(final\&\&typeof loadSalesQueue==='function'\)/);
});
test('Account Manager inbox is visible and permissions are narrow',()=>{
 const p=read('public/sbc-account-manager-v1.html'),b=read('browser_public/sbc-account-manager-v1.html');
 assert.equal(p,b);assert.match(p,/id="sbcSpanishAmQueue"/);assert.match(p,/sbc-spanish-am-queue-v1\.js/);
 const js=read('public/sbc-spanish-am-queue-v1.js');new vm.Script(js);
 assert.equal(js,read('browser_public/sbc-spanish-am-queue-v1.js'));
 const gate=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 assert.equal(gate.allowed('GET','/api/sales/spanish-callbacks'),true);
 assert.equal(gate.allowed('POST','/api/sales/spanish-callbacks/cust_123/claim'),true);
 assert.equal(gate.allowed('POST','/api/sales/spanish-callbacks/cust_123/move'),false);
 assert.equal(gate.allowed('GET','/api/sales/call-history'),false);
});

test('failed calling queue refresh clears stale leads and shows a safe retry, in both mirrored clients',async()=>{
 for(const file of ['public/app.js','browser_public/app.js']){
  const source=read(file),start=source.indexOf('async function loadSalesQueue(){'),end=source.indexOf('\nfunction salesQueuePanel(){',start);
  assert.ok(start>=0&&end>start,file+' function missing');
  const view={innerHTML:'OLD QUEUE: call this person'};
  const state={me:{role:'owner'},salesQueue:{leads:[{id:'old'}]}};
  const sandbox={state,api:async()=>{throw new Error('network unavailable')},$:()=>view,salesQueuePanel:()=>'<p>stale</p>',loadSbcSpanishCallbackQueue:()=>{},loadSbcCallLedger:()=>{},console:{warn:()=>{}}};
  const run=vm.runInNewContext(source.slice(start,end)+'\nloadSalesQueue',sandbox,{timeout:1000});
  assert.equal(await run(),null);
  assert.equal(state.salesQueue,null,file+' stale state retained');
  assert.match(view.innerHTML,/Calling Queue Unavailable/,file+' error not announced');
  assert.match(view.innerHTML,/Retry Calling Queue/,file+' retry missing');
  assert.doesNotMatch(view.innerHTML,/OLD QUEUE/,file+' stale lead still callable');
 }
});

test('queue replenishment announces no replacement inventory rather than implying leads will appear',()=>{
 for(const file of ['public/app.js','browser_public/app.js']){
  const source=read(file),start=source.indexOf('function salesQueuePanel(){'),end=source.indexOf('\nconst SBC_SPANISH_HANDOFF_REASON',start);
  assert.ok(start>=0&&end>start,file+' queue panel missing');
  const render=available=>vm.runInNewContext(source.slice(start,end)+'\nsalesQueuePanel',{state:{salesQueue:{target:50,count:1,available,leads:[]}},esc:v=>String(v)},{timeout:1000})();
  assert.match(render(0),/No replacement leads available/,file+' falsely implies inventory');
  assert.doesNotMatch(render(5),/No replacement leads available/,file+' hides available pool');
 }
});
