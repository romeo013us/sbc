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
