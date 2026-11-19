'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const v3=require('../enterprise/sbc-call-command-live-v3.cjs');
const actor={id:'manager-1',role:'account_manager',active:true,tenantId:7};
const account={id:'cust-1',tenant_id:7,assigned_to:'manager-1',phone:'3055550147',status:'Lead'};
const cert={kind:'SBC_CALL_AUTH_V3',phone:'+13055550147',authorizedAt:'2026-11-19T12:00:00.000Z',
 expiresAt:'2026-11-26T12:00:00.000Z',verifiedBy:'owner',prospectTimeZone:'America/New_York',
 phoneVerified:true,dncChecked:true,callingAuthorized:true,consentOrLegalBasisVerified:true,evidence:'Owner verified commercial outreach permission and DNC screening from external records.'};
const when=new Date('2026-11-19T16:00:00Z');
test('certificate is default-deny and bound to exact verified phone and expiry',()=>{
 assert.equal(v3.authorizationRecord([],account,when),null);
 assert.equal(v3.authorizationRecord([cert],account,when)?.phone,'+13055550147');
 assert.equal(v3.authorizationRecord([cert],{...account,phone:'3055550999'},when),null);
 assert.equal(v3.authorizationRecord([cert],account,new Date('2026-11-27T12:00:00Z')),null);
});
test('later owner revocation cancels prior phone authorization',()=>{
 assert.equal(v3.authorizationRecord([cert,{kind:'SBC_CALL_AUTH_V3_REVOKED',authorizedAt:'2026-11-20T00:00:00Z'}],account,new Date('2026-11-21T16:00:00Z')),null);
});
test('preflight denies suppressed, foreign and missing compliance',()=>{
 const opt={account,user:actor,tenantId:7,cert,providerReady:true,loggingReady:true,enabled:true,now:when};
 assert.equal(v3.evaluate(opt).allowed,true);
 assert.equal(v3.evaluate({...opt,cert:null}).allowed,false);
 assert.equal(v3.evaluate({...opt,account:{...account,status:'DNC'}}).allowed,false);
 assert.equal(v3.evaluate({...opt,tenantId:4}).allowed,false);
 assert.equal(v3.evaluate({...opt,user:{...actor,id:'manager-2'}}).allowed,false);
 assert.equal(v3.evaluate({...opt,now:new Date('2026-11-19T03:00:00Z')}).allowed,false);
 assert.equal(v3.evaluate({...opt,enabled:false}).allowed,false);
});
test('session identity and XML cannot be controlled by client supplied number',()=>{
 const s=v3.identityFor(7,'manager-1');
 assert.match(s,/^sbc-cc-7-[a-f0-9]{20}$/);
 const xml=v3.dialXml({phone:'+13055550147',from:'+13055550198',
   statusUrl:'https://app.example.com/api/v6606/crm/call-command/status?attempt=callv3_abc'});
 assert.match(xml,/<Number/);assert.match(xml,/\+13055550147/);
 assert(!xml.includes('javascript:'));
 assert.throws(()=>v3.dialXml({phone:'123',from:'+13055550198',statusUrl:'https://example.com/status'}));
});
test('signed webhook fails closed on forged signatures or origins',()=>{
 const f=v3.verifyTwilioForm({originalUrl:'/api/v6606/crm/call-command/twiml',headers:{'x-twilio-signature':'wrong','content-type':'application/x-www-form-urlencoded'},body:{AttemptId:'x'}},
 {authToken:'fake',origins:['https://app.example.com'],validateRequest:()=>false});
 assert.equal(f,false);
});
test('account call credentials never leak from preflight alone',()=>{
 const r=v3.evaluate({account,user:actor,tenantId:7,cert,providerReady:true,loggingReady:true,enabled:true,now:when});
 assert.equal(r.token,undefined);assert.equal(r.callSid,undefined);
});
