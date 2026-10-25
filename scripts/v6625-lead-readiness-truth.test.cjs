'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {inspect}=require('../enterprise/v6625-lead-readiness-audit.cjs');
const leads=[
 {id:1,tenantId:1,status:'Lead',leadTemperature:'Warm',verificationStatus:'Verified',phone:'(305) 555-0123',email:'contact@one.test'},
 {id:2,tenantId:1,status:'Lead',leadTemperature:'Hot',verificationStatus:'Needs Verification',phone:'3055550145'},
 {id:3,tenantId:1,status:'Lead',leadTemperature:'Warm',verificationStatus:'Sales Ready',email:'sales@three.test'},
 {id:4,tenantId:1,status:'Do Not Call',leadTemperature:'Hot',phone:'3055550199'},
 {id:5,tenantId:1,status:'Lead',leadTemperature:'Hot',sbcTest:true,phone:'3055550101'},
 {id:6,tenantId:2,status:'Lead',leadTemperature:'Hot',verificationStatus:'Verified',phone:'3055550182'},
 {id:7,tenantId:1,status:'Lead',leadTemperature:'Warm',verificationStatus:'Verified'}
];
const snapshot=JSON.stringify(leads);
leads.forEach(Object.freeze);Object.freeze(leads);
const o=inspect(leads,1,{limit:50});
assert.equal(o.totalTenantRecords,6);
assert.equal(o.activeWarmHot,4);
assert.equal(o.suppressedOrTerminal,1);
assert.equal(o.synthetic,1);
assert.equal(o.verifiedHumanCallReady,1);
assert.equal(o.verifiedEmailReviewReady,2);
assert.equal(o.needsRecordVerification,1);
assert.equal(o.manualResearchQueue,1);
assert.equal(o.invalidOrMissingContact,1);
assert.deepEqual(o.manualCallLeadIds,['1']);
assert.deepEqual(o.researchLeadIds,['2']);
assert.equal(o.noAutomaticCalls,true);
assert.equal(JSON.stringify(leads),snapshot);
assert.equal(inspect(leads,2).verifiedHumanCallReady,1);
assert.throws(()=>inspect(leads,0),/TENANT_CONTEXT_REQUIRED/);
assert.throws(()=>inspect(leads,null),/TENANT_CONTEXT_REQUIRED/);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6625-'));
try {
 const file=path.join(root,'server.js');
 fs.writeFileSync(file,[
 'MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED',
 'const workableMigration=promoteAllActiveLeadsToWorkable();if(workableMigration.changed)await saveData();',
 "console.log('workable ${workableMigration.changed||0}');",
 "app.get('/api/owner/launch-gates',auth,ownerOnly,async(req,res)=>{"
 ].join('\n'));
 const {apply}=require('../hotfix-assets/apply-v6625-lead-readiness-truth.js');
 assert.equal(apply(root).automaticPromotionDisabled,true);
 const modified=fs.readFileSync(file,'utf8');
 assert.match(modified,/workablePromotedThisBoot/);
 assert.match(modified,/app\.get\('\/api\/owner\/lead-readiness',auth,ownerOnly/);
 assert.match(modified,/SBC_V6625_AUDIT\.inspect\(db\.customers,tenantId/);
 assert.doesNotMatch(modified,/const workableMigration=promoteAllActiveLeadsToWorkable/);
 assert.throws(()=>apply(root),/already applied/);
 console.log('SBC V6625 workability truth and tenant-safe read-only endpoint PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}