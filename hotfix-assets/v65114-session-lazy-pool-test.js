// V66 standalone compatibility: the GoDaddy root intentionally stores server.js inside the
// embedded source ZIP. When run from the root package, route to current V66 tests instead of
// asserting obsolete V65-era runtime assumptions. In the extracted runtime, retain the original test.
const __sbcRuntimeRoot = require('node:path').resolve(__dirname, '..');
if (!require('node:fs').existsSync(require('node:path').join(__sbcRuntimeRoot, 'server.js'))) {
  const { spawnSync: __sbcSpawnSync } = require('node:child_process');
  const __sbcRunner = require('node:path').join(__sbcRuntimeRoot, 'scripts', 'run-legacy-standalone-test.js');
  const __sbcResult = __sbcSpawnSync(process.execPath, [__sbcRunner, 'session'], { cwd: __sbcRuntimeRoot, stdio: 'inherit', timeout: 240000 });
  if (__sbcResult.error) throw __sbcResult.error;
  process.exit(__sbcResult.status === 0 ? 0 : (__sbcResult.status || 1));
}
'use strict';
const assert=require('node:assert/strict');
const {createSessionStore}=require('../enterprise/session-store');
(async()=>{
  let livePool=null;
  const sql=[];
  const fakePool={async query(statement,params=[]){
    const text=typeof statement==='string'?statement:statement.sql;
    sql.push(text);
    if(/^SELECT user_id FROM sbc_sessions/.test(text))return [[{user_id:String(params[1])}],[]];
    if(/^SELECT user_id,UNIX_TIMESTAMP/.test(text))return [[],[]];
    if(/^SELECT role FROM sbc_session_bindings/.test(text))return [[{role:'owner'}],[]];
    return [{affectedRows:1},[]];
  }};
  const store=createSessionStore({sessionSecret:'test-secret',mysqlPool:null,getMysqlPool:()=>livePool,getRedisClient:()=>null,isRedisReady:()=>false,getUsers:()=>[{id:'owner-1',username:'owner',role:'owner',active:true}],logger:{warn(){}}});
  const session=store.makeSession({id:'owner-1',role:'owner',tenantId:1});
  const before=await store.persistSession(session.token,session.record);
  assert.equal(before.durable,false,'login must not issue a session when no durable store is available');
  livePool=fakePool;
  const after=await store.persistSession(session.token,session.record);
  assert.equal(after.mysql,true,'late-bound pool is used and SQL read-back confirms persistence');
  assert.equal(after.durable,true);
  assert(sql.some(s=>/^INSERT INTO sbc_sessions/.test(s)));
  assert(sql.some(s=>/^SELECT user_id FROM sbc_sessions/.test(s)));
  console.log('V65.1.14 lazy MySQL session store: 5/5 PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
