'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveSessionSecret, KEY_FILE } = require('../enterprise/durable-session-secret');

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

const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
assert.match(server, /getMysqlPool:\(\)=>sessionMysqlPool\|\|mysqlPool/, 'dedicated-pool-first binding');
assert.match(server, /let SBC_DDL_ENABLED = String\(process.env.ENABLE_DDL \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'true'/);
assert.match(server, /function sbcMayAutoEnableDdl\(\)\{return false;\}/);
assert.match(server, /SBC_RUNTIME_READ_ONLY \|\| !SBC_DDL_ENABLED \|\| !MYSQL_RECOVERY_EVALUATED \|\| MYSQL_RECOVERY_REQUIRED \|\| !sbcWriterLeaseReady/);
assert.match(server, /if\(!MYSQL_RECOVERY_EVALUATED\) return res.status\(503\)[^\n]+MYSQL_RECOVERY_NOT_EVALUATED/);
const poolStart=server.indexOf('sessionMysqlPool = wrapMySQLPool(mysql.createPool(');
const poolEnd=server.indexOf('if(!SBC_DDL_ENABLED)',poolStart);
assert(poolStart>0&&poolEnd>poolStart);
assert.match(server.slice(poolStart,poolEnd),/connectionLimit:2/);
assert.match(server,/if\(sessionMysqlPool\)await sessionMysqlPool.end\(\)/);
assert.match(server,/customers:customers.map\(r=>\(\{id:r.id,tenantId:Number\(r.tenant_id\)/);
assert.match(server,/function __sbcRequireTenantId[^\n]+TENANT_CONTEXT_REQUIRED/);
console.log('[SBC session stability] PASS: durable key, current runtime DDL opt-in, isolated pool, recovery and tenant scope');
