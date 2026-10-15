'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const patch = require('./apply-v6536-runtime-beacon');

assert.equal(patch.MARKER, 'SBC_V6536_RUNTIME_BEACON_RELEASE');
assert.equal(patch.FROM, '65.1.35');
assert.equal(patch.TO, '65.1.36');
assert.equal(patch.RELEASE_NAME, 'RUNTIME_BEACON_DEPLOYMENT_PROOF');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6536-release-'));
function put(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
try {
  put('package.json', JSON.stringify({
    name: 'sbc-business-command-center',
    version: '65.1.35',
    description: 'old',
    scripts: { start: 'node bootstrap.js', 'test:all': 'node bootstrap.js --verify' }
  }, null, 2));
  put('package-lock.json', JSON.stringify({
    name: 'sbc-business-command-center',
    version: '65.1.35',
    lockfileVersion: 3,
    packages: { '': { name: 'sbc-business-command-center', version: '65.1.35' } }
  }, null, 2));
  put('public/index.html', '<title>SBC Business Command Center — V65.1.35</title>');
  put('public/sw.js', "const CACHE='sbc-static-v65-1-35';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('config/release-identity.js', "const RELEASE_VERSION = '65.1.35';\nconst RELEASE_NAME = 'WRITER_NO_DDL_OPERATIONAL_STARTUP';\nconst RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:35});");
  put('server.js', "const WRITER_GUARD = 'MYSQL_RECOVERY_EVALUATED && !MYSQL_RECOVERY_REQUIRED && sbcWriterLeaseReady';");
  const result = patch.apply(root);
  assert.equal(result.version, '65.1.36');
  assert.equal(JSON.parse(read('package.json')).version, '65.1.36');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, '65.1.36');
  assert.equal(lock.packages[''].version, '65.1.36');
  assert.match(read('public/index.html'), /V65\.1\.36/);
  assert.match(read('public/sw.js'), /sbc-static-v65-1-36/);
  assert.match(read('config/release-identity.js'), /RELEASE_VERSION = '65\.1\.36'/);
  assert.match(read('config/release-identity.js'), /RELEASE_NAME = 'RUNTIME_BEACON_DEPLOYMENT_PROOF'/);
  assert.match(read('config/release-identity.js'), /patch:36/);
  assert.match(read('server.js'), /MYSQL_RECOVERY_EVALUATED && !MYSQL_RECOVERY_REQUIRED && sbcWriterLeaseReady/);
  assert.ok(fs.existsSync(path.join(root, 'hotfix-assets', 'v6536-runtime-beacon-test.js')));
  console.log('[SBC V65.1.36] release patch integration PASS; writer/recovery guard unchanged.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
