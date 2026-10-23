'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const patch=require('./apply-v6574-draggable-nav-rail');
const sourceJs=path.join(__dirname,'v6574-draggable-nav-rail.js');
const sourceCss=path.join(__dirname,'v6574-draggable-nav-rail.css');
const js=fs.readFileSync(sourceJs,'utf8');
const css=fs.readFileSync(sourceCss,'utf8');
const patchSource=fs.readFileSync(path.join(__dirname,'apply-v6574-draggable-nav-rail.js'),'utf8');
assert.match(patchSource,/querySelector\('\.navigation-rail-container'\)/,'must detect the actual navigation rail shell');
assert.match(patchSource,/querySelector\('#sidebar'\)/,'must detect id-based sidebars');
assert.match(patchSource,/querySelector\('aside'\)/,'must fall back to an aside rail when no standard class exists');
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
    assert.equal((html.match(/sbc-v6574-draggable-nav-rail\.css/g)||[]).length,1);
    assert.equal((html.match(/sbc-v6574-draggable-nav-rail\.js/g)||[]).length,1);
    assert.ok(html.includes('SBC_V6574_DRAGGABLE_NAV_RAIL'));
  }
  for(const dir of ['public','browser_public']){
    for(const name of ['sbc-v6574-draggable-nav-rail.css','sbc-v6574-draggable-nav-rail.js']){
      const actual=fs.readFileSync(path.join(root,dir,name),'utf8');
      assert.equal(actual,name.endsWith('.js')?js:css);
    }
  }
  assert.ok(js.includes("collapsed=!collapsed"));
  assert.ok(!js.includes("pointerdown"));
  assert.ok(!js.includes("pointermove"));
  assert.ok(!js.includes("sbc-nav-rail-resize"));
  assert.ok(!css.includes("sbc-nav-rail-resize"));
  cp.execFileSync(process.execPath,['--check',sourceJs],{stdio:'pipe'});
  const second=patch.apply(root);
  assert.equal(second.idempotent,true);
  for(const rel of ['public/index.html','browser_public/index.html']){
    const html=fs.readFileSync(path.join(root,rel),'utf8');
    assert.equal((html.match(/sbc-v6574-draggable-nav-rail\.css/g)||[]).length,1);
    assert.equal((html.match(/sbc-v6574-draggable-nav-rail\.js/g)||[]).length,1);
  }
  console.log('[SBC V6574 NAV RAIL TEST] PASS: both entrypoints and asset directories registered, repeat application safe, resizing removed, collapse retained.');
}finally{fs.rmSync(root,{recursive:true,force:true});}