'use strict';
// SBC OS V65.1.19 — additive, tenant-scoped operational control plane.
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const TARGET_VERSION = '65.1.19';
const RELEASE_NAME = 'PHASES-1-4-GOVERNED-OPS-CONTROL-PLANE';
const MARKER = 'SBC_V65119_PHASES_1_4_REGISTERED';

function replaceExactly(source, before, after, label) {
  const a = source.split(before).length - 1, b = source.split(after).length - 1;
  if (a === 0 && b === 1) return source;
  if (a !== 1 || b !== 0) throw new Error(`V65.1.19 patch stopped: ${label} anchor counts original=${a}, patched=${b}`);
  return source.replace(before, after);
}
function apply(rootDir) {
  const routeSource = path.join(__dirname, 'v65119-control-plane.js');
  if (!fs.existsSync(routeSource)) throw new Error('V65.1.19 control-plane module missing from hotfix-assets.');
  const routeTarget = path.join(rootDir, 'routes', 'v65119-control-plane.js');
  fs.mkdirSync(path.dirname(routeTarget), { recursive: true });
  fs.copyFileSync(routeSource, routeTarget);

  const serverPath = path.join(rootDir, 'server.js');
  let server = fs.readFileSync(serverPath, 'utf8');
  if (!server.includes(MARKER)) {
    const anchor = "// V64.2.28 GOD-TIER EXECUTIVE INTELLIGENCE — additive integration into the real SBC Command Center.";
    const inject = `// ${MARKER}\nconst registerV65119ControlPlane = require('./routes/v65119-control-plane');\nregisterV65119ControlPlane(app,{auth,ownerOnly,getContext:()=>({mysqlPool,db,buildVersion:BUILD_VERSION,recoveryRequired:()=>Boolean(MYSQL_RECOVERY_REQUIRED),audit,saveData})});\n\n${anchor}`;
    server = replaceExactly(server, anchor, inject, 'control-plane registration');
  }
  // Replace only the in-memory webhook replay check with an atomic MySQL claim.
  const old = "  const eventHash=require('node:crypto').createHash('sha256').update(raw).digest('hex');\n  if(Array.isArray(job.seenEvents)&&job.seenEvents.includes(eventHash))return {ok:true,ignored:'duplicate_event'};";
  const next = "  const eventHash=require('node:crypto').createHash('sha256').update(raw).digest('hex');\n  if(Array.isArray(job.seenEvents)&&job.seenEvents.includes(eventHash)){const repaired=await global.__SBC_V65119_CONTROL_PLANE.completeWebhookEvent({provider,eventHash});if(!repaired?.ok)return {ok:false,error:repaired?.error||'durable_webhook_ledger_complete_failed'};return {ok:true,ignored:'duplicate_event'};}";
  if (!server.includes('const durableClaim=global.__SBC_V65119_CONTROL_PLANE')) {
    server = replaceExactly(server, old, next, 'durable webhook event hash');
    const validateAnchor = "  if((shippingState||terminalDelivery)&&!trackingNumber)return {ok:false,error:'tracking_number_required_for_shipping_status'};\n  const rankState=value=>{const s=normalizeStatus(value);if(/completed|delivered|complete|fulfilled/.test(s))return 2;if(/shipped|dispatch|in_transit|tracking/.test(s))return 1;return 0;};";
    const validateNext = "  if((shippingState||terminalDelivery)&&!trackingNumber)return {ok:false,error:'tracking_number_required_for_shipping_status'};\n  const durableClaim=global.__SBC_V65119_CONTROL_PLANE&&await global.__SBC_V65119_CONTROL_PLANE.claimWebhookEvent({provider,eventHash,jobId:String(job.id)});\n  if(!durableClaim||durableClaim.ok!==true)return {ok:false,error:durableClaim?.error||'durable_webhook_ledger_unavailable'};\n  if(durableClaim.duplicate)return {ok:true,ignored:'duplicate_event'};\n  const rankState=value=>global.__SBC_V65119_CONTROL_PLANE.statusRank(value);";
    server = replaceExactly(server, validateAnchor, validateNext, 'durable claim after webhook evidence validation');
    server = replaceExactly(server, "  const shippingState=/shipped|dispatch|in_transit|tracking/.test(status);const terminalDelivery=/delivered|complete|fulfilled/.test(status);", "  const shippingState=global.__SBC_V65119_CONTROL_PLANE.statusRank(status)===1;const terminalDelivery=global.__SBC_V65119_CONTROL_PLANE.statusRank(status)===2;", 'canonical vendor status classification');
  }
  fs.writeFileSync(serverPath, server);

  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.version !== '65.1.18' && pkg.version !== TARGET_VERSION) throw new Error(`V65.1.19 expected source version 65.1.18; found ${pkg.version}`);
  if (pkg.version !== TARGET_VERSION) {
    const out = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'release-bump.js'), TARGET_VERSION, RELEASE_NAME, '--apply'], { cwd: rootDir, encoding: 'utf8', timeout: 120000, maxBuffer: 8*1024*1024 });
    if (out.status !== 0) throw new Error(`V65.1.19 release bump failed: ${(out.stderr||out.stdout||'').slice(-2500)}`);
    const p = JSON.parse(fs.readFileSync(pkgPath,'utf8'));
    p.description = 'SBC OS V65.1.19 governed Phases 1–4 operational control plane';
    p.scripts['test:v65119-phases'] = 'node scripts/v65119-phases-test.js';
    const all = p.scripts['test:all'] || '';
    if (all.includes('node scripts/ui-static-audit.js') && !all.includes('v65119-phases-test.js')) p.scripts['test:all'] = all.replace('node scripts/ui-static-audit.js','node scripts/v65119-phases-test.js && node scripts/ui-static-audit.js');
    fs.writeFileSync(pkgPath, JSON.stringify(p,null,2)+'\n');
    const lockPath=path.join(rootDir,'package-lock.json');
    if(fs.existsSync(lockPath)){const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));lock.version=TARGET_VERSION;if(lock.packages?.[''])lock.packages[''].version=TARGET_VERSION;fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');}
  }
  const testSrc = path.join(__dirname, 'v65119-phases-test.js');
  if (!fs.existsSync(testSrc)) throw new Error('V65.1.19 regression test missing from hotfix-assets.');
  fs.copyFileSync(testSrc, path.join(rootDir,'scripts','v65119-phases-test.js'));
  const check = spawnSync(process.execPath,['--check',routeTarget],{encoding:'utf8',timeout:30000});
  if(check.status!==0)throw new Error(`V65.1.19 route syntax failed: ${check.stderr||check.stdout}`);
  const finalServer=fs.readFileSync(serverPath,'utf8');
  if(!finalServer.includes(MARKER)||!finalServer.includes('durable_webhook_ledger_unavailable'))throw new Error('V65.1.19 integration markers missing after patch.');
  const hardeningPath=path.join(__dirname,'apply-v6520-hardening.js');
  if(!fs.existsSync(hardeningPath))throw new Error('V65.1.20 hardening overlay missing.');
  const hardening=require(hardeningPath).apply(rootDir);
  const atomicPath=path.join(__dirname,'apply-v6521-atomic-webhook.js');if(!fs.existsSync(atomicPath))throw new Error('V65.1.21 atomic webhook patch missing.');
  const atomic=require(atomicPath).apply(rootDir);
  return {version:'65.1.21',phases:[1,2,3,4],durableWebhookLedger:true,tenantScopedOps:true,hardening,atomic};
}
module.exports={apply,TARGET_VERSION,MARKER};
