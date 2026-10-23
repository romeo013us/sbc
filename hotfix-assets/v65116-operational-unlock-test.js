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
const loginStart = server.indexOf("app.post('/api/login'");
const loginEnd = server.indexOf("app.get('/api/owner/recovery/census'", loginStart);
assert(loginStart >= 0 && loginEnd > loginStart, 'login endpoint must be found');
const loginRoute = server.slice(loginStart, loginEnd);
const activeRelease = require('../config/release-identity');
const releaseValidator = require('../enterprise/v567-nine-nine');

assert.match(server, /HISTORICAL BASELINE MISMATCH[\s\S]*?await readRelational\(\);/, 'historical 248-record discrepancy is a warning for a non-empty CRM');
assert.doesNotMatch(server, /REFUSING PARTIAL-DATABASE ACTIVATION/, 'historical baseline must not hard-lock a non-empty CRM');
assert.match(server, /REFUSING EMPTY-DATABASE MIGRATION/, 'empty database remains protected');
assert.match(server, /Detailed per-table recovery census deferred/, 'slow table census is deferred');
assert.doesNotMatch(loginRoute, /MYSQL_RECOVERY_STARTUP_PENDING/, 'login must not be blocked while read-only recovery evaluation runs');
assert.match(loginRoute, /persistSession\(made\.token,made\.record\)/, 'login must persist a session durably');
assert.match(loginRoute, /SESSION_PERSISTENCE_UNAVAILABLE/, 'login must refuse authentication when durable persistence fails');
assert.match(server, /createSessionStore\(\{sessionSecret:SESSION_SECRET,getMysqlPool:\(\)=>mysqlPool/, 'session store uses the late-bound pool');
assert.match(store, /const persistTimeoutMs=15000/, 'session persistence timeout is extended');
assert.match(store, /mysqlDurable=Boolean/, 'MySQL session persistence is read-back verified');
assert.match(fs.readFileSync(path.join(root, 'enterprise', 'v567-nine-nine.js'), 'utf8'), /ACTIVE_PACKAGE_RELEASE=require\('\.\.\/config\/release-identity'\)\.RELEASE_VERSION/, 'release validator reads active release identity dynamically');
assert.equal(activeRelease.RELEASE_VERSION, require('../package.json').version, 'root source package and active release identity match');
assert.equal(releaseValidator.releaseIdentity(require('../package.json')).status, 'VALID', 'current release passes the production release validator');
assert.match(server, /MYSQL_RECOVERY_NOT_EVALUATED/, 'business persistence remains blocked until recovery checks complete');
assert.match(server, /FINANCIAL_GOVERNOR/, 'financial governance remains in the application');
console.log('V65.1.16 release/login regression suite: 14/14 PASS');
