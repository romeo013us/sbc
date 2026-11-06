'use strict';
// Offline regression: dummy SIDs/secrets only. No Twilio calls or CRM mutations.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {patchServer,REPLACEMENT,MARK}=require('./v6695-stage-voice-token.cjs');
const root=path.resolve(__dirname,'..');
const original=fs.readFileSync(path.join(root,'server.js'),'utf8');
const staged=patchServer(original);
assert.equal(patchServer(staged),staged,'voice-token transform is idempotent');
new vm.Script(staged,{filename:'staged-server.js'});
assert(staged.includes('SBC_V6690_VOICE_ROLE_GATE'),'existing caller authorization guard preserved');
assert(staged.includes('sbcSignedTwimlV6619'),'signed Voice webhook guard preserved');
assert(staged.includes('sbcVoiceLogCommitTailV6615'),'durable CRM logging preserved');
assert(!staged.includes("const header={typ:'JWT',alg:'HS256'};"),'manual JWT header eliminated');
assert(staged.includes(MARK));
if(process.argv.includes('--staged'))assert.equal(staged,original,'compiled staged server includes corrected token function');
const settings={
 TWILIO_ACCOUNT_SID:'AC'+'1'.repeat(32),
 TWILIO_API_KEY_SID:'SK'+'2'.repeat(32),
 TWILIO_API_KEY_SECRET:['unit','test','voice','secret','never','live'].join('-'),
 TWILIO_TWIML_APP_SID:'AP'+'3'.repeat(32)
};
const mint=new Function('require','secretValue',REPLACEMENT+'\nreturn makeTwilioVoiceToken;')(require,(name)=>settings[name]);
const jwt=mint('sbc-test-owner');
const parts=jwt.split('.');
assert.equal(parts.length,3);
const decode=segment=>JSON.parse(Buffer.from(segment,'base64url').toString('utf8'));
const header=decode(parts[0]),body=decode(parts[1]);
assert.equal(header.typ,'JWT');
assert.equal(header.alg,'HS256');
assert.equal(header.cty,'twilio-fpa;v=1');
assert.equal(body.iss,settings.TWILIO_API_KEY_SID);
assert.equal(body.sub,settings.TWILIO_ACCOUNT_SID);
assert.equal(body.grants.identity,'sbc-test-owner');
assert.equal(body.grants.voice.outgoing.application_sid,settings.TWILIO_TWIML_APP_SID);
assert.notEqual(body.grants.voice.incoming?.allow,true,'incoming calling must not be authorized');
assert(Number.isInteger(body.iat),'issued-at timestamp present');
assert.equal(body.exp-body.iat,3600,'one-hour token');
assert(body.iat<=Math.floor(Date.now()/1000)+5);
assert(body.exp>Math.floor(Date.now()/1000));
assert.equal(parts[2],crypto.createHmac('sha256',settings.TWILIO_API_KEY_SECRET).update(parts[0]+'.'+parts[1]).digest('base64url'));
assert(!jwt.includes(settings.TWILIO_API_KEY_SECRET),'secret is never embedded in JWT');
assert.throws(()=>new Function('require','secretValue',REPLACEMENT+'\nreturn makeTwilioVoiceToken;')(require,()=>'' )('owner'),/Twilio Voice is not configured/);
console.log('[SBC V66.95 VOICE TOKEN] PASS: official Twilio JWT header, iat/expiry, outbound-only grant, signature, role/webhook/CRM guards, idempotent stage; no real calls');
