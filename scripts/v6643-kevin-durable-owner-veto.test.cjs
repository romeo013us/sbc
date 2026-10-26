'use strict';
/** Run against the exact reconstructed runtime; no credentials or real customer writes. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const file=path.join(root,'enterprise/kevin/kevin-runtime.cjs');
const code=fs.readFileSync(file,'utf8');
assert.match(code,/SBC_V6643_DURABLE_OWNER_VETO_AND_KEVIN_REVENUE/);
assert.match(code,/ownerVetoActive:vetoReceipt\.active/);
assert.doesNotMatch(code,/ownerVetoActive:false, credentialModification/);
assert.match(code,/vetoStore\.save\(rootDir,req\.body\.active\)/);
assert.match(code,/typeof req\.body\?\.active!=='boolean'/);
assert.match(code,/process\.env\.SBC_RUNTIME_ROLE/);
new vm.Script(code,{filename:file});
const {HardenedControlPlane,sbcV6643SummarizeDb}=require(file);
const store=require(path.join(root,'enterprise/kevin/owner-veto-store.cjs'));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-kevin-owner-veto-'));
const oldRole=process.env.SBC_RUNTIME_ROLE;
(async()=>{
 try{
  fs.mkdirSync(path.join(tmp,'data'));
  assert.deepEqual(store.read(tmp).active,true,'missing veto is ON');
  assert.equal(store.read(tmp).verified,false);
  process.env.SBC_RUNTIME_ROLE='readonly';
  assert.throws(()=>store.save(tmp,false),/KEVIN_VETO_WRITER_REQUIRED/);
  assert.equal(store.read(tmp).active,true,'Preview must not clear veto');
  process.env.SBC_RUNTIME_ROLE='writer';
  assert.throws(()=>store.save(tmp,'false'),/KEVIN_VETO_BOOLEAN_REQUIRED/);
  assert.equal(store.save(tmp,false).active,false,'owner can durably clear after explicit approval');
  assert.equal(store.read(tmp).active,false,'cleared state persists across independent reads');
  assert.equal(store.read(tmp).verified,true);
  assert.equal(store.save(tmp,true).active,true,'owner can raise veto');
  assert.equal(store.read(tmp).active,true,'raised veto persists across restart');
  const receiptPath=path.join(tmp,'data',store.FILE);
  fs.writeFileSync(receiptPath,'{"schema":1,"active":false}',{mode:0o600});
  assert.equal(store.read(tmp).active,true,'truncated receipt cannot clear veto');
  assert.equal(store.read(tmp).verified,false);
  fs.unlinkSync(receiptPath);
  fs.symlinkSync(path.join(tmp,'outside.json'),receiptPath);
  assert.equal(store.read(tmp).active,true,'symlink attack cannot clear veto');
  fs.unlinkSync(receiptPath);
  const broken=path.join(tmp,'missing-subdir');
  assert.throws(()=>store.save(broken,false),'failed disk write must not clear veto');
  const finance=sbcV6643SummarizeDb({customers:[],leads:[],orders:[
    {id:'workflow-paid-only',status:'Paid',paymentStatus:'Pending',total:99999},
    {id:'delivered-but-unpaid',status:'Fulfilled',total:2000},
    {id:'confirmed',status:'Open',paymentStatus:'Paid',total:349},
    {id:'square-paid',status:'Open',paymentStatus:'Pending',squarePaymentStatus:'COMPLETED',total:199},
    {id:'refund',status:'Paid',paymentStatus:'REFUNDED',total:700}
  ]});
  assert.equal(finance.collectedRevenue,548,'Kevin must exclude workflow-paid and refunded orders');
  const config={governance:{ownerVetoActive:true}};
  const control=new HardenedControlPlane({rootDir:tmp,mysqlPoolGetter:()=>null,config});
  control.ledgerGet=async()=>null;
  control.ledgerAppend=async()=>({id:'audit-only'});
  control.verifyIndependent=async()=>({passed:true});
  const forbidden=await control.routeAction({tenantId:1, result:{directive:{id:'case1',type:'HEALTH_CHECK',payload:{type:'HEALTH_CHECK'}},simulation:{pass:true},council:{consensus:true},adversarial:{pass:true}},dryRun:false});
  assert.equal(forbidden.status,'FROZEN','owner veto blocks all execution, including green actions');
  assert.equal(forbidden.execution.reason,'OWNER_VETO');
  await assert.rejects(control.executeSafe({type:'HEALTH_CHECK'}),/KEVIN_OWNER_VETO_ACTIVE/);
  const staged=await control.stageYellow({tenantId:1,proposalId:'case2',type:'BULK_UPDATE',payload:{},idempotencyKey:'id'});
  assert.equal(staged.status,'FROZEN','owner veto blocks staged workflow');
  console.log('[SBC V6643] PASS durable veto across restart, Preview lock, bad receipts, failed writes, green/staged veto, real collected revenue');
 }finally{
  if(oldRole===undefined)delete process.env.SBC_RUNTIME_ROLE;else process.env.SBC_RUNTIME_ROLE=oldRole;
  fs.rmSync(tmp,{recursive:true,force:true});
 }
})().catch(e=>{console.error('[SBC V6643]',e);process.exitCode=1});
