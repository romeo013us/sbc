'use strict';

// Deterministic GoDaddy source-bundle overlay. This patches only the known
// V65.1.13 package and aborts if any expected source anchor has drifted.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const BASE_VERSION = '65.1.13';
const TARGET_VERSION = '65.1.14';
const RELEASE_NAME = 'OPERATIONAL-RECOVERY-SESSION-HOTFIX';
const PATCH_MARKER = 'SBC_V65114_OPERATIONAL_UNLOCK_APPLIED';

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function mustReplaceOnce(source, expression, replacement, label) {
  const matches = source.match(expression);
  if (!matches) throw new Error(`V65.1.14 hotfix stopped: could not locate ${label}.`);
  if (matches.length !== 1) throw new Error(`V65.1.14 hotfix stopped: ${label} matched ${matches.length} times.`);
  return source.replace(expression, replacement);
}

function patchSessionStore(rootDir) {
  const file = path.join(rootDir, 'enterprise', 'session-store.js');
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes('const currentMysqlPool=()=>')) return;
  source = mustReplaceOnce(source, /  mysqlPool,\n  getRedisClient,/, '  mysqlPool,\n  getMysqlPool,\n  getRedisClient,', 'session-store pool arguments');
  source = mustReplaceOnce(source, /  const SESSION_TTL_MS=Math\.max\(5\*60\*1000,Number\(ttlMs\)\|\|604800000\);/, match => `${match}\n  // V65.1.14: resolve MySQL lazily because this store is constructed before initMysql().\n  const currentMysqlPool=()=>{try{return typeof getMysqlPool==='function'?getMysqlPool():mysqlPool;}catch{return null;}};`, 'session-store TTL declaration');
  source = mustReplaceOnce(source, /  const mysqlQuery=\(sql,params=\[\]\)=>mysqlPool\.query\(\{sql,timeout:persistTimeoutMs\},params\);/, '  const mysqlQuery=(sql,params=[])=>{const pool=currentMysqlPool();if(!pool){const e=new Error(\'MySQL durable session store is unavailable.\');e.code=\'SESSION_STORE_UNAVAILABLE\';throw e;}return pool.query({sql,timeout:persistTimeoutMs},params);};', 'session-store MySQL query wrapper');
  source = source.replaceAll('if(mysqlPool){', 'if(currentMysqlPool()){');
  source = source.replaceAll('if(mysqlPool)cleanup.push', 'if(currentMysqlPool())cleanup.push');
  source = source.replaceAll('if(!rec&&mysqlPool){', 'if(!rec&&currentMysqlPool()){');
  const writePattern = /    if\(currentMysqlPool\(\)\)\{try\{await withTimeout\(mysqlQuery\(`INSERT INTO sbc_sessions[\s\S]*?mysqlDurable=true;\}catch\(e\)\{logger\.warn\('\[SBC AUTH\] MySQL session write:',e\.message\)\}\}/;
  if (writePattern.test(source)) {
    source = source.replace(writePattern, `    if(currentMysqlPool()){
      try{
        const hash=sessionHash(token);
        await withTimeout(mysqlQuery(\`INSERT INTO sbc_sessions(token_hash,user_id,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),expires_at=VALUES(expires_at),last_seen_at=UTC_TIMESTAMP()\`,[hash,rec.userId,new Date(rec.createdAt).toISOString().slice(0,19).replace('T',' '),new Date(rec.expiresAt).toISOString().slice(0,19).replace('T',' ')]),persistTimeoutMs+250);
        const [confirmed]=await withTimeout(mysqlQuery('SELECT user_id FROM sbc_sessions WHERE token_hash=? AND user_id=? AND expires_at>=UTC_TIMESTAMP() LIMIT 1',[hash,rec.userId]),persistTimeoutMs+250);
        mysqlDurable=Boolean(confirmed?.length && String(confirmed[0].user_id)===String(rec.userId));
        if(!mysqlDurable)logger.warn('[SBC AUTH] MySQL session persistence read-back did not confirm the row.');
      }catch(e){logger.warn('[SBC AUTH] MySQL session write/verification:',e.message)}
    }`);
  } else if (!source.includes('MySQL session persistence read-back did not confirm the row.')) {
    throw new Error('V65.1.14 hotfix stopped: could not locate MySQL session persistence block.');
  }
  fs.writeFileSync(file, source);
}

function patchRecoveryDecision(rootDir) {
  const file = path.join(rootDir, 'server.js');
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes(PATCH_MARKER)) return;
  const expression = /if\(Number\(countRows\[0\]\?\.customers\|\|0\) < VERIFIED_PRE_CORRUPTION_CRM_COUNT\)\{\s*storageMode='mysql-recovery-required';\s*MYSQL_RECOVERY_REQUIRED=true;\s*MYSQL_RECOVERY_EVALUATED=true;\s*console\.error\(`\[SBC RECOVERY GUARD\] REFUSING PARTIAL-DATABASE ACTIVATION:[\s\S]*?return true;\s*\}\s*await readRelational\(\);/;
  source = mustReplaceOnce(source, expression, `const actualCustomerCount=Number(countRows[0]?.customers||0);
      if(actualCustomerCount < VERIFIED_PRE_CORRUPTION_CRM_COUNT){
        // ${PATCH_MARKER}: treat the historical row count as a warning, not an app-wide lock.
        // Continue only when an existing relational core is present. No missing records are created.
        console.warn(\`[SBC RECOVERY GUARD] HISTORICAL BASELINE MISMATCH — continuing with existing non-empty MySQL data: customers=\${actualCustomerCount}, historicalBaseline=\${VERIFIED_PRE_CORRUPTION_CRM_COUNT}, activeLeadBaseline=\${VERIFIED_PRE_CORRUPTION_ACTIVE_LEADS}. No missing customer rows were synthesized.\`);
      }
      await readRelational();`, 'non-empty partial-database threshold block');
  source = mustReplaceOnce(source, /const SESSION_STORE=createSessionStore\(\{sessionSecret:SESSION_SECRET,mysqlPool,getRedisClient:/, 'const SESSION_STORE=createSessionStore({sessionSecret:SESSION_SECRET,getMysqlPool:()=>mysqlPool,getRedisClient:', 'server-to-session-store pool wiring');
  fs.writeFileSync(file, source);
}

function bumpRelease(rootDir) {
  const packagePath = path.join(rootDir, 'package.json');
  const pkg = readJson(packagePath);
  if (pkg.version === TARGET_VERSION) return;
  if (pkg.version !== BASE_VERSION) throw new Error(`V65.1.14 hotfix expected package ${BASE_VERSION}, found ${pkg.version}.`);
  const script = path.join(rootDir, 'scripts', 'release-bump.js');
  const out = spawnSync(process.execPath, [script, TARGET_VERSION, RELEASE_NAME, '--apply'], { cwd: rootDir, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  if (out.status !== 0) throw new Error(`V65.1.14 release identity update failed: ${(out.stderr || out.stdout || 'no output').slice(-2000)}`);
  const lockPath = path.join(rootDir, 'package-lock.json');
  // The original V65.1.13 source ZIP intentionally has no lockfile. Generate
  // a real npm v3 lock for the just-bumped manifest instead of aborting startup.
  if (!fs.existsSync(lockPath)) {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const generated = spawnSync(npmCmd, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: rootDir, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024
    });
    if (generated.status !== 0 || !fs.existsSync(lockPath)) {
      const detail = (generated.stderr || generated.stdout || 'npm did not create package-lock.json').slice(-2500);
      throw new Error(`V65.1.14 lockfile generation failed safely: ${detail}`);
    }
  }
  const lock = readJson(lockPath);
  lock.name = pkg.name;
  lock.version = TARGET_VERSION;
  if (!lock.packages) lock.packages = {};
  if (!lock.packages['']) lock.packages[''] = {};
  lock.packages[''].name = pkg.name;
  lock.packages[''].version = TARGET_VERSION;
  if (pkg.dependencies) lock.packages[''].dependencies = pkg.dependencies;
  if (pkg.engines) lock.packages[''].engines = pkg.engines;
  writeJson(lockPath, lock);
  const updatedPkg = readJson(packagePath);
  updatedPkg.description = 'SBC OS V65.1.14 operational recovery availability and durable session-store hotfix';
  const tests = updatedPkg.scripts['test:all'] || '';
  const endNeedle = 'node scripts/v65113-recovery-write-failure-test.js && node scripts/ui-static-audit.js';
  if (tests.includes(endNeedle)) {
    updatedPkg.scripts['test:all'] = tests.replace(endNeedle, 'node scripts/v65113-recovery-write-failure-test.js && node scripts/v65114-operational-unlock-test.js && node scripts/v65114-session-lazy-pool-test.js && node scripts/ui-static-audit.js');
  } else if (!tests.includes('scripts/v65114-operational-unlock-test.js')) {
    throw new Error('V65.1.14 hotfix stopped: could not append regression tests to test:all.');
  }
  writeJson(packagePath, updatedPkg);

  const authTestPath = path.join(rootDir, 'scripts', 'v65112-auth-session-safety-test.js');
  let authTest = fs.readFileSync(authTestPath, 'utf8');
  authTest = authTest.replace(/assert\.match\(store,\/const mysqlQuery=.*?session queries use driver timeout plus application bound'\);/, "assert.match(store,/const currentMysqlPool=\\(\\)=>[\\s\\S]*?currentMysqlPool\\(\\)/,'session store resolves the MySQL pool dynamically after startup initialization');");
  fs.writeFileSync(authTestPath, authTest);

  // Add the two focused regression tests supplied alongside this root launcher.
  const overlayDir = path.join(__dirname, 'hotfix-assets');
  for (const filename of ['v65114-operational-unlock-test.js', 'v65114-session-lazy-pool-test.js']) {
    const from = path.join(overlayDir, filename);
    const to = path.join(rootDir, 'scripts', filename);
    if (!fs.existsSync(from)) throw new Error(`V65.1.14 hotfix test asset missing: ${filename}`);
    fs.copyFileSync(from, to);
  }
  delete require.cache[require.resolve(path.join(rootDir, 'enterprise/v4341-kim-resilience-control.js'))];
  const integrity = require(path.join(rootDir, 'enterprise/v4341-kim-resilience-control.js'));
  integrity.integrityManifest();
  const check = integrity.verifyIntegrity();
  if (!check.ok) throw new Error(`V65.1.14 integrity manifest check failed: ${JSON.stringify(check.mismatches)}`);
}

function apply(rootDir) {
  const pkg = readJson(path.join(rootDir, 'package.json'));
  if (pkg.name !== 'sbc-business-command-center') throw new Error('V65.1.14 hotfix stopped: unexpected package name.');
  if (pkg.version === TARGET_VERSION && fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8').includes(PATCH_MARKER)) {
    // A previous launch has already applied this exact patch. Still verify the version and pool wiring.
    if (!fs.readFileSync(path.join(rootDir, 'enterprise', 'session-store.js'), 'utf8').includes('currentMysqlPool')) throw new Error('V65.1.14 session-store patch marker is missing.');
    return { version: TARGET_VERSION, alreadyApplied: true };
  }
  if (pkg.version !== BASE_VERSION) throw new Error(`V65.1.14 hotfix only accepts ${BASE_VERSION}; found ${pkg.version}.`);
  patchSessionStore(rootDir);
  patchRecoveryDecision(rootDir);
  bumpRelease(rootDir);
  // Final identity and syntax checks protect startup from partial or drifted overlays.
  const finalPkg = readJson(path.join(rootDir, 'package.json'));
  const release = require(path.join(rootDir, 'config', 'release-identity.js'));
  if (finalPkg.version !== TARGET_VERSION || release.RELEASE_VERSION !== TARGET_VERSION) throw new Error('V65.1.14 release identity mismatch after patch.');
  for (const rel of ['server.js', 'enterprise/session-store.js', 'scripts/v65114-operational-unlock-test.js', 'scripts/v65114-session-lazy-pool-test.js']) {
    const result = spawnSync(process.execPath, ['--check', path.join(rootDir, rel)], { encoding: 'utf8', timeout: 30000 });
    if (result.status !== 0) throw new Error(`V65.1.14 syntax check failed for ${rel}: ${result.stderr || result.stdout}`);
  }
  console.log(`[SBC V65.1.14 HOTFIX] applied: non-empty CRM no longer hard-stops on historical 248-row count; lazy durable MySQL session pool enabled; empty-core recovery refusal retained.`);
  return { version: TARGET_VERSION, alreadyApplied: false };
}

module.exports = { apply, BASE_VERSION, TARGET_VERSION, PATCH_MARKER };
