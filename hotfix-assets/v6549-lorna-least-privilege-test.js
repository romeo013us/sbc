'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6549-lorna-least-privilege');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6549-lorna-'));
function put(rel,content){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,content);}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
try{
 put('server.js',"app.get('/api/gateways/readiness',auth,(req,res)=>{});\nconst guards='SBC_RUNTIME_WRITER_LEASE_REQUIRED MYSQL_RECOVERY_REQUIRED';\n");
 put('public/index.html','<title>SBC V65.1.47</title><div data-view="dashboard"></div><div data-view="acquisition"></div></body>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-47-import-contract';");
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.47',description:'old'},null,2));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.47',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.47'}}},null,2));
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.47'; const RELEASE_NAME = 'LEAD_IMPORT_CACHE_CONTRACT'; const RELEASE = {major:65,minor:1,patch:47};");
 put('browser_public/app.js',"const EXPECTED_RELEASE_VERSION='65.1.47';");
 put('VERSION','65.1.47');
 const result=patch.apply(root);
 assert.equal(result.version,'65.1.48');
 const server=get('server.js');
 assert.match(server,/SBC_V6549_LORNA_LEAST_PRIVILEGE/);
 assert.match(server,/sbcLornaAllowedRequest/);
 assert.match(server,/sessionUser\(req\)/);
 assert.match(server,/LORNA_LEAST_PRIVILEGE_DENIED/);\n assert.match(server,/researcher\\?db\\.customers\\.filter/);\n assert.match(server,/websiteDemos:researcher\\?\\{\\}/);\n assert.match(server,/users:\\['owner','manager'\\]\\.includes/);
 assert.match(server,/MYSQL_RECOVERY_REQUIRED/);
 const html=get('public/index.html');
 assert.match(html,/sbc-lorna-least-privilege-ui/);
 assert.match(html,/acquisition/);
 assert.match(html,/training/);
 assert.match(html,/timeclock/);
 assert.match(html,/V65\.1\.48/);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-48-lorna-least-privilege/);
 assert.equal(JSON.parse(get('package.json')).version,'65.1.48');
 assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.48');
 assert.match(get('config/release-identity.js'),/LORNA_LEAST_PRIVILEGE/);
 assert.match(get('browser_public/app.js'),/65\.1\.48/);
 assert.equal(patch.apply.toString().includes(''),true);
 console.log('[SBC V65.1.48] Lorna least-privilege patch regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
