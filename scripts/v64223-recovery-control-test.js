'use strict';
const fs=require('fs');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const server=fs.readFileSync('server.js','utf8');
const checks=[
 ['package version matches authoritative release identity',pkg.version===require('./../config/release-identity.js').RELEASE_VERSION],
 ['backup scan is read-only',server.includes("/api/owner/recovery/backup-candidates")&&server.includes('recoveryScanFiles')],
 ['provenance endpoint is owner-only',server.includes("/api/owner/recovery/provenance',auth,ownerOnly")],
 ['exit check is owner-only',server.includes("/api/owner/recovery/exit-check',auth,ownerOnly")],
 ['provenance never promotes leads',server.includes('No lead was promoted to sbc_customers')],
 ['financial mutations remain blocked in exit check',server.includes('financialMutationsAllowed:false')],
 ['recovery guard remains active',server.includes('MYSQL_RECOVERY_REQUIRED=true;')],
 ['backup audit script exists',fs.existsSync('scripts/recovery-authority-audit.js')],
 ['lead audit script exists',fs.existsSync('scripts/lead-mesh-provenance-audit.js')]
];
let bad=0;for(const [n,ok] of checks){console.log((ok?'PASS ':'FAIL ')+n);if(!ok)bad++}if(bad){process.exit(1)}console.log(`V64.2.28 recovery control test: PASS (${checks.length}/${checks.length})`);
