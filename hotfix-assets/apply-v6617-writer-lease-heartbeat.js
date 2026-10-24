'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6617_WRITER_LEASE_HEARTBEAT_REPAIR';
const OLD=/sbcWriterLeaseTimer=setInterval\(async\(\)=>\{try\{const \[\[r\]\]=await sbcWriterLeaseConn\.query\('SELECT CONNECTION_ID\(\) AS sessionId, IS_USED_LOCK\(\?\) AS owner',\[SBC_RUNTIME_WRITER_LOCK_NAME\]\);[\s\S]*?\},10000\);/g;
function apply(root){
 const file=path.join(root,'server.js');
 let server=fs.readFileSync(file,'utf8');
 if(server.includes(MARKER)){
  if(server.includes('writer lease lost; recovery-safe mode enabled:'))throw Error(MARKER+': legacy heartbeat remains after application');
  return {marker:MARKER,changed:false};
 }
 const found=[...server.matchAll(OLD)];
 if(found.length!==1)throw Error(MARKER+': expected exactly one legacy heartbeat, found '+found.length);
 const state="let sbcWriterLeaseConn=null,sbcWriterLeaseConnectionId=null,sbcWriterLeaseReady=false,sbcWriterLeaseTimer=null;";
 if(server.split(state).length!==2)throw Error(MARKER+': lease state anchor not unique');
 if(server.includes('sbcWriterLeaseCheckInFlight'))throw Error(MARKER+': unexpected earlier lifecycle state; review conflicting timers');
 const stateNext=state+"\n// "+MARKER+": one single-flight bounded heartbeat, never unlock MySQL recovery on reconnect.\nlet sbcWriterLeaseCheckInFlight=false,sbcWriterLeaseRetryAt=0,sbcWriterLeaseRetryDelayMs=5000;";
 // Keep recovery blocked on any socket loss. Only an explicit authoritative
 // recovery verification in the already-existing control plane may clear it.
 const heartbeat=String.raw`sbcWriterLeaseTimer=setInterval(async()=>{
 if(sbcWriterLeaseCheckInFlight||Date.now()<sbcWriterLeaseRetryAt)return;
 sbcWriterLeaseCheckInFlight=true;
 let conn=sbcWriterLeaseConn,deadline=null;
 try{
  if(!conn){
   const mysqlLease=require('mysql2/promise');
   const candidate=await mysqlLease.createConnection({
    host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME,port:Number(process.env.DB_PORT||3306),
    connectTimeout:5000,enableKeepAlive:true,keepAliveInitialDelay:10000,charset:'utf8mb4'
   });
   try{
    const [rows]=await candidate.query('SELECT GET_LOCK(?,0) AS acquired, CONNECTION_ID() AS connectionId',[SBC_RUNTIME_WRITER_LOCK_NAME]);
    if(Number(rows?.[0]?.acquired)!==1)throw Object.assign(new Error('writer lease held by another process'),{code:'SBC_RUNTIME_WRITER_BUSY'});
    conn=candidate;sbcWriterLeaseConn=candidate;sbcWriterLeaseConnectionId=Number(rows[0].connectionId);
    sbcWriterLeaseReady=true;
    sbcWriterLeaseRetryAt=0;sbcWriterLeaseRetryDelayMs=5000;
    console.warn('[SBC_V6617_WRITER_LEASE_HEARTBEAT_REPAIR] lease reacquired; MYSQL_RECOVERY_REQUIRED remains active until authoritative verification');
   }catch(e){try{candidate.destroy()}catch(_){}throw e}
  }
  const result=await Promise.race([
   conn.query('SELECT CONNECTION_ID() AS sessionId, IS_USED_LOCK(?) AS owner',[SBC_RUNTIME_WRITER_LOCK_NAME]),
   new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Object.assign(new Error('writer lease heartbeat timed out'),{code:'SBC_WRITER_LEASE_HEARTBEAT_TIMEOUT'})),4000)})
  ]);
  const r=result?.[0]?.[0];
  if(Number(r?.sessionId)!==sbcWriterLeaseConnectionId||Number(r?.owner)!==sbcWriterLeaseConnectionId)
   throw Object.assign(new Error('writer lease session or advisory lock ownership changed'),{code:'SBC_WRITER_LEASE_SESSION_MISMATCH'});
 }catch(e){
  sbcWriterLeaseReady=false;
  MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';
  const broken=sbcWriterLeaseConn||conn;
  sbcWriterLeaseConn=null;sbcWriterLeaseConnectionId=null;
  sbcWriterLeaseRetryAt=Date.now()+sbcWriterLeaseRetryDelayMs;
  sbcWriterLeaseRetryDelayMs=Math.min(sbcWriterLeaseRetryDelayMs*2,60000);
  if(broken)try{broken.destroy()}catch(_){}
  console.error('[SBC_V6617_WRITER_LEASE_HEARTBEAT_REPAIR] lease lost; writes blocked; reconnect scheduled:',String(e?.code||e?.message||e),'retryMs='+sbcWriterLeaseRetryDelayMs);
 }finally{
  if(deadline!==null)clearTimeout(deadline);
  sbcWriterLeaseCheckInFlight=false;
 }
},5000);`;
 server=server.replace(state,stateNext);
 server=server.replace(OLD,heartbeat);
 if(server.includes('writer lease lost; recovery-safe mode enabled:'))throw Error(MARKER+': old one-shot heartbeat still present');
 if((server.match(/sbcWriterLeaseTimer=setInterval/g)||[]).length!==1)throw Error(MARKER+': multiple heartbeat timers');
 const initial="connectTimeout:Number(process.env.SBC_DB_CONNECT_TIMEOUT_MS||10000),charset:'utf8mb4'});const [rows]=await leaseCandidate.query";
 const initialNext="connectTimeout:Number(process.env.SBC_DB_CONNECT_TIMEOUT_MS||10000),enableKeepAlive:true,keepAliveInitialDelay:10000,charset:'utf8mb4'});const [rows]=await leaseCandidate.query";
 if(server.split(initial).length!==2)throw Error(MARKER+': initial connection anchor unexpected');
 server=server.replace(initial,initialNext);
 fs.writeFileSync(file,server);
 const src=path.join(__dirname,'v6617-writer-lease-heartbeat-test.cjs'),dst=path.join(root,'scripts','v6617-writer-lease-heartbeat-test.cjs');
 if(!fs.existsSync(src))throw Error(MARKER+': test missing');
 fs.copyFileSync(src,dst);
 return {marker:MARKER,changed:true,exactHeartbeatCount:1,recoveryAutoUnlock:false,baseDataMutations:false};
}
module.exports={MARKER,apply};
