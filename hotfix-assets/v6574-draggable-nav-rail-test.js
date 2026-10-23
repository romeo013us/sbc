'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const patch=require('./apply-v6574-draggable-nav-rail');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6574-nav-'));
try{
  for(const rel of ['public/index.html','browser_public/index.html']){
    const file=path.join(root,rel);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,'<!doctype html><html><head></head><body><aside class="sidebar"></aside><main id="main-content"></main></body></html>');
  }
  const result=patch.apply(root);
  assert.equal(result.marker,'SBC_V6574_DRAGGABLE_NAV_RAIL');
  assert.equal(result.crmWrites,false);
  assert.equal(result.serverChanges,false);
  for(const rel of ['public/index.html','browser_public/index.html']){
    const html=fs.readFileSync(path.join(root,rel),'utf8');
    assert.ok(html.includes('/sbc-v6574-draggable-nav-rail.css'));
    assert.ok(html.includes('/sbc-v6574-draggable-nav-rail.js'));
    assert.ok(html.includes('SBC_V6574_DRAGGABLE_NAV_RAIL'));
  }
  for(const rel of ['public/sbc-v6574-draggable-nav-rail.css','public/sbc-v6574-draggable-nav-rail.js']){
    assert.ok(fs.statSync(path.join(root,rel)).size>100);
  }
  assert.throws(()=>patch.apply(root),/patch already applied/);
  console.log('[SBC V6574 NAV RAIL TEST] PASS: both HTML entrypoints registered, real assets copied, duplicate application blocked.');
}finally{fs.rmSync(root,{recursive:true,force:true});}
