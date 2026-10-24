'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const patch=require('./apply-v6602-layout-containment');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6602-layout-test-'));
try {
  for(const rel of ['public/index.html','browser_public/index.html']) {
    const file=path.join(root,rel);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,'<!doctype html><html><body><div id="app"></div></body></html>');
  }
  const result=patch.apply(root);
  assert.equal(result.marker,'SBC_V6602_LAYOUT_CONTAINMENT');
  assert.equal(result.changed.length,2);
  for(const rel of ['public/index.html','browser_public/index.html']) {
    const html=fs.readFileSync(path.join(root,rel),'utf8');
    assert.match(html,/sbcConsultativeRevenueMount/);
    assert.match(html,/sbcGodTierBroadcastMount/);
    assert.match(html,/sbc-v6602-ten-brain-compact/);
    assert.match(html,/SBC_V6602_LAYOUT_CONTAINMENT/);
    assert.ok(html.includes('</body>'));
  }
  assert.throws(()=>patch.apply(root),/no supported HTML entrypoint found or patch already applied/);
  console.log('SBC V6602 LAYOUT CONTAINMENT TEST PASS');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
