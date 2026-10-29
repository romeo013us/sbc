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
   ! /^[a-f0-9]{64}$/.test(release.serverSha256||'')) {
  throw Error('[SBC DEPLOY IDENTITY] invalid pinned release identity');
}
const serverSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server.js'))).digest('hex');
if(serverSha!==release.serverSha256)throw Error('[SBC DEPLOY IDENTITY] packaged server has changed since verification');
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
