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
  const timerReplacement="sbcWriterLeaseTimer=setInterval(async()=>{if(sbcWriterLeaseCheckInFlight||!sbcWriterLeaseConn||!sbcWriterLeaseReady)return;sbcWriterLeaseCheckInFlight=true;let timer;try{const leaseConn=sbcWriterLeaseConn,leaseId=sbcWriterLeaseConnectionId;const result=await Promise.race([leaseConn.query('SELECT IS_USED_LOCK(?) AS owner',[SBC_RUNTIME_WRITER_LOCK_NAME]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('writer lease heartbeat timed out after 5000ms'),{code:'SBC_WRITER_LEASE_HEARTBEAT_TIMEOUT'})),5000)})]);const r=result&&result[0]&&result[0][0];if(Number(r&&r.owner)!==leaseId)throw new Error('writer lease ownership changed');}catch(e){sbcWriterLeaseReady=false;MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';const stale=sbcWriterLeaseConn;sbcWriterLeaseConn=null;sbcWriterLeaseConnectionId=null;console.error('['+MARKER+'] lease heartbeat failed; writer readiness revoked and recovery-safe mode enabled:',String(e&&e.message||e));for(const handle of sbcWriterLeaseTimerHandles)clearInterval(handle);sbcWriterLeaseTimerHandles=[];sbcWriterLeaseTimer=null;try{if(stale)await stale.destroy()}catch{}}finally{clearTimeout(timer);sbcWriterLeaseCheckInFlight=false;}},10000);sbcWriterLeaseTimerHandles.push(sbcWriterLeaseTimer);";
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
 }
 const pkgPath=path.join(root,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
 if(!pkg.scripts['test:v6564-mysql-lease-lifecycle'])pkg.scripts['test:v6564-mysql-lease-lifecycle']='node hotfix-assets/v6564-mysql-lease-lifecycle-test.js';
 if(!String(pkg.scripts['test:all']||'').includes('v6564-mysql-lease-lifecycle-test.js'))pkg.scripts['test:all']=String(pkg.scripts['test:all']||'node bootstrap.js --verify')+' && node hotfix-assets/v6564-mysql-lease-lifecycle-test.js';
 fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
 const test=path.join(__dirname,'v6564-mysql-lease-lifecycle-test.js'),dest=path.join(root,'hotfix-assets','v6564-mysql-lease-lifecycle-test.js');
 if(!fs.existsSync(test))throw Error(MARKER+': regression test missing');
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(test,dest);fs.copyFileSync(__filename,path.join(root,'hotfix-assets','apply-v6564-mysql-lease-lifecycle.js'));
 return {marker:MARKER,heartbeatTimeoutMs:5000,singleFlight:true,allHeartbeatIntervalsTracked:true,destroyStaleLeaseConnection:true,recoveryGatePreserved:true};
}
module.exports={apply,MARKER};
