'use strict';
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const server=read('server.js');
const v10=read('public/v10.js');
const commerce=read('public/v5610-commerce.js');
const kim=read('public/v32-9-enterprise.js');
const launch=read('public/v33-0-launch-acquisition.js');
const pkg=JSON.parse(read('package.json'));
const release=require('../config/release-identity.js');
const index=read('public/index.html');
const finalizer=read('public/v56251-ui-finalize.js');
const checks=[
 ['package and release identity match',pkg.version===release.RELEASE_VERSION],
 ['verified-lead read endpoint exists',server.includes("/api/owner/recovery/verified-leads")],
 ['verified-lead commit endpoint exists',server.includes("/api/owner/recovery/verified-leads/commit")],
 ['owner confirmation is required',server.includes("RESTORE-VERIFIED-LEADS")],
 ['source is sbc_lead_mesh',server.includes("source:'sbc_lead_mesh'")],
 ['deterministic lead IDs',server.includes('sbc_lm_')],
 ['owner verification is explicit',server.includes("ownerVerified:true")],
 ['lead mesh source reference preserved',server.includes('leadMeshId:Number(r.id)')],
 ['restore uses transactional commit',server.includes('await conn.beginTransaction()') && server.includes('await conn.commit()')],
 ['restore does not use DELETE/TRUNCATE for CRM',!server.includes('DELETE FROM sbc_customers') && !server.includes('TRUNCATE TABLE sbc_customers')],
 ['full recovery guard remains active',server.includes('MYSQL_RECOVERY_REQUIRED=true; storageMode=\'mysql-recovery-required\';')],
 ['automation remains suspended after verified-lead restore',server.includes('automation=BLOCKED')],
 ['dashboard identifies safe recovery',commerce.includes('SAFE RECOVERY MODE')],
 ['dashboard uses current platform identity',index.includes('V65.1.26 · DEMO STUDIO')&&finalizer.includes("__SBC_UI_RELEASE__='65.1.26'")],
 ['lead desk offers verified-lead restoration',v10.includes('Restore Verified Leads to CRM')],
 ['lead desk distinguishes pending restoration',v10.includes('pendingRecoveryRows')],
 ['Kim panel uses current platform identity',kim.includes('SBC OS V65.1.26')],
 ['launch panel uses current platform identity',launch.includes('SBC OS V65.1.26')]
];
let fail=0; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} — ${name}`); if(!ok)fail++;}
console.log(`RESULT ${checks.length-fail}/${checks.length} PASS`);
process.exitCode=fail?1:0;
