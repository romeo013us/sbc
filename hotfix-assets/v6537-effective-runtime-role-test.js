'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const patch = require('./apply-v6537-effective-runtime-role');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6537-role-'));
function put(rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
try {
  put('server.js', `const SBC_RUNTIME_ROLE = 'readonly';
const SBC_RUNTIME_READ_ONLY = true;
const safety = 'SBC_RUNTIME_WRITER_LEASE_REQUIRED SBC_RUNTIME_WRITER_LEASE_LOST !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady SBC_READ_ONLY_RUNTIME';
initMysql().then(async()=>{ console.log('startup'); });
`);
  put('package.json', JSON.stringify({
    name: 'sbc-business-command-center', version: '65.1.36',
    description: 'old',
    scripts: { 'test:all': 'node bootstrap.js --verify' }
  }, null, 2));
  put('package-lock.json', JSON.stringify({
    name: 'sbc-business-command-center', version: '65.1.36',
    lockfileVersion: 3, packages: { '': { name: 'sbc-business-command-center', version: '65.1.36' } }
  }, null, 2));
  put('public/index.html', '<title>SBC Business Command Center — V65.1.36</title>');
  put('public/sw.js', "const CACHE='sbc-static-v65-1-36';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('config/release-identity.js', "const RELEASE_VERSION = '65.1.36';\nconst RELEASE_NAME = 'RUNTIME_BEACON_DEPLOYMENT_PROOF';\nconst RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:36});");
  const result = patch.apply(root);
  const server = read('server.js');
  assert.equal(result.version, '65.1.37');
  assert.match(server, /const SBC_RUNTIME_ROLE = String\(process\.env\.SBC_RUNTIME_ROLE \|\| 'readonly'\)\.trim\(\)\.toLowerCase\(\);/);
  assert.match(server, /const SBC_RUNTIME_READ_ONLY = SBC_RUNTIME_ROLE !== 'writer';/);
  assert.match(server, /SBC_RUNTIME_ROLE must be writer or readonly/);
  assert.match(server, /\[SBC ROLE SOURCE CHECK\] env=/);
  assert.match(server, /SBC_RUNTIME_WRITER_LEASE_REQUIRED/);
  assert.match(server, /SBC_RUNTIME_WRITER_LEASE_LOST/);
  assert.match(server, /!MYSQL_RECOVERY_EVALUATED \|\| MYSQL_RECOVERY_REQUIRED \|\| !sbcWriterLeaseReady/);
  assert.match(server, /SBC_READ_ONLY_RUNTIME/);
  assert.equal(JSON.parse(read('package.json')).version, '65.1.37');
  assert.equal(JSON.parse(read('package-lock.json')).version, '65.1.37');
  assert.match(read('public/index.html'), /V65\.1\.37/);
  assert.match(read('public/sw.js'), /sbc-static-v65-1-37/);
  assert.match(read('config/release-identity.js'), /RELEASE_VERSION = '65\.1\.37'/);
  assert.match(read('config/release-identity.js'), /EFFECTIVE_RUNTIME_ROLE_SOURCE_FIX/);
  console.log('[SBC V65.1.37] effective runtime role + safety-gate regression PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
