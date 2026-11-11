'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../server.js'),'utf8');
const staged=require('./v66150-stage-hr-delegation.cjs').ROUTES;
async function verify(routes,label){
 const ledger={drafts:[{id:'existing',status:'Pending Owner Review'}],preferences:{worker:{provider:'Payoneer'}},reviewLog:[{event:'DRAFT_SUBMITTED'}]};
 const ctx={db:{settings:{v9:{hrOps:ledger,compensation:{},extension:{keep:true}}}},saveData:async()=>({ok:true}),SBC_RUNTIME_READ_ONLY:false,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true};
 vm.createContext(ctx);
 for(const name of ['v9data','v9save']){
  const line=src.split('\n').find(l=>l.startsWith('function '+name+'('));assert(line);vm.runInContext(line,ctx);
 }
 await vm.runInContext('v9save({...v9data(),compensation:{worker:{payRate:4}}})',ctx);
 assert.equal(ctx.db.settings.v9.hrOps,ledger,label+': workforce save lost HR ledger');
 assert.equal(ctx.db.settings.v9.compensation.worker.payRate,4);
 assert.equal(ctx.db.settings.v9.extension.keep,true);
 const start=routes.indexOf('async function sbcHrSave('),end=routes.indexOf("app.get('/api/hr/overview'",start);
 assert(start>=0&&end>start);vm.runInContext(routes.slice(start,end),ctx);
 const drafts=Array.from({length:251},(_,i)=>({id:String(i),tenantId:i%2+1,status:i===250?'Pending Owner Review':'Owner Rejected'}));
 const reviewLog=Array.from({length:351},(_,i)=>({event:'REVIEW',id:i}));
 await ctx.sbcHrSave(ctx.db.settings.v9,{drafts,preferences:ledger.preferences,reviewLog});
 assert.equal(ctx.db.settings.v9.hrOps.drafts.length,251,label+': draft history truncated');
 assert.equal(ctx.db.settings.v9.hrOps.drafts.at(-1).status,'Pending Owner Review');
 assert.equal(ctx.db.settings.v9.hrOps.reviewLog.length,351,label+': review history truncated');
 const before=ctx.db.settings.v9;
 ctx.saveData=async()=>{throw Error('synthetic storage failure')};
 await assert.rejects(ctx.sbcHrSave(before,{drafts:[],preferences:{},reviewLog:[]}),/HR_LEDGER_COMMIT_FAILED/);
 assert.equal(ctx.db.settings.v9,before,label+': failed save must restore ledger');
 ctx.SBC_RUNTIME_READ_ONLY=true;
 await assert.rejects(ctx.sbcHrSave(before,{drafts:[],preferences:{},reviewLog:[]}),/HR_PUBLISHED_WRITER_REQUIRED/);
 assert.equal(ctx.db.settings.v9,before);
 console.log('PASS '+label+': workforce preservation, long history, pending drafts, rollback and preview guard');
}
(async()=>{await verify(src,'compiled server');await verify(staged,'release stage')})().catch(e=>{console.error(e);process.exitCode=1});
