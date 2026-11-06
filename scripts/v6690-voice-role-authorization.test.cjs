'use strict';
// SBC V66.90 voice security: prove role denial on ALL voice client endpoints.
// Synthetic-only: no provider calls, actual access tokens, CRM records or MySQL writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {patchServer,inspectSource,ROUTES,ROLE_GUARD,MARK}=require('./v6690-stage-voice-role-gate.cjs');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'server.js'),'utf8');
const after=patchServer(source);
assert.equal(patchServer(after),after,'staging may repeat without duplicate gates');
new vm.Script(after,{filename:'server-with-voice-role-guard.js'});
for(const [anchor,installed] of Object.entries(inspectSource(after)))assert.equal(installed,true,'voice route must require role: '+anchor);
assert.equal(after.split(MARK).length-1,4,'guard all four voice routes');
assert.match(after,/app\.post\('\/api\/voice\/twiml',sbcSignedTwimlV6619,/,'signed Twilio callback preserved');
assert.match(after,/sbcVoiceLogCommitTailV6615/,'durable call log serialization preserved');
const run=(role)=>{
 const calls=[];const res={status(code){calls.push({status:code});return this},json(body){calls.push({json:body});return this}};
 const req={user:role==null?undefined:{role}};
 const action=new Function('req','res',ROLE_GUARD);
 action(req,res);
 return calls;
};
for(const role of ['owner','manager','caller','OWNER']){
 assert.deepEqual(run(role),[],'legitimate dialer role remains available: '+role);
}
for(const role of ['researcher','lead_researcher','lead_generator','prospector','demo','employee','viewer','finance','',null]){
 const out=run(role);
 assert.equal(out[0]?.status,403,'noncalling role denied: '+role);
 assert.equal(out[1]?.json?.error,'VOICE_CALLER_ROLE_REQUIRED');
}
if(process.argv.includes('--staged')){
 assert.deepEqual(Object.values(inspectSource(source)),[true,true,true,true],'ALL four guards must be present in staged server');
}else{
 assert.match(source,/app\.get\('\/api\/voice\/token',auth,/,'pinned server route exists before compile');
}
const browser=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
assert.match(browser,/const prepared=await saveSbcBusinessCallNotes\(false\)/,'CRM log must be durable before dial');
assert.match(browser,/device\.connect\(\{params:\{To:dialNumber\}\}\)/);
console.log('[SBC V66.90] PASS: four backend voice routes caller role enforced (owner/manager/caller); researcher/demo denied, staged server parses, signed callback + MySQL durability + dialer preserved');
