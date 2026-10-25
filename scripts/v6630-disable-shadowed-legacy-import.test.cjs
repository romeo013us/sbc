'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {apply}=require('../hotfix-assets/apply-v6630-disable-shadowed-legacy-import.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6630-'));
try{
 const old="app.post('/api/crm/leads/import',auth,async(req,res)=>{db.customers.push({});await saveData();res.json({added,skipped});});";
 const modern="app.post('/api/crm/leads/import',auth,ownerOnly,async(req,res)=>{requireRequestTenant(req);if(!sbcWriterLeaseReady)return res.status(423).json({code:'SBC_IMPORT_WRITE_LOCKED'});res.json({ok:true,dryRun:true,results:[]});});";
 fs.writeFileSync(path.join(root,'server.js'),[old,modern].join('\n'));
 const proof=apply(root);assert.equal(proof.activeImportRoutes,1);assert.equal(proof.crmWrites,false);
 const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.equal((s.match(/app\.post\('\/api\/crm\/leads\/import'/g)||[]).length,1);
 assert.doesNotMatch(s,/db\.customers\.push/);
 assert.match(s,/auth,ownerOnly/);
 assert.match(s,/dryRun:true/);
 assert.throws(()=>apply(root),/already applied/);
 console.log('V6630 single safe CSV import route / legacy first-match writer removed PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}