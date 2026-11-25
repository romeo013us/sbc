'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const {excludedReleasePath}=require('../enterprise/v66155-public-asset-policy.cjs');
const {selectReleaseFiles}=require('../scripts/v66-release-file-selector.cjs');

test('historical root markdown is retained in source but excluded from the published ZIP',()=>{
 const examples=[
  'RELEASE-NOTES-V60.0.0-GOD-TIER.md',
  'RELEASE-NOTES-V65.1.26-DEMO-STUDIO.md',
  'GOD-TIER-RELEASE-MANIFEST.md',
  'V64.2.1-SANDBOX-VERIFICATION.md',
  'RELEASE-VERIFICATION-V65.1.13.md',
  'HISTORICAL-BACKUP-COMPARISON-V65.1.10.md',
  'AUDIT-REPORT-V65.1.8-POLLING-HOTFIX.md'
 ];
 for(const file of examples){
  assert(fs.existsSync(path.join(root,file)),'Keep source history in GitHub: '+file);
  assert.equal(excludedReleasePath(file),true,'Historical doc cannot be shipped: '+file);
 }
 for(const file of ['README.md','public/index.html','browser_public/index.html','public/v32-2-upgrade.js','scripts/v6611-verify-stage-inventory.cjs','sbc-godaddy-flat-entrypoint.cjs','migrations/20261109_001_fulfillment_v2_plan_steps.sql'])
  assert.equal(excludedReleasePath(file),false,'Preserve active/runtime files: '+file);
 assert.equal(excludedReleasePath('docs/launch-notes.md'),false,'Historical document rule is root-only');
});
test('selection is deterministic, strips historical docs but not source, and rejects duplicate paths',()=>{
 const candidates=['public/index.html','RELEASE-NOTES-V60.0.0-GOD-TIER.md','README.md','browser_public/index.html','GOD-TIER-RELEASE-MANIFEST.md','public/v32-2-upgrade.js','.env','public/index.html.pre-commercial'];
 const selected=selectReleaseFiles(candidates);
 assert.deepEqual(selected,['README.md','browser_public/index.html','public/index.html','public/v32-2-upgrade.js']);
 assert.deepEqual(selectReleaseFiles(candidates.slice().reverse()),selected);
 assert.throws(()=>selectReleaseFiles(['public/index.html','public/index.html']),/duplicate/i);
 assert.throws(()=>selectReleaseFiles(['public/index.html',null]),/invalid/i);
});
test('CLI selection matches module selection and rejects unsanctioned paths',()=>{
 const sample=['RELEASE-NOTES-V65.1.26-DEMO-STUDIO.md','public/index.html','README.md','public/app.js','browser_public/app.js'];
 const run=spawnSync(process.execPath,['scripts/v66-release-file-selector.cjs'],{cwd:root,input:JSON.stringify(sample),encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.deepEqual(JSON.parse(run.stdout),selectReleaseFiles(sample));
});
test('CI must use the same source-of-truth release selector before manifest hashing and ZIP generation',()=>{
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/sbc-v6606-staged-release.yml'),'utf8');
 assert.match(workflow,/scripts\/v66-release-file-selector\.cjs/);
 assert.match(workflow,/files=\[pathlib\.Path\(name\) for name in json\.loads\(selected\.stdout\)\]/);
 const selection=workflow.indexOf('scripts/v66-release-file-selector.cjs');
 const hashing=workflow.indexOf('hashed={str(p):');
 assert(selection>0&&hashing>selection);
 assert.match(workflow,/test\/v66-release-selection\.test\.cjs/);
});

test('superseded root reports and manifests stay in source but never enter the deployment inventory',()=>{
 const obsolete=['BUILD-MANIFEST-V60.4.1.txt','BUILD-VERIFICATION-V65.1.10-SESSION-OVERLAY-HOTFIX.json','BUILD-VERIFICATION-V65.1.10.json','BUILD-VERIFICATION-V65.1.6.json','BUILD-VERIFICATION-V65.1.8.json','RELEASE-MANIFEST-V64.0.0.json','RELEASE-MANIFEST-V64.2.16.json','RELEASE-MANIFEST-V64.2.17.json','RELEASE-MANIFEST-V65.0.3.json','RELEASE-MANIFEST-V65.0.4.json','LEAD-WORKSPACE-TEST-REPORT.txt','all-tests.txt','browser-war-file-results.json','browser-war-results.json','SHA256-V65.0.9-OWNER-LEADS.txt','V56.25.0-FILE-SHA256.txt','V56.6-COMPONENT-HASHES.txt','V60.3.0-FILE-HASHES.txt','V65.0.7-RELEASE-MANIFEST.txt','component-sha256-v56.23.0.txt','component-sha256.txt'];
 const required=['SBC-STAGED-INVENTORY.json','SBC-FLAT-RELEASE-IDENTITY.json','SBC-DEPLOY-RECEIPT.json','CLEAN-DISTRIBUTION-MANIFEST.sha256','.guardian/release-gate.json','BIOS-MIGRATION-SHA256.txt','public/v32-2-upgrade.js','browser_public/app.js','scripts/v6611-verify-stage-inventory.cjs','migrations/20261109_001_fulfillment_v2_plan_steps.sql'];
 for(const file of obsolete){
  assert(fs.existsSync(path.join(root,file)),'Historical source remains available: '+file);
  assert.equal(excludedReleasePath(file),true,'Historical artifact cannot ship: '+file);
 }
 assert.deepEqual(selectReleaseFiles([...obsolete,...required]),required.slice().sort());
 assert.equal(excludedReleasePath('docs/all-tests.txt'),false,'Scope is root-only');
});
