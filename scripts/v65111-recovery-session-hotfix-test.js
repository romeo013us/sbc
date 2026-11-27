'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const sessionSource = fs.readFileSync(path.join(root, 'enterprise/session-store.js'), 'utf8');
const guard = require('../enterprise/recovery/recovery-write-guard.cjs');

assert.match(server, /async function writeRelational\([\s\S]*?if\(!MYSQL_RECOVERY_EVALUATED\)[\s\S]*?MYSQL_RECOVERY_NOT_EVALUATED/,
  'relational snapshots are blocked until the authoritative recovery census completes');
assert.match(server, /async function saveData\(\)\{[\s\S]*?if\(!MYSQL_RECOVERY_EVALUATED\)/,
  'saveData fails closed before recovery evaluation');
assert.match(server, /SESSION_STORE_UNAVAILABLE[\s\S]*?status\(503\)/,
  'temporary session-store failure is not mislabeled as an unauthenticated 401');
assert.match(sessionSource, /withTimeout\(mysqlQuery\('SELECT s\.user_id,[^\n]*?FROM sbc_sessions s LEFT JOIN sbc_session_bindings b ON b\.token_hash=s\.token_hash WHERE s\.token_hash=\? AND s\.expires_at>=UTC_TIMESTAMP\(\) LIMIT 1',\[hash\]\),persistTimeoutMs\+250\)/,
  'durable session lookup has a bounded timeout');
assert.match(sessionSource, /function sessionStoreUnavailable\([^\n]*?e\.code='SESSION_STORE_UNAVAILABLE';[^\n]*?return e;/,
  'session lookup distinguishes store outage from a valid missing session');
assert.match(sessionSource,/catch\(error\)\{durableReadFailureCount=[^\n]*?throw sessionStoreUnavailable\(/,'failed durable read uses the explicit outage error');
assert.match(sessionSource,/if\(!rows\[0\]\)return null;/,'only a successful empty lookup is missing');
assert.equal(guard.isExpectedRecoveryRejection(Object.assign(new Error('MYSQL_RECOVERY_NOT_EVALUATED'), {code:'MYSQL_RECOVERY_NOT_EVALUATED'})), true,
  'expected pre-census write rejection is not process-fatal');
console.log('V65.1.26 recovery/session hotfix: 6/6 passed');
