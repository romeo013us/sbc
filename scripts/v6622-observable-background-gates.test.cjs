'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {apply,MARKER}=require('../hotfix-assets/apply-v6622-observable-background-gates.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6622-'));
try{
 const src=[
 "const out={productionCertified:false,checks:{},outstandingManualVerification:[]};",
 " out.coreWritePrerequisitesVerified=!SBC_RUNTIME_READ_ONLY&&out.checks.mysqlReachable&&out.checks.writerLeaseSessionVerified&&out.checks.recoveryEvaluated&&out.checks.recoveryClear&&out.checks.historicalCustomerFloorSatisfied;",
 "res.json(out);"
 ].join('\n');
 fs.writeFileSync(path.join(dir,'server.js'),src);
 assert.equal(apply(dir).readOnlyObservation,true);
 const next=fs.readFileSync(path.join(dir,'server.js'),'utf8');
 assert.ok(next.includes(MARKER));
 assert.ok(next.includes('out.checks.tenantlessBackgroundRejections'));
 assert.ok(next.includes('out.backgroundAutomationVerified='));
 assert.ok(next.includes('coreWritePrerequisitesVerified=!SBC_RUNTIME_READ_ONLY'));
 assert.ok(next.includes('productionCertified:false'));
 assert.throws(()=>apply(dir),/duplicate patch/);
 console.log('SBC V6622 background observability regression PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
