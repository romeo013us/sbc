'use strict';
/* SBC V66.108 — red/green/retake tests for the offline war gate itself. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const audit=require('./predeploy-war-test.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-war-gates-'));
const put=(p,v)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,v)};
try{
 put('app.js',"require('./missing-module.js');");
 assert.equal(audit.auditModules(root).ok,false,'must reject unresolved active require');
 put('missing-module.js',"module.exports=true;\n");
 assert.equal(audit.auditModules(root).ok,true,'fix -> passes');
 put('public/index.html','<script src="/missing-script.js"></script>');
 assert.equal(audit.auditAssets(root,['public/index.html']).ok,false,'must fail missing browser asset');
 put('public/missing-script.js','console.log("synthetic");');
 assert.equal(audit.auditAssets(root,['public/index.html']).ok,true,'browser asset repaired');
 put('server.js','synthetic release');
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server.js'))).digest('hex');
 const identity={sourceCommit:'fixed-sha',sourceFingerprint:'fingerprint',serverSha256:hash};
 const receipt={sourceCommit:'fixed-sha',sourceFingerprint:'fingerprint',artifactSha256:hash,buildBranch:'a-sbc-master',deployBranch:'a-sbc-master'};
 put('SBC-FLAT-RELEASE-IDENTITY.json',JSON.stringify(identity));
 put('SBC-DEPLOY-RECEIPT.json',JSON.stringify(receipt));
 assert.equal(audit.auditRelease(root).ok,true,'matching current receipt should pass');
 put('server.js','tampered synthetic release');
 assert.equal(audit.auditRelease(root).ok,false,'tampered compiled server must fail');
 put('server.js','synthetic release');
 assert.equal(audit.auditRelease(root).ok,true,'restore and re-check should pass');
 const real=path.resolve(__dirname,'..');
 assert.equal(audit.auditModules(real).ok,true,'active source must resolve');
 assert.equal(audit.auditAssets(real).ok,true,'actual employee assets exist');
 assert.equal(audit.auditRelease(real).ok,true,'verified GitHub candidate receipt must match server');
 assert.equal(audit.auditContracts(real).ok,true,'core financial and role protections must remain wired');
 console.log('[SBC V66.108] PASS: red/green red/green replay, missing local require/assets fail, tampered deploy receipt fails, actual source contracts unchanged');
}finally{fs.rmSync(root,{recursive:true,force:true})}
