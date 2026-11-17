'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(dir,name)=>fs.readFileSync(path.join(root,dir,name),'utf8');
test('Lorna urgent panel never inherits pale amber text on its pale warning background',()=>{
 for(const dir of ['public','browser_public']){
  const css=read(dir,'sbc-lorna-checklist.css');
  assert.match(css,/\.sbc-urgent-research\s+p\s*\{[^}]*color:#4a2024\s*!important/i);
  assert.match(css,/\.sbc-urgent-research\s+strong\s*\{[^}]*color:#4a2024\s*!important/i);
 }
 assert.equal(read('public','sbc-lorna-checklist.css'),read('browser_public','sbc-lorna-checklist.css'));
});
