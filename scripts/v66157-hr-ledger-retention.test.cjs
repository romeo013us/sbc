'use strict';
/* V66.157 RED->GREEN: protect historical HR payroll drafts and review records.
 * Isolated VM fixtures. No live GoDaddy, employee data or financial API calls.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const STAGE=require('./v66157-stage-hr-ledger-retention.cjs');
const source=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const compiled=STAGE.patchServer(source);
assert.equal(STAGE.patchServer(compiled),compiled,'staging patch must be idempotent');
new vm.Script(compiled,{filename:'sbc-v66157-staged-server.js'});
if(process.argv.includes('--staged'))assert.equal(source,compiled,'disposable release must contain V66.157 HR protection');
const scope={
 db:{settings:{v9:{
  timeEntries:[{id:'clock-1',userId:'worker-1'}],
  compensation:{},hrOps:{drafts:[{id:'historical',tenantId:1,status:'Pending Owner Review'}],
   preferences:{'worker-1':{provider:'Payoneer',status:'Awaiting Owner Review'}},
   reviewLog:[{event:'DRAFT_SUBMITTED',draftId:'historical'}]},
  extension:{keep:true}
 }}}},
 SBC_RUNTIME_READ_ONLY:false,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true,
 saves:0,saveData:async()=>{scope.saves++;return {ok:true}}
};
vm.createContext(scope);
for(const name of ['v9data','v9save']){
 const line=compiled.split('\n').find(x=>x.startsWith('function '+name+'('));
 assert(line,name+' must exist');vm.runInContext(line,scope);
}
(async()=>{
 const original=scope.db.settings.v9.hrOps;
 await vm.runInContext('v9save({...v9data(),compensation:{"worker-1":{payRate:4}}})',scope);
 assert.equal(scope.db.settings.v9.hrOps,original,'generic workforce settings must retain exact HR ledger');
 assert.equal(scope.db.settings.v9.extension.keep,true);
 assert.equal(scope.db.settings.v9.compensation['worker-1'].payRate,4);
 const start=compiled.indexOf('async function sbcHrSave(');
 const end=compiled.indexOf("app.get('/api/hr/overview'",start);
 assert(start>0&&end>start,'HR save route required');
 vm.runInContext(compiled.slice(start,end),scope);
 const drafts=Array.from({length:251},(_,i)=>({id:'draft-'+i,tenantId:i%2+1,
  status:i===250?'Pending Owner Review':'Owner Rejected'}));
 const reviewLog=Array.from({length:351},(_,i)=>({event:'OWNER_REVIEW',id:i}));
 const ops={drafts,preferences:{'worker-1':{provider:'Payoneer'}},reviewLog};
 const v=scope.db.settings.v9;
 await scope.sbcHrSave(v,ops);
 assert.equal(scope.db.settings.v9.hrOps.drafts.length,251,'old pending draft must not be truncated');
 assert.equal(scope.db.settings.v9.hrOps.drafts[250].status,'Pending Owner Review');
 assert.equal(scope.db.settings.v9.hrOps.reviewLog.length,351,'append-only review evidence must be retained');
 assert.equal(scope.db.settings.v9.extension.keep,true,'unrelated settings survive HR save');
 const before=scope.db.settings.v9;
 scope.saveData=async()=>{throw Error('SYNTHETIC_MYSQL_SAVE_FAILURE')};
 await assert.rejects(scope.sbcHrSave(before,{drafts:[],preferences:{},reviewLog:[]}),/HR_LEDGER_COMMIT_FAILED/);
 assert.equal(scope.db.settings.v9,before,'failed HR commit must restore previous snapshot');
 await assert.rejects(vm.runInContext('v9save({compensation:{}})',scope),/SYNTHETIC_MYSQL_SAVE_FAILURE/);
 assert.equal(scope.db.settings.v9,before,'generic v9 save must also restore on failed write');
 scope.SBC_RUNTIME_READ_ONLY=true;
 await assert.rejects(scope.sbcHrSave(before,{drafts:[],preferences:{},reviewLog:[]}),/HR_PUBLISHED_WRITER_REQUIRED/);
 assert.equal(scope.db.settings.v9,before,'preview cannot alter HR ledger');
 console.log('PASS V66.157: preserved HR history 251/351, no lost payout preferences, durable failure rollback, preview write veto');
})().catch(e=>{console.error(e);process.exitCode=1});
