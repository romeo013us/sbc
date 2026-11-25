'use strict';
// Offline renderer/signing CLI. Never connects to providers, the database or GoDaddy.
const fs=require('node:fs'),path=require('node:path');
const E=require('../enterprise/sbc-social-asset-engine.cjs');
const {createBundle}=require('../enterprise/sbc-social-creative-bundle.cjs');
const [planFile,keyFile,outFile]=process.argv.slice(2);
if(!planFile||!keyFile||!outFile)throw Error('Usage: node scripts/sbc-sign-creative-refill.cjs PRIVATE_PLAN_JSON PRIVATE_ED25519_KEY PRIVATE_OUTPUT_JSON');
const root=path.resolve(__dirname,'..');
for(const f of [planFile,keyFile,outFile]){
 const p=path.resolve(f);
 if(p===root||p.startsWith(root+path.sep))throw Error('PRIVATE_FILES_OUTSIDE_REPOSITORY_REQUIRED');
}
const plan=JSON.parse(fs.readFileSync(planFile,'utf8'));
if(plan.ok!==true||!Number.isSafeInteger(plan.tenantId)||!Array.isArray(plan.missing)||!Array.isArray(plan.assets))throw Error('AUTHORITATIVE_REFILL_PLAN_REQUIRED');
if(!plan.missing.length){console.log('No missing future slots.');process.exit(0);}
if(plan.missing.some(s=>Date.parse(s.at)<=Date.now()))throw Error('REFRESH_STALE_REFILL_PLAN');
const logo=fs.readFileSync(path.join(root,'public/assets/sbc-logo.jpg'));
const rows=E.generate({targetSlots:plan.missing,logo,history:plan.assets});
const bundle=createBundle(rows,{tenantId:plan.tenantId,privateKey:fs.readFileSync(keyFile)});
fs.writeFileSync(outFile,JSON.stringify(bundle),{flag:'wx',mode:0o600});
console.log('Signed '+rows.length+' draft creatives; owner import and approval are still required.');
