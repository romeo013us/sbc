'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6570-lease-'));
function put(rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
function get(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
try {
  const pkg = { name: 'sbc-business-command-center', version: '65.1.68', scripts: { 'test:all': 'node bootstrap.js --verify' } };
  const lock = { name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { '': { name: pkg.name, version: pkg.version, scripts: {} } } };
  put('package.json', JSON.stringify(pkg));
  put('package-lock.json', JSON.stringify(lock));
  put('server.js', [
    "const SBC_RUNTIME_WRITER_LOCK_NAME='sbc:runtime:writer:v1';",
    "const [[r]]=await sbcWriterLeaseConn.query('SELECT CONNECTION_ID() AS sessionId, IS_USED_LOCK(?) AS owner',[SBC_RUNTIME_WRITER_LOCK_NAME]);if(Number(r&&r.owner)!==sbcWriterLeaseConnectionId)throw new Error('writer lease ownership changed');",
    "const [[owner]]=await conn.query('SELECT CONNECTION_ID() AS sessionId, IS_USED_LOCK(?) AS owner',[SBC_RUNTIME_WRITER_LOCK_NAME]);if(Number(owner&&owner.owner)!==sbcWriterLeaseConnectionId)throw Object.assign(new Error('writer lease ownership changed'),{code:'SBC_RUNTIME_WRITER_LEASE_LOST'});",
    "console.error('['+MARKER+'] lease heartbeat/reconnect failed; writes remain recovery-gated; retry scheduled:',String(e&&e.message||e),'retryDelayMs='+sbcWriterLeaseRetryDelayMs);"
  ].join('\n'));
  const result = require('./apply-v6570-lease-session-verification.js').apply(root);
  assert.equal(result.version, '65.1.70');
  assert.equal(result.sameSessionConnectionIdChecked, true);
  assert.equal(result.pooledWriteChecksLeaseOwnerOnly, true);
  assert.equal(result.advisoryLockOwnerChecked, true);
  assert.equal(result.recoveryGateChanged, false);
  assert.equal(result.tenantIsolationChanged, false);
  const server = get('server.js');
  assert.equal((server.match(/CONNECTION_ID\(\)\s+AS\s+sessionId/g) || []).length, 2);
  assert.equal((server.match(/SBC_WRITER_LEASE_SESSION_CHANGED/g) || []).length, 1, 'only dedicated lease connection compares session identity');
  assert.equal((server.match(/SBC_WRITER_LEASE_OWNERSHIP_CHANGED/g) || []).length, 2);
  assert.doesNotMatch(get('hotfix-assets/apply-v6570-lease-session-verification.js'), /const guard = \/if\\\\s/);
  assert.match(server, /recovery-gated/);
  assert.match(server, /sqlState/);
  assert.equal(server.includes("console.error('['+MARKER+']"), false);
  assert.match(server, /SBC_V6564_MYSQL_LEASE_LIFECYCLE/);
  assert.equal(JSON.parse(get('package.json')).version, '65.1.70');
  assert.equal(JSON.parse(get('package-lock.json')).version, '65.1.70');
  console.log('[SBC V65.1.70 LEASE SESSION VERIFICATION] PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
