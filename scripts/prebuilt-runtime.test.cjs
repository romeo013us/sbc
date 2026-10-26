'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {buildFingerprint,INPUTS}=require('./runtime-build-fingerprint.cjs');
const {readManifest,prepare,ARCHIVE,MANIFEST}=require('./prebuilt-runtime.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-prebuilt-contract-'));
const put=(name,body)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);};
try{
 for(const item of INPUTS){
  if(item==='hotfix-assets'||item==='enterprise'||item==='scripts')put(item+'/fixture.js','module.exports=true');
  else put(item,item==='package.json'?'{"version":"66.0.0"}':'fixture');
 }
 assert.equal(readManifest(root),null,'legacy checkout without prebuilt release may still start during migration');
 const blob=Buffer.from('TEST-ARCHIVE-DOES-NOT-CONTAIN-LIVE-DATA');
 put(ARCHIVE,blob);
 const m={schema:1,version:'66.0.0',archive:ARCHIVE,
  archiveSha256:crypto.createHash('sha256').update(blob).digest('hex'),
  sourceFingerprint:buildFingerprint(root)};
 put(MANIFEST,JSON.stringify(m));
 assert.deepEqual(readManifest(root).manifest,m);
 let extracted=0,checked=0,syntax=0,adopted=0;
 const mocks={
  extractZip(_bytes,target){extracted++;put(path.relative(root,target)+'/server.js','//mock server');},
  verifyExtracted(target,version){assert.equal(version,'66.0.0');assert.ok(fs.existsSync(path.join(target,'server.js')));},
  verifyPatchedSyntax(){syntax++;},
  loadManifestValidator(){return {audit(){checked++;return true}};},
  persistState(){adopted++}
 };
 const once=prepare(root,mocks);
 assert.equal(once.reused,false);
 assert.equal(extracted,1);
 assert.equal(syntax,1);
 const again=prepare(root,mocks);
 assert.equal(again.reused,true);
 assert.equal(extracted,1,'verified runtime can be reused without reconstruction');
 assert.equal(checked,2,'cached runtime must be revalidated');
 put(ARCHIVE,Buffer.from('tamper'));
 assert.throws(()=>readManifest(root),/ZIP SHA-256/,'tampered ZIP rejected');
 put(ARCHIVE,blob);
 put('hotfix-assets/fixture.js','CHANGED AFTER RELEASE');
 assert.throws(()=>readManifest(root),/release is stale/,'stale compiled source rejected');
 assert.equal(adopted,0,'no stale data adoption occurred during clean fixture run');
 console.log('[SBC PREBUILT CONTRACT] PASS release checksum, source binding, cold install and cached reuse');
} finally{fs.rmSync(root,{recursive:true,force:true});}
