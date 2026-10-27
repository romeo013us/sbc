'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const marker='SBC_V6617_WRITER_LEASE_HEARTBEAT_REPAIR';
assert.ok(src.includes(marker));
assert.equal((src.match(/sbcWriterLeaseTimer=setInterval/g)||[]).length,1,'one lease heartbeat only');
assert.equal(src.includes('writer lease lost; recovery-safe mode enabled:'),false,'old one-shot timer prohibited');
assert.ok(src.includes('MYSQL_RECOVERY_REQUIRED=true'));
assert.ok(!src.includes('SBC_V6617_AUTO_RECOVERY_UNLOCK'));
const m=src.match(/sbcWriterLeaseTimer=setInterval\(async\(\)=>\{[\s\S]*?\},5000\);/);
assert.ok(m,'patched heartbeat missing');
let now=100000,timer=null,intervals=0,connectAttempts=0;
const warnings=[],errors=[],dead=[];
const initialConn={async query(){throw Object.assign(new Error('server inactivity timeout'),{code:'PROTOCOL_CONNECTION_LOST'})},destroy(){dead.push('initial')}};
let connectionMode='success',nextConn=null;
const mockMysql={async createConnection(){
 connectAttempts++;
 const thisConn={destroy(){dead.push('candidate')},async query(sql){
  if(sql.includes('GET_LOCK'))return [[{acquired:connectionMode==='busy'?0:1,connectionId:222}]];
  if(sql.includes('IS_USED_LOCK'))return [[{sessionId:222,owner:222}]];
  throw Error('unexpected '+sql);
 }};
 nextConn=thisConn;return thisConn;
}};
const context={
 sbcWriterLeaseConn:initialConn,sbcWriterLeaseConnectionId:111,sbcWriterLeaseReady:true,sbcWriterLeaseTimer:null,
 sbcWriterLeaseCheckInFlight:false,sbcWriterLeaseRetryAt:0,sbcWriterLeaseRetryDelayMs:5000,
 MYSQL_RECOVERY_REQUIRED:false,MYSQL_RECOVERY_EVALUATED:false,storageMode:'mysql',
 SBC_RUNTIME_WRITER_LOCK_NAME:'sbc:runtime:writer:v1',
 process:{env:{DB_HOST:'127.0.0.1',DB_USER:'test',DB_PASSWORD:'',DB_NAME:'disposable',DB_PORT:'3306'}},
 require(name){assert.equal(name,'mysql2/promise');return mockMysql},
 Date:{now(){return now}},
 Number,Promise,String,Math,Object,Error,
 console:{warn(...x){warnings.push(x.join(' '))},error(...x){errors.push(x.join(' '))}},
 setTimeout,clearTimeout,
 setInterval(fn,ms){assert.equal(ms,5000);intervals++;timer=fn;return {unref(){}}},
 clearInterval(){throw Error('heartbeat must never stop after disconnect')}
};
vm.createContext(context);vm.runInContext(m[0],context);
assert.equal(intervals,1);
(async()=>{
 await timer();
 assert.equal(context.sbcWriterLeaseReady,false);
 assert.equal(context.MYSQL_RECOVERY_REQUIRED,true);
 assert.equal(context.storageMode,'mysql-recovery-required');
 assert.deepEqual(dead,['initial']);
 assert.equal(context.sbcWriterLeaseConn,null);
 assert.equal(connectAttempts,0,'must wait before retry');
 await timer();
 assert.equal(connectAttempts,0,'retry must respect backoff');
 now+=5500;await timer();
 assert.equal(connectAttempts,1);
 assert.equal(context.sbcWriterLeaseReady,true);
 assert.equal(context.sbcWriterLeaseConnectionId,222);
 assert.equal(context.MYSQL_RECOVERY_REQUIRED,true,'reconnect must never automatically unlock authoritative recovery');
 assert.equal(context.storageMode,'mysql-recovery-required');
 assert.equal(intervals,1,'no duplicate heartbeat timers after recovery');
 context.sbcWriterLeaseConn=null;context.sbcWriterLeaseReady=false;context.sbcWriterLeaseConnectionId=null;
 connectionMode='busy';now+=5500;await timer();
 assert.equal(context.sbcWriterLeaseReady,false,'foreign lease must never activate writer');
 assert.equal(context.MYSQL_RECOVERY_REQUIRED,true);
 assert.ok(dead.includes('candidate'),'contended connection must be closed');
 assert.ok(errors.length>=2);
 assert.ok(warnings.some(x=>x.includes('authoritative verification')));
 console.log(JSON.stringify({status:'PASS_V6617_MYSQL_LEASE_DISCONNECT_RECOVERY',checks:12,oneHeartbeat:true,oldSocketDisposed:true,reacquisitionBounded:true,recoveryNeverAutoUnlocked:true,foreignLeaseNeverAcquired:true,synthetic:true}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
