'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const MARKER='SBC_V6521_ATOMIC_WEBHOOK_RECOVERY';
function replaceExactly(source,before,after,label){const a=source.split(before).length-1,b=source.split(after).length-1;if(a===0&&b===1)return source;if(a!==1||b!==0)throw new Error(`V65.1.21 patch stopped: ${label} anchor counts original=${a}, patched=${b}`);return source.replace(before,after);}
function apply(rootDir){
 const serverPath=path.join(rootDir,'server.js');let server=fs.readFileSync(serverPath,'utf8');
 if(server.includes(MARKER))return {version:'65.1.21',alreadyApplied:true};
 const routePath=path.join(rootDir,'routes','v65119-control-plane.js');let route=fs.readFileSync(routePath,'utf8');
 const broken="if(names.has('provider_event_id')&&!names.has('provider_event_id'))await pool.query('ALTER TABLE sbc_ops_webhook_ledger CHANGE COLUMN provider_event_id provider_event_id VARCHAR(190) NOT NULL');";
 const fixed="if(names.has('event_hash')&&!names.has('provider_event_id'))await pool.query('ALTER TABLE sbc_ops_webhook_ledger CHANGE COLUMN event_hash provider_event_id VARCHAR(190) NOT NULL');";
 route=replaceExactly(route,broken,fixed,'legacy webhook ledger column migration');
 // Keep the rendered operations cockpit aligned with the root release identity.
 server=server.replace('SUCCESSFUL BY CHOICE · V65.1.19','SUCCESSFUL BY CHOICE · V65.1.21');
 const oldExport='register._test={base32,unbase32,totp,verifyTotp,encryptSecret,decryptSecret,tenantFrom,canonicalWebhookStatusRank};';
 const newExport='register._test={base32,unbase32,totp,verifyTotp,encryptSecret,decryptSecret,tenantFrom,canonicalWebhookStatusRank,createController};';
 route=replaceExactly(route,oldExport,newExport,'test-only controller export');
 fs.writeFileSync(routePath,route);
 const early="  if(Array.isArray(job.seenEvents)&&job.seenEvents.includes(providerEventId))return {ok:true,ignored:'duplicate_event'};";
 server=replaceExactly(server,early,'  // V65.1.21: claim/check the durable ledger before consulting the persisted job replay list.','duplicate shortcut ordering');
 const claim="  if(durableClaim.duplicate)return {ok:true,ignored:'duplicate_event'};\n  const rankState=value=>global.__SBC_V65119_CONTROL_PLANE.statusRank(value);";
 const claimFixed="  if(durableClaim.duplicate)return {ok:true,ignored:'duplicate_event'};\n  // If the job state was saved but the process crashed before ledger completion, repair the claim.\n  if(Array.isArray(job.seenEvents)&&job.seenEvents.includes(providerEventId)){const repaired=await global.__SBC_V65119_CONTROL_PLANE.completeWebhookEvent({provider,eventId:providerEventId});if(!repaired?.ok||!repaired.affected)return {ok:false,error:repaired?.error||'DURABLE_WEBHOOK_LEDGER_REPAIR_FAILED'};return {ok:true,ignored:'duplicate_event_reconciled'};}\n  const rankState=value=>global.__SBC_V65119_CONTROL_PLANE.statusRank(value);";
 server=replaceExactly(server,claim,claimFixed,'repair already-persisted event before applying a second effect');
 server='// '+MARKER+'\n'+server;
 fs.writeFileSync(serverPath,server);
 // Keep the same release identity on package, lockfile and release identity module.
 const bump=spawnSync(process.execPath,[path.join(rootDir,'scripts','release-bump.js'),'65.1.21','ATOMIC-WEBHOOK-RECOVERY-AND-DISCOVERY','--apply'],{cwd:rootDir,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
 if(bump.status!==0)throw new Error('V65.1.21 release bump failed: '+String(bump.stderr||bump.stdout).slice(-2500));
 const pkgPath=path.join(rootDir,'package.json');const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));pkg.description='SBC OS V65.1.21 atomic webhook recovery and read-only schema discovery';pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6521-webhook-recovery']='node scripts/v6521-webhook-recovery-test.js';if(!String(pkg.scripts['test:all']||'').includes('v6521-webhook-recovery-test.js'))pkg.scripts['test:all']=(pkg.scripts['test:all']?pkg.scripts['test:all']+' && ':'')+'node scripts/v6521-webhook-recovery-test.js';fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
 const lockPath=path.join(rootDir,'package-lock.json');if(fs.existsSync(lockPath)){const l=JSON.parse(fs.readFileSync(lockPath,'utf8'));l.version='65.1.21';if(l.packages?.[''])l.packages[''].version='65.1.21';fs.writeFileSync(lockPath,JSON.stringify(l,null,2)+'\n');}
 const testAsset=path.join(__dirname,'v6521-webhook-recovery-test.js');if(!fs.existsSync(testAsset))throw new Error('V65.1.21 test asset missing');const testTarget=path.join(rootDir,'scripts','v6521-webhook-recovery-test.js');fs.copyFileSync(testAsset,testTarget);
 for(const file of [serverPath,routePath,testTarget]){const r=spawnSync(process.execPath,['--check',file],{cwd:rootDir,encoding:'utf8',timeout:30000});if(r.status!==0)throw new Error('V65.1.21 syntax failed '+path.relative(rootDir,file)+': '+String(r.stderr||r.stdout).slice(-2000));}
 const run=spawnSync(process.execPath,[testTarget],{cwd:rootDir,encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});if(run.status!==0)throw new Error('V65.1.21 webhook regression failed: '+String(run.stderr||run.stdout).slice(-3000));
 console.log(String(run.stdout||'').trim());console.log('[SBC V65.1.21] atomic webhook recovery patch PASS; live database untouched.');
 return {version:'65.1.21',webhookCrashRecovery:true,productionMutation:'BLOCKED'};
}
module.exports={apply,MARKER};
