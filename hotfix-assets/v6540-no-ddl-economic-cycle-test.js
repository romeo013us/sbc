'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const patch = require('./apply-v6540-no-ddl-economic-cycle');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6540-no-ddl-'));
function put(rel, value) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), {recursive:true});
  fs.writeFileSync(p, value);
}
function get(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

try {
  put('enterprise/v56220-economic-control.js',
    "'use strict';\nasync function runEconomicControlCycle(ctx) {\n  return await executePrimaryEconomicMutations(ctx);\n}\n");
  put('package.json', JSON.stringify({name:'sbc-business-command-center',version:'65.1.39',scripts:{'test:all':'node bootstrap.js --verify'}},null,2)+'\n');
  put('package-lock.json', JSON.stringify({name:'sbc-business-command-center',version:'65.1.39',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.39'}}},null,2)+'\n');
  put('config/release-identity.js', "const RELEASE_VERSION = '65.1.39';\nconst RELEASE_NAME = 'SAFE_NO_DDL_STARTUP';\nconst RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:39});\n");
  put('public/index.html','<title>SBC Business Command Center — V65.1.39</title>');
  put('public/sw.js',"const CACHE='sbc-static-v65-1-39';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('hotfix-assets/v6540-no-ddl-economic-cycle-test.js','// copied');
  const result = patch.apply(root);
  const source = get('enterprise/v56220-economic-control.js');
  assert.equal(result.version,'65.1.40');
  assert.match(source,/SBC_V6540_DDL_ENABLED/);
  assert.match(source,/reason:'NO_DDL_RUNTIME_PROFILE'/);
  assert.match(source,/return await executePrimaryEconomicMutations\(ctx\);/);
  assert.equal(JSON.parse(get('package.json')).version,'65.1.40');
  assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.40');
  assert.match(get('config/release-identity.js'),/patch:40/);
  assert.match(get('public/index.html'),/V65\.1\.40/);
  assert.match(get('public/sw.js'),/sbc-static-v65-1-40/);
  console.log('[SBC V65.1.40] no-DDL economic mutation suppression regression PASS');
} finally {
  fs.rmSync(root,{recursive:true,force:true});
}
