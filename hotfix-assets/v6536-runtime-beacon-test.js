'use strict';
const assert = require('node:assert/strict');
const patch = require('./apply-v6536-runtime-beacon');
assert.equal(patch.MARKER, 'SBC_V6536_RUNTIME_BEACON_RELEASE');
assert.equal(patch.FROM, '65.1.35');
assert.equal(patch.TO, '65.1.36');
assert.equal(patch.RELEASE_NAME, 'RUNTIME_BEACON_DEPLOYMENT_PROOF');
console.log('[SBC V65.1.36] version/marker constants PASS');
