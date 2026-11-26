'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
function prefix(anchor,stop,offset=0){const start=server.indexOf(anchor,offset),end=server.indexOf(stop,start+anchor.length);assert(start>=offset&&end>start,'current startup boundary must exist');return server.slice(start+anchor.length,end);}
const sweep=prefix('.then(async()=>{','// V64.3.0 — controlled autonomous sweep',server.indexOf('SBC_UNATTENDED_NOTIFICATIONS.start();'));
const operational=prefix('const startOperationalRuntime=async()=>{','console.log(`[SBC MYSQL STABILITY PATCH]');
test('actual autonomous sweep guard blocks every unsafe startup combination',async()=>{
 for(let mask=0;mask<32;mask++){
  const readonly=Boolean(mask&1),ddl=Boolean(mask&2),evaluated=Boolean(mask&4),recovery=Boolean(mask&8),lease=Boolean(mask&16);
  let entered=0;
  await vm.runInNewContext('(async()=>{'+sweep+'enter();})()',{SBC_RUNTIME_READ_ONLY:readonly,SBC_DDL_ENABLED:ddl,MYSQL_RECOVERY_EVALUATED:evaluated,MYSQL_RECOVERY_REQUIRED:recovery,sbcWriterLeaseReady:lease,console:{warn(){}},enter:()=>entered++},{timeout:1000});
  assert.equal(entered,Number(!readonly&&ddl&&evaluated&&!recovery&&lease),String(mask));
 }
});
test('operational runtime entry independently blocks Preview and absent DDL opt-in',async()=>{
 for(const readonly of [false,true])for(const ddl of [false,true]){
  let entered=0;
  await vm.runInNewContext('(async()=>{'+operational+'enter();})()',{SBC_RUNTIME_READ_ONLY:readonly,SBC_DDL_ENABLED:ddl,console:{log(){},warn(){}},enter:()=>entered++},{timeout:1000});
  assert.equal(entered,Number(!readonly&&ddl));
 }
});
