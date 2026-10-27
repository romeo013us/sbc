'use strict';
const fs=require('fs');const path=require('path');const crypto=require('crypto');const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const checks=[];const pass=(name,detail)=>checks.push({name,status:'PASS',detail});const fail=(name,detail)=>checks.push({name,status:'FAIL',detail});
function exists(rel){return fs.existsSync(path.join(root,rel));}
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8');}
function json(rel){return JSON.parse(read(rel));}
function assert(cond,name,detail){cond?pass(name,detail):fail(name,detail);}
const pkg=json('package.json');
const releaseIdentity = require('../config/release-identity');
assert(pkg.version===releaseIdentity.RELEASE_VERSION,'Release identity',`package.json declares V${pkg.version}`);
assert(exists('package-lock.json'),'Dependency lockfile','package-lock.json is required for reproducible GoDaddy dependency installation');
if(exists('package-lock.json')){
  try{
    const lock=json('package-lock.json');
    assert(lock.lockfileVersion>=2,'Dependency lock format',`lockfileVersion=${lock.lockfileVersion}`);
    assert(lock.packages?.['']?.version===pkg.version,'Locked package version',`lock declares ${lock.packages?.['']?.version||'missing'}`);
    const lockedDeps=lock.packages?.['']?.dependencies||{};
    const declaredDeps=pkg.dependencies||{};
    assert(Object.keys(declaredDeps).every(k=>lockedDeps[k]===declaredDeps[k]),'Locked direct dependencies','all package.json direct dependency ranges match package-lock.json');
  }catch(e){fail('Dependency lock validation',String(e.message||e));}
}
assert(pkg.scripts?.start==='node server.js','GoDaddy start contract','start = node server.js');
assert(pkg.engines?.node==='22.x','Node runtime contract','Node 22.x');
assert(exists('server.js'),'Production entrypoint','server.js present');
assert(exists('config/release-identity.js') && releaseIdentity.RELEASE_VERSION===pkg.version,'Authoritative runtime identity',`config/release-identity.js declares V${releaseIdentity.RELEASE_VERSION}`);
const required=['enterprise/sbc-enterprise-control-plane-v640.js','config/sbc-v640-enterprise.json','enterprise/kevin/kevin-runtime.cjs','migrations/20261008_064_v641_kevin_hardened_runtime.sql','public/sbc-god-tier.html','scripts/v640-release-integrity-test.js','scripts/v640-enterprise-control-plane-test.js','scripts/v641-hardened-runtime-test.js'];
for(const f of required) assert(exists(f),`Required V64 asset: ${f}`, 'present');
const server=read('server.js');
for(const n of ['sbc-enterprise-control-plane-v640','SBC_V640.start()','startKevinV6422','/api/release-identity']) assert(server.includes(n),`Server wiring: ${n}`,'present');
assert(server.includes("app.get('/livez'"),'Server safety: /livez','present');
assert(server.includes("app.get('/readyz'"),'Server safety: /readyz','present');
assert(exists('enterprise/integration/sbc-persistence-safety.cjs'),'Persistence safety helper','present');
assert(read('enterprise/integration/sbc-persistence-safety.cjs').includes('CRM_BULK_REWRITE_BLOCKED_SOURCE_EMPTY') && read('enterprise/integration/sbc-persistence-safety.cjs').includes('CRM_BULK_REWRITE_BLOCKED_PARTIAL_SOURCE'),'CRM partial/empty shrink shield','present');
assert(server.includes('ON DUPLICATE KEY UPDATE'),'Row-level upsert persistence','present');
assert(!server.includes('DELETE FROM sbc_customers') && !server.includes('DELETE FROM sbc_quotes') && !server.includes('DELETE FROM sbc_orders') && !server.includes('DELETE FROM sbc_renewals'),'No destructive core bulk rewrite','absent');
assert(!server.includes('db.customers=[]'),'Legacy startup CRM reset disabled','absent');
const cfg=json('config/sbc-v640-enterprise.json');
assert(cfg.governance?.newGoDaddySecrets===false,'Secret constraint','V64 does not require new GoDaddy secrets');
assert(cfg.governance?.unrestrictedProductionMutation===false,'Production mutation guard','unrestricted production mutation disabled');
assert(cfg.execution?.financialHighRiskRequiresOwnerApproval===true,'Financial mutation guard','high-risk financial actions require owner approval');
const publicHtml=read('public/sbc-god-tier.html');
for(const n of ['/api/v640/control-plane/status','/api/kevin/hardened/status','Single Flight','Independent Verification','Financial Mutation','Prediction','SIMULATE','Twin']) assert(publicHtml.includes(n),`Front-end V64 surface: ${n}`,'present');
// Static syntax audit across all JS sources.
let js=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.git'))continue;const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.js'))js.push(p);}}
walk(root);let syntaxFailures=[];for(const f of js){try{execFileSync(process.execPath,['--check',f],{stdio:'ignore'});}catch(e){syntaxFailures.push(path.relative(root,f));}}
assert(syntaxFailures.length===0,'JavaScript syntax audit',`${js.length} files checked; failures=${syntaxFailures.length}${syntaxFailures.length?': '+syntaxFailures.join(', '):''}`);
// No plaintext secret values in obvious env/config artifacts.
const secretPatterns=/(sk-[A-Za-z0-9]{20,}|AC[a-z0-9]{30,}|sq0[a-z0-9_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
let leaks=[];for(const rel of ['package.json','config/release-identity.js','config/sbc-v640-enterprise.json','README.md']){if(exists(rel)&&secretPatterns.test(read(rel)))leaks.push(rel);}
assert(leaks.length===0,'Static secret leak scan',leaks.length?'possible secret material in '+leaks.join(', '):'no obvious credential material');
// Stale authoritative identity check.
assert(!read('config/release-identity.js').includes("'63.0.0'"),'No stale authoritative V63 identity',`runtime release identity is V${releaseIdentity.RELEASE_VERSION}`);
// Integrity hash for release evidence.
const h=crypto.createHash('sha256');for(const f of ['package.json','server.js','config/release-identity.js','config/sbc-v640-enterprise.json','enterprise/sbc-enterprise-control-plane-v640.js','public/sbc-god-tier.html']){h.update(f+'\0'+read(f));}pass('Core release fingerprint',h.digest('hex'));
const result={ok:checks.every(c=>c.status==='PASS'),version:pkg.version,checkedAt:new Date().toISOString(),checks};
console.log(JSON.stringify(result,null,2));process.exit(result.ok?0:1);
