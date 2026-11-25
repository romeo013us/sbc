'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyHealth}=require('../scripts/sbc-portable-health-contract.cjs');
const base={ok:true,app:'SBC Business Command Center',writerLeaseReady:false,recoveryEvaluated:true};
test('a disposable empty database boots but must not be certified as hydrated',()=>{
 assert.equal(classifyHealth({...base,database:'connected',storage:'mysql-recovery-required',recoveryRequired:true,productionReady:false},'empty'),'ISOLATED_EMPTY_DB_FAIL_CLOSED');
});
test('reject fallback, writer leases, or unsafe readiness on empty database',()=>{
 for(const patch of [{database:'fallback'},{writerLeaseReady:true},{productionReady:true},{recoveryRequired:false},{recoveryEvaluated:false}]){
  assert.throws(()=>classifyHealth({...base,database:'connected',storage:'mysql-recovery-required',recoveryRequired:true,productionReady:false,...patch},'empty'));
 }
});
test('a hydrated read-only rehearsal has distinct evidence and never certifies production',()=>{
 assert.equal(classifyHealth({...base,database:'connected',storage:'mysql-relational-read-only',recoveryRequired:false,productionReady:true},'hydrated'),'ISOLATED_HYDRATED_READONLY');
 assert.throws(()=>classifyHealth({...base,database:'connected',storage:'mysql-recovery-required',recoveryRequired:true,productionReady:false},'hydrated'));
 assert.throws(()=>classifyHealth(base,'unknown'));
});
