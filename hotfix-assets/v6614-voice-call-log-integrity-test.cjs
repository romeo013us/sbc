'use strict';
/* Call-log route regression: real reconstructed handler functions; synthetic credentials
   and records; no Twilio network calls and no production database changes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const line=(needle)=>{
  const matches=code.split(/\r?\n/).filter(x=>x.startsWith(needle));
  if(matches.length!==1)throw Error('VOICE_REGRESSION_EXPECTED_ONE_HANDLER '+needle+' got '+matches.length);
  return matches[0];
};
const getSource=line("app.get('/api/voice/logs',auth,");
const postSource=line("app.post('/api/voice/log',auth,");
const serialPrelude=code.split(/\r?\n/).find(x=>x.startsWith('let sbcVoiceLogCommitTailV6615='))||'';
const app={
  handlers:new Map(),
  get(p,...args){this.handlers.set('GET '+p,args.at(-1))},
  post(p,...args){this.handlers.set('POST '+p,args.at(-1))}
};
const db={
 customers:[
  {id:'lead-a',tenantId:1,businessName:'Tenant A'},
  {id:'lead-a',tenantId:2,businessName:'Tenant B'},
  {id:'orphan',businessName:'Legacy unowned'},
  {id:'tenant2-only',tenant_id:2,businessName:'Tenant B only'}
 ],
 callLogs:[]
};
const counters={saved:0,audited:0,activities:0};
let mysqlProofAvailable=true;
const mysqlPool={async query(sql,params){
 assert.match(sql,/SELECT JSON_CONTAINS\(/);
 assert.equal((sql.match(/\?/g)||[]).length,5);
 assert.equal(params.length,5);
 const valid=mysqlProofAvailable && db.callLogs.some(log=>log.id===params[0]&&Number(log.tenantId)===Number(params[1])&&log.status===params[2]&&log.notes===params[3]&&log.outcome===params[4]);
 return [[{confirmed:valid?1:0}],[]];
}};
let serial=0;
const load=new Function('app','auth','db','requireRequestTenant','now','id',
 'normalizeDialNumber','saveData','audit','addActivity','mysqlPool',serialPrelude+'\n'+getSource+'\n'+postSource);
load(app,()=>{},db,
 req=>{if(!Number.isInteger(req.authTenant)||req.authTenant<1)throw Error('AUTHENTICATED_TENANT_REQUIRED');return req.authTenant},
 ()=>new Date('2026-10-24T14:05:09.000Z').toISOString(),
 prefix=>prefix+'-'+(++serial),
 value=>String(value||''),
 async()=>{counters.saved++},
 ()=>{counters.audited++},
 ()=>{counters.activities++},
 mysqlPool
);
const post=app.handlers.get('POST /api/voice/log');
const get=app.handlers.get('GET /api/voice/logs');
assert.equal(typeof post,'function');
assert.equal(typeof get,'function');
const res=()=>({
 statusCode:200,body:null,
 status(code){this.statusCode=code;return this},
 json(body){this.body=body;return this}
});
const user=(id,tenantId,role='caller')=>({id,name:id,role,tenantId});
const request=(tenantId,actor='caller1',role='caller',body={})=>({
  authTenant:tenantId,user:user(actor,tenantId,role),body,
  query:{customerId:body.customerId??'lead-a'}
});
const checks=[];
const check=(label,fn)=>{fn();checks.push(label)};
async function invokePost(req){const r=res();await post(req,r);return r}
function invokeGet(req){const r=res();get(req,r);return r}
async function run(){
 const args={customerId:'lead-a',sessionId:'s-1',status:'connecting',notes:'Initial customer note',to:'+13055550101'};
 const connect=await invokePost(request(1,'caller1','caller',args));
 check('new connecting call succeeds as one CRM session',()=>{
  assert.equal(connect.statusCode,201);assert.equal(db.callLogs.length,1);assert.equal(db.callLogs[0].status,'connecting')
 });
 check('connecting call is not erroneously marked ended',()=>{
  assert.equal(db.callLogs[0].endedAt,'');assert.equal(counters.audited,0)
 });
 const active=await invokePost(request(1,'caller1','caller',{...args,status:'in-progress',notes:'Customer requested website'}));
 check('in-progress note autosave updates same log',()=>{
  assert.equal(active.statusCode,200);assert.equal(db.callLogs.length,1);assert.equal(db.callLogs[0].notes,'Customer requested website')
 });
 check('in-progress autosave does not mark ended',()=>{
  assert.equal(db.callLogs[0].endedAt,'');assert.equal(counters.audited,0)
 });
 const ended=await invokePost(request(1,'caller1','caller',{...args,status:'completed',durationSec:45,notes:'Booked appointment'}));
 check('completed session gets genuine terminal endedAt',()=>{
  assert.equal(ended.statusCode,200);assert.ok(db.callLogs[0].endedAt);assert.equal(db.callLogs[0].durationSec,45)
 });
 check('terminal event audited exactly once',()=>{
  assert.equal(counters.audited,1);assert.equal(counters.activities,1)
 });
 const resaved=await invokePost(request(1,'caller1','caller',{...args,status:'completed',notes:'Updated completed call notes'}));
 check('repeat terminal notes update is idempotent',()=>{
  assert.equal(resaved.statusCode,200);assert.equal(db.callLogs.length,1);
  assert.equal(counters.audited,1);assert.equal(db.callLogs[0].notes,'Updated completed call notes')
 });
 const owner=invokeGet(request(1,'owner1','owner',{customerId:'lead-a'}));
 check('owner sees call history only for own tenant',()=>{
  assert.equal(owner.statusCode,200);assert.equal(owner.body.rows.length,1)
 });
 const otherCaller=invokeGet(request(1,'caller2','caller',{customerId:'lead-a'}));
 check('other caller does not see first caller private notes',()=>{
  assert.equal(otherCaller.statusCode,200);assert.deepEqual(otherCaller.body.rows,[])
 });
 const foreignOwner=invokeGet(request(2,'tenant2owner','owner',{customerId:'lead-a'}));
 check('same customer ID in tenant B never exposes tenant A notes',()=>{
  assert.equal(foreignOwner.statusCode,200);assert.equal(foreignOwner.body.rows.length,0)
 });
 const orphanRead=invokeGet(request(1,'owner1','owner',{customerId:'orphan'}));
 check('orphaned unowned customer is invisible to voice history',()=>assert.equal(orphanRead.statusCode,404));
 const orphanWrite=await invokePost(request(1,'caller1','caller',{customerId:'orphan',sessionId:'orphan-session',status:'completed'}));
 check('orphaned unowned customer cannot receive new call log',()=>assert.equal(orphanWrite.statusCode,404));
 const foreignRecord=await invokePost(request(1,'caller1','caller',{customerId:'tenant2-only',sessionId:'foreign-session',status:'completed'}));
 check('foreign tenant customer cannot receive tenant A call log',()=>assert.equal(foreignRecord.statusCode,404));
 const parallel=await invokePost(request(2,'tenant2caller','caller',{customerId:'lead-a',sessionId:'s-1',status:'connecting'}));
 check('identical session ID belongs to independent tenant',()=>{
  assert.equal(parallel.statusCode,201);assert.equal(db.callLogs.length,2);
  assert.equal(db.callLogs[0].tenantId,2);assert.equal(db.callLogs[0].endedAt,'')
 });
 const queued=await invokePost(request(2,'tenant2caller','caller',{customerId:'lead-a',sessionId:'s-1',status:'failed'}));
 check('failed call closes with its own terminal timestamp',()=>{
  assert.equal(queued.statusCode,200);assert.ok(db.callLogs[0].endedAt)
 });
 check('only valid persisted updates invoke saveData',()=>assert.equal(counters.saved,6));
 console.log(JSON.stringify({
  status:'PASS_V6614_VOICE_CALL_LOG_INTEGRITY',
  checks:checks.length,
  assertions:checks,
  synthetic:true,
  liveVoiceValidated:false,
  persistedMysqlValidated:false,
  tenantSafety:'foreign, orphan and cross-user access blocked'
 },null,2));
}
run().catch(e=>{console.error('VOICE_LOG_GATE_FAILED',e.stack||e);process.exitCode=1});
