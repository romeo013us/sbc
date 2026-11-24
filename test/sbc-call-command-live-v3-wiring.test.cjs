'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('production server mounts the bounded Account Manager Twilio V3 routes with authoritative context',()=>{
 const code=src('server.js');
 // Split this asserted source string so the static dependency inventory does not
 // mistake test fixture text for a module import relative to /test.
 const marker='require('+"\'./routes/sbc-call-command-live-v3.cjs\').register(app,{";
 assert(code.includes(marker),'AM Call Command V3 was implemented but never mounted in server.js');
 const mount=code.indexOf(marker),end=code.indexOf('});',mount);
 assert(mount>=0&&end>mount);
 const init=code.slice(mount,end);
 assert.match(init,/auth,/,'route must use standard authenticated session');
 assert.match(init,/mysqlPool/,'route must use authoritative MySQL');
 assert.match(init,/recoveryRequired/,'route must refuse recovery-locked writes');
 assert.match(init,/SBC_AM_ACADEMY_GATES\.hasClearance/,'route must require current Academy clearance for employee calls');
});
test('Account Manager access permits only dedicated per-account calling endpoints, not owner voice token',()=>{
 const gate=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 for(const route of ['/api/v6606/crm/account-portfolios/acc_1/call-readiness',
 '/api/v6606/crm/account-portfolios/acc_1/call-history'])
 assert(gate.allowed('GET',route),route);
 assert(gate.allowed('POST','/api/v6606/crm/account-portfolios/acc_1/call-start'));
 for(const [verb,route] of [['GET','/api/voice/token'],['POST','/api/voice/log'],['POST','/api/v6606/crm/account-portfolios/acc_1/call-authorization'],
 ['POST','/api/v6606/crm/account-portfolios/acc_1/call-revoke']])
 assert(!gate.allowed(verb,route),'privileged route must remain denied: '+route);
});
test('dedicated Twilio V3 remains opt-in, signed, one-use and owner-attested',()=>{
 const route=src('routes/sbc-call-command-live-v3.cjs'),adapter=src('enterprise/sbc-call-command-live-v3.cjs');
 assert.match(adapter,/SBC_CALL_COMMAND_V3_ENABLED==='1'/);
 assert.match(route,/!cfg.enabled\|\|!cfg.configured/);
 assert.match(route,/!signed\(req,cfg\)/);
 assert.match(route,/CALL_PERMISSION_CHANGED/);
 assert.match(route,/ACCOUNT_NOT_ASSIGNED/);
 assert.match(route,/ANOTHER_CALL_SESSION_ACTIVE/);
 assert.match(route,/AUTHORIZED|CALL_AUTHORIZATION_EVIDENCE_REQUIRED/);
});
