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
assert(job.includes("['SBC-DEPLOY-RECEIPT.json','SBC-FLAT-RELEASE-IDENTITY.json','SBC-STAGED-INVENTORY.json'")&&job.includes('.every(p=>paths.includes(p))'),'publisher must require all three fresh attestations even when runtime assets have identical bytes');
assert(job.includes('node scripts/v6611-verify-stage-inventory.cjs .'),'unchanged UI bundles must still be content-verified by full inventory');
assert.equal((job.match(/git add server\.js enterprise\/v56150-revenue-autopilot\.js/g)||[]).length,1,'exactly one controlled publisher git-add step');
const addLine=job.split('\n').find(x=>x.includes('git add server.js'));
const filesLine=job.split('\n').find(x=>x.includes("const files=['server.js'"));
for(const name of pinned){
 assert(addLine.includes(name),'git add omitted: '+name);
 assert(filesLine.includes("'"+name+"'"),'rerun equivalence omitted: '+name);
}
console.log('[SBC V66.118] PASS: 8 exact staged release assets, inventory integrity, both UI bundles, master-only publisher and idempotent rerun comparison');

// Academy generation must hand off to the full staging build without changing
// canonical master. Candidate-only dispatch cannot enter the legacy publisher.
const media=fs.readFileSync(path.resolve(__dirname,'../.github/workflows/sbc-academy360-auto-media.yml'),'utf8');
assert(media.includes('actions: write'),'automatic candidate dispatch requires scoped Actions permission');
assert(media.includes('refs/heads/release/candidate/academy-')&&media.includes('--force-with-lease="$candidate_ref:"'),'media must use create-only candidate refs');
assert(!/git push[^\n]*:a-sbc-master\b/.test(media),'raw media must never push to master');
assert(media.includes('gh workflow run sbc-v6606-staged-release.yml --ref "$candidate_branch"'),'Academy must trigger full candidate validation');
assert(media.includes('GH_TOKEN:')&&media.includes("if: github.ref == 'refs/heads/a-sbc-master'"),'dispatch originates from canonical Academy workflow');
assert(job.includes("github.event_name == 'workflow_dispatch' && startsWith(github.ref, 'refs/heads/release/candidate/')"),'candidate staging only on explicit dispatch');
const verify=job.indexOf('node scripts/verify-release-sync.cjs . "$GITHUB_SHA"');
const pin=job.indexOf('bash scripts/pin-verified-godaddy-ref.sh "$GITHUB_SHA"');
const candidate=job.indexOf('if [[ "$GITHUB_REF" == refs/heads/release/candidate/* ]]');
const push=job.indexOf('git push origin "HEAD:refs/heads/$BRANCH"');
assert(verify>=0&&pin>verify&&candidate>pin&&push>candidate&&job.slice(candidate,push).includes('exit 0'),'candidate must be verified and pinned but never promote');
assert(job.includes('needs: verified-staged-zip')&&job.includes('if [ "$remote" = "$GITHUB_SHA" ]; then')&&job.includes('node scripts/v66-deployment-artifact-gate.cjs .'),'transitional legacy publisher still requires full staging and stale-source protection');
console.log('[SBC ACADEMY HANDOFF] PASS: automatic candidate validation, no raw master writes from media, full inventory and pin gates');
