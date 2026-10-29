'use strict';
// Preserve V66 root launcher data persistence, tenant process guards and boot beacon.
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const fs = require('node:fs');
const root = __dirname;
// Verified identity is generated from the same isolated CI runtime used by this build.
const release = require('./SBC-FLAT-RELEASE-IDENTITY.json');
if(release.schema!==1||! /^[a-f0-9]{40}$/.test(release.sourceCommit||'')||
   ! /^[a-f0-9]{64}$/.test(release.sourceFingerprint||'')||
   ! /^[a-f0-9]{64}$/.test(release.serverSha256||'')||
   ! /^[a-f0-9]{64}$/.test(release.inventorySha256||'')) {
  throw Error('[SBC DEPLOY IDENTITY] invalid pinned release identity');
}
const serverSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server.js'))).digest('hex');
if(serverSha!==release.serverSha256)throw Error('[SBC DEPLOY IDENTITY] packaged server has changed since verification');
function digest(b){return crypto.createHash('sha256').update(b).digest('hex');}
function verifyFlatIntegrity(root,release){
 const file=path.join(root,'SBC-FLAT-FILE-INVENTORY.json');
 const bytes=fs.readFileSync(file);
 if(digest(bytes)!==release.inventorySha256)
  throw Error('[SBC FLAT INTEGRITY] manifest hash mismatch; mixed/incomplete deployment');
 const m=JSON.parse(bytes.toString('utf8'));
 if(m.schema!==1||m.version!==release.version||m.sourceFingerprint!==release.sourceFingerprint||
    !Array.isArray(m.files)||m.files.length<200||m.files.length>5000)
  throw Error('[SBC FLAT INTEGRITY] malformed source-bound inventory');
 let total=0;
 const seen=new Set();
 for(const item of m.files){
  const rel=item.path;
  if(typeof rel!=='string'||!rel||rel.startsWith('/')||rel.includes('\\')||
     rel.split('/').some(s=>!s||s==='.'||s==='..')||seen.has(rel)||
     /^(?:data|backups|sbc-persistent|node_modules|\.git)\//.test(rel)||
     !/^[a-f0-9]{64}$/.test(item.sha256||'')||
     !Number.isSafeInteger(item.size)||item.size<0||item.size>50*1024*1024)
   throw Error('[SBC FLAT INTEGRITY] unsafe inventory entry');
  seen.add(rel);
  const target=path.join(root,rel);
  let actual;
  try{actual=fs.readFileSync(target);}
  catch{throw Error('[SBC FLAT INTEGRITY] required packaged file missing: '+rel);}
  if(actual.length!==item.size)
   throw Error('[SBC FLAT INTEGRITY] wrong packaged file type/size: '+rel);
  if(digest(actual)!==item.sha256)
   throw Error('[SBC FLAT INTEGRITY] packaged file altered: '+rel);
  total+=item.size;
  if(total>256*1024*1024)throw Error('[SBC FLAT INTEGRITY] release size exceeds limit');
 }
 for(const required of ['server.js','package.json','bootstrap.js','sbc-godaddy-flat-entrypoint.cjs',
                         'sbc-flat-integrity.cjs','persistent-state.js',
                         'tenant-rejection-guard.js','runtime-env-beacon.js',
                         'public/index.html','public/app.js','browser_public/index.html']){
  if(!seen.has(required))throw Error('[SBC FLAT INTEGRITY] critical runtime asset not pinned: '+required);
 }
 console.log('[SBC FLAT INTEGRITY] PASS source='+release.sourceCommit.slice(0,12)+' files='+seen.size+' bytes='+total);
 return {ok:true,files:seen.size};
}

verifyFlatIntegrity(root,release);
const receiptPath = path.join(root,'SBC-DEPLOY-RECEIPT.json');
const hasReceipt = fs.existsSync(receiptPath);
if(hasReceipt){
 const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
 if(receipt.sourceCommit!==release.sourceCommit||receipt.sourceFingerprint!==release.sourceFingerprint){
  throw Error('[SBC DEPLOY IDENTITY] GitHub deployment receipt does not match running server');
 }
}
console.log('[SBC DEPLOY IDENTITY] entry=flat source_commit='+release.sourceCommit+' source_fingerprint='+release.sourceFingerprint+' receipt='+(hasReceipt?'VERIFIED':'ZIP_INSTALL'));
const {persistState} = require('./persistent-state.js');
const state = persistState(root, root, {reused:false});
if (state.ephemeral) throw Error('SBC flat runtime rejects ephemeral customer state');
const bootId = Date.now().toString(36)+'-'+process.pid+'-'+crypto.randomBytes(4).toString('hex');
process.env.SBC_BOOT_ID = bootId;
console.log('[SBC FLAT STARTUP] boot_id='+bootId+' port='+(process.env.PORT||'<absent>')+' role_env='+String(process.env.SBC_RUNTIME_ROLE||'<absent>'));
console.log(require('./runtime-env-beacon.js').buildBeaconLine(process.env,os.hostname()));
require('./tenant-rejection-guard.js').installTenantRejectionGuard(process,console);
require(path.join(root,'server.js'));
