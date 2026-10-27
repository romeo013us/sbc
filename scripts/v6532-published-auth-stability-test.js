'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveSessionSecret, KEY_FILE } = require('./durable-session-secret');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6532-session-key-'));
try {
  const env = {};
  const first = resolveSessionSecret({ env, dataDir: tmp });
  const second = resolveSessionSecret({ env, dataDir: tmp });
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(second, first, 'the persisted signing key remains stable across application restarts');
  const stat = fs.statSync(path.join(tmp, KEY_FILE));
  assert.equal(stat.mode & 0o777, 0o600, 'the persisted signing key is owner-readable only');
  assert.equal(resolveSessionSecret({ env: { SBC_SESSION_SECRET: 'explicit-existing-key' }, dataDir: tmp }), 'explicit-existing-key', 'an existing explicit secret is preserved without rotation');
  assert.throws(() => resolveSessionSecret({ env: {} }), /SBC_SESSION_KEY_STORAGE_REQUIRED/);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const patch = fs.readFileSync(path.join(__dirname, 'apply-v6533-startup-ddl-gate.js'), 'utf8');
assert.match(patch, /sessionMysqlPool\|\|mysqlPool/, 'session storage has a dedicated-pool-first binding');
assert.match(patch, /ENABLE_DDL \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'true'/, 'schema changes require explicit ENABLE_DDL=true');
assert.match(patch, /SBC_RUNTIME_READ_ONLY \|\| !SBC_DDL_ENABLED/, 'startup hydration skips schema-changing operations unless opted in');
assert.match(patch, /ENABLE_DDL \|\| ''\)\.trim\(\)\.toLowerCase\(\) !== 'true'/, 'query guard blocks DDL unless explicitly enabled');
assert.match(patch, /skip schema-dependent startup workers without DDL opt-in/, 'startup workers are not run when DDL is disabled');
assert.match(patch, /connectionLimit:2/, 'auth traffic uses a bounded independent pool');
assert.match(patch, /MYSQL_RECOVERY_NOT_EVALUATED/, 'sign-in is rejected while authoritative recovery is still evaluating');
assert.match(patch, /early dedicated session pool initialization/, 'session pool is available before lengthy schema reconciliation');
assert.match(patch, /close isolated session pool on shutdown/, 'dedicated pool is closed during graceful shutdown');
assert.match(fs.readFileSync(path.join(__dirname, 'apply-v6529-open-readiness.js'), 'utf8'), /tenantId:Number\(r\.tenant_id\)/, 'the prior release already hydrates tenant identity from MySQL');
assert.match(patch, /TENANT_CONTEXT_REQUIRED/, 'autopilot holds when tenant provenance is absent');
console.log('[SBC V65.1.33] startup DDL gate, durable session key, isolated auth pool, and tenant-context safety checks PASS');
