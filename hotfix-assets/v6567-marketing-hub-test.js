'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6567-marketing-'));
function put(rel,s){const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
function get(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
try{
 put('package.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.65',scripts:{'test:all':'node bootstrap.js --verify'}}));
 put('package-lock.json',JSON.stringify({name:'sbc-business-command-center',version:'65.1.65',lockfileVersion:3,packages:{'':{name:'sbc-business-command-center',version:'65.1.65',scripts:{}}}}));
 put('server.js',"const MYSQL_RECOVERY_REQUIRED=true;const MYSQL_RECOVERY_EVALUATED=true;const SBC_RUNTIME_READ_ONLY=false;const SBC_RUNTIME_WRITER_LEASE_REQUIRED=true;let sbcWriterLeaseReady=true;const mysqlPool={};function auth(){}function ownerOnly(){}function requireRequestTenant(){}function secretValue(){}function vaultSecret(){}app.get('/api/kim/v329/summary',auth,kimV329Gate,async(req,res)=>{});async function authHandler(req,res,next){try{sessionUser(req)}catch(e){if(e?.code==='SESSION_STORE_UNAVAILABLE') return res.status(503).json({error:'Session validation temporarily unavailable.',code:'SESSION_STORE_UNAVAILABLE',retryable:true,requestId:req.requestId||null});}}");
 put('enterprise/session-store.js',[
 "const V452={cacheSet(){return Promise.resolve()},cacheGet(){return Promise.resolve(null)}};",
 "function createSessionStore({sessionSecret,mysqlPool,getRedisClient,isRedisReady,getUsers,jwtVerify,tenantDefaultId=1,ttlMs=604800000,logger=console}){",
 "const persistTimeoutMs=5000;",
 "const withTimeout=(promise,ms)=>Promise.resolve(promise);",
 "const mysqlQuery=(sql,params=[])=>mysqlPool.query({sql,timeout:persistTimeoutMs},params);",
 "function sessionHash(token){return String(token)}",
 "function sessionRedisKey(token){return String(token)}",
 "  async function sessionUser(req){",
 "    const token='token';let rec=null;const redis=getRedisClient();",
 "    if(!rec&&mysqlPool){try{const [rows]=await withTimeout(mysqlQuery('SELECT user_id,UNIX_TIMESTAMP(created_at)*1000 AS created_ms,UNIX_TIMESTAMP(expires_at)*1000 AS expires_ms,UNIX_TIMESTAMP(last_seen_at)*1000 AS last_seen_ms FROM sbc_sessions WHERE token_hash=? AND expires_at>=UTC_TIMESTAMP() LIMIT 1',[sessionHash(token)]),persistTimeoutMs+250);if(rows[0]){rec={createdAt:Number(rows[0].created_ms),userId:rows[0].user_id,tenantId:tenantDefaultId,expiresAt:Number(rows[0].expires_ms)};try{const [br]=await withTimeout(mysqlQuery('SELECT role FROM sbc_session_bindings WHERE token_hash=? LIMIT 1',[sessionHash(token)]),persistTimeoutMs+250);rec.role=String(br[0]?.role||'')}catch(e){logger.warn('[SBC AUTH] session role binding read:',e.message)}if(isRedisReady()&&redis){const ttl=Math.max(1,Math.ceil((rec.expiresAt-Date.now())/1000));redis.set(sessionRedisKey(token),JSON.stringify(rec),{EX:ttl}).catch(()=>{})}withTimeout(mysqlQuery('UPDATE sbc_sessions SET last_seen_at=UTC_TIMESTAMP() WHERE token_hash=?',[sessionHash(token)]),persistTimeoutMs+250).catch(()=>{})}}catch(e){logger.warn('[SBC AUTH] durable session read unavailable:',e.message);const unavailable=new Error('Session store temporarily unavailable.');unavailable.code='SESSION_STORE_UNAVAILABLE';throw unavailable}}",
 "    if(!rec)return null;",
 "  }",
 "}"].join('\n'));
 put('public/index.html','<html><head><title>SBC</title></head><body><aside class="sidebar"><nav></nav></aside><main></main></body></html>');
 put('browser_public/index.html','<html><head></head><body>Browser shell</body></html>');
 put('public/sw.js',"const CACHE='sbc-static-v65-1-65';");
 put('browser_public/sw.js',"const CACHE='sbc-static-v65-1-65';");
 put('config/release-identity.js',"const RELEASE_VERSION = '65.1.64'; const RELEASE_NAME = 'DASHBOARD_LAYOUT_STABILITY'; const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:64});");
 put('VERSION','65.1.65');
 put('enterprise/v567-nine-nine.js',"const ACTIVE_PACKAGE_RELEASE='65.1.65'; const COMPATIBLE_PACKAGE_RELEASES=Object.freeze(new Set(['65.1.65']));");
 const r=require('./apply-v6567-marketing-hub.js').apply(root);
 assert.equal(r.version,'65.1.66');assert.equal(r.contentStudio,true);assert.equal(r.approvalQueue,true);assert.equal(r.livePublishingEnabled,false);assert.equal(r.recoveryAndWriterGuardsPreserved,true);
 for(const rel of ['public/index.html','browser_public/index.html']){assert.match(get(rel),/sbc-v6567-marketing-hub\.css\?v=65\.1\.66/);assert.match(get(rel),/sbc-v6567-marketing-hub\.js\?v=65\.1\.66/);assert.match(get(rel),/SBC_V6567_MARKETING_HUB/)}
 assert.match(get('enterprise/session-store.js'),/SBC_V6567_SESSION_BACKPRESSURE/);assert.match(get('enterprise/session-store.js'),/MAX_SESSION_READS/);assert.match(get('enterprise/session-store.js'),/durableReadInFlight/);assert.doesNotMatch(get('enterprise/session-store.js'),/SELECT role FROM sbc_session_bindings WHERE token_hash/);assert.match(get('server.js'),/Retry-After/);assert.match(get('server.js'),/SBC_V6567_MARKETING_API/);assert.match(get('server.js'),/sbc_marketing_content/);assert.match(get('server.js'),/MARKETING_WRITER_GATE_CLOSED/);assert.match(get('server.js'),/MARKETING_PUBLISHING_DISABLED/);
 assert.match(get('public/sbc-v6567-marketing-hub.js'),/Content Studio/);assert.match(get('public/sbc-v6567-marketing-hub.js'),/api\/ai\/chat/);assert.match(get('public/sbc-v6567-marketing-hub.js'),/Draft with Kim/);assert.match(get('public/sbc-v6567-marketing-hub.js'),/Approval Queue/);assert.match(get('public/sbc-v6567-marketing-hub.js'),/publishing remains disabled/i);assert.match(get('public/sw.js'),/sbc-static-v65-1-66-marketing-hub/);assert.equal(JSON.parse(get('package.json')).version,'65.1.66');assert.equal(JSON.parse(get('package-lock.json')).packages[''].version,'65.1.66');assert.match(get('config/release-identity.js'),/RELEASE_VERSION = '65\.1\.66'/);assert.match(get('enterprise/v567-nine-nine.js'),/ACTIVE_PACKAGE_RELEASE='65\.1\.66'/);assert.match(get('enterprise/v567-nine-nine.js'),/COMPATIBLE_PACKAGE_RELEASES=Object\.freeze\(new Set\(\['65\.1\.66'/);
 cp.execFileSync(process.execPath,['--check',path.join(__dirname,'apply-v6567-marketing-hub.js')]);cp.execFileSync(process.execPath,['--check',path.join(__dirname,'v6567-marketing-hub.js')]);cp.execFileSync(process.execPath,['--check',path.join(__dirname,'v6567-marketing-runtime-patch.js')]);
 console.log('[SBC V65.1.66] bounded session reads, durable marketing API, asset injection, release identity, and publishing guard tests PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}
