'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply}=require('../hotfix-assets/apply-v6631-main-width-zero-repair.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6631-'));
try {
 const old='#app.app>.main{flex:1 1 0!important;min-width:0!important;width:0!important;max-width:100%!important}';
 for(const dir of ['public','browser_public']){
  const file=path.join(root,dir,'sbc-v6601-reference-cockpit.css');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'#app .sidebar{width:260px}\n'+old+'\n');
 }
 const out=apply(root);assert.equal(out.changed.length,2);
 for(const dir of ['public','browser_public']){
  const css=fs.readFileSync(path.join(root,dir,'sbc-v6601-reference-cockpit.css'),'utf8');
  assert.doesNotMatch(css,/width:0!important/);
  assert.match(css,/width:auto!important/);
  assert.match(css,/SBC_V6631_MAIN_WIDTH_ZERO_REPAIR/);
 }
 assert.throws(()=>apply(root),/already applied/);
 console.log('V6631 zero width main column removed in both entrypoints PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}