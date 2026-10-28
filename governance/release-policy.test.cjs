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
assert.match(launcher,/verify_source_matched_prebuilt\(\)/,
  'direct Python packaging must verify the checked-out source before writing a ZIP');
assert.match(launcher,/readManifest\(process\.cwd\(\)\)/,
  'Python builder must use the same complete source and archive verifier as GoDaddy Node boot');
assert.match(offline,/if test "\$\(git rev-parse origin\/main\)" != "\$GITHUB_SHA"/);
assert.match(offline,/publish_verified_prebuilt_to_main:[\s\S]{0,200}type:\s*boolean[\s\S]{0,100}default:\s*false/,
  'source runtime publishing must be manual and disabled by default');
const runtimeJob=offline.split(/\n  publish-prebuilt-to-main:/)[1];
assert.ok(runtimeJob,'prebuilt publisher still exists');
assert.match(runtimeJob.split(/\n    steps:/)[0],/\n    if:\s*github\.event_name == 'workflow_dispatch' && inputs\.publish_verified_prebuilt_to_main == true && github\.ref == 'refs\/heads\/main'/,
  'generated runtime can never commit to main without explicit manual permission');

for(const file of ['ui-overlays/**','ecosystem/**']){
  const appearances=offline.split("'"+file+"'").length-1;
  assert.ok(appearances>=2,'reconstruction watches push and PR changes to '+file);
}
const manifest=JSON.parse(read('SBC-V66-PREBUILT-RUNTIME.json'));
assert.equal(manifest.generatedBy,'isolated-github-ci');
assert.match(manifest.sourceFingerprint,/^[a-f0-9]{64}$/);
const {buildFingerprint}=require('../scripts/runtime-build-fingerprint.cjs');
const sourceMatches=manifest.sourceFingerprint===buildFingerprint(root);
console.log(JSON.stringify({result:'PASS',policy:'SBC_SAFE_RELEASE_V1',automaticDeployBranch:false,automaticRuntimeMainPublish:false,
  pinningEnforced:true,sourceMatchesCurrentBuild:sourceMatches,
  nextAction:sourceMatches?'check compiled artifact and live approval':'rebuild from current source; never deploy stale artifact'}));

// Exercise the REAL Python packager with a disposable Node/source fixture.
// All failures must occur before CSV checks or ZIP writing; no live secrets,
// customer records, network or GoDaddy service is used.
const os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-godaddy-packaging-parity-'));
const put=(rel,content)=>{
 const file=path.join(fixture,rel);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,content);
};
try{
 const {INPUTS}=require('../scripts/runtime-build-fingerprint.cjs');
 for(const item of INPUTS){
  if(['hotfix-assets','enterprise','ecosystem','ui-overlays','scripts'].includes(item)){
   put(item+'/fixture.js','module.exports=true;\\n');
  }else put(item,item==='package.json'?'{"version":"66.0.0"}':'fixture');
 }
 for(const name of ['prebuilt-runtime.cjs','runtime-build-fingerprint.cjs'])
  fs.copyFileSync(path.join(root,'scripts',name),path.join(fixture,'scripts',name));
 fs.mkdirSync(path.join(fixture,'tools'),{recursive:true});
 fs.copyFileSync(path.join(root,'tools/build-godaddy-single-layer.py'),
  path.join(fixture,'tools/build-godaddy-single-layer.py'));
 const archive=Buffer.from('CI_TEST_ARCHIVE_ONLY_NOT_A_REAL_ZIP');
 const zipName='SBC-V66-PREBUILT-RUNTIME.zip',manifestName='SBC-V66-PREBUILT-RUNTIME.json';
 put(zipName,archive);
 const receipt={schema:1,version:'66.0.0',archive:zipName,
  archiveSha256:crypto.createHash('sha256').update(archive).digest('hex'),
  sourceFingerprint:buildFingerprint(fixture),sourceCommit:'a'.repeat(40),
  generatedBy:'isolated-github-ci'};
 const writeReceipt=()=>put(manifestName,JSON.stringify(receipt));
 const run=()=>cp.spawnSync('python3',['tools/build-godaddy-single-layer.py'],
  {cwd:fixture,encoding:'utf8',timeout:30000});
 writeReceipt();
 let result=run();
 assert.equal(result.status,1,'synthetic fixture must not produce a deployable package');
 assert.match(result.stdout,/private October 26\\/27 lead intake CSV missing/,
  'valid pinned fixture passes source check and reaches the next safety guard');
 put('ecosystem/fixture.js','module.exports=false;\\n');
 result=run();
 assert.notEqual(result.status,0);
 assert.match(result.stdout,/release is stale relative to checked-out source/,
  'direct packaging must reject stale source even when ZIP SHA matches');
 put('ecosystem/fixture.js','module.exports=true;\\n');
 put(zipName,Buffer.from('TAMPERED_ARCHIVE'));
 result=run();
 assert.notEqual(result.status,0);
 assert.match(result.stdout,/ZIP SHA-256 does not match release receipt/,
  'direct packaging must reject tampered archive even when source matches');
 put(zipName,archive);
 receipt.generatedBy='unknown-runner';writeReceipt();
 result=run();
 assert.notEqual(result.status,0);
 assert.match(result.stdout,/Release lacks verified isolated CI provenance/,
  'direct packaging cannot accept untrusted provenance');
 console.log('[SBC RELEASE PACKAGING PARITY] PASS: valid, stale, tampered and unverified receipts');
} finally {fs.rmSync(fixture,{recursive:true,force:true});}
