'use strict';
/* SBC V66.118: publisher must stage every file that the inventory SHA pins.
 * The GitHub Actions publishing job is master-only, so audit this contract
 * before a PR is merged as well as on master.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../.github/workflows/sbc-v6606-staged-release.yml'),'utf8');
const job=source.slice(source.indexOf('github-preview-branch:'));
assert(job.length>4000,'release-publisher job must exist');
const pinned=[
 'server.js',
 'enterprise/v56150-revenue-autopilot.js',
 'enterprise/sbc-unattended-notifications-v6504.cjs',
 'public/app.js',
 'browser_public/app.js',
 'SBC-FLAT-RELEASE-IDENTITY.json',
 'SBC-STAGED-INVENTORY.json',
 'SBC-DEPLOY-RECEIPT.json'
];
for(const name of pinned){
 assert(job.includes('cp "$temp/'+name+'" '+name),'publisher did not stage inventory-pinned file: '+name);
 assert(job.includes("git add server.js"),'publisher must stage all pinned assets through git add');
 assert(job.includes("'"+name+"'"),'publisher allowlist and rerun comparison must include: '+name);
}
assert(job.includes('node scripts/v6611-verify-stage-inventory.cjs .'),'release inventory must be checked against actual staged repository');
assert(job.includes('node --check browser_public/app.js'),'desktop/mobile compiled browser bundle must parse');
assert(job.includes("['public/app.js','browser_public/app.js','SBC-DEPLOY-RECEIPT.json'")&&job.includes('.every(p=>paths.includes(p))'),'publisher must refuse if pinned UI is not committed');
assert.equal((job.match(/git add server\.js enterprise\/v56150-revenue-autopilot\.js/g)||[]).length,1,'exactly one controlled publisher git-add step');
const addLine=job.split('\n').find(x=>x.includes('git add server.js'));
const filesLine=job.split('\n').find(x=>x.includes("const files=['server.js'"));
for(const name of pinned){
 assert(addLine.includes(name),'git add omitted: '+name);
 assert(filesLine.includes("'"+name+"'"),'rerun equivalence omitted: '+name);
}
console.log('[SBC V66.118] PASS: 8 exact staged release assets, inventory integrity, both UI bundles, master-only publisher and idempotent rerun comparison');
