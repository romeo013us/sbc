'use strict';
// Read-only release verification. Never regenerates an inventory from untrusted host files.
const fs=require('node:fs'),path=require('node:path');
const {verifyDeploymentArtifact}=require('./v66-deployment-artifact-gate.cjs');
const SHA40=/^[a-f0-9]{40}$/,SHA64=/^[a-f0-9]{64}$/;
const FIELDS=[['sourceCommit','x-sbc-source-commit',SHA40],['serverSha256','x-sbc-server-sha256',SHA64],['sourceFingerprint','x-sbc-source-fingerprint',SHA64],['stagedInventorySha256','x-sbc-inventory-sha256',SHA64]];
function verifyReleaseSync(root,expectedSource){
 if(!SHA40.test(expectedSource||''))throw Error('SOURCE_PIN_REQUIRED');
 root=path.resolve(root);
 const id=JSON.parse(fs.readFileSync(path.join(root,'SBC-FLAT-RELEASE-IDENTITY.json'),'utf8'));
 if(id.sourceCommit!==expectedSource)throw Error('SOURCE_PIN_MISMATCH');
 const proof=verifyDeploymentArtifact(root);
 const receipt=JSON.parse(fs.readFileSync(path.join(root,'SBC-DEPLOY-RECEIPT.json'),'utf8'));
 if(receipt.buildBranch!=='a-sbc-master'||receipt.deployBranch!=='a-sbc-master')throw Error('DEPLOY_BRANCH_MISMATCH');
 if(typeof id.candidateOnly!=='boolean'||id.productionCertified!==false)throw Error('RELEASE_CERTIFICATION_INVALID');
 return Object.freeze({sourceCommit:id.sourceCommit,serverSha256:id.serverSha256,sourceFingerprint:id.sourceFingerprint,stagedInventorySha256:id.stagedInventorySha256,candidateOnly:id.candidateOnly,checked:proof.checked,productionCertified:false});
}
function verifyHostHeaders(headers,expected){
 for(const [key,name,re] of FIELDS)if(!re.test(expected?.[key]||'')||headers.get(name)!==expected[key])throw Error('HOST_RELEASE_MISMATCH: '+name);
 if(typeof expected.candidateOnly!=='boolean'||headers.get('x-sbc-release-candidate')!==String(expected.candidateOnly)||!/(?:^|,)\s*no-store\s*(?:,|$)/i.test(headers.get('cache-control')||''))throw Error('HOST_RELEASE_MISMATCH: candidate or caching');
 return {releaseIdentity:'VERIFIED',sourceCommit:expected.sourceCommit,serverSha256:expected.serverSha256,candidateOnly:expected.candidateOnly,productionCertified:false};
}
async function verifyHost(root,expectedSource,origin){
 const expected=verifyReleaseSync(root,expectedSource);
 if(!['https://tyvrqnjz57.c24.airoapp.ai','https://tyvrqnjz57.preview.c24.airoapp.ai'].includes(origin))throw Error('COMMAND_CENTER_ORIGIN_REQUIRED');
 const response=await fetch(origin+'/api/health',{redirect:'error',cache:'no-store',headers:{'Cache-Control':'no-cache','Accept':'application/json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('HOST_HEALTH_UNAVAILABLE');
 const health=await response.json();
 if(health?.ok!==true||health.app!=='SBC Business Command Center')throw Error('HOST_HEALTH_INVALID');
 return {...verifyHostHeaders(response.headers,expected),origin,observedAt:new Date().toISOString(),productionReady:health.productionReady===true};
}
if(require.main===module)(async()=>{try{
 const [root,source,origin,...rest]=process.argv.slice(2);if(!root||rest.length)throw Error('Usage: node scripts/verify-release-sync.cjs ROOT VERIFIED_SOURCE_SHA [COMMAND_CENTER_ORIGIN]');
 console.log(JSON.stringify(origin?await verifyHost(root,source,origin):verifyReleaseSync(root,source),null,2));
}catch(e){console.error(String(e.message));process.exitCode=1;}})();
module.exports={verifyReleaseSync,verifyHostHeaders,verifyHost};
