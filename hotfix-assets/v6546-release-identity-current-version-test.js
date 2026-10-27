'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const patch = require('./apply-v6546-release-identity-current-version');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6546-release-identity-'));
function put(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function get(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

try {
  put('server.js', [
    "const packageVersion = require('./package.json').version;",
    "const EXPECTED_RELEASE_VERSION = require('./browser_public/app').EXPECTED_RELEASE_VERSION;",
    "if (packageVersion !== EXPECTED_RELEASE_VERSION) console.error('[SBC RELEASE IDENTITY] FATAL: RELEASE_IDENTITY_MISMATCH package=' + packageVersion + ' expected ' + EXPECTED_RELEASE_VERSION + ' (or supported rollback release)');"
  ].join('\n'));
  put('browser_public/app.js', "const EXPECTED_RELEASE_VERSION = '65.1.59'; module.exports = { EXPECTED_RELEASE_VERSION };");
  put('package.json', JSON.stringify({name:'sbc-business-command-center',version:'65.1.44',scripts:{'test:all':'node bootstrap.js --verify'}},null,2)+'\n');
  put('package-lock.json', JSON.stringify({name:'sbc-business-command-center',version:'65.1.44',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.44',scripts:{}}}},null,2)+'\n');
  put('config/release-identity.js', [
    "const RELEASE_VERSION = '65.1.44';",
    "const RELEASE_NAME = 'BASELINE_GATED_DDL_UNBLOCK';",
    "const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:44});",
    "module.exports = { RELEASE_VERSION, RELEASE_NAME, RELEASE };"
  ].join('\n')+'\n');
  put('public/index.html','<title>SBC Business Command Center — V65.1.44</title><script src="/sbc-ask-kim-drag-v6544.js?v=65.1.44-baseline-ddl"></script>');
  put('public/sw.js',"const CACHE='sbc-static-v65-1-44-baseline-ddl';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('hotfix-assets/v6546-release-identity-current-version-test.js','// test source placeholder');
  put('enterprise/v4341-kim-resilience-control.js',"module.exports={integrityManifest(){return {}},verifyIntegrity(){return {ok:true}}};");

  const result = patch.apply(root);
  assert.equal(result.version,'65.1.45');
  assert.equal(result.releaseGuardFilesChanged,1);
  assert.equal(result.releaseGuardReplacements,1);
  assert.doesNotMatch(get('server.js'),/65\.1\.18/);
  assert.match(get('server.js'),/RELEASE_IDENTITY_MISMATCH/);
  assert.match(get('browser_public/app.js'),/EXPECTED_RELEASE_VERSION = '65\.1\.45'/);
  assert.equal(JSON.parse(get('package.json')).version,'65.1.45');
  assert.equal(JSON.parse(get('package-lock.json')).version,'65.1.45');
  assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.45');
  assert.match(get('config/release-identity.js'),/RELEASE_VERSION = '65\.1\.45'/);
  assert.match(get('config/release-identity.js'),/patch:45/);
  assert.match(get('public/index.html'),/V65\.1\.45/);
  assert.match(get('public/sw.js'),/sbc-static-v65-1-45-release-identity/);
  assert.ok(fs.existsSync(path.join(root,'hotfix-assets','apply-v6546-release-identity-current-version.js')));
  assert.ok(fs.existsSync(path.join(root,'hotfix-assets','v6546-release-identity-current-version-test.js')));
  console.log('[SBC V65.1.45] release identity alignment regression PASS');
} finally {
  fs.rmSync(root,{recursive:true,force:true});
}
