'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const v3=require('../enterprise/sbc-call-command-live-v3.cjs');
const {randomBytes}=require('node:crypto');
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

test('configured human-click calling is operational by default; explicit stop still wins',()=>{
 const cfg={SBC_PUBLIC_URL:'https://sbc.example',TWILIO_ACCOUNT_SID:'AC'+'1'.repeat(32),
 TWILIO_API_KEY_SID:'SK'+'2'.repeat(32),TWILIO_API_KEY_SECRET:randomBytes(24).toString('hex'),
 SBC_CALL_COMMAND_TWIML_APP_SID:'AP'+'3'.repeat(32),TWILIO_PHONE_NUMBER:'+13055550199',
 TWILIO_AUTH_TOKEN:randomBytes(24).toString('hex')};
 const ready=v3.settings(cfg);
 assert.equal(ready.configured,true);
 assert.equal(ready.enabled,true,'configured calling should not silently remain off');
 assert.equal(ready.activationState,'CONFIGURED');
 assert.equal(v3.settings({...cfg,SBC_CALL_COMMAND_V3_ENABLED:'0'}).enabled,false);
 assert.equal(v3.settings({...cfg,SBC_CALL_COMMAND_V3_ENABLED:'0'}).activationState,'PAUSED_BY_OWNER');
 assert.equal(v3.settings({...cfg,SBC_CALL_COMMAND_V3_ENABLED:'1'}).enabled,true);
 assert.equal(v3.settings({...cfg,SBC_CALL_COMMAND_V3_ENABLED:'typo'}).enabled,false);
 assert.equal(v3.settings({...cfg,SBC_CALL_COMMAND_V3_ENABLED:'typo'}).activationState,'INVALID_SETTING');
 const missing=v3.settings({...cfg,SBC_CALL_COMMAND_TWIML_APP_SID:''});
 assert.equal(missing.enabled,false);
 assert.equal(missing.activationState,'PROVIDER_SETUP_REQUIRED');
 assert(missing.missingSettings.includes('SBC_CALL_COMMAND_TWIML_APP_SID'));
 assert.equal(v3.settings({...cfg,TWILIO_TWIML_APP_SID:cfg.SBC_CALL_COMMAND_TWIML_APP_SID,SBC_CALL_COMMAND_TWIML_APP_SID:''}).enabled,false,'never fall back to legacy owner TwiML app');
});

test('call console translates backend gates into staff actions',()=>{
 const ui=require('../public/sbc-call-command-live-v3.js');
 assert.equal(ui.readableReason('ACADEMY_CERTIFICATION_REQUIRED'),'Complete Academy 360 certification before calling.');
 assert.equal(ui.readableReason('SPANISH_CALLBACK_NOT_DUE'),'This Spanish callback is scheduled for a later time.');
 assert.match(ui.statusText({ok:true,liveCallAvailable:false,reasons:['PHONE_INVALID']}),/Add and verify a valid business phone number/);
});

test('call console is a focused four-step workflow with safe shortcuts',()=>{
 const ui=require('../public/sbc-call-command-live-v3.js');
 const html=ui.render({account:{id:'cust-1',businessName:'Miami Test Shop',phone:'+13055550147'},role:'account_manager',lang:'en'});
 assert.match(html,/FOCUS MODE/);
 assert.match(html,/Miami Test Shop/);
 assert.match(html,/1 · Verify/);
 assert.match(html,/4 · Save outcome/);
 assert.match(html,/Alt\+C/);
 assert.match(html,/Live call in progress/);
});
