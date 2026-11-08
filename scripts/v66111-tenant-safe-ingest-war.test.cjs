'use strict';
// SBC V66.111 offline war test: 20 concurrent completions, tenant collision,
// intentionally failed first database save, retry, and mutation-safety checks.
// Synthetic data only. Does NOT certify live MySQL or a provider.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),readline=require('node:readline'),vm=require('node:vm');
const stage=require('./v66111-stage-tenant-safe-ingest.cjs');
const ROOT=path.resolve(__dirname,'..');
const base=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
const patched=stage.patchServer(base);
assert.equal(stage.patchServer(patched),patched,'source patch must be idempotent');
assert(patched.includes(stage.MARK));
assert(patched.includes('if(Number(c?.tenantId)!==tenantId)continue'));
assert(patched.includes('...lead,tenantId,createdAt:now()'));
assert(patched.includes('if(!initialSaveCommitted&&db.customers===customers)'));
const start=patched.indexOf('// '+stage.MARK);
const end=patched.indexOf('ASYNC_INGEST.configure({onComplete:mergeAsyncIngestResult});',start);
assert(start>0&&end>start,'patched merge implementation not found');
const code=patched.slice(start,end);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v66111-war-'));
const existing={id:'tenant2-1',tenantId:2,businessName:'ACME Auto',contactName:'Original Tenant Two',email:'shared@acme.example',phone:'+13055550180',leadScore:20};
const db={customers:[existing]};
let failNext=false, saves=0, audits=0;
const scope={
 fs,path,crypto,readline,db,mysqlPool:null,
 LEAD_INTAKE_ENGINE:require('../enterprise/v56131-lead-intake.js'),
 PUBLIC_ENRICH:{enrichCustomer:async()=>{throw Error('NO_ENRICHMENT_IN_WAR_TEST')}},
 saveData:async()=>{saves++;await new Promise(resolve=>setImmediate(resolve));if(failNext){failNext=false;throw Error('SYNTHETIC_MYSQL_COMMIT_FAILURE');}},
 audit:()=>{audits++}, now:()=>new Date().toISOString(),
 sqlDateTime:v=>v,id:()=>'synthetic-id',
 console,setImmediate,Promise
};
vm.runInNewContext(code+'\nthis.__merge=mergeAsyncIngestResult;',scope,{timeout:3000});
assert.equal(typeof scope.__merge,'function');
const row={businessName:'ACME Auto',contactName:'Tenant One Lead',email:'shared@acme.example',phone:'+13055550180',leadScore:89,leadTemperature:'hot',intakeDisposition:'CRM',status:'Lead',verificationStatus:'Needs Verification'};
const job=(index,tenantId=1)=>{
 const dir=path.join(tmp,'job-'+index);fs.mkdirSync(dir,{recursive:true});
 const resultPath=path.join(dir,'result.ndjson');
 fs.writeFileSync(resultPath,JSON.stringify(row)+'\n');
 return [{id:'job-'+index,tenantId,dir,batchId:'BATCH-'+index},{resultPath}];
};
(async()=>{
 try{
  await assert.rejects(()=>scope.__merge(...job('bad-tenant',0)),/INGEST_TENANT_REQUIRED/);
  assert.equal(db.customers.length,1,'invalid tenant must not mutate CRM');
  failNext=true;
  await assert.rejects(()=>scope.__merge(...job('failed-save')),/SYNTHETIC_MYSQL_COMMIT_FAILURE/);
  assert.equal(db.customers.length,1,'uncommitted save must roll back in-memory snapshot');
  assert.equal(db.customers[0].contactName,'Original Tenant Two');
  const work=Array.from({length:20},(_,i)=>scope.__merge(...job('spike-'+i)));
  const results=await Promise.all(work);
  assert.equal(results.reduce((sum,r)=>sum+Number(r.added||0),0),1,'20 concurrent merges must insert one lead');
  assert.equal(results.reduce((sum,r)=>sum+Number(r.duplicates||0),0),19,'19 merges must observe same tenant duplicate');
  assert.equal(db.customers.length,2,'tenant 2 preserved, tenant 1 added exactly once');
  assert.equal(db.customers.filter(c=>c.tenantId===1).length,1);
  assert.equal(db.customers.filter(c=>c.tenantId===2).length,1);
  assert.equal(db.customers.find(c=>c.tenantId===2).contactName,'Original Tenant Two','no cross-tenant data mutation');
  assert.equal(db.customers.find(c=>c.tenantId===2).leadScore,20,'no cross-tenant lead-score inflation');
  assert.equal(db.customers.find(c=>c.tenantId===1).contactName,'Tenant One Lead');
  assert(saves>=21&&audits>=21,'every attempted merge must record durable attempt/audit');
  if(process.argv.includes('--staged'))assert.equal(patched,base,'staged runtime must already contain the fix');
  console.log(JSON.stringify({status:'PASS_SYNTHETIC_V66111',concurrentCompletions:20,uniqueInserted:1,deduplicated:19,tenantsRetained:2,failedSaveRollback:'PASS',invalidTenantRejected:true,productionCalls:0,liveCertified:false}));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
