'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {verifyStagingEvidence}=require('../scripts/verify-staging-evidence.cjs');
function fixture(){
 const source='a'.repeat(40),runId='42';
 const run={id:42,repository:{full_name:'romeo013us/sbc'},head_repository:{full_name:'romeo013us/sbc'},head_sha:source,path:'.github/workflows/sbc-v6606-staged-release.yml',event:'workflow_dispatch',head_branch:'release/candidate/academy-fixture',status:'completed',conclusion:'success',run_attempt:2};
 const jobs=['verified-staged-zip','github-preview-branch','SBC consolidated source release gate'].map(name=>({name,run_id:42,run_attempt:2,head_sha:source,status:'completed',conclusion:'success'}));
 return {source,runId,run,jobs};
}
test('exact successful candidate staging is evidence, never promotion authority',()=>{const r=verifyStagingEvidence(fixture());assert.equal(r.stagingVerified,true);assert.equal(r.promotionAuthorized,false);});
test('wrong source, fork, workflow, branch or event is rejected',()=>{
 for(const patch of [{head_sha:'b'.repeat(40)},{head_repository:{full_name:'other/sbc'}},{path:'.github/workflows/other.yml'},{head_branch:'a-sbc-master'},{event:'pull_request'}]){
  const x=fixture();Object.assign(x.run,patch);assert.throws(()=>verifyStagingEvidence(x));
 }
});
test('failed, missing, skipped or stale-attempt jobs cannot certify staging',()=>{
 for(const patch of [{conclusion:'failure'},{conclusion:'skipped'},{run_attempt:1},{head_sha:'b'.repeat(40)},{run_id:99}]){
  const x=fixture();Object.assign(x.jobs[1],patch);assert.throws(()=>verifyStagingEvidence(x));
 }
 const missing=fixture();missing.jobs.pop();assert.throws(()=>verifyStagingEvidence(missing));
 const duplicate=fixture();duplicate.jobs.push({...duplicate.jobs[0]});assert.throws(()=>verifyStagingEvidence(duplicate));
});
test('an incomplete or unsuccessful run is rejected even with green job records',()=>{
 for(const patch of [{status:'in_progress'},{conclusion:'failure'},{id:43}]){
  const x=fixture();Object.assign(x.run,patch);assert.throws(()=>verifyStagingEvidence(x));
 }
});
test('consolidated source gate must be independently present and successful on the exact attempt',()=>{
 const name='SBC consolidated source release gate';
 const withGate=()=>fixture();
 assert.equal(verifyStagingEvidence(withGate()).stagingVerified,true);
 const missing=fixture();missing.jobs=missing.jobs.filter(j=>j.name!==name);assert.throws(()=>verifyStagingEvidence(missing),/source release gate/);
 for(const patch of [{conclusion:'failure'},{conclusion:'skipped'},{run_attempt:1},{head_sha:'b'.repeat(40)},{run_id:99},{status:'in_progress'}]){
  const x=withGate();Object.assign(x.jobs.at(-1),patch);assert.throws(()=>verifyStagingEvidence(x));
 }
 const duplicate=withGate();duplicate.jobs.push({...duplicate.jobs.at(-1)});assert.throws(()=>verifyStagingEvidence(duplicate),/ambiguous/);
});
