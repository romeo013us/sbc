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
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'enterprise', 'session-store.js'), 'utf8');
const loginStart = server.indexOf("app.post('/api/login'");
const loginEnd = server.indexOf("app.get('/api/owner/recovery/census'", loginStart);
assert(loginStart >= 0 && loginEnd > loginStart, 'login endpoint must be found');
const loginRoute = server.slice(loginStart, loginEnd);
const activeRelease = require('../config/release-identity');
const releaseValidator = require('../enterprise/v567-nine-nine');

// Execute the actual authoritative recovery branch without connecting to a database.
const recoveryStart=server.indexOf('    if(relationalCoreCount > 0){');
const recoveryEnd=server.indexOf("    storageMode='mysql-relational';",recoveryStart);
assert(recoveryStart>=0&&recoveryEnd>recoveryStart,'startup recovery branch must exist');
async function checkRecovery(customers,core){
 let reads=0,ownerBoots=0;
 const context={relationalCoreCount:core,countRows:[{customers}],VERIFIED_PRE_CORRUPTION_CRM_COUNT:248,VERIFIED_PRE_CORRUPTION_ACTIVE_LEADS:238,storageMode:'mysql',MYSQL_RECOVERY_REQUIRED:false,MYSQL_RECOVERY_EVALUATED:false,localCoreCount:999,legacyCoreCount:999,legacyRows:[],readRelational:async()=>{reads++;},ensureOwnerUser:()=>{ownerBoots++;},console:{log(){},warn(){},error(){}}};
 await vm.runInNewContext('(async()=>{'+server.slice(recoveryStart,recoveryEnd)+"\nreturn false;})()",context,{timeout:1000});
 return {locked:context.MYSQL_RECOVERY_REQUIRED,evaluated:context.MYSQL_RECOVERY_EVALUATED,storage:context.storageMode,reads,ownerBoots};
}
(async()=>{
 assert.deepEqual(await checkRecovery(247,247),{locked:true,evaluated:true,storage:'mysql-recovery-required',reads:0,ownerBoots:0});
 assert.deepEqual(await checkRecovery(0,0),{locked:true,evaluated:true,storage:'mysql-recovery-required',reads:0,ownerBoots:1});
 assert.deepEqual(await checkRecovery(248,248),{locked:false,evaluated:false,storage:'mysql',reads:1,ownerBoots:0});
assert.match(server, /Detailed per-table recovery census deferred/, 'slow table census is deferred');
assert.match(loginRoute, /if\(!MYSQL_RECOVERY_EVALUATED\) return res\.status\(503\)[^\n]*MYSQL_RECOVERY_NOT_EVALUATED/, 'login fails closed until authoritative recovery evaluation completes');
assert.match(loginRoute, /persistSession\(made\.token,made\.record\)/, 'login must persist a session durably');
assert.match(loginRoute, /SESSION_PERSISTENCE_UNAVAILABLE/, 'login must refuse authentication when durable persistence fails');
assert.match(server, /createSessionStore\(\{sessionSecret:SESSION_SECRET,getMysqlPool:\(\)=>sessionMysqlPool\|\|mysqlPool/, 'session store uses the late-bound pool');
assert.match(store, /const persistTimeoutMs=15000/, 'session persistence timeout is extended');
assert.match(store, /mysqlDurable=Boolean/, 'MySQL session persistence is read-back verified');
assert.match(fs.readFileSync(path.join(root, 'enterprise', 'v567-nine-nine.js'), 'utf8'), /ACTIVE_PACKAGE_RELEASE=require\('\.\.\/config\/release-identity'\)\.RELEASE_VERSION/, 'release validator reads active release identity dynamically');
assert.equal(activeRelease.RELEASE_VERSION, require('../package.json').version, 'root source package and active release identity match');
assert.equal(releaseValidator.releaseIdentity(require('../package.json')).status, 'VALID', 'current release passes the production release validator');
assert.match(server, /MYSQL_RECOVERY_NOT_EVALUATED/, 'business persistence remains blocked until recovery checks complete');
assert.match(server, /FINANCIAL_GOVERNOR/, 'financial governance remains in the application');
console.log('Operational recovery and login regression suite: PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
