'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const patch = require('./apply-v6539-safe-no-ddl-startup');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6539-safe-no-ddl-'));
function put(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, content);
}
function get(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

try {
  put('server.js', [
    "initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6535_WRITER_NO_DDL_OPERATIONAL_STARTUP] startup workers held: read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
    "}).then(async()=>{if(SBC_RUNTIME_READ_ONLY || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6535_WRITER_NO_DDL_OPERATIONAL_STARTUP] autonomous sweep held: read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
    "const startOperationalRuntime=async()=>{if(SBC_RUNTIME_READ_ONLY){console.log('[SBC_V6524_SINGLE_WRITER_PREVIEW] read-only runtime: background workers and WebSockets not started.');return;}",
    "await SBC_GOD_EVENTS.ensureTables();"
  ].join('\n'));
  put('package.json', JSON.stringify({name:'sbc-business-command-center',version:'65.1.38',description:'old',scripts:{'test:all':'node bootstrap.js --verify'}},null,2)+'\n');
  put('package-lock.json', JSON.stringify({name:'sbc-business-command-center',version:'65.1.38',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.38',dependencies:{}}}},null,2)+'\n');
  put('config/release-identity.js', "const RELEASE_VERSION = '65.1.38';\nconst RELEASE_NAME = 'WRITER_HYDRATION_WITHOUT_DDL';\nconst RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:38});\n");
  put('public/index.html','<title>SBC Business Command Center — V65.1.38</title>');
  put('public/sw.js',"const CACHE='sbc-static-v65-1-38';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('hotfix-assets/v6539-safe-no-ddl-startup-test.js','// copied regression test');
  const result=patch.apply(root);
  const server=get('server.js');
  assert.equal(result.version,'65.1.39');
  assert.equal(result.ddlRemainsOptIn,true);
  assert.equal(result.recoveryAndLeaseGuardsPreserved,true);
  assert.match(server,/if\(SBC_RUNTIME_READ_ONLY \|\| !SBC_DDL_ENABLED \|\| !MYSQL_RECOVERY_EVALUATED \|\| MYSQL_RECOVERY_REQUIRED \|\| !sbcWriterLeaseReady\)/);
  assert.equal((server.match(/SBC_V6539_SAFE_NO_DDL_STARTUP/g)||[]).length,3);
  assert.match(server,/if\(!SBC_DDL_ENABLED\)\{console\.warn\('\[SBC_V6539_SAFE_NO_DDL_STARTUP\] Published HTTP\/API listener remains available/);
  assert.match(server,/await SBC_GOD_EVENTS\.ensureTables\(\)/,'schema-dependent worker setup remains in place but is bypassed by the early return');
  assert.match(server,/MYSQL_RECOVERY_REQUIRED \|\| !sbcWriterLeaseReady/);
  assert.equal(JSON.parse(get('package.json')).version,'65.1.39');
  assert.equal(JSON.parse(get('package-lock.json')).version,'65.1.39');
  assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.39');
  assert.match(get('config/release-identity.js'),/patch:39/);
  assert.match(get('public/index.html'),/V65\.1\.39/);
  assert.match(get('public/sw.js'),/sbc-static-v65-1-39/);
  assert.ok(fs.existsSync(path.join(root,'hotfix-assets','v6539-safe-no-ddl-startup-test.js')));
  console.log('[SBC V65.1.39] no-DDL startup gate, recovery guard, and writer lease regression PASS');
} finally {
  fs.rmSync(root,{recursive:true,force:true});
}
