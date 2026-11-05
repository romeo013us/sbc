'use strict';
// V66.82: synthetic-only regression. No real MySQL, vendors, webhooks or money.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const finance=require('../enterprise/v569-production-expansion.js');
const {patchSource,MARK}=require('./v6682-stage-owner-clearance.cjs');
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const LOCK=(more={})=>({
  lock_id:'lock-1',tenant_id:1,resource_id:'job-1',action:'vendor_fulfillment',amount:'10000.00',
  status:'OWNER_AUTHORIZED',owner_authorized_by:'owner-1',owner_authorized_at:'2026-11-05 11:00:00',
  automation_allowed:1,...more
});
function pool(seed=[]){
  const rows=seed.map(x=>({...x}));
  const db={queries:[],updates:0,async query(sql,args){
    db.queries.push({sql,args});
    const n=sql.replace(/\s+/g,' ').toUpperCase();
    if(n.startsWith('SELECT * FROM SBC_FINANCIAL_VAULT_LOCKS WHERE LOCK_ID=? AND TENANT_ID=?'))
      return [rows.filter(r=>r.lock_id===args[0]&&r.tenant_id===args[1]).map(r=>({...r}))];
    if(n.startsWith('SELECT * FROM SBC_FINANCIAL_VAULT_LOCKS WHERE TENANT_ID=? AND RESOURCE_ID=? AND ACTION=? AND AMOUNT=?'))
      return [rows.filter(r=>r.tenant_id===args[0]&&r.resource_id===args[1]&&r.action===args[2]&&Number(r.amount)===args[3]).map(r=>({...r})).slice(0,1)];
    if(n.startsWith('UPDATE SBC_FINANCIAL_VAULT_LOCKS SET STATUS=')){
      const row=rows.find(r=>r.lock_id===args[1]&&r.tenant_id===args[2]&&r.status==='OWNER_LOCKED');
      if(!row)return [{affectedRows:0}];
      row.status='OWNER_AUTHORIZED';row.owner_authorized_by=args[0];row.owner_authorized_at='2026-11-05 11:00:00';row.automation_allowed=1;db.updates++;return [{affectedRows:1}];
    }
    throw Error('Unexpected mock SQL '+sql);
  }};
  return db;
}
const gate=(db,more={})=>finance.financialExecutionGate({
  pool:db,amount:10000,tenantId:1,resourceId:'job-1',lockId:'lock-1',action:'vendor_fulfillment',...more
});
let passed=0;
async function test(label,fn){await fn();passed++;console.log('PASS',label);}
function route(vault,status='owner_clearance_required'){
  const job={id:'job-1',tenantId:1,value:10000,status,financialLockId:'lock-1',orderId:'order-1'};
  const db=pool(vault?[vault]:[]);let handler,saves=0;
  const patched=patchSource(source),start=patched.indexOf("app.post('/api/v566/delivery/approve/:jobId'");
  const end=patched.indexOf('\n\nregisterAgentOSRoutes(',start);
  assert.ok(start>0&&end>start);
  vm.runInNewContext(patched.slice(start,end),{
    app:{post(url,a,b,cb){handler=cb}},auth(){},ownerOnly(){},
    __sbcRequireTenantId:v=>Number(v),megaData:()=>({fulfillmentJobs:[job]}),
    mysqlPool:db,V569_PRODUCTION_EXPANSION:finance,
    now:()=>new Date().toISOString(),megaSave:async()=>{saves++},
    audit(){},BUILD_VERSION:'66.0.0',console
  });
  return {db,job,saves:()=>saves,async call(tenantId=1){
    let code=200,result;
    const res={status(v){code=v;return this},json(v){result=v;return this}};
    await handler({tenantId,params:{jobId:'job-1'},user:{id:'owner-1'}},res);
    return {code,result};
  }};
}
(async()=>{
  await test('exact approval',async()=>assert.equal((await gate(pool([LOCK()]))).authorized,true));
  await test('wrong job denied',async()=>assert.rejects(gate(pool([LOCK()]),{resourceId:'job-other'}),/RESOURCE_MISMATCH/));
  await test('wrong action denied',async()=>assert.rejects(gate(pool([LOCK()]),{action:'other_action'}),/ACTION_MISMATCH/));
  await test('higher amount denied',async()=>assert.rejects(gate(pool([LOCK()]),{amount:25000}),/AMOUNT_MISMATCH/));
  await test('changed lower amount denied',async()=>assert.rejects(gate(pool([LOCK({amount:'25000.00'})])),/AMOUNT_MISMATCH/));
  await test('unknown explicit lock never falls back',async()=>{
    const p=pool([LOCK()]);await assert.rejects(gate(p,{lockId:'unknown'}),/OWNER_HARD_BREAKPOINT/);
    assert.equal(p.queries.length,1);
  });
  await test('implicit lookup bound to tenant, job, action, amount',async()=>{
    const p=pool([LOCK()]);assert.equal((await gate(p,{lockId:null})).authorized,true);
    assert.equal(p.queries[0].args.length,4);
  });
  await test('cross-tenant denied',async()=>assert.rejects(gate(pool([LOCK()]),{tenantId:2}),/OWNER_HARD_BREAKPOINT/));
  await test('unapproved, unsigned, disabled denied',async()=>{
    for(const more of [{status:'OWNER_LOCKED'},{owner_authorized_by:null},{owner_authorized_at:null},{automation_allowed:0}])
      await assert.rejects(gate(pool([LOCK(more)])),/OWNER_HARD_BREAKPOINT/);
  });
  await test('invalid amounts denied',async()=>{
    for(const amount of [undefined,null,NaN,Infinity,-1,'',10000.001,9999.999,false])
      await assert.rejects(gate(pool([LOCK()]),{amount}),/FINANCIAL_AMOUNT_INVALID/);
  });
  await test('25 concurrent approvals: one atomic UPDATE',async()=>{
    const p=pool([LOCK({status:'OWNER_LOCKED',owner_authorized_by:null,owner_authorized_at:null,automation_allowed:0})]);
    const results=await Promise.all(Array.from({length:25},()=>finance.authorizePersistentFinancialExecution(p,'lock-1','owner-1',{tenantId:1})));
    assert.equal(p.updates,1);assert.equal(results.filter(r=>r.approvalOutcome==='AUTHORIZED').length,1);
  });
  await test('staged owner route patch idempotent and present',async()=>{
    const s=patchSource(source);assert.ok(s.includes(MARK));assert.equal(patchSource(s),s);
  });
  await test('route missing vault never clears UI',async()=>{
    const r=route(null),x=await r.call();assert.equal(x.code,400);assert.equal(r.saves(),0);assert.equal(r.job.status,'owner_clearance_required');
  });
  await test('route mismatched job amount never clears UI',async()=>{
    const r=route(LOCK({amount:'25000.00'})),x=await r.call();assert.equal(x.code,400);assert.equal(r.saves(),0);
  });
  await test('route cross-tenant cannot access job',async()=>{
    const r=route(LOCK()),x=await r.call(2);assert.equal(x.code,404);assert.equal(r.saves(),0);
  });
  await test('route processing job cannot reset to ready',async()=>{
    const r=route(LOCK(),'processing'),x=await r.call();assert.equal(x.code,400);assert.equal(r.saves(),0);
  });
  await test('route saves only after durable vault authorization',async()=>{
    const r=route(LOCK({status:'OWNER_LOCKED',owner_authorized_by:null,owner_authorized_at:null,automation_allowed:0}));
    const x=await r.call();assert.equal(x.code,202);assert.equal(x.result.status,'CLEARED');
    assert.equal(r.db.updates,1);assert.equal(r.saves(),1);assert.equal(r.job.status,'ready');
  });
  console.log('V66.82 synthetic regression checks passed:',passed);
})().catch(e=>{console.error(e);process.exitCode=1});
