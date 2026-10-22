'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const patch=require('./apply-v6574-draggable-nav-rail');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6574-nav-'));
try{
 const pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
 fs.writeFileSync(path.join(pub,'index.html'),'<!doctype html><html><head></head><body><aside class="sidebar"></aside><main id="main-content"></main></body></html>');
 const result=patch.apply(root);
 assert.equal(result.marker,'SBC_V6574_DRAGGABLE_NAV_RAIL');
 assert.equal(result.crmWrites,false);
 assert.equal(result.serverChanges,false);
 const html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
 assert.match(html,/sbc-v6574-draggable-nav-rail\.css/);
 assert.match(html,/sbc-v6574-draggable-nav-rail\.js/);
 assert.match(html,/SBC_V6574_DRAGGABLE_NAV_RAIL/);
 assert.ok(fs.existsSync(path.join(pub,'sbc-v6574-draggable-nav-rail.css')));
 assert.ok(fs.existsSync(path.join(pub,'sbc-v6574-draggable-nav-rail.js')));
 assert.throws(()=>patch.apply(root),/patch already applied/);
 console.log('[SBC_V6574_DRAGGABLE_NAV_RAIL] PASS: assets installed, duplicate guarded, CRM/server unchanged.');
}finally{fs.rmSync(root,{recursive:true,force:true})}
