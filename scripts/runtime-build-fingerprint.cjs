'use strict';
// Fingerprint the repository inputs used to reconstruct SBC's V66 runtime.
// Hashing only the immutable baseline ZIP and static patch ID can reuse an old
// generated server/index after an updated GoDaddy source checkout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const INPUTS=Object.freeze([
 'bootstrap.js','apply-v65116-hotfix.js','package.json','package-lock.json',
 'persistent-state.js','runtime-env-beacon.js','tenant-rejection-guard.js',
 'hotfix-assets','enterprise','scripts'
]);
function buildFingerprint(root,entries=INPUTS){
 const h=crypto.createHash('sha256'),base=path.resolve(root);
 let files=0,totalBytes=0;
 const walk=rel=>{
  const full=path.join(base,rel),stat=fs.lstatSync(full);
  if(stat.isSymbolicLink())throw Error('SBC RUNTIME FINGERPRINT: symbolic source input '+rel);
  if(stat.isDirectory()){
   const children=fs.readdirSync(full).sort();
   for(const child of children)walk(path.posix.join(rel.replace(/\\/g,'/'),child));
   return;
  }
  if(!stat.isFile())throw Error('SBC RUNTIME FINGERPRINT: nonregular source '+rel);
  if(++files>10000||((totalBytes+=stat.size)>256*1024*1024))
   throw Error('SBC RUNTIME FINGERPRINT: source inventory exceeds safety budget');
  const buf=fs.readFileSync(full);
  h.update(rel.replace(/\\/g,'/')+'\0');
  h.update(crypto.createHash('sha256').update(buf).digest('hex')+'\n');
 };
 for(const entry of [...entries].sort())walk(entry);
 if(!files)throw Error('SBC RUNTIME FINGERPRINT: empty source inventory');
 return h.digest('hex');
}
function markerMatches(marker,expected){
 return !!marker&&typeof marker==='object'&&marker.sourceHash===expected.sourceHash&&
  marker.version===expected.version&&marker.patchId===expected.patchId&&
  typeof marker.buildFingerprint==='string'&&
  /^[a-f0-9]{64}$/.test(marker.buildFingerprint)&&
  marker.buildFingerprint===expected.buildFingerprint;
}
module.exports={buildFingerprint,markerMatches,INPUTS};
