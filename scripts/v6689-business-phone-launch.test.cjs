'use strict';
// V66.89 launch phone gate: synthetic-only browser isolation + static server contract.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('public/app.js'),mirror=read('browser_public/app.js');
assert.equal(app,mirror,'browser runtime must be the same as main public runtime');
new vm.Script(app,{filename:'public/app.js'});
const begin=app.indexOf('async function startSbcBusinessCall(customerId){');
const end=app.indexOf('\nfunction normalizeClientPhone(',begin);
assert.ok(begin>0&&end>begin,'canonical phone start function exists exactly once');
const src=app.slice(begin,end);
assert.match(src,/const prepared=await saveSbcBusinessCallNotes\(false\)/);
assert.match(src,/if\(!prepared\)/);
assert.ok(src.indexOf('const prepared=await saveSbcBusinessCallNotes(false)')<src.indexOf('ensureSbcVoice()'),'durable log must precede Twilio call');
assert.match(src,/device\.connect\(\{params:\{To:dialNumber\}\}\)/);
assert.match(app,/result\?\.ok!==true\|\|result\?\.durable!==true/,'server must explicitly acknowledge durable CRM write');
assert.match(app,/sbcVoiceDevice\.updateToken\(fresh\.token\)/,'long-lived session refreshes access token');
assert.match(app,/sbcVoiceStartedAt=null;sbcVoiceStartedAtIso='';sbcVoiceCallStatus='idle';sbcVoiceSessionId='';/,'failed preflight resets the dialer without charging provider');
assert.match(app,/Native phone calls use your handset\/carrier caller ID, not SBC Twilio/,'native handset fallback must be truthful about caller ID');
assert.match(app,/They are NOT automatically recorded in SBC/,'native call never pretends automatic CRM logging');
assert.match(app,/href="tel:'\+esc\(dialNumber\)/,'native handset link must use sanitized E.164 number');
assert.match(app,/Do Not Call \/ suppression is active/);
assert.match(app,/const synced=await saveSbcBusinessCallNotes\(false,status\)/,'final log cannot be reported as synced if persistence fails');
function mk({lead={id:'lead1',phone:'3055550101'},durable=false}={}){
  const calls=[],messages=[],statuses={},state={data:{customers:[lead]}};
  const ids={sbcStartCall:{disabled:false},sbcEndCall:{disabled:true},sbcPhoneLiveStatus:{textContent:''}};
  const ctx={state,sbcVoiceStartedAt:null,sbcVoiceSessionId:'',sbcVoiceCallStatus:'idle',
    sbcVoiceNotesSnapshot:{},sbcVoiceStartedAtIso:'',sbcVoiceCustomerId:'',sbcVoiceOpenCustomerId:'',
    sbcVoiceFinishing:false,
    sbcVoiceCollectNotes:()=>({notes:'synthetic local draft',outcome:'Pending'}),
    saveSbcBusinessCallNotes:async()=>durable,
    ensureSbcVoice:async()=>({connect:async ({params})=>{calls.push(params);return {on:()=>{}}}}),
    normalizeClientPhone:x=>{const digits=String(x||'').replace(/\D/g,'');return digits.length===10?'+1'+digits:String(x||'')},
    toast:s=>messages.push(String(s)),
    $:s=>ids[s.slice(1)]||null,
    console:{error:()=>{}},
    Math,Date,
    finishSbcBusinessCall:async()=>{},
    };
  vm.createContext(ctx);
  vm.runInContext(src,ctx,{timeout:1000});
  return {ctx,calls,messages,ids};
}
(async()=>{
 const denied=mk({durable:false});
 await denied.ctx.startSbcBusinessCall('lead1');
 assert.equal(denied.calls.length,0,'failed CRM durability must block Twilio');
 assert.equal(denied.ctx.sbcVoiceStartedAt,null,'failed CRM durability resets busy flag');
 assert.equal(denied.ctx.sbcVoiceSessionId,'','failed CRM durability clears session ID');
 assert.equal(denied.ids.sbcEndCall.disabled,true);
 assert.equal(denied.ids.sbcStartCall.disabled,false);
 assert.match(denied.ids.sbcPhoneLiveStatus.textContent,/Call NOT placed/);
 const good=mk({durable:true});
 await good.ctx.startSbcBusinessCall('lead1');
 assert.equal(good.calls.length,1,'one durable log authorizes one outgoing synthetic connect');
 assert.equal(good.calls[0].To,'+13055550101');
 const suppressed=mk({lead:{id:'lead1',phone:'3055550101',doNotContact:true},durable:true});
 await suppressed.ctx.startSbcBusinessCall('lead1');
 assert.equal(suppressed.calls.length,0);
 assert.equal(suppressed.ctx.sbcVoiceSessionId,'');
 const invalid=mk({lead:{id:'lead1',phone:'12'},durable:true});
 await invalid.ctx.startSbcBusinessCall('lead1');
 assert.equal(invalid.calls.length,0);
 assert.equal(invalid.ctx.sbcVoiceSessionId,'');
 const confirm=read('enterprise/v6664-voice-preflight.cjs');
 assert.match(confirm,/realCallMade:false,tokenMinted:false,providerContacted:false/,'preflight cannot claim a real call');
 const signed=read('enterprise/v6619-signed-twilio-webhook.js');
 assert.match(signed,/TWILIO_WEBHOOK_SIGNATURE_INVALID/);
 assert.match(signed,/TWILIO_WEBHOOK_SIGNATURE_REQUIRED/);
 assert.match(signed,/TWILIO_WEBHOOK_VERIFICATION_UNCONFIGURED/);
 const server=read('server.js');
 assert.match(server,/app\.get\('\/api\/voice\/token',auth,/,'authenticated Twilio token route is present');
 assert.match(server,/app\.post\('\/api\/voice\/twiml',sbcSignedTwimlV6619,/,'Twilio callback remains signed');
 // PINNED SERVER ACCEPTANCE HOLD: source-level operator-role guard is not yet
 // present. Do not certify this phone as 9.5 or open non-owner calling based
 // only on these synthetic tests; a separately rebuilt server identity is required.
 const tokenLine=server.split('\n').find(x=>x.startsWith("app.get('/api/voice/token',auth,"));
 assert.ok(tokenLine,'exact canonical voice token route remains available for a separate security release');
 const script=read('public/index.html');
 assert.match(script,/app\.js\?v=66\.0\.89-voice-gate/,'browser reloads patched voice client');
 console.log('[SBC V66.89 PHONE] PASS: no call when durable CRM unavailable, one connect with confirmed log, DNC and invalid number blocked, token refresh, native handset truth, callback signature guard, no live carrier calls');
})().catch(e=>{console.error(e);process.exitCode=1});
