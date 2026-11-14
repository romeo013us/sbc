'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {patch,stage}=require('./stage-lorna-handoff-v1.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('optional Lorna panel is inserted next to existing research scripts without changing the forms',()=>{
 const original='<html><head><title>Research</title></head><body><form id="lead-import"></form><script src="/lead-research.js?v=10" defer></script></body></html>';
 const edited=patch(original);assert.equal(edited.changed,true);assert.match(edited.source,/sbc-lorna-handoff-v1.js/);assert.match(edited.source,/sbc-lorna-handoff-v1.css/);
 assert.match(edited.source,/id="lead-import"/);assert.match(edited.source,/lead-research.js\?v=10/);
 assert.equal(patch(edited.source).changed,false);
});
test('Lorna file patch refuses unexpected source and mismatched served asset mirrors',()=>{
 assert.throws(()=>patch('<html></html>'),/ANCHOR_MISSING_OR_AMBIGUOUS/);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-lorna-stage-'));
 try{for(const dir of ['public','browser_public'])fs.mkdirSync(path.join(root,dir));
  fs.writeFileSync(path.join(root,'public/lead-research.html'),'<script src="/lead-research.js?v=10" defer></script></head>');
  fs.writeFileSync(path.join(root,'browser_public/lead-research.html'),'UNRELATED');
  assert.throws(()=>stage(root),/MIRROR_MISMATCH/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
