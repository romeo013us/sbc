'use strict';
/* Fail-closed Academy 360 V66.169 release media receipt.
 * Source-only and extracted ZIP checks; no credentials or live network.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MANIFEST='academy-media/academy360/AUTO_GENERATED_MANIFEST.json';
const dirs=['public/','browser_public/'];
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const full=(root,name)=>path.join(root,name);
function expectedNames(){
 const all=[];for(let n=1;n<=12;n++)for(const lang of ['en','es']){
  const base='am-'+String(n).padStart(2,'0')+'-'+lang;
  all.push(base+'.mp4',base+'-audio.webm',base+'.vtt');
  for(let i=1;i<=4;i++)all.push(base+'-'+String(i).padStart(2,'0')+'.webp');
 }
 return all.sort();
}
function manifest(root){
 const f=full(root,dirs[0]+MANIFEST),other=full(root,dirs[1]+MANIFEST);
 if(!fs.existsSync(f)||!fs.existsSync(other))throw Error('ACADEMY_MEDIA_MANIFEST_MISSING');
 if(sha(f)!==sha(other))throw Error('ACADEMY_MEDIA_MANIFEST_MIRROR_MISMATCH');
 let data;try{data=JSON.parse(fs.readFileSync(f,'utf8'));}catch{throw Error('ACADEMY_MEDIA_MANIFEST_INVALID_JSON');}
 if(!/^\d+\.\d+$/.test(String(data.version||''))||data.authenticatedEmployeeRecording!==false||data.syntheticOnly!==true)
  throw Error('ACADEMY_MEDIA_DECLARATION_INVALID');
 if(!Array.isArray(data.lessons)||data.lessons.length!==24||!Array.isArray(data.files)||data.files.length!==168)
  throw Error('ACADEMY_MEDIA_INVENTORY_INCOMPLETE');
 const expected=expectedNames(),actual=[...data.files].sort();
 if(new Set(actual).size!==168||expected.some((name,i)=>name!==actual[i]))throw Error('ACADEMY_MEDIA_FILENAME_MISMATCH');
 const expectedLessons=Array.from({length:12},(_,i)=>'am-'+String(i+1).padStart(2,'0')).flatMap(id=>['en','es'].map(lang=>id+'-'+lang)).sort();
 const declared=data.lessons.map(l=>String(l.lessonId)+'-'+String(l.lang)).sort();
 if(declared.some((s,i)=>s!==expectedLessons[i]))throw Error('ACADEMY_MEDIA_LESSON_MISMATCH');
 return {data,digest:sha(f)};
}
function stamp(root,identity){
 const info=manifest(root);
 return {...identity,academyRelease:info.data.version,academyMediaManifestSha256:info.digest};
}
function verify(root,identity,inventory){
 const info=manifest(root);
 if(identity?.academyRelease!==info.data.version||identity?.academyMediaManifestSha256!==info.digest)
  throw Error('ACADEMY_MEDIA_RELEASE_IDENTITY_MISMATCH');
 if(!inventory||typeof inventory!=='object')throw Error('ACADEMY_MEDIA_STAGED_INVENTORY_MISSING');
 const all=[MANIFEST.split('/').pop(),...info.data.files];
 for(const name of all){
  for(const dir of dirs){
   const relative=dir+(name==='AUTO_GENERATED_MANIFEST.json'?MANIFEST:'academy-media/academy360/'+name);
   const disk=full(root,relative);
   if(!fs.existsSync(disk)||!fs.statSync(disk).isFile())throw Error('ACADEMY_MEDIA_MISSING_'+relative);
   const digest=sha(disk);
   if(inventory[relative]!==digest)throw Error('ACADEMY_MEDIA_STAGED_HASH_INVALID_'+relative);
  }
  if(name!=='AUTO_GENERATED_MANIFEST.json'){
   const a=sha(full(root,dirs[0]+'academy-media/academy360/'+name));
   const b=sha(full(root,dirs[1]+'academy-media/academy360/'+name));
   if(a!==b)throw Error('ACADEMY_MEDIA_BINARY_MIRROR_MISMATCH_'+name);
  }
 }
 return {version:info.data.version,lessons:24,mediaFiles:168,mirrors:2,syntheticOnly:true};
}
module.exports={manifest,stamp,verify,expectedNames,MANIFEST};
