'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6557-unlock-'));
function put(rel,s){const f=path.join(dir,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(rel){return fs.readFileSync(path.join(dir,rel),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.56',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.56',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.56',scripts:{}}}}));
 put('public/index.html','<html><head><script src="/app.js?v=65.1.56-voice-sdk-v2-local"></script></head><body>V65.1.56</body></html>');
 put('browser_public/index.html','<html><head><script src="/app.js?v=65.1.56-voice-sdk-v2-local"></script></head><body>V65.1.56</body></html>');
 const app="const state={me:null};async function api(){}async function boot(){$('#login').classList.add('hidden');$('#app').classList.remove('hidden');await load();}";
 put('public/app.js',app);put('browser_public/app.js',app);
 put('public/sw.js',"const CACHE='sbc-static-v65-1-56-twilio-sdk-v2-local';const keys=await caches.keys();keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE);");
 put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-56-twilio-sdk-v2-local';");
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.56'; const RELEASE_NAME = 'TWILIO_VOICE_SDK_V2_LOCAL_BUNDLE'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:56});");
 put('VERSION','V65.1.56');
 const server=[
"const SBC_RUNTIME_ROLE = String(process.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase();",
"const SBC_RUNTIME_READ_ONLY = SBC_RUNTIME_ROLE !== 'writer';",
"let sbcWriterLeaseConn=null,sbcWriterLeaseConnectionId=null,sbcWriterLeaseReady=false,sbcWriterLeaseTimer=null;",
"let mysqlPool={query:async()=>[[{setting_value:'true'}]]};",
"let MYSQL_RECOVERY_REQUIRED=false;",
"let MYSQL_RECOVERY_EVALUATED=false;",
"let SBC_DDL_ENABLED=false,storageMode='mysql-recovery-required';",
"const SBC_RUNTIME_WRITER_LOCK_NAME='sbc:runtime:writer:v1';",
"const VERIFIED_PRE_CORRUPTION_CRM_COUNT=248;",
"app.use(createRecoveryWriteGuard({isRecoveryRequired:()=>!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED}));",
"app.use((req,res,next)=>{if(!SBC_RUNTIME_READ_ONLY || !String(req.path||'').startsWith('/api/') || !['POST','PUT','PATCH','DELETE'].includes(String(req.method||'').toUpperCase())) return next();if(req.path==='/api/login' || req.path==='/api/logout') return next();return res.status(423).json({error:'SBC_READ_ONLY_RUNTIME'});});",
"async function initMysql(){",
" if(SBC_RUNTIME_READ_ONLY){",
"      // SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL:",
"      if(Number(counts?.customers||0)<VERIFIED_PRE_CORRUPTION_CRM_COUNT){MYSQL_RECOVERY_REQUIRED=true;storageMode='mysql-recovery-required';}",
" }",
" if(relationalCoreCount > 0){",
"      if(Number(countRows[0]?.customers||0) < VERIFIED_PRE_CORRUPTION_CRM_COUNT){MYSQL_RECOVERY_REQUIRED=true;storageMode='mysql-recovery-required';return true;}",
" }else{throw new Error('empty');}",
"}",
"app.get('/api/owner/recovery/status',auth,ownerOnly,async(req,res)=>{res.json({ok:true});});",
"",
"// V64.2.28 — SOVEREIGN RECOVERY CONTROL PLANE (READ-ONLY)"
].join('\n');
 put('server.js',server);
 put('hotfix-assets/v6557-owner-force-unlock-test.js','// placeholder');
 const r=require('./apply-v6557-owner-force-unlock.js').apply(dir);
 assert.equal(r.version,'65.1.57');assert.equal(r.persistentOwnerForceUnlock,true);assert.equal(r.exclusiveWriterLeasePreserved,true);
 const srv=get('server.js');assert.match(srv,/let SBC_RUNTIME_ROLE/);assert.match(srv,/let SBC_RUNTIME_READ_ONLY/);assert.match(srv,/sbc_owner_force_unlock_v6557/);assert.match(srv,/app\.post\('\/api\/owner\/recovery\/force-unlock'/);assert.match(srv,/RUNTIME_GATE\.setKill\(false,stops/);assert.match(srv,/if\(relationalCoreCount > 0 \|\| SBC_OWNER_FORCE_UNLOCK_ACTIVE\)/);assert.match(srv,/if\(!SBC_OWNER_FORCE_UNLOCK_ACTIVE && Number\(countRows/);
 for(const f of ['public/app.js','browser_public/app.js']){assert.match(get(f),/sbcV6557OwnerForceUnlockOnce/);assert.match(get(f),/\/api\/owner\/recovery\/force-unlock/);}
 for(const f of ['public/index.html','browser_public/index.html'])assert.match(get(f),/65\.1\.57-owner-force-unlock/);
 assert.match(get('public/sw.js'),/sbc-static-v65-1-57-owner-force-unlock/);assert.equal(JSON.parse(get('package.json')).version,'65.1.57');assert.match(get('config/release-identity.js'),/OWNER_FORCE_UNLOCK_AND_OPERATIONAL_GATES/);
 console.log('[SBC V65.1.57 OWNER FORCE-UNLOCK PATCH] PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
