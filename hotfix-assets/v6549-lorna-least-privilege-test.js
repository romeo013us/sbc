'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const patch=require('./apply-v6549-lorna-least-privilege');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6549-lorna-'));
function put(rel,content){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,content);}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
try{
 put('server.js',[
  "app.get('/api/gateways/readiness',auth,(req,res)=>{});",
  "const guards='SBC_RUNTIME_WRITER_LEASE_REQUIRED MYSQL_RECOVERY_REQUIRED';",
  "const v=v9data(), role=req.user.role, isOwnerRole=role==='owner', manager=role==='manager', caller=role==='caller', researcher=role==='lead_researcher', fulfillment=role==='fulfillment';",
  "const customers=caller?db.customers.filter(c=>!c.assignedTo||c.assignedTo===req.user.id):researcher?db.customers:fulfillment?db.customers.filter(c=>true):db.customers;",
  "const mine=req.user.role==='lead_researcher'?all.filter(c=>!c.verificationStatus||c.verificationStatus!=='Sales Ready'||c.assignedTo===req.user.id):all;",
  "const c=(db.customers||[]).find(x=>String(x.id)===String(req.params.id));if(!c)return res.status(404).json({error:'Lead not found.'});",
  "const out={websiteDemos:v.websiteDemos,workforceNotes:v.workforceNotes||{}};",
  "res.json({stats,leads:mine.slice(0,1000),users:(db.users||[]).filter(u=>u.active!==false&&['lead_researcher','caller','manager','owner'].includes(u.role)).map(u=>({id:u.id,name:u.name,role:u.role}))});"
 ].join('\n')+'\n');
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
 assert.match(server,/LORNA_LEAST_PRIVILEGE_DENIED/);
 assert.match(server,/researcher\?db\.customers\.filter/);
 assert.match(server,/websiteDemos:researcher\?\{\}/);
 assert.match(server,/users:\['owner','manager'\]\.includes/);
 assert.match(server,/api\/v9\/bootstrap/);
 assert.match(server,/api\/v9\/lead-verification/);
 assert.match(server,/api\/v9\/time\/clock/);
 assert.ok(server.includes('sbcLornaRole(req.user)'));
 assert.match(server,/outside your assigned research queue/);
 assert.ok(server.includes('const mine=sbcLornaRole(req.user)'));
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
 console.log('[SBC V65.1.48] Lorna least-privilege patch regression PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}
