'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runner = require('./run-legacy-standalone-test');
const root = path.resolve(__dirname, '..');
const wrappers = [
  ['hotfix-assets/v65114-operational-unlock-test.js', 'operational'],
  ['hotfix-assets/v65115-operational-unlock-test.js', 'operational'],
  ['hotfix-assets/v65116-operational-unlock-test.js', 'operational'],
  ['hotfix-assets/v65114-session-lazy-pool-test.js', 'session'],
  ['hotfix-assets/v65115-session-timeout-test.js', 'session'],
  ['hotfix-assets/v65116-session-timeout-test.js', 'session'],
  ['hotfix-assets/v65117-workorder-regression-test.js', 'workorder'],
  ['hotfix-assets/v6521-webhook-recovery-test.js', 'webhook']
];
for (const [rel, group] of wrappers) {
  const source = fs.readFileSync(path.join(root, rel), 'utf8');
  assert.match(source, /V66 standalone compatibility/, rel + ' documents the root-package routing');
  assert.match(source, /run-legacy-standalone-test\.js/, rel + ' routes to the current V66 test runner');
  assert.ok(source.includes("'" + group + "'"), rel + ' maps to the correct current test group');
}
for (const group of ['operational', 'session', 'workorder', 'webhook']) runner.run(group);
console.log('[SBC V66 LEGACY STANDALONE SUITE] PASS: all eight legacy entrypoints route to current-release regression coverage.');
