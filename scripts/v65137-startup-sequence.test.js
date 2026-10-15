'use strict';

/**
 * SBC V65.1.43 startup sequence regression.
 *
 * This test combines assertions against the repository's actual startup patches
 * with a deterministic contract model. It does not connect to MySQL or prove
 * that GoDaddy injects environment variables into a particular process.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));
const bootstrap = read('bootstrap.js');
const rolePatch = read('hotfix-assets/apply-v6537-effective-runtime-role.js');
const leasePatch = read('hotfix-assets/apply-v6528-runtime-writer-lease.js');
const singleWriterPatch = read('hotfix-assets/apply-v6524-single-writer.js');
const ddlPatch = read('hotfix-assets/apply-v6533-startup-ddl-gate.js');
const workerPatch = read('hotfix-assets/apply-v6535-writer-no-ddl-operational-startup.js');
const safeStartupPatch = read('hotfix-assets/apply-v6539-safe-no-ddl-startup.js');

function assertPatchOrder(segment, target, label) {
  const expected = [
    'apply-v6524-single-writer.js',
    'apply-v6528-runtime-writer-lease.js',
    'apply-v6533-startup-ddl-gate.js',
    'apply-v6535-writer-no-ddl-operational-startup.js',
    'apply-v6537-effective-runtime-role.js',
    'apply-v6538-writer-hydration-without-ddl.js',
    'apply-v6539-safe-no-ddl-startup.js',
    'apply-v6541-lead-import.js',
    'apply-v6542-voice-call-diagnostics.js',
    'apply-v6543-lead-import-commit-contract.js'
  ];
  let last = -1;
  for (const patch of expected) {
    const marker = patch + "')).apply(" + target + ")";
    const current = segment.indexOf(marker);
    assert.notEqual(current, -1, label + ': bootstrap must apply ' + patch);
    assert.ok(current > last, label + ': ' + patch + ' must be applied in safety-gate order');
    last = current;
  }
}

function sourceContractChecks() {
  assert.equal(pkg.version, '65.1.43', 'test is tied to the deployed V65.1.43 source');
  assert.match(bootstrap, /process\.env\.SBC_BOOT_ID = sbcBootId/,
    'each launched process gets a unique boot correlation ID');
  assert.match(bootstrap, /\[SBC BOOT CORRELATION\] boot_id=/,
    'bootstrap logs its process boot ID before server startup');
  assertPatchOrder(
    bootstrap.slice(bootstrap.indexOf('function verifyOnly()'), bootstrap.indexOf('function launch()')),
    'temp',
    'verifyOnly'
  );
  assertPatchOrder(
    bootstrap.slice(bootstrap.indexOf('function launch()')),
    'runtimeDir',
    'launch'
  );

  assert.match(rolePatch, /process\.env\.SBC_RUNTIME_ROLE \|\| 'readonly'/,
    'missing role defaults to read-only');
  assert.match(rolePatch, /SBC_RUNTIME_READ_ONLY = SBC_RUNTIME_ROLE !== 'writer'/,
    'only the explicit writer role is writable');
  assert.match(rolePatch, /\[SBC ROLE SOURCE CHECK\]/,
    'runtime logs the effective role without printing secrets');

  assert.match(leasePatch, /GET_LOCK\(\?, 0\)/,
    'writer lease must use a nonblocking MySQL named lock');
  assert.match(leasePatch, /IS_USED_LOCK\(\?\)/,
    'lease ownership is rechecked before writes');
  assert.match(leasePatch, /SBC_RUNTIME_WRITER_BUSY/,
    'a second writer must fail closed');
  assert.match(leasePatch, /SBC_RUNTIME_WRITER_LEASE_REQUIRED/,
    'writes require an acquired lease');
  assert.match(leasePatch, /SBC_RUNTIME_WRITER_LEASE_LOST/,
    'writes stop if lease ownership is lost');
  assert.match(leasePatch, /s=once\(s,writerLog,lease\+writerLog,'startup lease'\)/,
    'lease acquisition is inserted before the writer startup log and schema path');
  assert.match(leasePatch, /MYSQL_RECOVERY_REQUIRED=true/,
    'lease failure enters recovery-safe mode');

  assert.match(singleWriterPatch, /if\(SBC_RUNTIME_READ_ONLY\)\{/,
    'Preview/read-only mode follows a separate hydration path');
  assert.match(singleWriterPatch, /schema\/migrations\/seeds skipped/,
    'read-only startup skips schema changes, migrations, and seeds');

  assert.match(ddlPatch, /ENABLE_DDL \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'true'/,
    'DDL requires the explicit ENABLE_DDL=true opt-in');
  assert.match(ddlPatch, /SBC_RUNTIME_READ_ONLY \|\| !SBC_DDL_ENABLED/,
    'DDL is separately gated from runtime role');

  assert.match(workerPatch, /SBC_RUNTIME_READ_ONLY \|\| !MYSQL_RECOVERY_EVALUATED \|\| MYSQL_RECOVERY_REQUIRED \|\| !sbcWriterLeaseReady/,
    'workers require writer role, completed recovery evaluation, clear recovery, and an active lease');
  assert.match(workerPatch, /DDL remains opt-in/,
    'worker startup does not require DDL to be enabled');
  assert.match(safeStartupPatch, /!SBC_DDL_ENABLED/,
    'schema-dependent startup workers are held when DDL is not explicitly enabled');
  assert.match(safeStartupPatch, /Published HTTP\/API listener remains available/,
    'the HTTP/API listener remains available in no-DDL safe mode');

  console.log('[SBC V65.1.39] source-contract checks PASS');
}

/**
 * Minimal policy model for deterministic no-database tests.
 * The source checks above tie this model to the repository's guard mechanisms;
 * this model itself is not an execution of server.js.
 */
class MockDatabase {
  constructor() {
    this.leaseOwner = null;
    this.schemaChanged = false;
  }

  async acquireExclusiveLease(nodeId) {
    if (this.leaseOwner !== null) {
      return { success: false, error: 'SBC_RUNTIME_WRITER_BUSY' };
    }
    this.leaseOwner = nodeId;
    return { success: true, leaseToken: 'token-' + nodeId };
  }

  async executeDDL() {
    this.schemaChanged = true;
    return { success: true };
  }
}

class SystemInitializer {
  constructor(env, db, recovery = 'clear') {
    this.env = env;
    this.db = db;
    this.recovery = recovery;
    this.leaseAcquired = false;
    this.recoveryEvaluated = false;
    this.workersStarted = false;
  }

  evaluateRole() {
    const role = String(this.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase();
    if (!['writer', 'readonly'].includes(role)) {
      throw new Error('SBC_RUNTIME_ROLE must be writer or readonly');
    }
    return role;
  }

  async runStartupSequence(nodeId) {
    const role = this.evaluateRole();
    if (role !== 'writer') {
      return { status: 'READ_ONLY', ddlEnabled: false };
    }

    const lease = await this.db.acquireExclusiveLease(nodeId);
    if (!lease.success) {
      this.recoveryEvaluated = true;
      return { status: 'RECOVERY_SAFE', reason: 'writer lease unavailable', ddlEnabled: false };
    }
    this.leaseAcquired = true;

    const ddlEnabled = String(this.env.ENABLE_DDL || '').trim().toLowerCase() === 'true';
    if (ddlEnabled) await this.db.executeDDL();
    if (!ddlEnabled) return { status: 'HTTP_API_SAFE_MODE', ddlEnabled: false };

    this.recoveryEvaluated = this.recovery !== 'not-evaluated';
    if (!this.recoveryEvaluated || this.recovery === 'required') {
      return { status: 'RECOVERY_SAFE', reason: 'recovery is not clear', ddlEnabled };
    }

    this.workersStarted = true;
    return { status: 'OPERATIONAL', ddlEnabled };
  }
}

async function modelChecks() {
  {
    const db = new MockDatabase();
    const runtime = new SystemInitializer({}, db);
    const result = await runtime.runStartupSequence('preview');
    assert.equal(result.status, 'READ_ONLY');
    assert.equal(db.leaseOwner, null, 'Preview must not try to take the writer lease');
    assert.equal(db.schemaChanged, false);
    assert.equal(runtime.workersStarted, false);
    console.log('PASS: Preview defaults to read-only and performs no writes.');
  }

  {
    const db = new MockDatabase();
    const runtime = new SystemInitializer({ SBC_RUNTIME_ROLE: 'writer' }, db);
    const result = await runtime.runStartupSequence('published');
    assert.equal(result.status, 'HTTP_API_SAFE_MODE');
    assert.equal(result.ddlEnabled, false, 'unset ENABLE_DDL remains disabled');
    assert.equal(runtime.leaseAcquired, true);
    assert.equal(runtime.recoveryEvaluated, false, 'no-DDL mode does not enter schema-dependent worker initialization');
    assert.equal(runtime.workersStarted, false, 'schema-dependent workers are held until DDL is explicitly enabled');
    assert.equal(db.schemaChanged, false, 'no schema mutation when ENABLE_DDL is unset');
    console.log('PASS: Writer with DDL unset acquires a lease; HTTP/API stays up while schema-dependent workers are held.');
  }

  {
    const db = new MockDatabase();
    const primary = new SystemInitializer({ SBC_RUNTIME_ROLE: 'writer', ENABLE_DDL: 'true' }, db);
    const primaryResult = await primary.runStartupSequence('primary');
    assert.equal(primaryResult.status, 'OPERATIONAL');

    const secondary = new SystemInitializer({ SBC_RUNTIME_ROLE: 'writer', ENABLE_DDL: 'true' }, db);
    const secondaryResult = await secondary.runStartupSequence('secondary');
    assert.equal(secondaryResult.status, 'RECOVERY_SAFE');
    assert.equal(secondary.workersStarted, false);
    assert.equal(secondary.leaseAcquired, false);
    console.log('PASS: A secondary writer is held when the exclusive lease is unavailable.');
  }

  {
    const db = new MockDatabase();
    const runtime = new SystemInitializer({ SBC_RUNTIME_ROLE: 'writer', ENABLE_DDL: 'true' }, db, 'required');
    const result = await runtime.runStartupSequence('published-recovery-required');
    assert.equal(result.status, 'RECOVERY_SAFE');
    assert.equal(runtime.leaseAcquired, true);
    assert.equal(runtime.workersStarted, false);
    console.log('PASS: Required recovery blocks worker startup even after lease acquisition.');
  }

  {
    const db = new MockDatabase();
    const runtime = new SystemInitializer({ SBC_RUNTIME_ROLE: 'writer', ENABLE_DDL: 'true' }, db, 'not-evaluated');
    const result = await runtime.runStartupSequence('published-recovery-pending');
    assert.equal(result.status, 'RECOVERY_SAFE');
    assert.equal(runtime.workersStarted, false);
    console.log('PASS: Unevaluated recovery blocks worker startup.');
  }
}

(async () => {
  sourceContractChecks();
  await modelChecks();
  console.log('[SBC V65.1.39] startup sequence regression PASS');
})().catch(error => {
  console.error('[SBC V65.1.39] startup sequence regression FAIL:', error);
  process.exitCode = 1;
});
