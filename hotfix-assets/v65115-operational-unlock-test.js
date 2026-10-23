// V66 standalone compatibility: the GoDaddy root intentionally stores server.js inside the
// embedded source ZIP. When run from the root package, route to current V66 tests instead of
// asserting obsolete V65-era runtime assumptions. In the extracted runtime, retain the original test.
const __sbcRuntimeRoot = require('node:path').resolve(__dirname, '..');
if (!require('node:fs').existsSync(require('node:path').join(__sbcRuntimeRoot, 'server.js'))) {
  const { spawnSync: __sbcSpawnSync } = require('node:child_process');
  const __sbcRunner = require('node:path').join(__sbcRuntimeRoot, 'scripts', 'run-legacy-standalone-test.js');
  const __sbcResult = __sbcSpawnSync(process.execPath, [__sbcRunner, 'operational'], { cwd: __sbcRuntimeRoot, stdio: 'inherit', timeout: 240000 });
  if (__sbcResult.error) throw __sbcResult.error;
  process.exit(__sbcResult.status === 0 ? 0 : (__sbcResult.status || 1));
}
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'enterprise', 'session-store.js'), 'utf8');

assert.match(server, /HISTORICAL BASELINE MISMATCH[\s\S]*?await readRelational\(\);/, 'historical 248-record discrepancy must be a warning for an existing non-empty CRM');
assert.doesNotMatch(server, /REFUSING PARTIAL-DATABASE ACTIVATION/, 'the historical row count must not hold the entire non-empty CRM in recovery');
assert.match(server, /REFUSING EMPTY-DATABASE MIGRATION/, 'empty database remains protected');
assert.match(server, /Detailed per-table recovery census deferred/, 'the slow diagnostic census must not block startup readiness');
assert.match(server, /Retry-After[\s\S]*?MYSQL_RECOVERY_STARTUP_PENDING/, 'sign-in writes are held until core recovery evaluation finishes');
assert.match(server, /createSessionStore\(\{sessionSecret:SESSION_SECRET,getMysqlPool:\(\)=>mysqlPool/, 'session store gets a late-bound MySQL pool');
assert.match(store, /const persistTimeoutMs=15000/, 'session timeout exceeds the 10-second DB cold-connect timeout');
assert.match(store, /currentMysqlPool/, 'all session queries resolve the live pool');
assert.match(store, /mysqlDurable=Boolean/, 'session storage must be confirmed before login is issued');
assert.match(server, /FINANCIAL_GOVERNOR/, 'financial governance stays in the application');
console.log('V65.1.15 startup-readiness checks: 10/10 PASS');
