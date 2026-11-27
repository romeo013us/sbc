'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const lease=server.indexOf('// SBC_V6528_RUNTIME_WRITER_LEASE: acquire exclusive lease before any DDL');
const start=server.indexOf('    if(!SBC_DDL_ENABLED){',lease),end=server.indexOf('    await RUNTIME_GATE.ensureSchema();',start);
const policy=server.match(/function sbcMayAutoEnableDdl\(\)\{return false;\}/)?.[0];
assert(lease>=0&&start>lease&&end>start&&policy,'actual no-DDL hydration and opt-in policy must exist');
async function hydrate(customers,fail=false){
 const queries=[];let reads=0;
 const ctx={SBC_DDL_ENABLED:false,SBC_DDL_ENV_MISSING:true,MYSQL_RECOVERY_REQUIRED:false,MYSQL_RECOVERY_EVALUATED:false,storageMode:'mysql',sbcWriterLeaseReady:true,VERIFIED_PRE_CORRUPTION_CRM_COUNT:248,process:{env:{}},console:{warn(){},error(){}},mysqlPool:{async query(sql){queries.push(sql);assert.match(sql,/^SELECT /);return [[{customers}]];}},readRelational:async()=>{reads++;if(fail)throw Error('offline');},RUNTIME_GATE:{ensureSchema(){assert.fail('no DDL opt-in');}}};
 const result=await vm.runInNewContext(policy+'\n(async()=>{'+server.slice(start,end)+'await RUNTIME_GATE.ensureSchema();})()',ctx,{timeout:1000});
 assert.equal(result,true);assert.equal(ctx.SBC_DDL_ENABLED,false);assert.equal(ctx.process.env.ENABLE_DDL,undefined);assert.equal(reads,1);assert.equal(ctx.MYSQL_RECOVERY_EVALUATED,true);
 return {locked:ctx.MYSQL_RECOVERY_REQUIRED,storage:ctx.storageMode,queries:queries.length};
}
test('healthy existing-schema hydration does not enable DDL',async()=>{assert.deepEqual(await hydrate(248),{locked:false,storage:'mysql-relational',queries:2});});
test('partial or failed hydration remains recovery locked',async()=>{assert.deepEqual(await hydrate(247),{locked:true,storage:'mysql-recovery-required',queries:2});assert.deepEqual(await hydrate(248,true),{locked:true,storage:'mysql-recovery-required',queries:1});});
