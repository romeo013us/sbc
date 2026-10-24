'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const lines=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8').split(/\r?\n/);
const one=prefix=>{
 const found=lines.filter(x=>x.startsWith(prefix));
 if(found.length!==1)throw Error('expected 1 voice route '+prefix+', found '+found.length);
 return found[0];
};
const app={handlers:new Map(),post(p,...args){this.handlers.set(p,args.at(-1))}};
const db={customers:[{id:'lead-x',tenantId:1},{id:'lead-y',tenant_id:2}],callLogs:[],activities:[],auditLog:[]};
let stored=[],failSave=false,skipMysqlWrite=false,saves=0,checks=[],counter=0;
const mysqlPool={async query(sql,args){
 assert.match(sql,/JSON_CONTAINS\(payload/);
 assert.equal(args.length,5);
 const found=stored.find(x=>String(x.id)===String(args[0])&&Number(x.tenantId)===Number(args[1])&&x.status===args[2]&&x.notes===args[3]&&x.outcome===args[4]);
 return [[{confirmed:found?1:0}],[]];
}};
const routeSource=one("app.post('/api/voice/log',auth,");
const mutexPrelude=one('let sbcVoiceLogCommitTailV6615=');
const make=new Function('app','auth','db','requireRequestTenant','now','id','normalizeDialNumber','saveData','audit','addActivity','mysqlPool',mutexPrelude+'\n'+routeSource);
make(app,()=>{},db,r=>r.authTenant,()=>new Date('2026-10-24T17:00:00Z').toISOString(),
 prefix=>prefix+'-'+(++counter),v=>String(v??''),
 async()=>{saves++;await new Promise(done=>setTimeout(done,3));if(failSave)throw Error('SIMULATED_MYSQL_FAILURE');if(!skipMysqlWrite)stored=db.callLogs.map(x=>({...x}));},
 ()=>{db.auditLog.push({event:'voice_call'})},
 ()=>{db.activities.push({type:'call'})},
 mysqlPool);
const handler=app.handlers.get('/api/voice/log');assert.equal(typeof handler,'function');
const res=()=>({code:200,body:null,status(x){this.code=x;return this},json(x){this.body=x;return this}});
const req=(sessionId,notes,status='connecting',customerId='lead-x',tenant=1)=>({
 authTenant:tenant,user:{id:'operator',name:'Sales Operator',role:'caller',tenantId:tenant},
 body:{sessionId,notes,status,customerId,to:'+13055551234',outcome:'Pending'}
});
async function call(request){const r=res();await handler(request,r);return r}
const check=(label,fn)=>{fn();checks.push(label)};
(async()=>{
 let r=await call(req('s-good','Initial note'));
 check('successful write requires matching MySQL workspace row',()=>{
  assert.equal(r.code,201);assert.equal(r.body.durable,true);
  assert.equal(stored.length,1);
 });
 const prior=db.callLogs.map(x=>({...x}));
 skipMysqlWrite=true;
 r=await call(req('s-not-durable','Pretend persist succeeded'));
 check('silent fallback cannot report a durable call log',()=>{
  assert.equal(r.code,503);assert.equal(r.body.durable,false);
  assert.equal(r.body.error,'VOICE_LOG_NOT_DURABLE');
 });
 check('false durability leaves original in-memory call logs intact',()=>{
  assert.deepEqual(db.callLogs,prior);assert.equal(stored.length,1);
 });
 skipMysqlWrite=false;
 failSave=true;
 r=await call(req('s-writer-failed','MySQL rejected call log'));
 check('explicit MySQL snapshot failure returns 503',()=>assert.equal(r.code,503));
 check('failed snapshot does not leave phantom call in memory',()=>assert.deepEqual(db.callLogs,prior));
 failSave=false;
 const results=await Promise.all([
  call(req('race-one','Parallel A')),
  call(req('race-two','Parallel B'))
 ]);
 check('two concurrent valid calls both succeed under serialized writer',()=>{
  assert.deepEqual(results.map(x=>x.code),[201,201]);assert.equal(db.callLogs.length,3);
 });
 check('both concurrent logs are persisted to MySQL snapshot',()=>{
  assert.equal(stored.length,3);
  assert.equal(stored.find(x=>x.sessionId==='race-one').notes,'Parallel A');
  assert.equal(stored.find(x=>x.sessionId==='race-two').notes,'Parallel B');
 });
 r=await call(req('race-one','New note after save'));
 check('repeat notes edit returns durable confirmation',()=>{
  assert.equal(r.code,200);assert.equal(r.body.durable,true);
  assert.equal(stored.length,3);
  assert.equal(stored.find(x=>x.sessionId==='race-one').notes,'New note after save');
 });
 check('all queued writes release lock even on failure',()=>assert.equal(saves,6));
 console.log(JSON.stringify({status:'PASS_V6615_STRICT_CALL_LOG_DURABILITY',checks:checks.length,assertions:checks,synthetic:true,mysqlSqlVerifiedSeparately:true},null,2));
})().catch(e=>{console.error('VOICE_LOG_DURABILITY_GATE_FAILED',e.stack||e);process.exitCode=1});
