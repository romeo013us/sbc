'use strict';
const assert=require('node:assert/strict');
const {assess,normalizeError,requiredSources}=require('./production-95-three-track-preflight.cjs');
const {RUBRIC}=require('../scripts/sbc-v6655-strict-95-evidence.cjs');
const {INPUTS}=require('../scripts/runtime-build-fingerprint.cjs');
const sourceCommit='a'.repeat(40);
const validRelease={manifest:{sourceCommit,archiveSha256:'b'.repeat(64),generatedBy:'isolated-github-ci'}};
const source=()=>validRelease;
const assessWith=(values={})=>assess({readRelease:source,...values});
const none=assessWith();
assert.equal(none.release.status,'SOURCE_MATCHED_AND_ARCHIVE_VERIFIED');
assert.equal(none.status,'NO_GO','source compile alone NEVER proves SaaS or company readiness');
assert.equal(none.deploymentAuthorized,false);
assert.equal(none.liveDeploymentVerified,false);
assert.deepEqual(Object.keys(none.tracks),['build','saas','company']);
for(const name of ['build','saas','company']){
 assert.equal(none.tracks[name].submittedScore,null);
 assert.equal(none.tracks[name].status,'NOT_CERTIFIED');
}
assert(INPUTS.includes('ecosystem')&&INPUTS.includes('ui-overlays'),
 'reproducible source identity must cover Office Box and Kim UI');
assert.deepEqual(assessWith({inputList:['hotfix-assets','enterprise','scripts']}).sourceCoverage.missing,
 ['ecosystem','ui-overlays']);
assert.equal(assessWith({inputList:[]}).release.reason,'SOURCE_INPUTS_NOT_FINGERPRINTED');
assert.equal(assessWith({readRelease:()=>null}).release.reason,'NO_PREBUILT_RELEASE');
assert.equal(assessWith({readRelease:()=>({manifest:{...validRelease.manifest,sourceCommit:'not-a-sha'}})}).release.reason,'UNBOUND_RELEASE_COMMIT');
assert.equal(assessWith({readRelease:()=>({manifest:{...validRelease.manifest,generatedBy:'manual'}})}).release.reason,'UNVERIFIED_BUILD_PROVENANCE');
for(const [message,reason] of [
 ['[SBC PREBUILT] release is stale relative to checked-out source; refuse mixed code','SOURCE_RELEASE_FINGERPRINT_MISMATCH'],
 ['[SBC PREBUILT] ZIP SHA-256 does not match release receipt','ARCHIVE_INTEGRITY_MISMATCH'],
 ['[SBC PREBUILT] release archive or receipt is missing','ARCHIVE_OR_RECEIPT_INCOMPLETE'],
 ['[SBC PREBUILT] malformed or wrong-version release receipt','RECEIPT_SCHEMA_INVALID'],
 ['network glitch','SOURCE_RELEASE_UNVERIFIED']
]){
 assert.equal(normalizeError(Error(message)),reason);
 const failed=assessWith({readRelease:()=>{throw Error(message)}});
 assert.equal(failed.status,'NO_GO');assert.equal(failed.release.reason,reason);
 assert.equal(failed.deploymentAuthorized,false);
}
const now=new Date().toISOString();
const claims={commit:sourceCommit,build:{},saas:{},company:{}};
for(const [track,items] of Object.entries(RUBRIC)){
 for(const item of items){
  claims[track][item.id]={verified:true,score:96,observedAt:now,commit:sourceCommit,
   artifacts:item.kinds.map(kind=>({kind,reference:'https://evidence.example.test/review/'+item.id+'/'+kind,sha256:'c'.repeat(64)}))};
 }
}
// Even maximum submitted 95+ claims and a source-verified ZIP only permit
// independent human/provider review; they NEVER deploy or certify.
const all=assessWith({evidence:claims});
assert.equal(all.status,'AWAITING_INDEPENDENT_LIVE_APPROVAL');
for(const track of ['build','saas','company']){
 assert.equal(all.tracks[track].submittedScore,96);
 assert.equal(all.tracks[track].blockers.length,0);
}
assert.equal(all.deploymentAuthorized,false);
assert.equal(all.liveDeploymentVerified,false);
const expired=JSON.parse(JSON.stringify(claims));
expired.company.renewals_retention_and_service_quality.observedAt='2020-01-01T00:00:00Z';
assert.equal(assessWith({evidence:expired}).status,'NO_GO','stale business proof cannot claim 9.5');
assert.equal(assessWith({evidence:claims,readRelease:()=>{throw Error('release is stale relative to checked-out source')}}).status,'NO_GO');
const real=assess(); // only reads checked-out repository, never network/customer/prod
assert.equal(real.deploymentAuthorized,false);
assert.equal(real.liveDeploymentVerified,false);
assert(requiredSources.every(x=>INPUTS.includes(x)));
console.log('SBC 9.5 THREE-TRACK PREFLIGHT PASS: strict source provenance, forged/stale source rejection, missing Build/SaaS/Company proof, no automatic production approval');
