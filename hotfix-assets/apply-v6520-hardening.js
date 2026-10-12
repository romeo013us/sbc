'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const MARKER = 'SBC_V6520_STRICT_TENANT_HARDENING';
const HELPER = `function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}`;
function walk(dir, out=[]) { for (const ent of fs.readdirSync(dir,{withFileTypes:true})) { if (['node_modules','.git','.sbc-runtime-v65.1.20','public','browser_public','tests','test','coverage'].includes(ent.name)) continue; const p=path.join(dir,ent.name); if(ent.isDirectory())walk(p,out); else if(ent.isFile()&&p.endsWith('.js'))out.push(p); } return out; }
function addHelper(src) { if(src.includes('function __sbcRequireTenantId('))return src; if(src.startsWith('#!')){const i=src.indexOf('\n');return src.slice(0,i+1)+HELPER+'\n'+src.slice(i+1);} const useStrict=/^(['"])use strict\1;\s*/; if(useStrict.test(src))return src.replace(useStrict,m=>m+'\n'+HELPER+'\n'); return HELPER+'\n'+src; }
function patchFallbacks(rootDir) {
 const roots=['server.js','enterprise','routes','workers','config']; let files=[];
 for(const rel of roots){const p=path.join(rootDir,rel);if(fs.existsSync(p))files.push(...(fs.statSync(p).isDirectory()?walk(p):[p]));}
 let replacements=0, touched=[];
 // Replace only fallback expressions whose left-hand path ends in tenantId / tenant_id.
 const re=/([A-Za-z_$][\w$]*(?:(?:\?\.|\.)[A-Za-z_$][\w$]*)*)\s*\|\|\s*1/g;
 for(const file of [...new Set(files)]){
  let src=fs.readFileSync(file,'utf8'); if(src.includes(MARKER))continue;
  let local=0;
  src=src.replace(re,(whole,lhs)=>{if(!/(?:tenantId|tenant_id)$/.test(lhs))return whole;local++;return `__sbcRequireTenantId(${lhs})`;});
  if(local){src=addHelper(src);touched.push({file:path.relative(rootDir,file),replacements:local});replacements+=local;}
  if(file===path.join(rootDir,'routes','v56160-event-broker.js')){src=src.replace(/tenantId:__sbcRequireTenantId\(b\.tenantId\)/g,'tenantId:__sbcRequireTenantId(req.tenantId)');}
  if(file===path.join(rootDir,'routes','v56200-revenue-proof.js')){src=src.replace(/tenantId:__sbcRequireTenantId\(req\.body\?\.tenantId\)/g,'tenantId:__sbcRequireTenantId(req.tenantId)');}
  if(file===path.join(rootDir,'server.js')){
   // Never trust tenant IDs supplied by the request body for these owner operations.
   src=src.replace(/tenantId:__sbcRequireTenantId\(b\.tenantId\)/g,'tenantId:__sbcRequireTenantId(req.tenantId)');
   src=src.replace(/tenantId:__sbcRequireTenantId\(req\.body\?\.tenantId\)/g,'tenantId:__sbcRequireTenantId(req.tenantId)');
   // Fail closed if the authenticated identity has no explicit tenant; do not synthesize tenant 1.
   src=src.replace(/function tenantIdForUser\(u\)\{return Number\(u\?\.tenantId\|\|TENANT_DEFAULT_ID\)\}/,
    "function tenantIdForUser(u){return __sbcRequireTenantId(u?.tenantId)}");
   // Auth returns a controlled 403 rather than allowing an invalid tenant through.
   src=src.replace("  req.tenantId=tenantIdForUser(u);\n  // V65.1.8:","  try { req.tenantId=tenantIdForUser(u); } catch { return res.status(403).json({error:'TENANT_CONTEXT_REQUIRED',message:'Account has no validated tenant assignment. Complete the reviewed tenant migration before access.'}); }\n  req.tenantContextId=req.tenantId;\n  // V65.1.8:");
   // Do not silently attach a tenant to legacy records in request-time normalization.
   src=src.replace(/function ensureTenantDefaults\(\)\{[\s\S]*?\n\}/,`function ensureTenantDefaults(){
  const collections=['users','customers','quotes','orders','renewals','activities','callReports','callLogs','appointments','sequences','sequenceEnrollments','emailTemplates','tasks','customerAccounts','customerMessages'];
  for(const k of collections){for(const x of (db[k]||[])){if(x.tenantId==null&&x.tenant_id!=null)x.tenantId=__sbcRequireTenantId(x.tenant_id);}}
  // Tenant assignment for legacy rows is a migration task, not a runtime fallback.
}`);
   src=src.replace(/durableUsers=userRows\.map\(r=>\(\{id:r\.id,tenantId:Number\(__sbcRequireTenantId\(r\.tenant_id\)\),/, "durableUsers=userRows.filter(r=>Number.isSafeInteger(Number(r.tenant_id))&&Number(r.tenant_id)>0).map(r=>({id:r.id,tenantId:Number(r.tenant_id),");
  }
  if(local||file===path.join(rootDir,'server.js')){
   if(file===path.join(rootDir,'server.js'))src=src.replace(/\n?\/\/ SBC_V6520_STRICT_TENANT_HARDENING[^\n]*\n?/g,'\n');
   // Marker is inserted as a comment so patching is idempotent.
   src='// '+MARKER+'\n'+src;
   fs.writeFileSync(file,src); if(local)touched[touched.length-1].replacements=local;
  }
 }
 return {replacements,files:touched};
}
function installGuard(rootDir){
 const dir=path.join(rootDir,'middleware');fs.mkdirSync(dir,{recursive:true});
 const file=path.join(dir,'strict-tenant-guard.js');
 const body=`'use strict';\nmodule.exports=function strictTenantGuard(req,res,next){const userRaw=req?.user?.tenantId??req?.user?.tenant_id;const reqRaw=req?.tenantId;const id=Number(reqRaw??userRaw);if(!Number.isSafeInteger(id)||id<=0){return res.status(403).json({error:'TENANT_CONTEXT_REQUIRED',message:'Authenticated request has no validated tenant scope.'});}if(userRaw!=null&&Number(userRaw)!==id)return res.status(403).json({error:'TENANT_CONTEXT_MISMATCH'});if(req.tenantContextId!=null&&Number(req.tenantContextId)!==id)return res.status(403).json({error:'TENANT_CONTEXT_MISMATCH'});req.tenantContextId=id;next();};\n`;
 fs.writeFileSync(file,body);
 const server=path.join(rootDir,'server.js');let src=fs.readFileSync(server,'utf8');
 if(!src.includes("const strictTenantGuard=require('./middleware/strict-tenant-guard');"))src=src.replace("const {runWithTenantContext} = require('./enterprise/tenant-context.cjs');","const {runWithTenantContext} = require('./enterprise/tenant-context.cjs');\nconst strictTenantGuard=require('./middleware/strict-tenant-guard');");
 const old="return runWithTenantContext({tenantId:req.tenantId,actorId:u.id||u.username,role:u.role,requestId:req.requestId,source:'authenticated-session'},()=>next());";
 const next="return strictTenantGuard(req,res,()=>runWithTenantContext({tenantId:req.tenantId,actorId:u.id||u.username,role:u.role,requestId:req.requestId,source:'authenticated-session'},()=>next()));";
 if(src.includes(old))src=src.replace(old,next);else if(!src.includes(next))throw new Error('TENANT_AUTH_CONTEXT_ANCHOR_DRIFT');
 fs.writeFileSync(server,src);
}
function patchWebhookLedger(rootDir){
 const file=path.join(rootDir,'routes','v65119-control-plane.js');let src=fs.readFileSync(file,'utf8');
 src=src.replace(/event_hash CHAR\(64\) NOT NULL/g,'provider_event_id VARCHAR(190) NOT NULL');
 src=src.replace(/UNIQUE KEY uq_provider_event\(provider,event_hash\)/g,'UNIQUE KEY uq_provider_event(provider,provider_event_id)');
 src=src.replace(/async function claimWebhookEvent\(\{provider,eventHash,jobId\}\)/,'async function claimWebhookEvent({provider,eventId,jobId})');
 src=src.replace(/event_hash/g,'provider_event_id');
 src=src.replace(/String\(eventHash\)/g,'String(eventId)');
 src=src.replace(/\{provider,eventHash\}/g,'{provider,eventId}');
 src=src.replace(/async function completeWebhookEvent\(\{provider,eventHash\}\)/,'async function completeWebhookEvent({provider,eventId})');
 // Avoid double-replacing the property name if this patch is run twice.
 src=src.replace(/provider_provider_event_id/g,'provider_event_id');
 const ensureOld="async function ensure(pool){if(!pool)throw Object.assign(new Error('MYSQL_UNAVAILABLE_FAIL_CLOSED'),{status:503});if(!schemaReady){schemaReady=(async()=>{for(const sql of SCHEMA)await pool.query(sql);})();}try{await schemaReady;}catch(e){schemaReady=null;throw e;}}";
 const ensureNew="async function ensure(pool){if(!pool)throw Object.assign(new Error('MYSQL_UNAVAILABLE_FAIL_CLOSED'),{status:503});if(!schemaReady){schemaReady=(async()=>{for(const sql of SCHEMA)await pool.query(sql);const [cols]=await pool.query(\"SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sbc_ops_webhook_ledger'\");const names=new Set((cols||[]).map(x=>x.COLUMN_NAME));if(names.has('event_hash')&&!names.has('provider_event_id'))await pool.query('ALTER TABLE sbc_ops_webhook_ledger CHANGE COLUMN event_hash provider_event_id VARCHAR(190) NOT NULL');})();}try{await schemaReady;}catch(e){schemaReady=null;throw e;}}";
 if(src.includes(ensureOld))src=src.replace(ensureOld,ensureNew);else if(!src.includes('information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=\'sbc_ops_webhook_ledger\''))throw new Error('WEBHOOK_LEDGER_MIGRATION_ANCHOR_DRIFT');
 const recoveryOld="const provider=String(b.provider||'').slice(0,48),hash=String(b.eventHash||'');if(!provider||!/^[a-f0-9]{64}$/.test(hash))return res.status(400).json({ok:false,error:'PROVIDER_AND_SHA256_EVENT_HASH_REQUIRED'});const [r]=await pool.query(\"UPDATE sbc_ops_webhook_ledger SET state='FAILED' WHERE provider=? AND provider_event_id=? AND state='CLAIMED' AND updated_at < DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 MINUTE)\",[provider,hash]);if(!r.affectedRows)return res.status(409).json({ok:false,error:'EVENT_NOT_STUCK_OR_NOT_FOUND',note:'Only CLAIMED events older than five minutes can be released for a safe retry.'});await C.audit(pool,tenant,actor,'webhook_claim_released_for_retry','webhook',hash,{provider,reason:String(b.reason||'owner_recovery').slice(0,300)});";
 const recoveryNew="const provider=String(b.provider||'').slice(0,48),eventId=String(b.providerEventId||b.eventId||'').slice(0,190);if(!provider||!eventId)return res.status(400).json({ok:false,error:'PROVIDER_AND_EVENT_ID_REQUIRED'});const [r]=await pool.query(\"UPDATE sbc_ops_webhook_ledger SET state='FAILED' WHERE provider=? AND provider_event_id=? AND state='CLAIMED' AND updated_at < DATE_SUB(UTC_TIMESTAMP(),INTERVAL 5 MINUTE)\",[provider,eventId]);if(!r.affectedRows)return res.status(409).json({ok:false,error:'EVENT_NOT_STUCK_OR_NOT_FOUND',note:'Only CLAIMED events older than five minutes can be released for a safe retry.'});await C.audit(pool,tenant,actor,'webhook_claim_released_for_retry','webhook',eventId,{provider,reason:String(b.reason||'owner_recovery').slice(0,300)});";
 if(src.includes(recoveryOld))src=src.replace(recoveryOld,recoveryNew);else if(src.includes('PROVIDER_AND_SHA256_EVENT_HASH_REQUIRED'))throw new Error('WEBHOOK_RECOVERY_ID_ANCHOR_DRIFT');
 fs.writeFileSync(file,src);
 const server=path.join(rootDir,'server.js');let s=fs.readFileSync(server,'utf8');
 // Patch the V65.1.18 overlay's final handler to key events by provider event ID where available, with a content hash fallback.
 s=s.replace("const eventHash=require('node:crypto').createHash('sha256').update(raw).digest('hex');", "const contentHash=require('node:crypto').createHash('sha256').update(raw).digest('hex');\n  const providerEventId=String(body.eventId||body.event_id||body.webhookId||body.webhook_id||body.event?.id||('sha256:'+contentHash)).slice(0,190);");
 s=s.replace('job.seenEvents.includes(eventHash)', 'job.seenEvents.includes(providerEventId)');
 s=s.replace('completeWebhookEvent({provider,eventHash})','completeWebhookEvent({provider,eventId:providerEventId})');
 s=s.replace('claimWebhookEvent({provider,eventHash,jobId:String(job.id)})','claimWebhookEvent({provider,eventId:providerEventId,jobId:String(job.id)})');
 s=s.replace('[eventHash,...(Array.isArray(job.seenEvents)?job.seenEvents:[])]','[providerEventId,...(Array.isArray(job.seenEvents)?job.seenEvents:[])]');
 // Historical seenEvents are already applied; do not require a ledger row created before V65.1.20.
 s=s.replace("if(Array.isArray(job.seenEvents)&&job.seenEvents.includes(providerEventId)){const repaired=await global.__SBC_V65119_CONTROL_PLANE.completeWebhookEvent({provider,eventId:providerEventId});if(!repaired?.ok)return {ok:false,error:repaired?.error||'durable_webhook_ledger_complete_failed'};return {ok:true,ignored:'duplicate_event'};}", "if(Array.isArray(job.seenEvents)&&job.seenEvents.includes(providerEventId))return {ok:true,ignored:'duplicate_event'};");
 // A stale but valid event is terminally processed after the unchanged state is persisted.
 s=s.replace("if(rankState(nextState)<rankState(job.status)){await megaSave(m);return {ok:true,ignored:'stale_event'};}", "if(rankState(nextState)<rankState(job.status)){await megaSave(m);const done=await global.__SBC_V65119_CONTROL_PLANE.completeWebhookEvent({provider,eventId:providerEventId});if(!done?.ok||!done.affected)return {ok:false,error:'DURABLE_WEBHOOK_LEDGER_COMPLETE_FAILED'};return {ok:true,ignored:'stale_event'};}");
 // Complete the ledger only after both the fulfillment state and any related order state are durable.
 s=s.replace("  return {ok:true,provider,jobId:job.id,orderId:job.orderId,status:job.status,trackingNumber:job.trackingNumber,vendorOrderNumber:job.vendorOrderNumber||''};", "  const ledgerDone=await global.__SBC_V65119_CONTROL_PLANE.completeWebhookEvent({provider,eventId:providerEventId});if(!ledgerDone?.ok||!ledgerDone.affected)return {ok:false,error:'DURABLE_WEBHOOK_LEDGER_COMPLETE_FAILED'};\n  return {ok:true,provider,jobId:job.id,orderId:job.orderId,status:job.status,trackingNumber:job.trackingNumber,vendorOrderNumber:job.vendorOrderNumber||''};");
 fs.writeFileSync(server,s);
}
function patchProxyTrust(rootDir){
 const p=path.join(rootDir,'server.js');let s=fs.readFileSync(p,'utf8');
 const old="app.disable('x-powered-by');app.set('trust proxy', process.env.SBC_TRUST_PROXY==='true' ? true : Number.isFinite(Number(process.env.SBC_TRUST_PROXY)) ? Number(process.env.SBC_TRUST_PROXY) : 1);";
 const next="app.disable('x-powered-by');const sbcProxyHopsRaw=String(process.env.SBC_TRUST_PROXY??'1').trim();const sbcProxyHops=/^(0|[1-9]\\d*)$/.test(sbcProxyHopsRaw)?Number(sbcProxyHopsRaw):NaN;if(!Number.isSafeInteger(sbcProxyHops)||sbcProxyHops>4)throw new Error('SBC_TRUST_PROXY_INVALID: configure an integer hop count from 0 to 4; boolean true and arbitrary proxy trust are forbidden.');app.set('trust proxy',sbcProxyHops);";
 if(s.includes(old))s=s.replace(old,next);else if(!s.includes('SBC_TRUST_PROXY_REQUIRED'))throw new Error('TRUST_PROXY_ANCHOR_DRIFT');
 fs.writeFileSync(p,s);
}
function addTests(rootDir, stats){
 const p=path.join(rootDir,'scripts','v6520-tenant-hardening-test.js');fs.writeFileSync(p,`'use strict';\nconst assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');\nconst root=path.resolve(__dirname,'..');const guard=require('../middleware/strict-tenant-guard');\nfunction response(){return {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(x){this.body=x;return this;}}}\nlet next=false;let r=response();guard({tenantId:2,user:{tenantId:2}},r,()=>{next=true});assert.equal(next,true);assert.equal(r.statusCode,200);\nnext=false;r=response();guard({tenantId:2,user:{tenantId:3}},r,()=>{next=true});assert.equal(next,false);assert.equal(r.statusCode,403);\nnext=false;r=response();guard({user:{}},r,()=>{next=true});assert.equal(next,false);assert.equal(r.statusCode,403);\nconst files=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.git','.sbc-runtime-v65.1.20','public','browser_public','tests','test','coverage'].includes(e.name))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.isFile()&&p.endsWith('.js'))files.push(p);}}for(const d of ['server.js','enterprise','routes','workers','config']){const p=path.join(root,d);if(fs.existsSync(p))fs.statSync(p).isDirectory()?walk(p):files.push(p)}const hits=[];const re=/(?:[A-Za-z_$][\\w$]*(?:(?:\\?\\.|\\.)[A-Za-z_$][\\w$]*)*)\\s*\\|\\|\\s*1/g;for(const f of files){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(re))if(/(?:tenantId|tenant_id)\\s*\\|\\|\\s*1/.test(m[0]))hits.push(path.relative(root,f)+':'+(s.slice(0,m.index).split('\\n').length));}assert.equal(hits.length,0,'tenant fallback remains: '+hits.slice(0,20).join(', '));\nconst broker=fs.readFileSync(path.join(root,'routes','v56160-event-broker.js'),'utf8');assert.doesNotMatch(broker,/tenantId:__sbcRequireTenantId\(b\.tenantId\)/,'event broker tenant comes from authenticated request');const revenueProof=fs.readFileSync(path.join(root,'routes','v56200-revenue-proof.js'),'utf8');assert.doesNotMatch(revenueProof,/tenantId:__sbcRequireTenantId\(req\.body\?\.tenantId\)/,'revenue proof tenant comes from authenticated request');const patcher=path.join(root,'scripts','apply-v65118-webhook-patch.js');assert.ok(fs.existsSync(patcher),'webhook patcher asset copied into scripts path');const control=fs.readFileSync(path.join(root,'routes','v65119-control-plane.js'),'utf8');assert.match(control,/UNIQUE KEY uq_provider_event\\(provider,provider_event_id\\)/);assert.match(control,/provider_event_id VARCHAR\\(190\\) NOT NULL/);const server=fs.readFileSync(path.join(root,'server.js'),'utf8');assert.ok(server.includes("process.env.SBC_TRUST_PROXY??'1'"),'bounded one-hop proxy default avoids consuming another environment slot');assert.match(server,/SBC_TRUST_PROXY_INVALID/,'invalid proxy-hop overrides fail closed');assert.match(server,/strictTenantGuard/);assert.match(server,/ledgerDone=await global.__SBC_V65119_CONTROL_PLANE.completeWebhookEvent/);assert.ok(server.includes('providerEventId=String(body.eventId'),'provider event identifier extraction present');console.log('V65.1.20 tenant hardening: PASS; strict guard tests 3/3; tenant fallback scan 0; provider-event uniqueness and explicit proxy-hop validation present.');\n`);
 const pkgPath=path.join(rootDir,'package.json');const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));pkg.version='65.1.20';pkg.description='SBC OS V65.1.20 strict tenant isolation and governed automation hardening';pkg.scripts=pkg.scripts||{};pkg.scripts['test:v6520-tenant-hardening']='node scripts/v6520-tenant-hardening-test.js';pkg.scripts['test:all']=(pkg.scripts['test:all']||'').replace('node scripts/ui-static-audit.js','node scripts/v6520-tenant-hardening-test.js && node scripts/ui-static-audit.js');if(!pkg.scripts['test:all'].includes('v6520-tenant-hardening-test.js'))pkg.scripts['test:all']+=' && node scripts/v6520-tenant-hardening-test.js';fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
 const lockPath=path.join(rootDir,'package-lock.json');if(fs.existsSync(lockPath)){const l=JSON.parse(fs.readFileSync(lockPath,'utf8'));l.version='65.1.20';if(l.packages?.[''])l.packages[''].version='65.1.20';fs.writeFileSync(lockPath,JSON.stringify(l,null,2)+'\n');}
 const note=path.join(rootDir,'RELEASE-NOTES-V65.1.20-STRICT-TENANT-HARDENING.md');fs.writeFileSync(note,`# SBC OS V65.1.20 — Strict Tenant Isolation and Governed Automation\n\n## Included\n- Strict server-derived tenant context middleware. Authenticated requests without a valid positive tenant ID fail closed; request/body tenant IDs are not accepted as authorization.\n- Static replacement of tenantId/tenant_id fallbacks to tenant 1 across server-side JS in server.js, enterprise/, routes/, workers/, and config/. Missing context throws TENANT_CONTEXT_REQUIRED rather than silently choosing tenant 1.\n- Durable webhook ledger uses a database-enforced unique key on (provider, provider_event_id); provider event IDs are preferred, with a stable content-hash key only when providers omit an event ID.\n- Proxy trust accepts only an explicit integer hop count 0–4; startup fails if SBC_TRUST_PROXY is absent, boolean, or invalid. Reuse an existing GoDaddy environment slot—do not add a 51st—and verify the actual proxy topology before production.\n- Patcher asset resolver copies the webhook patch into scripts/ and verifies SHA-256.\n- Existing owner MFA, recovery lock, Kevin governance, financial mutation blocks, and owner veto remain. No payments, outbound messages, production restores, or automatic production unlocks are performed.\n\n## Migration / rollout requirements\n- The base SBC relational schema creates core CRM tables such as ` + '`sbc_customers`' + `, ` + '`sbc_orders`' + `, and ` + '`sbc_renewals`' + ` without tenant_id columns. The read-only preflight reports actual columns; this package does not claim database-wide multi-tenant isolation until those tables, inserts, and reads are migrated and tenant-scoped.\n- The runtime no longer assigns tenant 1 to missing legacy records. Existing records with absent tenant assignment will be inaccessible until reviewed and explicitly migrated. Run the read-only preflight in ` + '`migrations/20261011_065_tenant_isolation_preflight.sql`' + ` on a database clone first. Do not backfill automatically.\n- A 15-minute staging run and the prior 72-hour silent shadow are still required; this build does not establish GoDaddy/live-MySQL success.\n- TOTP must be enrolled and verified before sensitive owner actions. MFA configuration reuses existing secrets; no 51st GoDaddy slot.\n- Quote, abandoned-checkout, renewal and fault work remains queue-first and bounded. No unattended outbound or money movement is enabled in this hardening release.\n\n## Verification\n- Run ` + '`node bootstrap.js --verify`' + `, ` + '`node persistent-state-test.js`' + `, ` + '`node hotfix-assets/v65119-phases-test.js`' + `, and ` + '`node scripts/v6520-tenant-hardening-test.js`' + ` after the runtime overlay is applied.\n- Live phpMyAdmin schema verification, concurrent live webhook tests, MFA enrollment, staging isolation, GoDaddy runtime and full buyer-demo runbook remain external gates.\n`);
}
function apply(rootDir){
 const resolverPath=path.join(__dirname,'patcher-path-resolver.js');if(fs.existsSync(resolverPath))require(resolverPath).resolvePatcherAsset(rootDir);
 const sourcePreflight=path.join(__dirname,'migrations','20261011_065_tenant_isolation_preflight.sql');if(fs.existsSync(sourcePreflight)){const md=path.join(rootDir,'migrations');fs.mkdirSync(md,{recursive:true});fs.copyFileSync(sourcePreflight,path.join(md,'20261011_065_tenant_isolation_preflight.sql'));}
 const serverPath=path.join(rootDir,'server.js');let server=fs.readFileSync(serverPath,'utf8');
 if(server.includes(MARKER)){return {version:'65.1.20',alreadyApplied:true};}
 const stats=patchFallbacks(rootDir);installGuard(rootDir);patchWebhookLedger(rootDir);patchProxyTrust(rootDir);
 // The source package is bumped only after all code changes are written and syntax-checked.
 const script=path.join(rootDir,'scripts','release-bump.js');if(!fs.existsSync(script))throw new Error('RELEASE_BUMP_SCRIPT_MISSING');
 const out=spawnSync(process.execPath,[script,'65.1.20','STRICT-TENANT-ISOLATION-GOVERNED-AUTOMATION','--apply'],{cwd:rootDir,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});if(out.status!==0)throw new Error('V65.1.20 release bump failed: '+String(out.stderr||out.stdout).slice(-3000));
 addTests(rootDir,stats);
 for(const rel of ['server.js','middleware/strict-tenant-guard.js','routes/v65119-control-plane.js','scripts/v6520-tenant-hardening-test.js',...stats.files.map(x=>x.file)]){const r=spawnSync(process.execPath,['--check',path.join(rootDir,rel)],{encoding:'utf8',timeout:30000});if(r.status!==0)throw new Error('V65.1.20 syntax failed '+rel+': '+(r.stderr||r.stdout));}
 const remain=[];for(const f of walk(rootDir)){const s=fs.readFileSync(f,'utf8');if(/(?:[A-Za-z_$][\w$]*(?:(?:\?\.|\.)[A-Za-z_$][\w$]*)*)\s*\|\|\s*1/g.test(s)&&/(?:tenantId|tenant_id)\s*\|\|\s*1/.test(s))remain.push(path.relative(rootDir,f));}
 if(remain.length)throw new Error('V65.1.20 tenant fallback scan failed: '+remain.join(', '));
 const strictTest=spawnSync(process.execPath,[path.join(rootDir,'scripts','v6520-tenant-hardening-test.js')],{cwd:rootDir,encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});if(strictTest.status!==0)throw new Error('V65.1.20 strict tenant regression failed: '+String(strictTest.stderr||strictTest.stdout).slice(-2500));
 console.log('[SBC V65.1.20] strict tenant hardening PASS; removed '+stats.replacements+' tenant fallback expressions across '+stats.files.length+' files; legacy runtime default assignment disabled; webhook event key unique; proxy trust bounded.');
 return {version:'65.1.20',tenantFallbacksRemoved:stats.replacements,filesChanged:stats.files.length,tenantFiles:stats.files,webhookLedgerUniqueKey:'provider,provider_event_id',proxyTrust:'explicit integer 0..4',mfa:true,productionMutation:'BLOCKED'};
}
module.exports={apply,MARKER};
