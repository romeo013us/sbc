'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {verifyDeploymentArtifact}=require('../scripts/v66-deployment-artifact-gate.cjs');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const required=['server.js','package.json','public/app.js','public/index.html',
 'enterprise/financial-governor-v56-25-3.js','enterprise/sbc-margin-policy.cjs',
 'sbc-godaddy-flat-entrypoint.cjs','scripts/v6611-verify-stage-inventory.cjs',
 'public/sbc-website-production-v1.js','public/sales-caller.js',
 'public/sbc-website-revenue-shortcuts-v1.css'];

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v66-archive-gate-'));
 const files={};
 for(const name of [...required,...Array.from({length:100},(_,i)=>'test/synthetic-'+String(i).padStart(3,'0')+'.txt')]){
  const content=name==='package.json'?JSON.stringify({main:'sbc-godaddy-flat-entrypoint.cjs',scripts:{start:'node sbc-godaddy-flat-entrypoint.cjs'}}):'Safe synthetic V66 fixture: '+name;
  const full=path.join(root,name);
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,content);
  files[name]=sha(content);
 }
 const sourceCommit='a'.repeat(40),sourceFingerprint='b'.repeat(64);
 const inventory={schema:1,status:'STAGING CANDIDATE ONLY — NOT LIVE CERTIFIED',sourceCommit,files};
 const raw=JSON.stringify(inventory,null,2)+'\n';
 fs.writeFileSync(path.join(root,'SBC-STAGED-INVENTORY.json'),raw);
 const identity={schema:1,sourceCommit,sourceFingerprint,serverSha256:files['server.js'],stagedInventorySha256:sha(raw)};
 fs.writeFileSync(path.join(root,'SBC-FLAT-RELEASE-IDENTITY.json'),JSON.stringify(identity));
 const receipt={sourceCommit,sourceFingerprint,artifactType:'server.js',artifactSha256:files['server.js']};
 fs.writeFileSync(path.join(root,'SBC-DEPLOY-RECEIPT.json'),JSON.stringify(receipt));
 return {root,files,identity,receipt};
}
function using(callback){const setup=fixture();try{return callback(setup)}finally{fs.rmSync(setup.root,{recursive:true,force:true})}}
test('realistic extracted artifact verifies server, SHA inventory, receipt and required assets',()=>using(({root})=>{
 const result=verifyDeploymentArtifact(root);
 assert(result.checked>=100);
 assert.equal(result.sourceCommit,'a'.repeat(40));
}));
test('fail closed when the server or a required website asset was tampered with',()=>using(({root})=>{
 fs.appendFileSync(path.join(root,'public/sales-caller.js'),'\nTAMPER');
 assert.throws(()=>verifyDeploymentArtifact(root),/checksum mismatch/i);
}));
test('fail closed if receipt, inventory or core website asset is absent',()=>using(({root})=>{
 fs.unlinkSync(path.join(root,'SBC-DEPLOY-RECEIPT.json'));
 assert.throws(()=>verifyDeploymentArtifact(root),/receipt/i);
}));
test('fail closed on stale receipt and corrupt server hash',()=>using(({root,receipt})=>{
 fs.writeFileSync(path.join(root,'SBC-DEPLOY-RECEIPT.json'),JSON.stringify({...receipt,sourceCommit:'c'.repeat(40)}));
 assert.throws(()=>verifyDeploymentArtifact(root),/receipt/i);
}));
test('fail closed on an inventory without the required current website files',()=>using(({root,identity})=>{
 const file=path.join(root,'SBC-STAGED-INVENTORY.json');
 const inventory=JSON.parse(fs.readFileSync(file,'utf8'));
 delete inventory.files['public/sbc-website-production-v1.js'];
 const raw=JSON.stringify(inventory,null,2)+'\n';
 fs.writeFileSync(file,raw);
 fs.writeFileSync(path.join(root,'SBC-FLAT-RELEASE-IDENTITY.json'),JSON.stringify({...identity,stagedInventorySha256:sha(raw)}));
 assert.throws(()=>verifyDeploymentArtifact(root),/required asset/i);
}));
