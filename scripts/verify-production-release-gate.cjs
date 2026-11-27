'use strict';
// Read-only preflight; independently supplied pins are mandatory. This does not certify live production.
const fs=require('node:fs/promises'),path=require('node:path');
const {verifyReleaseSync}=require('./verify-release-sync.cjs');
const {verifyPinnedBrandLogo}=require('../enterprise/creative-intelligence/marketing-replenishment-worker.cjs');
const PIN_FIELDS=['sourceCommit','serverSha256','sourceFingerprint','stagedInventorySha256','logoSha256'];
const SHA40=/^[a-f0-9]{40}$/,SHA64=/^[a-f0-9]{64}$/;
function inside(root,target){const rel=path.relative(root,target);return rel===''||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep));}
async function verifyProductionReleaseGate(input={}){
 for(const key of PIN_FIELDS)if(typeof input[key]!=='string'||!(key==='sourceCommit'?SHA40:SHA64).test(input[key]))throw Error('INDEPENDENT_PIN_REQUIRED: '+key);
 if(typeof input.root!=='string'||!path.isAbsolute(input.root))throw Error('ABSOLUTE_RELEASE_ROOT_REQUIRED');
 if(typeof input.logoPath!=='string'||!path.isAbsolute(input.logoPath))throw Error('PRIVATE_LOGO_REQUIRED');
 const root=await fs.realpath(input.root),logoParent=await fs.realpath(path.dirname(input.logoPath));
 // Private artwork is not accepted from the release tree or its public directories.
 if(inside(root,logoParent))throw Error('PRIVATE_LOGO_REQUIRED');
 const release=verifyReleaseSync(root,input.sourceCommit);
 for(const key of PIN_FIELDS.slice(0,4))if(release[key]!==input[key])throw Error('RELEASE_PIN_MISMATCH: '+key);
 const logo=await verifyPinnedBrandLogo(path.join(logoParent,path.basename(input.logoPath)),input.logoSha256);
 return Object.freeze({status:'RELEASE_AND_BRAND_PINS_VERIFIED',release:Object.freeze(release),logo:Object.freeze(logo),productionCertified:false,publicationReady:false});
}
if(require.main===module)(async()=>{
 try{
  const [root,sourceCommit,serverSha256,sourceFingerprint,stagedInventorySha256,logoPath,logoSha256,...extra]=process.argv.slice(2);
  if(extra.length||!logoSha256)throw Error('Usage: node scripts/verify-production-release-gate.cjs ABS_RELEASE_ROOT SOURCE_SHA SERVER_SHA FINGERPRINT INVENTORY_SHA ABS_PRIVATE_LOGO APPROVED_LOGO_SHA');
  console.log(JSON.stringify(await verifyProductionReleaseGate({root,sourceCommit,serverSha256,sourceFingerprint,stagedInventorySha256,logoPath,logoSha256}),null,2));
 }catch(e){console.error(e.message);process.exitCode=1;}
})();
module.exports={verifyProductionReleaseGate};
