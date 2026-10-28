'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply}=require('../hotfix-assets/apply-v6632-remove-floating-lead-import.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6632-'));
const put=(rel,src)=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,src);};
try{
 put('public/index.html','<html><head></head><body><button data-view="customers">Leads & Customers</button><script src="/sbc-lead-import-v6541.js?v=66.29-import-http200-contract"></script></body></html>');
 put('browser_public/index.html','<html><head></head><body><button data-view="customers">Leads & Customers</button></body></html>');
 put('public/sw.js',"const CACHE='stale';");put('browser_public/sw.js',"const CACHE='stale';");
 const result=apply(root);assert.equal(result.crmWrites,false);assert.equal(result.masterLeadsPreserved,false);
 for(const rel of ['public/index.html','browser_public/index.html']){
  const html=fs.readFileSync(path.join(root,rel),'utf8');
  assert.doesNotMatch(html,/<script\b[^>]*src=["']\/sbc-lead-import-v6541/);
  assert.match(html,/#sbc-lead-import-launcher,#sbc-master-list-launcher,#sbc-lead-import-overlay\{display:none!important\}/);
  assert.match(html,/data-view="customers"/);
 }
 assert.match(fs.readFileSync(path.join(root,'public/sw.js'),'utf8'),/v66-32-no-floating-import/);
 assert.throws(()=>apply(root),/already applied/);
 console.log('V6632 remove both floating lead import controls, keep Leads & Customers navigation without publicly packaged CSV PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}