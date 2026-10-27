'use strict';
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const runtime=fs.readFileSync(path.join(root,'enterprise/kevin/kevin-runtime.cjs'),'utf8');
const validator=require('../enterprise/recovery/lead-provenance-validator.cjs');
const pkg=require('../package.json');
const release=require('../config/release-identity');
const checks=[]; const check=(name,ok)=>checks.push({name,ok:Boolean(ok)});
check('package-release-matches-manifest',pkg.version===release.RELEASE_VERSION);
check('authoritative-release-identity',release.RELEASE_VERSION===pkg.version&&release.RELEASE.major===65&&release.RELEASE.minor===1&&release.RELEASE.patch===26);
check('recovery-guard-active',server.includes('MYSQL_RECOVERY_REQUIRED=true;')&&server.includes('createRecoveryWriteGuard({isRecoveryRequired:()=>!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED})')&&server.includes('startup mutation pipeline remains suspended'));
check('pipeline-read-isolated',server.includes("/api/v24/production/pipeline")&&server.includes('READ endpoint. Never persist'));
check('243-lead-projection-read-only',server.includes('sbc_lead_mesh recovery projection')&&server.includes('readOnlyRecoveryProjection:true'));
check('kevin-background-heartbeat-suspended',runtime.includes('if (recoverySafe())')&&runtime.includes('heartbeat suspended'));
check('kevin-schema-bootstrap-skipped',runtime.includes('schema bootstrap and Kim briefing worker skipped'));
check('manual-kevin-heartbeat-blocked',runtime.includes("KEVIN_RECOVERY_SAFE"));
check('manual-kim-briefing-blocked',runtime.includes("KIM_RECOVERY_SAFE"));
check('verified-lead-promotion-requires-green-provenance',server.includes("error:'MYSQL_RECOVERY_REQUIRED'")&&server.includes("classification!=='GREEN'")&&!server.includes('RESTORE-ALL-LEAD-MESH-243'));
check('provenance-v6428-endpoint',server.includes('/api/owner/recovery/provenance/v6428'));
check('promotion-manifest-v6428-endpoint',server.includes('/api/owner/recovery/promotion-manifest/v6428'));
check('promotion-is-green-only',server.includes('PROVENANCE_GATE_FAILED')&&server.includes("classification!=='GREEN'"));
check('validator-is-read-only-module',typeof validator.auditLeadMesh==='function'&&typeof validator.validateLead==='function');
const tenantContext=require('../enterprise/tenant-context.cjs');
const stateGuard=require('../enterprise/recovery/state-reconciliation-guard.cjs');
check('cryptographic-tenant-context-module',typeof tenantContext.createTenantContextMiddleware==='function'&&typeof tenantContext.requireTenantContext==='function');
check('fail-closed-state-reconciliation-module',typeof stateGuard.createStateReconciliationGuard==='function'&&typeof stateGuard.canonicalHash==='function');
check('read-only-lead-diff-tool',fs.existsSync(path.join(root,'scripts/diff-leads-reconciliation.js')));
check('enterprise-safety-migration-present',fs.existsSync(path.join(root,'migrations/20261009_001_v6516_enterprise-safety-ledgers.sql')));
const fixture=[
{id:1,business_name:'Alpha Co',contact_name:'A',email:'a@alpha.example',phone_normalized:'+13055550101',website:'https://alpha.example',source:'import-1',status:'OWNER_VERIFIED',created_at:'2026-10-08T00:00:00Z',updated_at:new Date().toISOString()},
{id:2,business_name:'Alpha Co',contact_name:'B',email:'a@alpha.example',phone_normalized:'+13055550102',website:'https://alpha.example',source:'import-1',status:'OWNER_VERIFIED',created_at:'2026-10-08T00:00:00Z',updated_at:new Date().toISOString()},
{id:3,business_name:'No Contact',source:'import-1',status:'PENDING_VERIFICATION',created_at:'2026-10-08T00:00:00Z',updated_at:'2026-10-08T00:00:00Z'}
];
const a=validator.auditLeadMesh(fixture,{now:Date.now()});
check('fixture-duplicate-detection',a.counts.duplicateCandidates===2);
check('fixture-no-unjustified-green',a.rows.find(x=>x.leadMeshId===1)?.classification==='YELLOW');
check('fixture-red-quarantine',a.rows.find(x=>x.leadMeshId===3)?.classification==='RED');
const result={ok:checks.every(x=>x.ok),version:pkg.version,checks,fixture:{counts:a.counts,classes:a.rows.map(x=>({id:x.leadMeshId,class:x.classification,reasons:x.reasons}))}};
console.log(JSON.stringify(result,null,2));
process.exit(result.ok?0:1);
