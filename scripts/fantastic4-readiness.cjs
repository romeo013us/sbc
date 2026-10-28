'use strict';
/** Read-only Fantastic 4 production release gate. This checks evidence references,
 * NOT the actual live deployments or provider payments. Owner must validate each receipt.
 */
const fs=require('node:fs');
const path=require('node:path');
const manifest=require('../ecosystem/fantastic4-manifest.json');
const gates=manifest.goLiveRequirements;
function assess(evidence){
 const reasons=[],observed=new Set(),checks=[];
 if(evidence?.schema!=='sbc.fantastic4.release-evidence.v1')reasons.push('INVALID_EVIDENCE_SCHEMA');
 if(!evidence?.release?.commandCenterCommit||!evidence?.release?.officeBoxCommit||!evidence?.release?.publishedRuntimeFingerprint)reasons.push('MISSING_DEPLOYED_RELEASE_IDENTITIES');
 if(!evidence?.release?.verifiedMySqlBackupReceipt||!evidence?.release?.rollbackArtifactReceipt)reasons.push('MISSING_BACKUP_OR_ROLLBACK_EVIDENCE');
 for(const gate of Array.isArray(evidence?.checks)?evidence.checks:[]){
   if(!gates.includes(gate.id)||observed.has(gate.id)){reasons.push('UNKNOWN_OR_DUPLICATE_GATE');continue}
   observed.add(gate.id);
   const proof=typeof gate.evidence==='string'&&gate.evidence.trim().length>=12;
   const dated=typeof gate.checkedAt==='string'&&Number.isFinite(Date.parse(gate.checkedAt));
   const passed=gate.status==='PASS'&&proof&&dated;
   checks.push({id:gate.id,status:passed?'PASS':gate.status==='FAIL'?'FAIL':'UNVERIFIED'});
   if(!passed)reasons.push('GATE_NOT_PROVEN:'+gate.id);
 }
 for(const gate of gates)if(!observed.has(gate))reasons.push('MISSING_GATE:'+gate);
 if(Object.keys(evidence?.release||{}).some(k=>String(evidence.release[k]).toLowerCase().includes('placeholder')))reasons.push('PLACEHOLDER_RELEASE_EVIDENCE');
 return {schema:'sbc.fantastic4.readiness-result.v1',status:reasons.length?'NO_GO':'READY_FOR_OWNER_APPROVAL',passed:checks.filter(c=>c.status==='PASS').length,required:gates.length,reasons,checks};
}
function main(){
 const file=process.argv[2]||path.join(__dirname,'../ecosystem/fantastic4-evidence.sample.json');
 const evidence=JSON.parse(fs.readFileSync(file,'utf8'));
 const result=assess(evidence);
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(result.status==='NO_GO')process.exitCode=2;
}
if(require.main===module)main();
module.exports={assess};
