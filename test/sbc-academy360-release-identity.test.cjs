'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const gate=require('../scripts/sbc-academy-media-release-gate.cjs');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function setup(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-academy-release-'));
 const names=gate.expectedNames(),lessons=Array.from({length:12},(_,i)=>'am-'+String(i+1).padStart(2,'0')).flatMap(id=>['en','es'].map(lang=>({lessonId:id,lang})));
 const manifest={version:'66.169',authenticatedEmployeeRecording:false,syntheticOnly:true,files:names,lessons};
 const inventory={};
 for(const dir of ['public','browser_public']){
  for(const name of names){
   const rel=dir+'/academy-media/academy360/'+name,full=path.join(root,rel),body='Synthetic isolated training clip or image: '+name+' '.repeat(1800);
   fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,body);inventory[rel]=digest(body);
  }
  const rel=dir+'/academy-media/academy360/AUTO_GENERATED_MANIFEST.json',body=JSON.stringify(manifest);
  fs.writeFileSync(path.join(root,rel),body);inventory[rel]=digest(body);
 }
 return {root,inventory,identity:gate.stamp(root,{sourceCommit:'a'.repeat(40)})};
}
function use(fn){const f=setup();try{fn(f);}finally{fs.rmSync(f.root,{recursive:true,force:true});}}
test('staged release stamps manifest version and verifies 24 bilingual audio-video-photo-caption lessons',()=>{
 use(({root,inventory,identity})=>{
  assert.equal(identity.academyRelease,'66.169');
  assert.equal(gate.verify(root,identity,inventory).mediaFiles,168);
  assert.equal(gate.verify(root,identity,inventory).mirrors,2);
 });
});
test('staging fails if current Academy 360 manifest is labeled as an old release',()=>{
 use(({root,inventory,identity})=>assert.throws(()=>gate.verify(root,{...identity,academyRelease:'66.166'},inventory),/ACADEMY_MEDIA_RELEASE_IDENTITY_MISMATCH/));
});
test('staging fails on missing audio or images even if rest of app is healthy',()=>{
 use(({root,inventory,identity})=>{
  const f=path.join(root,'browser_public/academy-media/academy360/am-07-es-audio.webm');
  fs.unlinkSync(f);
  assert.throws(()=>gate.verify(root,identity,inventory),/ACADEMY_MEDIA_MISSING/);
 });
});
test('staging fails on a stale inventory or an altered caption',()=>{
 use(({root,inventory,identity})=>{
  const f='public/academy-media/academy360/am-01-en.vtt';
  inventory[f]='0'.repeat(64);
  assert.throws(()=>gate.verify(root,identity,inventory),/ACADEMY_MEDIA_STAGED_HASH_INVALID/);
 });
});
test('no release can claim complete multimedia if the manifest loses even one file',()=>{
 use(({root,inventory,identity})=>{
  const f=path.join(root,'public/academy-media/academy360/AUTO_GENERATED_MANIFEST.json');
  const m=JSON.parse(fs.readFileSync(f,'utf8'));m.files.pop();
  fs.writeFileSync(f,JSON.stringify(m));
  assert.throws(()=>gate.stamp(root,identity),/ACADEMY_MEDIA_MANIFEST_MIRROR_MISMATCH|ACADEMY_MEDIA_INVENTORY_INCOMPLETE/);
 });
});

test('explicit canonical Academy release verifies every canonical media hash without a mirror',()=>{
 use(({root,inventory,identity})=>{
  fs.rmSync(path.join(root,'browser_public'),{recursive:true});
  for(const k of Object.keys(inventory))if(k.startsWith('browser_public/'))delete inventory[k];
  assert.throws(()=>gate.verify(root,identity,inventory),/ACADEMY_MEDIA_MANIFEST_MISSING/);
  const canonical=gate.stamp(root,{...identity,frontendLayout:'canonical-public-v1'});
  const proof=gate.verify(root,canonical,inventory);
  assert.equal(proof.mirrors,1);assert.equal(proof.mediaFiles,168);assert.equal(proof.syntheticOnly,true);
  const f='public/academy-media/academy360/am-01-en.vtt';
  fs.appendFileSync(path.join(root,f),'tampered');
  assert.throws(()=>gate.verify(root,canonical,inventory),/ACADEMY_MEDIA_STAGED_HASH_INVALID/);
 });
});
test('canonical Academy mode rejects mixed inventories and unsupported layouts',()=>{
 use(({root,inventory,identity})=>{
  const canonical={...identity,frontendLayout:'canonical-public-v1'};
  assert.throws(()=>gate.verify(root,canonical,inventory),/ACADEMY_MEDIA_LAYOUT_MIXED/);
  assert.throws(()=>gate.verify(root,{...identity,frontendLayout:'unknown'},inventory),/ACADEMY_MEDIA_LAYOUT_INVALID/);
 });
});
