'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {preflight}=require('../enterprise/sbc-call-command-voice-preflight-v2.cjs');
const now=new Date('2026-11-19T16:00:00Z');
const user={id:'mgr1',role:'account_manager',active:true};
const account={id:'acct1',tenant_id:2,assigned_to:'mgr1',phone:'3055550199',status:'Active'};
const flags={phoneVerified:true,dncChecked:true,callingAuthorized:true,consentOrLegalBasisVerified:true,
 prospectTimeZone:'America/New_York',providerReady:true,durableLoggingReady:true};
test('default deny on missing evidence',()=>{
 const x=preflight({account,user,tenantId:2,now});
 assert.equal(x.allowed,false);assert(x.reasons.includes('OUTREACH_AUTHORIZATION_REQUIRED'));
});
test('tenant isolation and assignment are mandatory',()=>{
 assert.equal(preflight({account,user,tenantId:3,flags,now}).allowed,false);
 assert.equal(preflight({account,user:{...user,id:'other'},tenantId:2,flags,now}).allowed,false);
 assert.equal(preflight({account,user:{...user,role:'researcher'},tenantId:2,flags,now}).allowed,false);
});
test('DNC, invalid number, time and provider readiness block',()=>{
 assert.equal(preflight({account:{...account,status:'DNC'},user,tenantId:2,flags,now}).allowed,false);
 assert.equal(preflight({account:{...account,phone:'bad'},user,tenantId:2,flags,now}).allowed,false);
 assert.equal(preflight({account,user,tenantId:2,flags,now:new Date('2026-11-19T03:00:00Z')}).allowed,false);
 assert.equal(preflight({account,user,tenantId:2,flags:{...flags,providerReady:false},now}).allowed,false);
});
test('complete synthetic verified preflight is read-only, not a call',()=>{
 const x=preflight({account,user,tenantId:2,flags,now});
 assert.equal(x.allowed,true);assert.equal(x.outboundAttempted,false);
 assert.equal(x.tokenMinted,false);assert.equal(x.callLogged,false);
});
test('route wiring enforces authenticated authoritative database lookup',()=>{
 const route=fs.readFileSync(require('node:path').join(__dirname,'../routes/account-portfolios-v1.cjs'),'utf8');
 const gate=fs.readFileSync(require('node:path').join(__dirname,'../enterprise/sbc-account-manager-role-gate-v2.cjs'),'utf8');
 assert(route.includes("'/api/v6606/crm/account-portfolios/:id/call-preflight'"));
 assert(route.includes('SBCVoicePreflightV2.preflight'));
 assert(route.includes('tenant_id=? AND id=?'));
 assert(gate.includes("'/call-preflight$'"));
 assert(!route.includes('CALL_COMMAND_V2_AUTO_DIAL'));
});
