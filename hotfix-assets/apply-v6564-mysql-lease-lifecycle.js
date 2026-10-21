'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6564_MYSQL_LEASE_LIFECYCLE';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b)}
function apply(root){
 const file=path.join(root,'server.js');let s=fs.readFileSync(file,'utf8');
 if(!s.includes(MARKER)){
  const stateAnchor='let sbcWriterLeaseConn=null,sbcWriterLeaseConnectionId=null,sbcWriterLeaseReady=false,sbcWriterLeaseTimer=null;';
  s=once(s,stateAnchor,stateAnchor+'\n// '+MARKER+': prevent overlapping lease checks and retire broken lease sockets.\nlet sbcWriterLeaseCheckInFlight=false,sbcWriterLeaseTimerHandles=[];', 'lease state');
  const timerAnchor="sbcWriterLeaseTimer=setInterval(async()=>{try{const [[r]]=await sbcWriterLeaseConn.query('SELECT IS_USED_LOCK(?) AS owner',[SBC_RUNTIME_WRITER_LOCK_NAME]);if(Number(r&&r.owner)!==sbcWriterLeaseConnectionId)throw new Error('writer lease ownership changed');}catch(e){sbcWriterLeaseReady=false;MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';console.error('['+MARKER+'] writer lease lost; recovery-safe mode enabled:',String(e&&e.message||e));clearInterval(sbcWriterLeaseTimer);sbcWriterLeaseTimer=null;}},10000);";
  const timerReplacement="sbcWriterLeaseTimer=setInterval(async()=>{if(sbcWriterLeaseCheckInFlight||Date.now()<sbcWriterLeaseRetryAt)return;sbcWriterLeaseCheckInFlight=true;let timer,stale=null;try{if(!sbcWriterLeaseConn){const mysqlLease=require('mysql2/promise');const candidate=await Promise.race([mysqlLease.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||3306),connectTimeout:Number(process.env.SBC_DB_CONNECT_TIMEOUT_MS||10000),enableKeepAlive:true,keepAliveInitialDelay:10000,charset:'utf8mb4'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('writer lease reconnect timed out after 5000ms'),{code:'SBC_WRITER_LEASE_RECONNECT_TIMEOUT'})),5000)})]);try{const [[lease]]=await candidate.query('SELECT GET_LOCK(?, 0) AS acquired, CONNECTION_ID() AS connectionId',[SBC_RUNTIME_WRITER_LOCK_NAME]);if(Number(lease&&lease.acquired)!==1)throw Object.assign(new Error('writer lease is owned by another process'),{code:'SBC_RUNTIME_WRITER_BUSY'});sbcWriterLeaseConn=candidate;sbcWriterLeaseConnectionId=Number(lease.connectionId);sbcWriterLeaseReady=true;sbcWriterLeaseRetryDelayMs=5000;sbcWriterLeaseRetryAt=0;console.warn('['+MARKER+'] exclusive writer lease re-acquired; authoritative recovery verification remains required before writes resume');}catch(acquireError){try{await candidate.destroy()}catch{}throw acquireError;}}const leaseConn=sbcWriterLeaseConn,leaseId=sbcWriterLeaseConnectionId;const result=await Promise.race([leaseConn.query('SELECT IS_USED_LOCK(?) AS owner',[SBC_RUNTIME_WRITER_LOCK_NAME]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('writer lease heartbeat timed out after 5000ms'),{code:'SBC_WRITER_LEASE_HEARTBEAT_TIMEOUT'})),5000)})]);const r=result&&result[0]&&result[0][0];if(Number(r&&r.owner)!==leaseId)throw new Error('writer lease ownership changed');}catch(e){sbcWriterLeaseReady=false;MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';stale=sbcWriterLeaseConn;sbcWriterLeaseConn=null;sbcWriterLeaseConnectionId=null;sbcWriterLeaseRetryAt=Date.now()+sbcWriterLeaseRetryDelayMs;sbcWriterLeaseRetryDelayMs=Math.min(sbcWriterLeaseRetryDelayMs*2,60000);console.error('['+MARKER+'] lease heartbeat/reconnect failed; writes remain recovery-gated; retry scheduled:',String(e&&e.message||e),'retryDelayMs='+sbcWriterLeaseRetryDelayMs);}finally{clearTimeout(timer);if(stale){try{await stale.destroy()}catch{}}sbcWriterLeaseCheckInFlight=false;}},5000);sbcWriterLeaseTimerHandles.push(sbcWriterLeaseTimer);";
  const timerCount=s.split(timerAnchor).length-1;
  if(timerCount===1){
   s=s.replace(timerAnchor,timerReplacement);
  }else{
   // Source bundles may contain multiple matching writer-lock timer blocks.
   // Harden every eligible block and track every interval so failure clears all of them.
   const timerPattern=/sbcWriterLeaseTimer=setInterval\(async\(\)=>\{[\s\S]*?\},10000\);/g;
   const matches=s.match(timerPattern)||[];
   const leaseMatches=matches.filter(x=>x.includes('IS_USED_LOCK')&&x.includes('SBC_RUNTIME_WRITER_LOCK_NAME'));
   if(leaseMatches.length===0){
    if(s.includes('sbcWriterLeaseCheckInFlight')&&s.includes('writer lease heartbeat timed out after 5000ms')){
     // Already hardened by an equivalent patch; no-op.
    }else{
     throw Error(MARKER+': no eligible writer-lease heartbeat timer found; exact anchor count '+timerCount+', fallback timer count '+matches.length+', writer-lock heartbeat count '+leaseMatches.length);
    }
   }else{
    for(const candidate of leaseMatches)s=s.replace(candidate,timerReplacement);
   }
  }
  s=once(s,'  if(!mysqlPool) return;\\n  const conn=await mysqlPool.getConnection();',"  if(!mysqlPool) return;\\n  if(!SBC_RUNTIME_READ_ONLY && (!sbcWriterLeaseReady || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED)) throw Object.assign(new Error('SBC_RUNTIME_WRITER_LEASE_REQUIRED: write refused until exclusive lease and authoritative recovery verification pass.'),{code:'SBC_RUNTIME_WRITER_LEASE_REQUIRED'});\\n  const conn=await mysqlPool.getConnection();",'write fail-closed guard');
 }
 const pkgPath=path.join(root,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
 if(!pkg.scripts['test:v6564-mysql-lease-lifecycle'])pkg.scripts['test:v6564-mysql-lease-lifecycle']='node hotfix-assets/v6564-mysql-lease-lifecycle-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6564-mysql-lease-lifecycle-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6564-mysql-lease-lifecycle-test.js';
 fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
 const test=path.join(__dirname,'v6564-mysql-lease-lifecycle-test.js'),dest=path.join(root,'hotfix-assets','v6564-mysql-lease-lifecycle-test.js');
 if(!fs.existsSync(test))throw Error(MARKER+': regression test missing');
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(test,dest);fs.copyFileSync(__filename,path.join(root,'hotfix-assets','apply-v6564-mysql-lease-lifecycle.js'));
 return {marker:MARKER,heartbeatTimeoutMs:5000,singleFlight:true,allHeartbeatIntervalsTracked:true,destroyStaleLeaseConnection:true,boundedReconnect:true,keepAliveEnabled:true,recoveryGatePreserved:true};
}
module.exports={apply,MARKER};
