'use strict';
/*
 * V66.64 read-only voice callback preflight tests.
 * No Twilio credentials, provider API, live phone calls, database writes, or billing.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {inspect}=require('../enterprise/v6664-voice-preflight.cjs');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||path.join(__dirname,'..','.sbc-isolated-runtime'));

const empty=inspect({env:{},signatureTokenPresent:false,checkedAt:'2026-10-27T00:00:00.000Z'});
assert.equal(empty.ok,true);
assert.equal(empty.mode,'OWNER_READ_ONLY');
assert.equal(empty.status,'CONFIGURATION_BLOCKED');
assert.equal(empty.configuredForSignedVoiceCallback,false);
assert.equal(empty.blockers.length,2);
assert.deepEqual(empty.callbackUrls,[]);
assert.equal(empty.restrictions.providerContacted,false);
assert.equal(empty.restrictions.realCallMade,false);
assert.equal(empty.restrictions.crmChanged,false);

const token='do-not-expose-this-synthetic-auth-token';
const good=inspect({env:{
  SBC_PUBLIC_URL:'https://sbc.example.test/path?q=ignored',
  SBC_APP_URL:'https://sbc.example.test/other',
  TWILIO_AUTH_TOKEN:token
},signatureTokenPresent:true,checkedAt:'2026-10-27T00:00:00.000Z'});
assert.equal(good.configuredForSignedVoiceCallback,true);
assert.equal(good.status,'CALLBACK_PREREQUISITES_PRESENT');
assert.equal(good.checks.configuredCallbackOriginCount,1);
assert.deepEqual(good.callbackUrls,['https://sbc.example.test/api/voice/twiml']);
assert.equal(good.blockers.length,0);
assert.equal(good.restrictions.certified,false);
assert(!JSON.stringify(good).includes(token),'Auth token must never be returned');

const invalid=inspect({env:{
  SBC_PUBLIC_URL:'http://untrusted.example',
  SBC_APP_URL:'https://user:password@bad.example/private'
},signatureTokenPresent:true});
assert.equal(invalid.configuredForSignedVoiceCallback,false);
assert.deepEqual(invalid.callbackUrls,[]);
assert(invalid.blockers.some(x=>x.code==='PUBLIC_HTTPS_CALLBACK_ORIGIN_MISSING'));

for(const rel of ['public/app.js','browser_public/app.js']){
  const body=fs.readFileSync(path.join(root,rel),'utf8');
  assert(body.includes('VOICE CALLBACK CONFIG INCOMPLETE'),rel+' missing callback warning');
  assert(body.includes("st.configured&&st.webhookSignatureReady!==false?'green':'orange'"),rel+' misconfigured callback must show amber, not green');
  assert(body.includes('st.webhookSignatureReady!==false&&c.phone'),rel+' calling button must refuse known callback misconfiguration');
  assert(body.includes('/api/owner/voice-preflight'),rel+' must direct owner to endpoint');
}
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert(server.includes("app.get('/api/owner/voice-preflight',auth,ownerOnly,(req,res)=>{"),'owner-only route is missing');
assert(server.includes('SBC_V6664_VOICE_OWNER_PREFLIGHT'),'release marker is missing');
assert(server.includes("app.post('/api/voice/twiml',sbcSignedTwimlV6619,(req,res)=>{"),'Twilio callback must remain signed');
assert(server.includes('MYSQL_RECOVERY_REQUIRED')&&server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED'));
assert(fs.existsSync(path.join(root,'enterprise/v6664-voice-preflight.cjs')),'production helper not bundled');

console.log('[SBC V66.64] PASS owner-only callback prerequisites, privacy, safe browser gating, dual entrypoints and protected webhook; no live providers');
