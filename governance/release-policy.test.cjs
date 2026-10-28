'use strict';
/**
 * CI-only safety policy. Fails if automated push / workflow_run / pull_request
 * can update the GoDaddy deploy branch. Does not access GoDaddy or live data.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const flat=read('.github/workflows/build-godaddy-single-layer.yml');
const offline=read('.github/workflows/sbc-isolated-reconstruction.yml');
const proof=read('scripts/prebuilt-runtime.cjs');
const launcher=read('tools/build-godaddy-single-layer.py');

assert.match(flat,/workflow_dispatch:\s*\n\s*inputs:\s*\n\s*publish_deploy_branch:/);
assert.match(flat,/publish_deploy_branch:[\s\S]{0,230}type:\s*boolean[\s\S]{0,100}default:\s*false/);
const deployJob=flat.split(/\n  publish-godaddy-branch:/)[1];
assert.ok(deployJob,'must find GoDaddy deploy-branch publisher');
const jobHeader=deployJob.split(/\n    steps:/)[0];
assert.match(jobHeader,/\n    if:\s*github\.event_name == 'workflow_dispatch' && inputs\.publish_deploy_branch == true && github\.ref == 'refs\/heads\/main'/);
assert.match(deployJob,/HEAD_NOW=.*git ls-remote origin refs\/heads\/main/);
assert.match(flat,/readManifest\(process\.cwd\(\)\)/);
assert.match(proof,/if\(fingerprint!==m\.sourceFingerprint\)throw Error/);
assert.match(launcher,/if manifest\.get\("generatedBy"\) != "isolated-github-ci"/);
assert.match(offline,/if test "\$\(git rev-parse origin\/main\)" != "\$GITHUB_SHA"/);
for(const file of ['ui-overlays/**','ecosystem/**']){
  const appearances=offline.split("'"+file+"'").length-1;
  assert.ok(appearances>=2,'reconstruction watches push and PR changes to '+file);
}
const manifest=JSON.parse(read('SBC-V66-PREBUILT-RUNTIME.json'));
assert.equal(manifest.generatedBy,'isolated-github-ci');
assert.match(manifest.sourceFingerprint,/^[a-f0-9]{64}$/);
const {buildFingerprint}=require('../scripts/runtime-build-fingerprint.cjs');
const sourceMatches=manifest.sourceFingerprint===buildFingerprint(root);
console.log(JSON.stringify({result:'PASS',policy:'SBC_SAFE_RELEASE_V1',automaticDeployBranch:false,
  pinningEnforced:true,sourceMatchesCurrentBuild:sourceMatches,
  nextAction:sourceMatches?'check compiled artifact and live approval':'rebuild from current source; never deploy stale artifact'}));
