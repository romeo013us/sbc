'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const pkg=require(path.join(root,'package.json'));
const release=require(path.join(root,'config/release-identity.js'));
assert.equal(release.RELEASE_VERSION,pkg.version);
assert.match(server,/blocked\.code=safety\.error[\s\S]*blocked\.recoveryGuard=true[\s\S]*REFUSING CRM SHRINK/,'persistence safety rejection carries a stable code and caller diagnostic');
const start=server.indexOf('let saveDataInFlight=null;');
const end=server.indexOf('// SBC_V66111_TENANT_SAFE_ASYNC_LEAD_MERGE',start);
assert(start>=0&&end>start,'actual saveData implementation must exist');
function fixture(error){
 let writes=0;
 const ctx={SBC_RUNTIME_READ_ONLY:false,MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcShutdownStarted:false,mysqlPool:{},storageMode:'mysql',Error,setTimeout,console:{error(){},warn(){}},writeRelational:async()=>{writes++;if(error)throw error;}};
 vm.runInNewContext(server.slice(start,end),ctx,{timeout:1000});
 return {ctx,writes:()=>writes};
}
(async()=>{
 const rejection=Object.assign(new Error('partial source'),{code:'CRM_BULK_REWRITE_BLOCKED_PARTIAL_SOURCE',recoveryGuard:true});
 const recovery=fixture(rejection);
 await assert.rejects(recovery.ctx.saveData(),e=>e===rejection);
 assert.equal(recovery.ctx.MYSQL_RECOVERY_REQUIRED,true);
 assert.equal(recovery.ctx.storageMode,'mysql-recovery-required');
 await assert.rejects(recovery.ctx.saveData(),/MYSQL_RECOVERY_REQUIRED/);
 assert.equal(recovery.writes(),1);
 const error=Object.assign(new Error('uncommitted write'),{code:'ER_BAD_FIELD_ERROR'});
 const failed=fixture(error);
 await assert.rejects(failed.ctx.saveData(),e=>e.code==='MYSQL_RELATIONAL_COMMIT_FAILED'&&e.cause===error);
 assert.equal(failed.writes(),1);
 const healthy=fixture();await healthy.ctx.saveData();assert.equal(healthy.writes(),1);
 const unevaluated=fixture();unevaluated.ctx.MYSQL_RECOVERY_EVALUATED=false;
 await assert.rejects(unevaluated.ctx.saveData(),{code:'MYSQL_RECOVERY_NOT_EVALUATED'});assert.equal(unevaluated.writes(),0);
 console.log('Recovery-write failure propagation: PASS (actual isolated saveData execution)');
})().catch(e=>{console.error(e);process.exitCode=1;});
