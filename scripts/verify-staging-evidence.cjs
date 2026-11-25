'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const SHA=/^[a-f0-9]{40}$/;
const REPO='romeo013us/sbc';
const STAGE='.github/workflows/sbc-v6606-staged-release.yml';
function verifyStagingEvidence({source,runId,run,jobs}){
 assert.match(source,SHA,'Full reviewed source SHA required');
 assert.match(String(runId),/^[1-9]\d*$/,'Explicit staging run ID required');
 assert.equal(String(run.id),String(runId),'Run ID mismatch');
 assert.equal(run.repository?.full_name,REPO,'Wrong repository');
 assert.equal(run.head_repository?.full_name,REPO,'Fork staging is not trusted');
 assert.equal(run.head_sha,source,'Wrong tested source');
 assert.equal(run.path,STAGE,'Wrong workflow');
 assert.equal(run.event,'workflow_dispatch','Candidate staging must be dispatched');
 assert.match(run.head_branch||'',/^release\/candidate\/[A-Za-z0-9._/-]+$/,'Wrong candidate namespace');
 assert.equal(run.status,'completed','Staging incomplete');
 assert.equal(run.conclusion,'success','Staging failed');
 assert(Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0,'Missing attempt evidence');
 assert(Array.isArray(jobs),'Missing job evidence');
 for(const name of ['verified-staged-zip','github-preview-branch']){
  const matches=jobs.filter(j=>j.name===name);
  assert.equal(matches.length,1,'Missing or ambiguous required job: '+name);
  const job=matches[0];
  assert.equal(String(job.run_id),String(runId),'Job run mismatch');
  assert.equal(job.run_attempt,run.run_attempt,'Job attempt mismatch');
  assert.equal(job.head_sha,source,'Job source mismatch');
  assert.equal(job.status,'completed','Required job incomplete: '+name);
  assert.equal(job.conclusion,'success','Required job unsuccessful: '+name);
 }
 return Object.freeze({source,runId:String(runId),attempt:run.run_attempt,stagingVerified:true,promotionAuthorized:false});
}
if(require.main===module){try{
 const [source,runId,runFile,jobsFile,...rest]=process.argv.slice(2);
 assert(!rest.length&&runFile&&jobsFile,'Usage: verify-staging-evidence.cjs SOURCE RUN_ID RUN_JSON JOBS_JSON');
 const run=JSON.parse(fs.readFileSync(runFile,'utf8')),data=JSON.parse(fs.readFileSync(jobsFile,'utf8'));
 assert.equal(data.total_count,data.jobs?.length,'Incomplete job pagination');
 console.log(JSON.stringify(verifyStagingEvidence({source,runId,run,jobs:data.jobs})));
}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={verifyStagingEvidence};
