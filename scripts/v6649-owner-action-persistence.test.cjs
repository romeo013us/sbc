'use strict';
// Credential-free executed compiled routes with two synthetic tenants.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert.match(s,/SBC_V6649_DURABLE_OWNER_ACTIONS/);
const slice=(a,b)=>{const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>0&&end>start,a);return s.slice(start,end)};
const routes={},ownerOnly=()=>{},auth=()=>{};
let mode='pass',resolveCommit,saves=0;
const db={orders:[{id:'paid',tenantId:7,customerId:'cust7',paymentStatus:'PAID'},{id:'other',tenantId:8,paymentStatus:'PAID'},{id:'unpaid',tenantId:7,paymentStatus:'PENDING'}],fantastic4:{approvals:[],autonomous:{paused:true,mode:'SHADOW'}}};
const F4={approval(store,v){let x={...v,id:'a'+store.approvals.length,status:v.approved?'APPROVED':'REQUESTED'};store.approvals.unshift(x);return x}};
const AUTONOMOUS={setMode(store,m){store.autonomous.mode=m;return {mode:m}},resume(store){store.autonomous.paused=false;return {paused:false}},pause(store){store.autonomous.paused=true;return {paused:true}},summary(store){return {...store.autonomous}}};
const ctx={app:{post(p,...fn){routes[p]=fn}},auth,ownerOnly,db,F4,AUTONOMOUS,structuredClone,Date,
  SBC_RUNTIME_READ_ONLY:false,mysqlPool:{},sbcWriterLeaseReady:true,MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcShutdownStarted:false,
  requireRequestTenant:req=>{if(!req.tenantId)throw Error('TENANT_CONTEXT_REQUIRED');return req.tenantId},
  require:rel=>{assert.equal(rel,'./enterprise/v6640-payment-evidence.cjs');return require(path.join(root,'enterprise/v6640-payment-evidence.cjs'))},
  saveData:()=>{saves++;if(mode==='fail')return Promise.reject(Object.assign(Error('MYSQL_RELATIONAL_COMMIT_FAILED'),{code:'MYSQL_RELATIONAL_COMMIT_FAILED'}));if(mode==='wait')return new Promise(resolve=>{resolveCommit=resolve});return Promise.resolve({committed:true})},
  audit:()=>{}
};
const helper=slice('// SBC_V6649_DURABLE_OWNER_ACTIONS:',"app.get('/api/fantastic4/summary'");
const approval=slice("app.post('/api/fantastic4/approval'","app.post('/api/fantastic4/wordpress/provision'");
const activate=slice("app.post('/api/fantastic4/production-activate'","app.get('/api/fantastic4/cache'");
const toggle=s.split('\n').find(l=>l.startsWith("app.post('/api/fantastic4/autonomous/toggle'"));
vm.runInNewContext([helper,approval,activate,toggle].join('\n'),ctx,{filename:'compiled-owner-routes.js'});
for(const p of ['/api/fantastic4/approval','/api/fantastic4/production-activate','/api/fantastic4/autonomous/toggle'])assert.equal(routes[p][1],ownerOnly);
const request=(tenantId,body={})=>({tenantId,body,user:{id:'real-owner',role:'owner'}});
const response=()=>({statusCode:200,sent:false,status(n){this.statusCode=n;return this},json(x){this.sent=true;this.body=x;return this}});
async function post(path,req){const res=response();await routes[path].at(-1)(req,res);return res}
(async()=>{
  mode='wait';let res=response();
  const action=routes['/api/fantastic4/approval'].at(-1)(request(7,{orderId:'paid',approved:true,approvedBy:'forged'}),res);
  assert.equal(res.sent,false,'must wait for database');
  resolveCommit({committed:true});await action;
  assert.equal(res.statusCode,201);assert.equal(res.body.approval.approvedBy,'real-owner');assert.equal(res.body.approval.tenantId,7);
  assert.equal((await post('/api/fantastic4/approval',request(7,{orderId:'other',approved:true}))).statusCode,404);
  assert.equal((await post('/api/fantastic4/production-activate',request(7,{orderId:'unpaid'}))).statusCode,409);
  assert.equal((await post('/api/fantastic4/production-activate',request(8,{orderId:'paid'}))).statusCode,404);
  mode='fail';res=await post('/api/fantastic4/production-activate',request(7,{orderId:'paid'}));
  assert.equal(res.statusCode,503);assert.equal(db.fantastic4.approvals[0].status,'APPROVED','rollback activated status');
  res=await post('/api/fantastic4/approval',request(7,{orderId:'paid',approved:true}));
  assert.equal(res.statusCode,503);assert.equal(db.fantastic4.approvals.length,1,'rollback uncommitted owner approval');
  mode='pass';res=await post('/api/fantastic4/production-activate',request(7,{orderId:'paid'}));
  assert.equal(res.statusCode,200);assert.equal(db.fantastic4.approvals[0].status,'ACTIVE');
  mode='fail';res=await post('/api/fantastic4/autonomous/toggle',request(7,{enabled:true}));
  assert.equal(res.statusCode,503);assert.equal(db.fantastic4.autonomous.paused,true,'failed save may not leave autonomy running');
  ctx.SBC_RUNTIME_READ_ONLY=true;res=await post('/api/fantastic4/autonomous/toggle',request(7,{enabled:true}));
  assert.equal(res.statusCode,423);
  for(const action of ['demo-provision','handoff','qa','assets/sync','blueprints','autonomous/mode','autonomous/pause','autonomous/resume','autonomous/toggle','autonomous/event','corporate-evolution/evaluate']){
   const line=s.split('\n').find(l=>l.startsWith("app.post('/api/fantastic4/"+action+"'"));
   assert.ok(line,action);assert.match(line,/async\(req,res\)=>/);assert.match(line,/await saveData\(\)/);assert.match(line,/SBC_V6649_REQUIRE_WRITER\(\)/);
  }
  console.log('[SBC V6649] PASS: 13 owner-control routes, database acknowledgement, denied cross-tenant access, no unpaid activation, and rollback on rejected saves');
})().catch(e=>{console.error(e);process.exitCode=1});
