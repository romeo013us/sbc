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
assert.match(sessionSource, /mysqlQuery\('SELECT user_id,[\s\S]*?persistTimeoutMs\+250\)/,
  'durable session lookup has a bounded timeout');
assert.match(sessionSource, /unavailable\.code='SESSION_STORE_UNAVAILABLE';throw unavailable/,
  'session lookup distinguishes store outage from a valid missing session');
assert.equal(guard.isExpectedRecoveryRejection(Object.assign(new Error('MYSQL_RECOVERY_NOT_EVALUATED'), {code:'MYSQL_RECOVERY_NOT_EVALUATED'})), true,
  'expected pre-census write rejection is not process-fatal');
console.log('V65.1.26 recovery/session hotfix: 6/6 passed');
