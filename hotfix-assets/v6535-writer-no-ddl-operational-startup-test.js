'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const patch = require('./apply-v6535-writer-no-ddl-operational-startup');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6535-writer-no-ddl-'));
function put(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function get(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
try {
  put('server.js',
    "initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){console.log('[SBC_V6524_SINGLE_WRITER_PREVIEW] read-only runtime: skipping notifications, seed/repair writes, and all automation startup.');return;}" +
    "}).then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){console.log('SBC_V6524_SINGLE_WRITER_PREVIEW read-only runtime: autonomous sweep and all background mutation timers skipped.');return;}" +
    "else storageMode='mysql-relational-read-only';");
  put('public/index.html', '<title>SBC Business Command Center — V65.1.34</title>');
  put('public/sw.js', "const CACHE='sbc-static-v65-1-34';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('package.json', JSON.stringify({name:'sbc-business-command-center',version:'65.1.34',description:'old',scripts:{'test:all':'node bootstrap.js --verify'}}));
  put('package-lock.json', JSON.stringify({name:'sbc-business-command-center',version:'65.1.34',packages:{'':{version:'65.1.34'}}}));
  put('config/release-identity.js', "const RELEASE_VERSION = '65.1.34';\nconst RELEASE_NAME = 'PRICE_CONSISTENCY_AND_CHECKOUT_GUARD';\nconst RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:34});");
  const result = patch.apply(root);
  assert.equal(result.version, '65.1.35');
  const server = get('server.js');
  assert.match(server, /SBC_RUNTIME_READ_ONLY \|\| !MYSQL_RECOVERY_EVALUATED \|\| MYSQL_RECOVERY_REQUIRED \|\| !sbcWriterLeaseReady/);
  assert.equal((server.match(/SBC_DDL_ENABLED/g) || []).length, 0, 'worker activation is no longer coupled to the DDL flag');
  assert.match(server, /storageMode=SBC_RUNTIME_READ_ONLY\?'mysql-relational-read-only':'mysql-relational'/);
  assert.match(server, /DDL remains opt-in/);
  assert.match(get('public/index.html'), /V65\.1\.35/);
  assert.match(get('public/sw.js'), /sbc-static-v65-1-35/);
  assert.equal(JSON.parse(get('package.json')).version, '65.1.35');
  assert.equal(JSON.parse(get('package-lock.json')).version, '65.1.35');
  assert.match(get('config/release-identity.js'), /patch:35/);
  assert.ok(fs.existsSync(path.join(root, 'hotfix-assets', 'v6535-writer-no-ddl-operational-startup-test.js')));
  console.log('[SBC V65.1.35] writer startup no longer depends on DDL opt-in; recovery and writer-lease gates remain required.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
