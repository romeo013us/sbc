'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply}=require('../hotfix-assets/apply-v6629-import-http200-contract.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6629-'));
function put(p,s){const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
try{
 put('public/sbc-lead-import-v6541.js',[
 "async function request(body){const response=await fetch('/api/crm/leads/import',{method:'POST',credentials:'same-origin'});return await response.json();}",
 "function renderResults(data){}"
 ].join('\n'));
 put('public/index.html','<script src="/sbc-lead-import-v6541.js?v=65.1.47-import-contract"></script>');
 put('public/sw.js',"const CACHE='sbc-static-old';");
 const r=apply(root);assert.equal(r.jsonRequired,true);
 const ui=fs.readFileSync(path.join(root,'public/sbc-lead-import-v6541.js'),'utf8');
 assert.match(ui,/redirect:'manual'/);
 assert.match(ui,/cache:'no-store'/);
 assert.match(ui,/contentType\.includes\('application\/json'\)/);
 assert.match(ui,/data\.dryRun!==true/);
 assert.match(ui,/data\.dryRun!==false/);
 assert.match(ui,/Number\.isFinite\(Number\(data\.imported\)\)/);
 assert.match(fs.readFileSync(path.join(root,'public/index.html'),'utf8'),/66\.29-import-http200-contract/);
 assert.match(fs.readFileSync(path.join(root,'public/sw.js'),'utf8'),/sbc-static-v66-29-import-contract/);
 assert.throws(()=>apply(root),/repeated patch/);
 console.log('V6629 import HTTP 200 JSON response contract, no auto retry and cache revision PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}