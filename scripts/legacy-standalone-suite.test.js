'use strict';
const runner = require('./run-legacy-standalone-test');
for (const group of ['operational', 'session', 'workorder', 'webhook']) runner.run(group);
console.log('[SBC V66 LEGACY STANDALONE SUITE] PASS: all eight legacy entrypoints now route to current-release regression coverage.');
