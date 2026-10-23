'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const groups = {
  operational: [
    'hotfix-assets/v6529-open-readiness-test.js',
    'hotfix-assets/v6539-safe-no-ddl-startup-test.js',
    'hotfix-assets/v6570-lease-session-verification-test.js',
    'hotfix-assets/v6568-stale-force-unlock-test.js'
  ],
  session: [
    'scripts/session-store-contract.test.js',
    'hotfix-assets/v6537-effective-runtime-role-test.js',
    'hotfix-assets/v6527-persistence-writer-lock-test.js'
  ],
  workorder: [
    'hotfix-assets/v65118-webhook-evidence-test.js',
    'hotfix-assets/v6563-sales-operating-model-test.js',
    'hotfix-assets/v65119-phases-test.js'
  ],
  webhook: [
    'hotfix-assets/v65118-webhook-evidence-test.js',
    'hotfix-assets/v65119-phases-test.js',
    'hotfix-assets/v6569-growth-503-sentry-test.js'
  ]
};

function run(groupName) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '66.0.0', 'legacy standalone checks must route to the current V66 release, not V65.1.73');
  const files = groups[groupName];
  assert.ok(files, `Unknown legacy standalone test group: ${groupName}`);
  for (const rel of files) {
    const file = path.join(root, rel);
    assert.ok(fs.existsSync(file), `Current replacement test is missing: ${rel}`);
    const result = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', timeout: 60000 });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Current V66 replacement test failed: ${rel}`);
  }
  console.log(`[SBC V66 LEGACY TEST ROUTER] PASS group=${groupName}; current-release replacements=${files.length}; legacy V65 assertions are not used as production truth.`);
}

if (require.main === module) {
  try { run(process.argv[2]); }
  catch (error) { console.error(error.stack || error); process.exitCode = 1; }
}
module.exports = { run };
