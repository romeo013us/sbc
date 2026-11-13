'use strict';
// Read-only evidence gate for an *extracted* GoDaddy V66 ZIP.
// Does not require excluded GitHub workflows, npm modules, credentials, or a DB.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {verifyStagedInventory}=require('./v6611-verify-stage-inventory.cjs');
const {excludedReleasePath}=require('../enterprise/v66155-public-asset-policy.cjs');
const sha256=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const REQUIRED=[
 'server.js','package.json','public/app.js','public/index.html',
 'sbc-godaddy-flat-entrypoint.cjs','scripts/v6611-verify-stage-inventory.cjs',
 'enterprise/financial-governor-v56-25-3.js','enterprise/sbc-margin-policy.cjs',
 'public/sbc-website-production-v1.js','public/sales-caller.js',
 'public/sbc-website-revenue-shortcuts-v1.css'
];
function load(root,name){
 const filename=path.join(root,name);
 if(!fs.existsSync(filename))throw Error('[SBC ARTIFACT GATE] missing '+name);
 return JSON.parse(fs.readFileSync(filename,'utf8'));
}
function verifyDeploymentArtifact(base){
 const root=path.resolve(base||path.join(__dirname,'..'));
 const identity=load(root,'SBC-FLAT-RELEASE-IDENTITY.json');
 const receipt=load(root,'SBC-DEPLOY-RECEIPT.json');
 if(identity.schema!==1||!SHA40.test(String(identity.sourceCommit||''))||
   !SHA64.test(String(identity.sourceFingerprint||''))||
   !SHA64.test(String(identity.serverSha256||''))||
   !SHA64.test(String(identity.stagedInventorySha256||''))){
  throw Error('[SBC ARTIFACT GATE] invalid release identity');
 }
 if(sha256(path.join(root,'server.js'))!==identity.serverSha256)
  throw Error('[SBC ARTIFACT GATE] compiled server hash mismatch');
 if(receipt.sourceCommit!==identity.sourceCommit||
   receipt.sourceFingerprint!==identity.sourceFingerprint||
   receipt.artifactType!=='server.js'||receipt.artifactSha256!==identity.serverSha256)
  throw Error('[SBC ARTIFACT GATE] stale or invalid deployment receipt');
 const proof=verifyStagedInventory(root,identity);
 if(proof.legacy||proof.checked<100)throw Error('[SBC ARTIFACT GATE] staged inventory incomplete');
 const inventory=load(root,'SBC-STAGED-INVENTORY.json');
 for(const name of Object.keys(inventory.files||{})){
  if(excludedReleasePath(name))
   throw Error('[SBC ARTIFACT GATE] forbidden release member: '+name);
 }
 for(const name of REQUIRED){
  if(!Object.hasOwn(inventory.files,name))throw Error('[SBC ARTIFACT GATE] required asset omitted: '+name);
 }
 const pkg=load(root,'package.json');
 if(pkg.main!=='sbc-godaddy-flat-entrypoint.cjs'||!/\bsbc-godaddy-flat-entrypoint\.cjs\b/.test(String(pkg.scripts?.start||'')))
  throw Error('[SBC ARTIFACT GATE] unexpected runtime entrypoint');
 return {checked:proof.checked,sourceCommit:identity.sourceCommit,receipt:'VERIFIED',staging:true};
}
if(require.main===module){
 try{
  const result=verifyDeploymentArtifact(process.argv[2]);
  console.log('[SBC V66 ARTIFACT GATE] PASS '+JSON.stringify(result));
 }catch(error){
  console.error(error?.message||error);
  process.exitCode=1;
 }
}
module.exports={verifyDeploymentArtifact};
