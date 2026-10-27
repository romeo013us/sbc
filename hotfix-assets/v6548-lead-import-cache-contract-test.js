'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6548-lead-import-cache-contract');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6548-import-cache-'));
function put(rel,content){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,content);}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
try{
 put('public/sbc-lead-import-v6541.js',"async function request(body){} request({mode:'import',dryRun:false,rows}); if(result.dryRun!==false){}");
 put('public/index.html','<title>SBC V65.1.46</title><script src="/sbc-lead-import-v6541.js?v=65.1.43-import-contract"></script>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-46-tenant-propagation';");
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.46',scripts:{'test:all':'node bootstrap.js --verify'}},null,2));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.46',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.46',scripts:{}}}},null,2));
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.46'; const RELEASE_NAME = 'TENANT_PROPAGATION'; const RELEASE = {major:65,minor:1,patch:46};");
 put('browser_public/app.js',"const EXPECTED_RELEASE_VERSION='65.1.46';");
 put('VERSION','65.1.46');
 const result=patch.apply(root);
 assert.equal(result.version,'65.1.47');
 assert.match(get('public/index.html'),/sbc-lead-import-v6541\.js\?v=65\.1\.47-import-contract/);
 assert.match(get('public/index.html'),/V65\.1\.47/);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-47-import-contract/);
 assert.equal(JSON.parse(get('package.json')).version,'65.1.47');
 assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.47');
 assert.match(get('config/release-identity.js'),/RELEASE_NAME = 'LEAD_IMPORT_CACHE_CONTRACT'/);
 assert.match(get('browser_public/app.js'),/65\.1\.47/);
 console.log('[SBC V65.1.47] lead-import cache/commit contract regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
