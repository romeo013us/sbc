'use strict';
/*
  Actual MySQL 8 lease ownership / disconnect integration gate.
  Zero data mutations: only GET_LOCK/IS_USED_LOCK/RELEASE_LOCK and CONNECTION_ID.
  Exclusive to the ephemeral sbc_ci_disposable CI database.
*/
const assert=require('node:assert/strict');
const mysql=require('mysql2/promise');
async function main(){
 if(process.env.CI!=='true'||process.env.SBC_MYSQL_CI_DISPOSABLE!=='yes'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE: CI disposable readonly only');
 if(!['127.0.0.1','localhost'].includes(process.env.MYSQL_HOST)||process.env.MYSQL_DATABASE!=='sbc_ci_disposable')throw Error('REFUSE: unexpected database identity');
 const opts={host:process.env.MYSQL_HOST,port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER,password:process.env.MYSQL_PASSWORD,database:process.env.MYSQL_DATABASE,connectTimeout:5000,enableKeepAlive:true};
 const name='sbc:ci:writer:disconnect:v6618';
 const check=[];
 const mark=(label,valid)=>{assert.ok(valid,label);check.push(label)};
 let first,observer,successor,competing;
 const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  first=await mysql.createConnection(opts);
  observer=await mysql.createConnection(opts);
  const [[owned]]=await first.query('SELECT GET_LOCK(?,0) AS acquired, CONNECTION_ID() AS sessionId',[name]);
  mark('first session acquires exclusive advisory lock',Number(owned.acquired)===1);
  const [[checkOwner]]=await observer.query('SELECT IS_USED_LOCK(?) AS owner',[name]);
  mark('independent session sees exact lease owner',Number(checkOwner.owner)===Number(owned.sessionId));
  const [[blocked]]=await observer.query('SELECT GET_LOCK(?,0) AS acquired',[name]);
  mark('second session cannot steal held lease',Number(blocked.acquired)===0);
  await first.destroy();first=null;
  let free=false;
  for(let i=0;i<30;i++){
   const [[r]]=await observer.query('SELECT IS_FREE_LOCK(?) AS free',[name]);
   if(Number(r.free)===1){free=true;break}
   await sleep(100);
  }
  mark('MySQL releases advisory lease when its socket is destroyed',free);
  successor=await mysql.createConnection(opts);
  const [[reacquired]]=await successor.query('SELECT GET_LOCK(?,0) AS acquired, CONNECTION_ID() AS sessionId',[name]);
  mark('fresh independent session can reacquire released writer lease',Number(reacquired.acquired)===1);
  mark('new lease has a distinct MySQL session ID',Number(reacquired.sessionId)!==Number(owned.sessionId));
  const [[ownedAgain]]=await observer.query('SELECT IS_USED_LOCK(?) AS owner',[name]);
  mark('foreign observer sees new exclusive session owner',Number(ownedAgain.owner)===Number(reacquired.sessionId));
  competing=await mysql.createConnection(opts);
  const [[foreign]]=await competing.query('SELECT GET_LOCK(?,0) AS acquired',[name]);
  mark('competing live session remains blocked after reconnect',Number(foreign.acquired)===0);
  const [[released]]=await successor.query('SELECT RELEASE_LOCK(?) AS released',[name]);
  mark('lock released explicitly by current owning session only',Number(released.released)===1);
  const [[secondOwner]]=await competing.query('SELECT GET_LOCK(?,0) AS acquired',[name]);
  mark('exclusive lock can pass to next process only after release',Number(secondOwner.acquired)===1);
  const [[clean]]=await competing.query('SELECT RELEASE_LOCK(?) AS released',[name]);
  mark('disposable lock is released after test',Number(clean.released)===1);
  console.log(JSON.stringify({status:'PASS_REAL_MYSQL_8_WRITER_LEASE_DISCONNECT',checks:check.length,assertions:check,kind:'real MySQL connection loss and advisory locks',productionTouched:false},null,2));
 }finally{
  for(const conn of [competing,successor,observer,first])if(conn)try{await conn.end()}catch(_){try{conn.destroy()}catch(__){}}
 }
}
main().catch(e=>{console.error('REAL_MYSQL_LEASE_TEST_FAILED',e.stack||e);process.exitCode=1});
