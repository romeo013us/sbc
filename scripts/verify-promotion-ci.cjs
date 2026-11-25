'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const REPO='romeo013us/sbc',SHA=/^[a-f0-9]{40}$/;
const REQUIRED=[
 'sbc-v66157-hr-ledger.yml','sbc-renewal-center.yml','sbc-academy360.yml',
 'sbc-four-gate-owner-acceptance.yml','sbc-v66156-smart-ingest-integrity.yml',
 'sbc-95-revenue-reliability.yml','sbc-account360-regression.yml',
 'sbc-v66-release-identity-reconciliation.yml','sbc-v66-customer-journey-reliability.yml',
 'sbc-v6606-staged-release.yml'
].map(n=>'.github/workflows/'+n);
function verifyIntegratedCI({base,source,prNumber,data,required=REQUIRED}){
 assert.match(base,SHA);assert.match(source,SHA);assert.notEqual(base,source);
 assert.match(String(prNumber),/^[1-9]\d*$/);
 assert(Array.isArray(data.workflow_runs));assert.equal(data.total_count,data.workflow_runs.length,'Incomplete workflow evidence');
 const latest=new Map();
 for(const r of data.workflow_runs){
  if(r.event!=='pull_request')continue;
  assert.equal(r.head_sha,source,'Wrong source run');
  assert.equal(r.repository?.full_name,REPO);assert.equal(r.head_repository?.full_name,REPO);
  const binds=r.pull_requests?.some(p=>String(p.number)===String(prNumber)&&p.head?.sha===source&&p.base?.sha===base&&p.base?.ref==='a-sbc-master');
  if(!binds)continue;
  assert.match(r.path,/^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/);
  assert(Number.isSafeInteger(r.run_number)&&Number.isSafeInteger(r.run_attempt));
  const old=latest.get(r.path);
  if(!old||r.run_number>old.run_number||(r.run_number===old.run_number&&r.run_attempt>old.run_attempt))latest.set(r.path,r);
 }
 for(const name of required)assert(latest.has(name),'Missing exact-base required CI: '+name);
 for(const [name,r] of latest){assert.equal(r.status,'completed','Incomplete CI: '+name);assert.equal(r.conclusion,'success','Unsuccessful CI: '+name);}
 return {source,base,prNumber:String(prNumber),verifiedWorkflows:latest.size};
}
if(require.main===module){try{const [base,source,prNumber,file]=process.argv.slice(2);console.log(JSON.stringify(verifyIntegratedCI({base,source,prNumber,data:JSON.parse(fs.readFileSync(file,'utf8'))})));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={verifyIntegratedCI,REQUIRED};
