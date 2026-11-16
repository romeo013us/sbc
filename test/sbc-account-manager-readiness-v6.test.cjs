'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {runWithTenantContext}=require('../enterprise/tenant-context.cjs');
const assess=require('../enterprise/sbc-account-manager-readiness-v6.cjs');
const register=require('../routes/account-portfolios-v1.cjs');
const tenantId=5;
const staff=[
 {id:'m1',tenantId:5,role:'account_manager',active:true,name:'Manager One'},
 {id:'m2',tenantId:5,role:'account_manager',active:true},
 {id:'legacy',tenantId:5,role:'caller',active:true},
 {id:'disabled',tenantId:5,role:'account_manager',active:false},
 {id:'foreign',tenantId:9,role:'account_manager',active:true}
];
function crm(id,assigned_to,status='Lead',t=5){return {id,assigned_to,status,tenant_id:t}}
function social(customer_id,manager_id,t=5){return {customer_id,manager_id,tenant_id:t}}
const crmRows=[
 crm('c1','m1'),crm('c2','m1','Customer'),crm('c3','legacy'),
 crm('c4','disabled'),crm('c5','foreign'),crm('c6',''),
 crm('c7','m2')
];
const socialRows=[
 social('c1','m1'),social('c2','m2'),social('c6','m1'),
 social('c3','legacy'),social('gone','m1')
];
test('V6 identifies every owner review class without changing CRM or social ownership',()=>{
 const original=JSON.stringify({crmRows,socialRows,staff});
 const data=assess({crmRows,socialRows,users:staff,tenantId,observedAt:Date.parse('2026-11-16T17:30:00Z')});
 assert.equal(data.status,'ACTION_REQUIRED');
 assert.equal(data.crm.total,7);
 assert.equal(data.crm.unassigned,1);
 assert.equal(data.crm.activeAccountManagerAssigned,3);
 assert.equal(data.crm.legacyCallerAssigned,1);
 assert.equal(data.crm.invalidAssignee,2);
 assert.equal(data.social.total,5);
 assert.equal(data.social.aligned,2);
 assert.equal(data.social.ownerMismatch,2);
 assert.equal(data.social.unlinkedAccount,1);
 assert.equal(data.social.danglingAccount,1);
 assert.equal(data.social.missingForManager,1);
 assert(data.issues.some(x=>x.code==='LEGACY_CALLER_ACCOUNTS'));
 assert(data.issues.some(x=>x.code==='INACTIVE_OR_UNKNOWN_MANAGER'));
 assert(data.issues.some(x=>x.code==='SOCIAL_ASSIGNMENT_DRIFT'));
 assert.deepEqual(JSON.stringify({crmRows,socialRows,staff}),original);
 assert.equal(data.autoCorrections,0);
 assert.equal(data.socialAccessGranted,false);
 assert(!JSON.stringify(data).includes('phone'));
});
test('V6 aligned audit is analysis only, not a production certification',()=>{
 const data=assess({crmRows:[crm('a','m1')],socialRows:[social('a','m1')],users:staff,tenantId});
 assert.equal(data.status,'ALIGNED');
 assert.equal(data.issues.length,0);
 assert.equal(data.productionReady,false);
 assert.equal(data.socialAccessGranted,false);
});
test('V6 fails closed on duplicate rows, tenant leakage, incomplete scans, unsupported data',()=>{
 for(const config of [
  {crmRows:[crm('a','m1'),crm('a','m1')],socialRows:[]},
  {crmRows:[],socialRows:[social('a','m1'),social('a','m2')]},
  {crmRows:[crm('other','m1','Lead',9)],socialRows:[]},
  {crmRows:[],socialRows:[social('other','m1',9)]},
  {crmRows:Array.from({length:5001},(_,i)=>crm('c'+i,'m1')),socialRows:[]},
  {crmRows:[],socialRows:null}
 ])assert.throws(()=>assess({...config,users:staff,tenantId}),/READINESS_/);
});
test('V6 owner-only endpoint uses two tenant-filtered SELECTs; no writes or access grants',async()=>{
 let queries=[],released=0,broken=false,wrongTenant=false;
 const app=express();app.use((req,res,next)=>{
  const key=req.get('x-test-role')||'owner';
  req.user=key==='owner'?{id:'owner',role:'owner',tenantId:5}:
   key==='manager'?{id:'m1',role:'account_manager',tenantId:5}:
   key==='otherowner'?{id:'owner9',role:'owner',tenantId:9}:
   key==='guest'?null:{id:'caller',role:'caller',tenantId:5};
  if(!req.user)return next();
  return runWithTenantContext({tenantId:req.user.tenantId,actorId:req.user.id},()=>next());
 });
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const conn={async query(sql,params){
  queries.push({sql,params});
  if(broken)throw Error('MISSING_SOCIAL_TABLE');
  if(/FROM sbc_customers /.test(sql)){
   return [[...crmRows.filter(r=>r.tenant_id===params[0]).map(r=>wrongTenant?{...r,tenant_id:9}:r)],[]];
  }
  if(/FROM sbc_account_ownership_v1 /.test(sql)){
   return [[...socialRows.filter(r=>r.tenant_id===params[0])],[]];
  }
  throw Error('Unexpected query: '+sql);
 },release(){released++}};
 register(app,{auth,getContext:()=>({
  db:{users:staff},mysqlPool:{getConnection:async()=>conn},recoveryRequired:()=>false
 })});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 const call=async who=>{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v6606/crm/account-portfolios/launch-readiness',
   {headers:{'x-test-role':who}});
  return {status:response.status,body:await response.json()};
 };
 try{
  assert.equal((await call('guest')).status,401);
  assert.equal((await call('manager')).status,403);
  assert.equal((await call('caller')).status,403);
  assert.equal((await call('otherowner')).status,200);
  queries=[];
  const owner=await call('owner');
  assert.equal(owner.status,200);
  assert.equal(owner.body.ok,true);
  assert.equal(owner.body.audit.status,'ACTION_REQUIRED');
  assert.equal(owner.body.audit.social.aligned,2);
  assert.equal(owner.body.audit.autoCorrections,0);
  assert.equal(owner.body.audit.productionReady,false);
  assert.equal(queries.length,2);
  assert(queries.every(q=>/^SELECT /i.test(q.sql)));
  assert(queries.every(q=>q.params[0]===5));
  assert(queries.every(q=>q.params[1]===5001));
  assert.equal(queries.some(q=>/SELECT \*/i.test(q.sql)),false);
  broken=true;assert.equal((await call('owner')).status,503);
  broken=false;wrongTenant=true;assert.equal((await call('owner')).status,503);
  assert(released>=4);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('V6 is owner-only in portfolio UI, not part of Account Manager allowlist',()=>{
 const fs=require('node:fs');
 const src=fs.readFileSync('public/sbc-account-portfolios-v1.js','utf8');
 assert.match(src,/Run Account Manager Readiness Audit/);
 assert.match(src,/launch-readiness/);
 assert.equal(fs.readFileSync('browser_public/sbc-account-portfolios-v1.js','utf8'),src);
 const gate=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 assert.equal(gate.allowed('GET','/api/v6606/crm/account-portfolios/launch-readiness'),false);
});
