'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createTwilioVoiceHandlers}=require('../routes/sbc-twilio-voice-v1.cjs');
function fixture(){
 const settings={TWILIO_ACCOUNT_SID:'test-account',TWILIO_API_KEY_SID:'test-key',TWILIO_API_KEY_SECRET:'test-value',TWILIO_TWIML_APP_SID:'test-app',TWILIO_PHONE_NUMBER:'+13055550100'};
 let minted=0,allowed=true,contextReads=0;
 const deps={secretValue:n=>settings[n],makeTwilioVoiceToken:id=>{minted++;return 'fixture-'+id;},sbcTwilioWebhookTokenV6619:()=>'',createSbcTwilioOriginsV6619:()=>[],sbcTwilioWebhookOriginsV6619:()=>[],v9CanLiveCall:()=>allowed,normalizeDialNumber:s=>String(s||''),xmlEsc:s=>s};
 const h=createTwilioVoiceHandlers(()=>{contextReads++;return deps});
 function run(name,req){
  const res={code:200,status(n){this.code=n;return this},json(v){this.body=v;return this},type(){return this},send(v){this.body=v;return this}};
  h[name](req,res);return res;
 }
 return {settings,deps,run,get minted(){return minted},get contextReads(){return contextReads},set allowed(v){allowed=v}};
}
test('actual voice module never mints for unauthorized or uncertified users',()=>{
 const f=fixture();
 for(const role of ['researcher','finance','viewer','',undefined])assert.equal(f.run('token',{user:{role,id:'x'}}).code,403);
 f.allowed=false;assert.equal(f.run('token',{user:{role:'caller',id:'x'}}).code,403);
 assert.equal(f.minted,0);f.allowed=true;
 assert.equal(f.run('token',{user:{role:'caller',id:'x'}}).body.token,'fixture-x');
 assert.equal(f.minted,1);
 delete f.settings.TWILIO_API_KEY_SECRET;
 assert.equal(f.run('token',{user:{role:'owner',id:'o'}}).code,503);assert.equal(f.minted,1);
});
test('voice status reports missing configuration without exposing secrets',()=>{
 const f=fixture();assert.equal(f.run('status',{user:{role:'researcher'}}).code,403);
 const r=f.run('status',{user:{role:'owner'}});
 assert.equal(r.body.configured,true);assert.equal(r.body.webhookSignatureReady,false);
 assert(!JSON.stringify(r.body).includes('test-value'));
 delete f.settings.TWILIO_API_KEY_SECRET;assert.equal(f.run('status',{user:{role:'owner'}}).body.configured,false);
});
test('TwiML refuses absent or denied authorization and invalid destination',()=>{
 const f=fixture();
 for(const verdict of [undefined,null,{allowed:false},{allowed:'true'}]){
  const r=f.run('authorizedTwiml',{body:{To:'+13055550199'},verdict});
  assert.equal(r.code,403);assert.doesNotMatch(r.body,/<Dial/);
 }
 assert.equal(f.run('authorizedTwiml',{body:{To:'invalid'},verdict:{allowed:true}}).code,400);
 const good=f.run('authorizedTwiml',{body:{To:'+13055550199'},verdict:{allowed:true}});
 assert.equal(good.code,200);assert.match(good.body,/<Dial callerId="\+13055550100">/);
});
test('server retains original role and signed authorization gates before delegation',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.match(s,/app\.get\('\/api\/voice\/status',auth,\(req,res\)=>\{\/\* SBC_V6690_VOICE_ROLE_GATE/);
 assert.match(s,/app\.get\('\/api\/voice\/token',auth,\(req,res\)=>\{\/\* SBC_V6690_VOICE_ROLE_GATE/);
 assert.match(s,/app\.post\('\/api\/voice\/twiml',sbcSignedTwimlV6619,\(req,res\)=>\{const verdict=SBC_V6699_OUTBOUND_AUTH\.authorize/);
 const twiml=s.slice(s.indexOf("app.post('/api/voice/twiml'"),s.indexOf('// SBC_V6614_VOICE_CALL_LOG_INTEGRITY'));
 assert.match(twiml,/if\(!verdict.allowed\)/);assert.match(twiml,/SBC_TWILIO_VOICE_HANDLERS\.authorizedTwiml\(\{body:req.body,verdict\},res\)/);
 assert.ok(twiml.indexOf('if(!verdict.allowed)')<twiml.indexOf('.authorizedTwiml('));
});
