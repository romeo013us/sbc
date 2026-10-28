'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..');
const asset=fs.readFileSync(path.join(repo,'ui-overlays/sbc-kim-chief-of-staff-page.js'),'utf8');
new vm.Script(asset,{filename:'sbc-kim-chief-of-staff-page.js'});
assert.match(asset,/sbcKimChiefRoom/);
assert.match(asset,/sbcKimChiefNav/);
assert.match(asset,/sbcKimCanonical/);
assert.match(asset,/startKimVoice/);
assert.match(asset,/owner-only|host\.className/);
assert.match(asset,/new MutationObserver/);
assert.doesNotMatch(asset,/fetch\s*\(\s*['"]\/api\/ai\//);
assert.doesNotMatch(asset,/document\.write/);
const root=process.env.SBC_RUNTIME_ROOT;
if(root){
 const live=path.resolve(root);
 const a=fs.readFileSync(path.join(live,'public/sbc-kim-chief-of-staff-page.js'));
 const b=fs.readFileSync(path.join(live,'browser_public/sbc-kim-chief-of-staff-page.js'));
 assert.equal(a.toString(),asset);assert.deepEqual(a,b);
 for(const prefix of ['public','browser_public']){
   const html=fs.readFileSync(path.join(live,prefix,'index.html'),'utf8');
   assert.equal((html.match(/\/sbc-kim-chief-of-staff-page\.js\?v=66\.81\.0/g)||[]).length,1);
   assert.equal((html.match(/\/kim-voice\.js\?v=66\.81\.0/g)||[]).length,1);
   assert.equal((html.match(/\/kim-voice\.css\?v=66\.81\.0/g)||[]).length,1);
   assert.ok(fs.statSync(path.join(live,prefix,'kim-voice.js')).size>1000);
 }
 const identity=JSON.parse(fs.readFileSync(path.join(live,'SBC-FLAT-RELEASE-IDENTITY.json'),'utf8'));
 const crypto=require('node:crypto');
 assert.equal(identity.uiOverlays.kimChiefOfStaffSha256,crypto.createHash('sha256').update(a).digest('hex'));
}
console.log('SBC Kim Chief of Staff overlay PASS — canonical chat, voice, owner navigation and source-pinned mirrors');
