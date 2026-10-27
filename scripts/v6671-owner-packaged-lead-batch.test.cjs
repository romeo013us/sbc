'use strict';
// V66.71: the deployed October 26-27 batch must be stageable without silent writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const s=read('server.js'),main=read('public/index.html'),
      importer=read('public/sbc-lead-import-v6541.js'),
      owner=read('public/sbc-v6667-private-owner-import.js');
const marker="app.get('/api/owner/lead-import/packaged-batch',auth,ownerOnly,(req,res)=>{";
const pos=s.indexOf(marker),end=s.indexOf('\n});',pos);
assert(pos>0&&end>pos&&s.indexOf(marker,pos+1)===-1,'must be exactly one owner-protected batch read endpoint');
const route=s.slice(pos,end+4);
assert.match(route,/Cache-Control.*no-store/);
assert.match(route,/sbc-leads-oct-26-27-2026-31\.csv/);
assert.match(route,/res\.type\('text\/csv'\)/);
assert.doesNotMatch(route,/INSERT|UPDATE|DELETE|beginTransaction|saveData|mysqlPool|getConnection/);
assert(main.includes('SBC_V6632_REMOVE_FLOATING_LEAD_IMPORT'),'must keep importer off dashboard');
assert(!main.includes('sbc-v6667-private-owner-import.js'),'owner import remains standalone only');
assert.match(importer,/window\.sbcOwnerLoadPackagedLeadCsv/);
assert.match(importer,/staged\.length!==31/);
assert.match(importer,/preview=null/);
assert.match(importer,/commitBtn\.disabled=true/);
assert.match(owner,/Load Oct 26–27 batch \(31 leads\)/);
assert.match(owner,/\/api\/owner\/lead-import\/packaged-batch/);
assert.match(owner,/window\.sbcOwnerLoadPackagedLeadCsv\(csv\)/);
assert.doesNotMatch(owner,/dryRun:false|mode:'import'|INSERT INTO|window\.confirm/);
new vm.Script(importer,{filename:'sbc-lead-import-v6541.js'});
new vm.Script(owner,{filename:'sbc-v6667-private-owner-import.js'});
const csv=fs.readFileSync(path.join(__dirname,'../hotfix-assets/sbc-leads-oct-26-27-2026-31.csv'),'utf8').replace(/^\uFEFF/,'');
assert(csv.startsWith('business_name,'));
assert.equal(csv.trim().split(/\r?\n/).length,32,'verified batch should have 31 data rows');
console.log('[SBC V6671] PASS owner-authenticated CSV staging, 31 rows, no automatic import, tenant/write checks retained');
