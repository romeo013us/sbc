'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const anchor='initMysql().then(async()=>{',start=server.indexOf(anchor),end=server.indexOf('SBC_UNATTENDED_NOTIFICATIONS.start();',start);
assert(start>=0&&end>start,'current startup guard must exist');
const prefix=server.slice(start+anchor.length,end);
test('actual startup gate: only a healthy writer with DDL opt-in reaches mutation workers',async()=>{
 for(let mask=0;mask<32;mask++){
  const readonly=Boolean(mask&1),ddl=Boolean(mask&2),evaluated=Boolean(mask&4),recovery=Boolean(mask&8),lease=Boolean(mask&16);
  let advisory=0,workers=0;
  const context={SBC_RUNTIME_READ_ONLY:readonly,SBC_DDL_ENABLED:ddl,MYSQL_RECOVERY_EVALUATED:evaluated,MYSQL_RECOVERY_REQUIRED:recovery,sbcWriterLeaseReady:lease,sbcStartExistingSchemaAdvisory:async()=>{advisory++;},startMutationWorkers:()=>{workers++;},console:{warn(){}}};
  await vm.runInNewContext('(async()=>{'+prefix+'startMutationWorkers();})()',context,{timeout:1000});
  assert.equal(workers,Number(!readonly&&ddl&&evaluated&&!recovery&&lease),String(mask));
  assert.equal(advisory,Number(!readonly&&!ddl&&evaluated&&!recovery&&lease),String(mask));
 }
});
