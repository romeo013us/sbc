'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6557_OWNER_FORCE_UNLOCK',FROM='65.1.56',TO='65.1.57';
function read(root,rel){const f=path.join(root,rel);if(!fs.existsSync(f))throw Error(MARKER+': missing '+rel);return fs.readFileSync(f,'utf8')}
function write(root,rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b)}
const LEASE_HELPER=[
"async function sbcV6557AcquireWriterLease(){",
" if(sbcWriterLeaseReady&&Number.isFinite(sbcWriterLeaseConnectionId))return true;",
" let candidate=null;",
" try{",
"  const mysqlLease=require('mysql2/promise');",
"  candidate=await mysqlLease.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||3306),connectTimeout:Number(process.env.SBC_DB_CONNECT_TIMEOUT_MS||10000),charset:'utf8mb4'});",
"  const [rows]=await candidate.query('SELECT GET_LOCK(?, 0) AS acquired, CONNECTION_ID() AS connectionId',[SBC_RUNTIME_WRITER_LOCK_NAME]);",
"  if(Number(rows&&rows[0]&&rows[0].acquired)!==1){try{await candidate.end()}catch{}return false}",
"  if(sbcWriterLeaseTimer){clearInterval(sbcWriterLeaseTimer);sbcWriterLeaseTimer=null}",
"  if(sbcWriterLeaseConn&&sbcWriterLeaseConn!==candidate){try{await sbcWriterLeaseConn.end()}catch{}}",
"  sbcWriterLeaseConn=candidate;sbcWriterLeaseConnectionId=Number(rows[0].connectionId);sbcWriterLeaseReady=true;",
"  SBC_RUNTIME_ROLE='writer';SBC_RUNTIME_READ_ONLY=false;process.env.SBC_RUNTIME_ROLE='writer';",
"  console.warn('[SBC V6557 OWNER FORCE UNLOCK] exclusive writer lease acquired by owner override.');",
"  sbcWriterLeaseTimer=setInterval(async()=>{try{const [[r]]=await sbcWriterLeaseConn.query('SELECT IS_USED_LOCK(?) AS owner',[SBC_RUNTIME_WRITER_LOCK_NAME]);if(Number(r&&r.owner)!==sbcWriterLeaseConnectionId)throw new Error('writer lease ownership changed');}catch(e){sbcWriterLeaseReady=false;MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';console.error('[SBC V6557 OWNER FORCE UNLOCK] writer lease lost; write protection re-engaged:',String(e&&e.message||e));clearInterval(sbcWriterLeaseTimer);sbcWriterLeaseTimer=null;}},10000);",
"  if(sbcWriterLeaseTimer.unref)sbcWriterLeaseTimer.unref();",
"  return true;",
" }catch(e){try{if(candidate)await candidate.end()}catch{}console.error('[SBC V6557 OWNER FORCE UNLOCK] writer lease acquisition failed:',String(e&&e.message||e));return false}",
"}"
].join('\n');
const FORCE_ROUTE=[
"app.post('/api/owner/recovery/force-unlock',auth,ownerOnly,async(req,res)=>{",
" try{",
"  if(String(req.body?.confirm||'')!=='FORCE-UNLOCK-ALL')return res.status(400).json({ok:false,error:'OWNER_CONFIRMATION_REQUIRED'});",
"  if(!mysqlPool)return res.status(503).json({ok:false,error:'MYSQL_UNAVAILABLE',message:'Cannot clear persistent locks without the authoritative MySQL connection.'});",
"  if(!sbcWriterLeaseReady){const acquired=await sbcV6557AcquireWriterLease();if(!acquired)return res.status(423).json({ok:false,error:'SBC_RUNTIME_WRITER_BUSY',message:'Another runtime currently owns the MySQL writer lease.'});}",
"  SBC_RUNTIME_ROLE='writer';SBC_RUNTIME_READ_ONLY=false;process.env.SBC_RUNTIME_ROLE='writer';",
"  process.env.ENABLE_DDL='true';SBC_DDL_ENABLED=true;",
"  SBC_OWNER_FORCE_UNLOCK_ACTIVE=true;MYSQL_RECOVERY_REQUIRED=false;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-relational';",
"  await ensureEnterpriseSchema();",
"  await mysqlPool.query('INSERT INTO sbc_settings(setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)',['sbc_owner_force_unlock_v6557','true']);",
"  await runSchemaMigrations();",
"  await ensureRevenueOSSchema();",
"  const unlockTenantId=requireRequestTenant(req);",
"  await mysqlPool.query('INSERT INTO sbc_revenue_control(tenant_id,global_kill,outbound_kill,sales_kill,fulfillment_kill,updated_by,updated_at) VALUES(?,0,0,0,0,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE global_kill=0,outbound_kill=0,sales_kill=0,fulfillment_kill=0,updated_by=VALUES(updated_by),updated_at=UTC_TIMESTAMP()',[unlockTenantId,req.user?.id||'owner']);",
"  await RUNTIME_GATE.ensureSchema();",
"  const stops=Object.fromEntries(PRODUCTION_HARDENING.KILL_STATES.map(k=>[k,false]));",
"  await RUNTIME_GATE.setKill(false,stops,req.user?.id||'owner');",
"  await readRelational();",
"  res.setHeader('Cache-Control','no-store');",
"  return res.json({ok:true,version:BUILD_VERSION,recoveryLockCleared:true,persisted:true,runtimeRole:SBC_RUNTIME_ROLE,readOnly:SBC_RUNTIME_READ_ONLY,ddlEnabled:SBC_DDL_ENABLED,writerLeaseReady:sbcWriterLeaseReady,operationalKillSwitchesCleared:true,message:'Owner force-unlock applied. Recovery/read-only/DDL gates, runtime kill switches, and tenant revenue/outbound/sales/fulfillment stops are cleared; the exclusive writer lease remains active.'});",
" }catch(e){return res.status(503).json({ok:false,error:'OWNER_FORCE_UNLOCK_FAILED',message:String(e?.message||e)});}",
"});"
].join('\n');
function patchServer(root){
 let s=read(root,'server.js');
 s=once(s,"app.use(createRecoveryWriteGuard({isRecoveryRequired:()=>!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED}));","app.use(createRecoveryWriteGuard({isRecoveryRequired:()=>!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED,allowPaths:['/api/owner/recovery/force-unlock']}));",'recovery middleware unlock allowlist');
 s=once(s,"if(req.path==='/api/login' || req.path==='/api/logout') return next();","if(req.path==='/api/login' || req.path==='/api/logout' || req.path==='/api/owner/recovery/force-unlock') return next();",'read-only middleware unlock allowlist');
 s=once(s,"const SBC_RUNTIME_ROLE = String(process.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase();","let SBC_RUNTIME_ROLE = String(process.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase();",'mutable runtime role');
 s=once(s,"const SBC_RUNTIME_READ_ONLY = SBC_RUNTIME_ROLE !== 'writer';","let SBC_RUNTIME_READ_ONLY = SBC_RUNTIME_ROLE !== 'writer';",'mutable read-only state');
 s=once(s,"let MYSQL_RECOVERY_EVALUATED = false;","let MYSQL_RECOVERY_EVALUATED = false;\nlet SBC_OWNER_FORCE_UNLOCK_ACTIVE = false;\n"+LEASE_HELPER,'force-unlock state/helper');
 const readOnlyAnchor="if(SBC_RUNTIME_READ_ONLY){\n      // SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL:";
 const leaseAnchor="    // SBC_V6528_RUNTIME_WRITER_LEASE: acquire exclusive lease before any DDL, migration, seed, repair, or worker write.\n    if(!SBC_RUNTIME_READ_ONLY){let leaseCandidate=null;try{";
 const overrideInit=[
"try{",
"      const [[ownerUnlockState]]=await mysqlPool.query('SELECT setting_value FROM sbc_settings WHERE setting_key=? LIMIT 1',['sbc_owner_force_unlock_v6557']);",
"      if(String(ownerUnlockState?.setting_value||'').trim().toLowerCase()==='true'){",
"        SBC_OWNER_FORCE_UNLOCK_ACTIVE=true;SBC_RUNTIME_ROLE='writer';SBC_RUNTIME_READ_ONLY=false;",
"        process.env.SBC_RUNTIME_ROLE='writer';process.env.ENABLE_DDL='true';SBC_DDL_ENABLED=true;",
"        MYSQL_RECOVERY_REQUIRED=false;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-relational';",
"        console.warn('[SBC V6557 OWNER FORCE UNLOCK] persisted owner override loaded.');",
"      }",
"    }catch{}",
"    "
].join('\n');
 if(s.includes(leaseAnchor))s=once(s,leaseAnchor,overrideInit+leaseAnchor,'persistent override before writer lease acquisition');
 else s=once(s,readOnlyAnchor,overrideInit+readOnlyAnchor,'persistent override startup load fallback');
 s=once(s,"if(Number(counts?.customers||0)<VERIFIED_PRE_CORRUPTION_CRM_COUNT){","if(!SBC_OWNER_FORCE_UNLOCK_ACTIVE&&Number(counts?.customers||0)<VERIFIED_PRE_CORRUPTION_CRM_COUNT){",'read-only baseline override');
 s=once(s,"if(relationalCoreCount > 0){","if(relationalCoreCount > 0 || SBC_OWNER_FORCE_UNLOCK_ACTIVE){",'core-empty override');
 s=once(s,"if(Number(countRows[0]?.customers||0) < VERIFIED_PRE_CORRUPTION_CRM_COUNT){","if(!SBC_OWNER_FORCE_UNLOCK_ACTIVE && Number(countRows[0]?.customers||0) < VERIFIED_PRE_CORRUPTION_CRM_COUNT){",'recovery baseline override');
 const seedAnchor="const leadMesh=await seedLeadMeshToMySQL();const seeded=seedStarterLeadPack();";
 if(s.includes(seedAnchor))s=once(s,seedAnchor,"const leadMesh=SBC_OWNER_FORCE_UNLOCK_ACTIVE?{added:0,skipped:0}:await seedLeadMeshToMySQL();const seeded=SBC_OWNER_FORCE_UNLOCK_ACTIVE?{added:0,skipped:0,removedDuplicates:0}:seedStarterLeadPack();",'skip auto-generated starter leads during force unlock');
 const routeAnchor="\n\n// V64.2.28 — SOVEREIGN RECOVERY CONTROL PLANE (READ-ONLY)";
 s=once(s,routeAnchor,"\n"+FORCE_ROUTE+routeAnchor,'owner force-unlock route');
 return s;
}
function patchApp(root,rel){
 let s=read(root,rel);
 if(s.includes('sbcV6557OwnerForceUnlockOnce'))throw Error(MARKER+': already patched '+rel);
 const bootAnchor='async function boot(){';
 const helper=[
"async function sbcV6557OwnerForceUnlockOnce(){",
" if(state.me?.role!=='owner')return;",
" try{",
"  if(localStorage.getItem('sbc-owner-force-unlock-v6557')==='done')return;",
"  const result=await api('/api/owner/recovery/force-unlock',{method:'POST',body:JSON.stringify({confirm:'FORCE-UNLOCK-ALL'}),timeoutMs:60000});",
"  if(result?.ok){localStorage.setItem('sbc-owner-force-unlock-v6557','done');console.info('[SBC V6557 OWNER FORCE UNLOCK]',result.message||'Operational locks cleared.');}",
" }catch(e){console.warn('[SBC V6557 OWNER FORCE UNLOCK]',String(e?.message||e));}",
"}",
""
].join('\n');
 s=once(s,bootAnchor,helper+bootAnchor,rel+' boot helper');
 const visibleAnchor="$('#login').classList.add('hidden');$('#app').classList.remove('hidden');await load();";
 s=once(s,visibleAnchor,"$('#login').classList.add('hidden');$('#app').classList.remove('hidden');if(state.me?.role==='owner')await sbcV6557OwnerForceUnlockOnce();await load();",rel+' owner boot call');
 return s;
}
function patchHtml(root,rel){let s=read(root,rel);if(s.includes(MARKER))throw Error(MARKER+': already patched '+rel);if(!s.includes('app.js?v='))throw Error(MARKER+': app script cache URL missing in '+rel);s=s.replace(/app\.js\?v=[^"'\s>]+/g,'app.js?v=65.1.57-owner-force-unlock');s=s.replace(/65\.1\.56/g,'65.1.57');s=once(s,'</head>','<!-- '+MARKER+': owner-authorized persistent operational unlock -->\n</head>',rel+' identity marker');write(root,rel,s)}
function apply(root){
 const pkg=JSON.parse(read(root,'package.json')),lock=JSON.parse(read(root,'package-lock.json'));
 if(pkg.name!=='sbc-business-command-center'||pkg.version!==FROM||lock.version!==FROM||lock.packages?.['']?.version!==FROM)throw Error(MARKER+': expected package/lock identity '+FROM);
 write(root,'server.js',patchServer(root));
 write(root,'public/app.js',patchApp(root,'public/app.js'));if(fs.existsSync(path.join(root,'browser_public/app.js')))write(root,'browser_public/app.js',patchApp(root,'browser_public/app.js'));
 patchHtml(root,'public/index.html');if(fs.existsSync(path.join(root,'browser_public/index.html')))patchHtml(root,'browser_public/index.html');
 let sw=read(root,'public/sw.js');if(!/const CACHE=['"][^'"]+['"]/.test(sw))throw Error(MARKER+': service-worker cache key missing');sw=sw.replace(/const CACHE=['"][^'"]+['"]/, "const CACHE='sbc-static-v65-1-57-owner-force-unlock'");if(!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)"))throw Error(MARKER+': service-worker cache purge guard missing');write(root,'public/sw.js',sw);
 if(fs.existsSync(path.join(root,'browser_public/sw.js'))){let b=read(root,'browser_public/sw.js');if(/const CACHE=['"][^'"]+['"]/.test(b))write(root,'browser_public/sw.js',b.replace(/const CACHE=['"][^'"]+['"]/, "const CACHE='sbc-static-v65-1-57-owner-force-unlock'"))}
 if(fs.existsSync(path.join(root,'config/release-identity.js'))){let id=read(root,'config/release-identity.js');id=once(id,"const RELEASE_VERSION = '65.1.56';","const RELEASE_VERSION = '65.1.57';",'release version');id=once(id,"const RELEASE_NAME = 'TWILIO_VOICE_SDK_V2_LOCAL_BUNDLE';","const RELEASE_NAME = 'OWNER_FORCE_UNLOCK_AND_OPERATIONAL_GATES';",'release name');id=id.replace('major:65,minor:1,patch:56','major:65,minor:1,patch:57');write(root,'config/release-identity.js',id)}
 if(fs.existsSync(path.join(root,'VERSION')))write(root,'VERSION',read(root,'VERSION').replace(/65\.1\.56/g,'65.1.57'));
 pkg.version=TO;pkg.description='SBC OS V65.1.57: owner force-unlock for recovery/read-only/DDL and operational kill switches with persistent override';
 pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6557-owner-force-unlock']='node hotfix-assets/v6557-owner-force-unlock-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6557-owner-force-unlock-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6557-owner-force-unlock-test.js';
 write(root,'package.json',JSON.stringify(pkg,null,2)+'\n');lock.version=TO;lock.packages[''].version=TO;lock.packages[''].description=pkg.description;lock.packages[''].scripts=pkg.scripts;write(root,'package-lock.json',JSON.stringify(lock,null,2)+'\n');
 const server=read(root,'server.js');if(!server.includes('MYSQL_RECOVERY_REQUIRED')||!server.includes('SBC_RUNTIME_WRITER_LOCK_NAME')||!server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED'))throw Error(MARKER+': core recovery/writer guard markers missing');
 const hd=path.join(root,'hotfix-assets');fs.mkdirSync(hd,{recursive:true});fs.copyFileSync(__filename,path.join(hd,'apply-v6557-owner-force-unlock.js'));
 const test=path.join(__dirname,'v6557-owner-force-unlock-test.js');if(!fs.existsSync(test))throw Error(MARKER+': regression test missing');fs.copyFileSync(test,path.join(hd,'v6557-owner-force-unlock-test.js'));
 return {marker:MARKER,version:TO,persistentOwnerForceUnlock:true,recoveryLatchClearable:true,operationalKillSwitchesClearable:true,readOnlyAndDdlGatesClearable:true,exclusiveWriterLeasePreserved:true};
}
module.exports={apply,MARKER,FROM,TO,patchServer,patchApp,patchHtml};
