'use strict';
// Old bundled prospect CSV endpoint is intentionally retired, while owner
// upload, preview, and explicit writer/tenant gates stay available.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const server=read('server.js'),main=read('public/index.html'),
      importer=read('public/sbc-lead-import-v6541.js'),
      owner=read('public/sbc-v6667-private-owner-import.js');
const marker="app.get('/api/owner/lead-import/packaged-batch',auth,ownerOnly,(req,res)=>{";
const pos=server.indexOf(marker),end=server.indexOf('\n});',pos);
assert(pos>=0&&end>pos&&server.indexOf(marker,pos+1)===-1,'owner-only retired endpoint must be unique');
const route=server.slice(pos,end+4);
assert.match(route,/Cache-Control.*no-store/);
assert.match(route,/SBC_PRIVATE_CSV_UPLOAD_REQUIRED/);
assert.match(route,/status\(410\)/,'retired endpoint must not serve prospect CSV');
assert.doesNotMatch(route,/readFileSync|sendFile|text\/csv|INSERT|UPDATE|DELETE|saveData|mysqlPool/);
const routes=[];
const auth={},ownerOnly={};
vm.runInNewContext(route,{app:{get:(name,a,b,handler)=>routes.push({name,a,b,handler})},auth,ownerOnly},{timeout:2000});
assert.equal(routes.length,1);assert.equal(routes[0].a,auth);assert.equal(routes[0].b,ownerOnly);
const headers={};let payload=null,code=200;
routes[0].handler({},{
 setHeader:(key,value)=>{headers[key]=value;},
 status(value){code=value;return this;},
 json(value){payload=value;return this;}
});
assert.equal(code,410);assert.equal(payload.code,'SBC_PRIVATE_CSV_UPLOAD_REQUIRED');
assert.match(headers['Cache-Control'],/no-store/);
assert(main.includes('SBC_V6632_REMOVE_FLOATING_LEAD_IMPORT'));
assert(!main.includes('sbc-v6667-private-owner-import.js'));
assert(owner.includes('Owner-only CSV upload ready'));
assert(!owner.includes('packaged-batch'),'no browser fetch for bundled private contacts');
assert(importer.includes('id="sbc-lead-import-file"'));
assert(importer.includes('dryRun:true'));
assert(importer.includes('dryRun:false'));
assert(importer.includes('window.confirm'));
assert(!fs.existsSync(path.join(root,'public/sbc-master-prospect-list-2026-10-23.csv')));
assert(!fs.existsSync(path.join(root,'browser_public/sbc-master-prospect-list-2026-10-23.csv')));
assert(!fs.existsSync(path.join(root,'starter-leads/SBC-Lorna-Barbershop-Batch-2026-10-09.csv')));
new vm.Script(importer,{filename:'sbc-lead-import-v6541.js'});
new vm.Script(owner,{filename:'sbc-v6667-private-owner-import.js'});
console.log('[SBC V6671] PASS retired bundled CSV, owner manual upload, safe preview, no public prospect files');
