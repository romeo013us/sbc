'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {verifyIntegratedCI,REQUIRED}=require('../scripts/verify-promotion-ci.cjs');
function fixture(){
 const base='a'.repeat(40),source='b'.repeat(40),prNumber=17;
 const run=path=>({path,head_sha:source,event:'pull_request',repository:{full_name:'romeo013us/sbc'},head_repository:{full_name:'romeo013us/sbc'},pull_requests:[{number:prNumber,head:{sha:source},base:{sha:base,ref:'a-sbc-master'}}],run_number:1,run_attempt:1,status:'completed',conclusion:'success'});
 const workflow_runs=REQUIRED.map(run);return {base,source,prNumber,data:{workflow_runs,total_count:workflow_runs.length},run};
}
test('all required exact-base PR runs pass',()=>{const f=fixture();assert.equal(verifyIntegratedCI(f).verifiedWorkflows,REQUIRED.length);});
test('missing or stale-base run cannot pass',()=>{const f=fixture();f.data.workflow_runs[0].pull_requests[0].base.sha='c'.repeat(40);assert.throws(()=>verifyIntegratedCI(f),/Missing exact-base/);});
test('a newer failed attempt overrides earlier success',()=>{const f=fixture();f.data.workflow_runs.push({...f.data.workflow_runs[0],run_attempt:2,conclusion:'failure'});f.data.total_count++;assert.throws(()=>verifyIntegratedCI(f),/Unsuccessful/);});
test('additional exact-base CI failure blocks even if core checks pass',()=>{const f=fixture();f.data.workflow_runs.push({...f.run('.github/workflows/extra.yml'),conclusion:'failure'});f.data.total_count++;assert.throws(()=>verifyIntegratedCI(f),/Unsuccessful/);});
test('pagination gaps and wrong source fail closed',()=>{const f=fixture();f.data.total_count++;assert.throws(()=>verifyIntegratedCI(f),/Incomplete/);f.data.total_count--;f.data.workflow_runs[0].head_sha='c'.repeat(40);assert.throws(()=>verifyIntegratedCI(f),/Wrong source/);});
