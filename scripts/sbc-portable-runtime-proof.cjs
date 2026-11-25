'use strict';
// Execute only against an independently obtained, trusted CI candidate in a fresh directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function prove(root,expectedCommit,expectedInventory){
 if(process.versions.node.split('.')[0]!=='22')throw Error('NODE_22_REQUIRED');
 if(!/^[a-f0-9]{40}$/.test(expectedCommit||'')||! /^[a-f0-9]{64}$/.test(expectedInventory||''))throw Error('INDEPENDENT_RELEASE_PINS_REQUIRED');
 root=path.resolve(root);if(fs.realpathSync(root)!==root)throw Error('CANONICAL_REAL_DIRECTORY_REQUIRED');
 const identity=JSON.parse(fs.readFileSync(path.join(root,'SBC-FLAT-RELEASE-IDENTITY.json'),'utf8'));
 if(identity.sourceCommit!==expectedCommit||identity.stagedInventorySha256!==expectedInventory)throw Error('RELEASE_PINS_MISMATCH');
 if(identity.frontendLayout!=='canonical-public-v1'||identity.candidateOnly!==true||identity.productionCertified!==false)throw Error('CANONICAL_PREVIEW_ONLY');
 if(digest(path.join(root,'SBC-STAGED-INVENTORY.json'))!==expectedInventory)throw Error('INVENTORY_PIN_MISMATCH');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'SBC-STAGED-INVENTORY.json'),'utf8'));
 const verifier=path.join(root,'scripts/v6611-verify-stage-inventory.cjs');
 if(fs.realpathSync(verifier)!==verifier||!fs.lstatSync(verifier).isFile()||digest(verifier)!==manifest.files?.['scripts/v6611-verify-stage-inventory.cjs'])throw Error('VERIFIER_PIN_MISMATCH');
 const result=require(verifier).verifyStagedInventory(root,identity);
 if(result.legacy||result.frontendLayout!=='canonical-public-v1')throw Error('ANCHORED_CANONICAL_INVENTORY_REQUIRED');
 const before=digest(path.join(root,'SBC-STAGED-INVENTORY.json'));
 const launch=cp.spawnSync(process.execPath,[path.join(root,'sbc-godaddy-flat-entrypoint.cjs')],{cwd:root,env:{SBC_RELEASE_PREFLIGHT_ONLY:'1'},encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
 if(launch.status!==0||!String(launch.stdout).includes('[SBC DEPLOY PREFLIGHT] PASS'))throw Error('PORTABLE_PREFLIGHT_FAILED');
 if(digest(path.join(root,'SBC-STAGED-INVENTORY.json'))!==before)throw Error('INVENTORY_CHANGED');
 return {passed:true,scope:'OFF_PROVIDER_OFFLINE_PREFLIGHT_ONLY',sourceCommit:expectedCommit,inventorySha256:expectedInventory,verifiedFiles:result.checked,node:process.version,platform:process.platform,productionCertified:false,fullBootVerified:false,databaseRestoreVerified:false};
}
if(require.main===module){try{console.log(JSON.stringify(prove(...process.argv.slice(2)),null,2))}catch(e){console.error(String(e.message));process.exitCode=1;}}
module.exports={prove};
