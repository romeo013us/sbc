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
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const store=fs.readFileSync(path.join(root,'enterprise/session-store.js'),'utf8');
assert.match(server,/HISTORICAL BASELINE MISMATCH[\s\S]*?await readRelational\(\);/,'non-empty partial relational DB logs the shortfall and continues loading authoritative MySQL');
assert.doesNotMatch(server,/REFUSING PARTIAL-DATABASE ACTIVATION/,'historical 248-customer count no longer hard-locks non-empty production');
assert.match(server,/REFUSING EMPTY-DATABASE MIGRATION/,'empty database remains protected from accidental seeding');
assert.match(server,/createSessionStore\(\{sessionSecret:SESSION_SECRET,getMysqlPool:\(\)=>mysqlPool/,'session store receives a lazy getter for the actual MySQL pool');
assert.match(store,/currentMysqlPool/,'all durable session paths use dynamically resolved MySQL pool');
assert.match(store,/confirmed[\s\S]*?mysqlDurable=Boolean/,'MySQL session persistence must be read-back verified before login is issued');
assert.match(server,/FINANCIAL_GOVERNOR/,'independent financial governance remains in the release');
console.log('V65.1.14 operational unlock: 7/7 PASS');process.exit(0);
