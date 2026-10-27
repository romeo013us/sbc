'use strict';
const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const release=require('../config/release-identity');
const checks=[];
function check(name,ok){checks.push({name,ok});}
check('release-identity-consistent',release.RELEASE_VERSION===require('../package.json').version);
check('no-automatic-workspace-promotion',!/legacyLooksCanonical[\s\S]{0,500}promoted into empty relational tables/.test(server));
check('partial-baseline-protection',server.includes('VERIFIED_PRE_CORRUPTION_CRM_COUNT = 248'));
check('recovery-required-on-partial-core',server.includes('REFUSING PARTIAL-DATABASE ACTIVATION'));
check('recovery-required-on-empty-core',server.includes('REFUSING EMPTY-DATABASE MIGRATION'));
check('save-blocked-during-recovery',server.includes("throw new Error('MYSQL_RECOVERY_REQUIRED')"));
check('startup-mutation-suspended',server.includes('read-only recovery mode: CRM promotion, growth table creation, campaign staging, and background timers are all suspended.') && server.includes('if(MYSQL_RECOVERY_REQUIRED){console.warn') && server.includes('startKimControlPlane();enterpriseWorkerCycle()'));
const growth=fs.readFileSync(path.join(root,'enterprise','sbc-growth-os-v650.js'),'utf8');
check('recovery-safe-growth-staging-boundaries',growth.includes('function assertWritable(){if(recoveryLocked())throw new Error(\'MYSQL_RECOVERY_REQUIRED:') && growth.includes('if(recoveryLocked())return {ok:true,version:VERSION,recoveryRequired:true,readOnly:true') && growth.includes('function start(){if(timer||!ctx||recoveryLocked())return false;'));
check('recovery-status-endpoint',server.includes('/api/owner/recovery/status'));
const result={ok:checks.every(x=>x.ok),version:release.RELEASE_VERSION,checks};
console.log(JSON.stringify(result,null,2));process.exit(result.ok?0:1);
