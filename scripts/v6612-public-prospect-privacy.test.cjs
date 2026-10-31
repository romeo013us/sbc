'use strict';
// SBC V66.12: source-controlled customer/prospect exports are never accepted.
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'})
  .split('\0').filter(Boolean);
const forbidden=tracked.filter(name=>/^(?:public|browser_public|hotfix-assets|starter-leads)\//i.test(name)
  && /\.csv$/i.test(name));
assert.deepEqual(forbidden,[], 'Public repository must not track prospect/customer CSV exports');
const patch=fs.readFileSync(path.join(root,'scripts/v6606-quote-server-hardening.cjs'),'utf8');
assert.match(patch,/SBC_V6608_PROSPECT_CSV_PRIVACY_GATE/,
  'Release should deny CSV paths before Express static');
const packageWorkflow=fs.readFileSync(path.join(root,'.github/workflows/sbc-v6606-staged-release.yml'),'utf8');
assert.match(packageWorkflow,/\.csv/,'Staged package must exclude CSVs');
assert.match(packageWorkflow,/starter-leads/,'Staged package must exclude prospect directories');
console.log('[SBC V6612 PRIVACY] PASS: no tracked prospect CSVs, staging excludes records, static deny gate retained');
