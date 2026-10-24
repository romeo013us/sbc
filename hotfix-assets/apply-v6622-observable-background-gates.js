'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6622_OBSERVABLE_BACKGROUND_GATES';
function apply(root){
  const file=path.join(root,'server.js');
  const old=fs.readFileSync(file,'utf8');
  if(old.includes(MARKER))throw Error(MARKER+': duplicate patch');
  const anchor=" out.coreWritePrerequisitesVerified=!SBC_RUNTIME_READ_ONLY&&out.checks.mysqlReachable&&out.checks.writerLeaseSessionVerified&&out.checks.recoveryEvaluated&&out.checks.recoveryClear&&out.checks.historicalCustomerFloorSatisfied;";
  if(old.split(anchor).length!==2)throw Error(MARKER+': owner-only launch-gates anchor must occur exactly once');
  const observation=[
    ' // '+MARKER+': in-process failure counters, never a recovery override.',
    ' out.checks.tenantlessBackgroundRejections=Number(process.SBC_TENANT_REJECTION_STATS?.rejected||0);',
    ' out.checks.lastTenantlessRejectionAt=process.SBC_TENANT_REJECTION_STATS?.lastRejectedAt||null;',
    ' out.backgroundAutomationVerified=out.checks.tenantlessBackgroundRejections===0&&out.checks.recoveryClear&&out.checks.writerLeaseSessionVerified;',
    " if(!out.backgroundAutomationVerified)out.outstandingManualVerification.push('Background automation must have zero tenantless rejections and a valid writer lease before approval.');"
  ].join('\n');
  const patched=old.replace(anchor,observation+'\n'+anchor);
  if(!patched.includes('out.productionCertified:false')&&!patched.includes('productionCertified:false'))throw Error(MARKER+': launch gate must not claim production certification');
  fs.writeFileSync(file,patched);
  return {marker:MARKER,changed:true,readOnlyObservation:true,tenantAndWriterGatesPreserved:true};
}
module.exports={apply,MARKER};
