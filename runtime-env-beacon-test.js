'use strict';

const assert = require('node:assert/strict');
const { buildBeaconLine } = require('./runtime-env-beacon');

const base = {
  NODE_ENV: 'production',
  PORT: '8080',
  SBC_RUNTIME_ROLE: 'writer',
  DB_HOST: 'db.internal.example',
  DB_NAME: 'sbc_main',
  SBC_SESSION_SECRET: 'THIS-MUST-NEVER-APPEAR',
  TWILIO_AUTH_TOKEN: 'ANOTHER-SECRET-MUST-NEVER-APPEAR'
};

const writerLine = buildBeaconLine(base, 'published-host');
assert.match(writerLine, /^\[SBC ENV BEACON\] role_env=writer/);
assert.match(writerLine, /node_env=production/);
assert.match(writerLine, /port=8080/);
assert.match(writerLine, /hostname=published-host/);
assert.match(writerLine, /db_fingerprint=[a-f0-9]{8}/);
assert.match(writerLine, /SBC_RUNTIME_ROLE/);
assert.match(writerLine, /SBC_SESSION_SECRET/);
assert.doesNotMatch(writerLine, /THIS-MUST-NEVER-APPEAR|ANOTHER-SECRET-MUST-NEVER-APPEAR|db\.internal\.example|sbc_main/);

assert.match(buildBeaconLine({ ...base, SBC_RUNTIME_ROLE: 'readonly' }), /role_env=readonly/);
assert.match(buildBeaconLine({ ...base, SBC_RUNTIME_ROLE: ' Writer ' }), /role_env=writer/);
assert.match(buildBeaconLine({ ...base, SBC_RUNTIME_ROLE: 'unexpected-secret-like-value' }), /role_env=<invalid>/);
assert.match(buildBeaconLine({ NODE_ENV: 'production' }), /role_env=<absent>/);
assert.match(buildBeaconLine({ NODE_ENV: 'production' }), /db_fingerprint=<absent>/);
assert.notEqual(
  buildBeaconLine({ DB_HOST: 'host-a', DB_NAME: 'db' }).match(/db_fingerprint=([^ ]+)/)[1],
  buildBeaconLine({ DB_HOST: 'host-b', DB_NAME: 'db' }).match(/db_fingerprint=([^ ]+)/)[1]
);

console.log('[SBC ENV BEACON TEST] PASS: role classification, environment identity, database fingerprint, and secret-value redaction.');
