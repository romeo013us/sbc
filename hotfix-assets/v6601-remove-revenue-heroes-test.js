'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict');
const patch=require('./apply-v6601-remove-revenue-heroes.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6601-test-'));
try{
 fs.mkdirSync(path.join(root,'public'),{recursive:true});
 fs.writeFileSync(path.join(root,'public/index.html'),'<!doctype html><html><head></head><body><main id="app"></main></body></html>');
 fs.mkdirSync(path.join(root,'browser_public'),{recursive:true});
 fs.writeFileSync(path.join(root,'browser_public/index.html'),'<!doctype html><html><head></head><body><main id="app"></main></body></html>');
 const result=patch.apply(root);
 assert.equal(result.changed.length,2);
 for(const rel of ['public/index.html','browser_public/index.html']){
  const s=fs.readFileSync(path.join(root,rel),'utf8');
  assert.ok(s.includes('SBC_V6601_REMOVE_REVENUE_HEROES'));
  assert.ok(s.includes('CONSULTATIVE REVENUE ENGINE'));
  assert.ok(s.includes('GOD[- ]TIER REVENUE AUTOPILOT'));
  assert.ok(s.includes('MutationObserver'));
 }
 assert.throws(()=>patch.apply(root),/no supported HTML entrypoint found or patch already applied/);
 console.log('V6601 revenue hero suppression regression: PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
