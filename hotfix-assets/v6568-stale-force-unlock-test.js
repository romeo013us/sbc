'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6568-'));
function put(rel, value) { const p=path.join(root,rel); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,value); }
function get(rel) { return fs.readFileSync(path.join(root,rel),'utf8'); }
try {
  const pkg={name:'sbc-business-command-center',version:'65.1.66',scripts:{'test:all':'node bootstrap.js --verify'}};
  const lock={name:pkg.name,version:pkg.version,lockfileVersion:3,packages:{'':{name:pkg.name,version:pkg.version,scripts:{}}}};
  put('package.json',JSON.stringify(pkg));
  put('package-lock.json',JSON.stringify(lock));
  put('public/app.js',"function sbcV6557OwnerForceUnlockOnce(){return fetch('/api/owner/recovery/force-unlock',{method:'POST'});}\nasync function boot(){sbcV6557OwnerForceUnlockOnce();}\nboot();");
  put('browser_public/app.js',"function sbcV6557OwnerForceUnlockOnce(){return fetch('/api/owner/recovery/force-unlock',{method:'POST'});}\nasync function boot(){sbcV6557OwnerForceUnlockOnce();}\nboot();");
  put('public/index.html','<html><head><script src="/app.js?v=65.1.63-sales-operating-model"></script></head><body></body></html>');
  put('browser_public/index.html','<html><head><script src="/app.js?v=65.1.63-sales-operating-model"></script></head><body></body></html>');
  put('public/sw.js',"const CACHE='sbc-static-v65-1-66';");
  put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-66';");
  const result=require('./apply-v6568-stale-force-unlock.js').apply(root);
  assert.equal(result.version,'65.1.67');
  for(const file of ['public/app.js','browser_public/app.js']) {
    const s=get(file);
    assert.match(s,/function sbcV6557OwnerForceUnlockOnce/);
    assert.doesNotMatch(s,/sbcV6557OwnerForceUnlockOnce\(\);/);
    assert.doesNotMatch(s,/\/api\/owner\/recovery\/force-unlock['"]/);
  }
  for(const file of ['public/index.html','browser_public/index.html']) assert.match(get(file),/65\.1\.67-stale-force-unlock-retired/);
  for(const file of ['public/sw.js','browser_public/sw.js']) assert.match(get(file),/sbc-static-v65-1-67-force-unlock-retired/);
  assert.equal(JSON.parse(get('package.json')).version,'65.1.67');
  assert.equal(JSON.parse(get('package-lock.json')).version,'65.1.67');
  console.log('[SBC V65.1.67 STALE FORCE-UNLOCK RETIREMENT] PASS');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
