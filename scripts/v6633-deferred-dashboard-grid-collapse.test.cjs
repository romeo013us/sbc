'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply}=require('../hotfix-assets/apply-v6633-deferred-dashboard-grid-collapse.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6633-'));
try{
 for(const dir of ['public','browser_public']){
  fs.mkdirSync(path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,dir,'sbc-v6562-executive-dashboard.css'),'#content:has(> #sbcProductionControlDashboard){display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr))}');
  fs.writeFileSync(path.join(root,dir,'sbc-v6601-reference-cockpit.css'),'#app.app>.main{min-width:0}');
 }
 const r=apply(root);assert.equal(r.changed.length,2);
 for(const dir of ['public','browser_public']){
  const css=fs.readFileSync(path.join(root,dir,'sbc-v6601-reference-cockpit.css'),'utf8');
  assert.match(css,/SBC_V6633_DEFERRED_DASHBOARD_GRID_COLLAPSE/);
  assert.match(css,/#app\.app \.main #content:has\(> #sbcProductionControlDashboard\)\{/);
  assert.match(css,/display:block!important;grid-template-columns:none!important/);
  assert.match(css,/grid-column:1\/-1!important/);
 }
 assert.throws(()=>apply(root),/duplicate patch/);
 console.log('V6633 full-width dashboard restored after late production deck append PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}