'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {buildFingerprint}=require('./runtime-build-fingerprint.cjs');
const ARCHIVE='SBC-V66-PREBUILT-RUNTIME.zip';
const MANIFEST='SBC-V66-PREBUILT-RUNTIME.json';
function sha(data){return crypto.createHash('sha256').update(data).digest('hex')}
function readManifest(root){
 const zip=path.join(root,ARCHIVE),manifest=path.join(root,MANIFEST);
 if(!fs.existsSync(zip)&&!fs.existsSync(manifest))return null;
 if(!fs.existsSync(zip)||!fs.existsSync(manifest))throw Error('[SBC PREBUILT] release archive or receipt is missing');
 const m=JSON.parse(fs.readFileSync(manifest,'utf8'));
 if(m.schema!==1||m.version!=='66.0.0'||m.archive!==ARCHIVE||
    !/^[a-f0-9]{64}$/.test(m.archiveSha256||'')||
    !/^[a-f0-9]{64}$/.test(m.sourceFingerprint||'')){
  throw Error('[SBC PREBUILT] malformed or wrong-version release receipt');
 }
 const fingerprint=buildFingerprint(root);
 if(fingerprint!==m.sourceFingerprint){
  // Preserve the fail-closed release gate while giving GoDaddy logs enough
  // non-secret evidence to distinguish a stale checkout from mutated sources.
  // Never log file contents, environment values, or secrets.
  const error=new Error('[SBC PREBUILT] release is stale relative to checked-out source; refuse mixed code'+
    ' | expectedFingerprint='+m.sourceFingerprint+
    ' | actualFingerprint='+fingerprint+
    ' | archiveSha256='+m.archiveSha256+
    ' | sourceCommit='+String(m.sourceCommit||'unknown').slice(0,40));
  error.code='SBC_PREBUILT_SOURCE_MISMATCH';
  throw error;
 }
 const bytes=fs.readFileSync(zip);
 if(sha(bytes)!==m.archiveSha256)throw Error('[SBC PREBUILT] ZIP SHA-256 does not match release receipt');
 return {bytes,manifest:m};
}
function prepare(root,dependencies){
 const release=readManifest(root);
 if(!release)return null; // transitional legacy path before the release artifact lands
 const {extractZip,verifyExtracted,verifyPatchedSyntax,loadManifestValidator,persistState}=dependencies;
 const {manifest:m,bytes}=release;
 const runtimeDir=path.join(root,'.sbc-runtime-prebuilt-v66-'+m.archiveSha256.slice(0,16));
 const marker=path.join(runtimeDir,'.sbc-prebuilt-ready.json');
 let reused=false;
 try{
  const previous=JSON.parse(fs.readFileSync(marker,'utf8'));
  reused=previous.archiveSha256===m.archiveSha256&&previous.sourceFingerprint===m.sourceFingerprint&&
    previous.version===m.version&&fs.statSync(path.join(runtimeDir,'server.js')).isFile();
  if(reused){
   verifyExtracted(runtimeDir,m.version);
   loadManifestValidator().audit(runtimeDir,m.version);
   verifyPatchedSyntax(runtimeDir);
  }
 }catch(_){reused=false}
 if(!reused){
  // Save existing live state before replacing any stale runtime directory.
  // Never touch sbc-persistent directly or discard recovery data.
  if(fs.existsSync(runtimeDir))persistState(root,runtimeDir,{reused:true});
  fs.rmSync(runtimeDir,{recursive:true,force:true});
  extractZip(bytes,runtimeDir);
  verifyExtracted(runtimeDir,m.version);
  loadManifestValidator().audit(runtimeDir,m.version);
  verifyPatchedSyntax(runtimeDir);
  fs.writeFileSync(marker,JSON.stringify({schema:1,archiveSha256:m.archiveSha256,sourceFingerprint:m.sourceFingerprint,version:m.version,created:new Date().toISOString()},null,2));
 }
 console.log('[SBC PREBUILT] PASS verified release '+m.archiveSha256.slice(0,16)+' | '+(reused?'reused':'extracted')+' | no runtime patches applied');
 return {runtimeDir,reused,archiveSha256:m.archiveSha256};
}
module.exports={prepare,readManifest,ARCHIVE,MANIFEST};
