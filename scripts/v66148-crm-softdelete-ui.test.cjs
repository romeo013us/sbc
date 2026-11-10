'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('./v66148-stage-crm-softdelete-ui.cjs');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'public/app.js'),'utf8'),
 mirror=fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8');
assert.equal(source,mirror);
const app=S.patchApp(source);
assert.equal(S.patchApp(app),app);
assert(app.includes(S.MARK));assert(app.includes('Retained Deleted tombstones'));
assert(app.includes('SQL-only NOT marked Deleted'));
assert(app.includes('No recovery action indicated'));
assert(app.includes('Active and archived records'));
new vm.Script(app,{filename:'v66148-owner-ui.js'});
if(process.argv.includes('--staged'))assert.equal(app,source,'compiled UI must contain repaired SQL count explanations');
const start=app.indexOf('/* SBC_V66145_OWNER_ACCEPTANCE_DESK_UI'),
 end=app.indexOf('function badge(s)',start);
assert(start>0&&end>start);
const block=app.slice(start,end);
const output={isConnected:true,innerHTML:'',textContent:''},trace=[];
const ctx={
 document:{getElementById:id=>id==='sbcAcceptIdDiffResult'?output:null},
 state:{me:{role:'owner'}},
 esc:v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])),
 api:async(url,opt)=>{
  trace.push(url);assert.equal(url,'/api/owner/crm/reconcile-ids');
  assert(!opt.method||opt.method==='GET');
  return {customerIds:{sqlCount:771,projectionCount:716,recordCountDelta:55,
    sqlOnlyCount:55,projectionOnlyCount:0,sqlOnlySample:['old-customer-id'],
    projectionOnlySample:[],sqlOnlyDeletedTombstones:55,sqlOnlyUnexplained:0,
    sqlOnlyUnexplainedSample:[],expectedSoftDeleteExclusionOnly:true,
    evidenceState:'SQL_DELETED_TOMBSTONES_EXCLUDED_AS_DESIGNED',completeIdComparison:true},
   orderIds:{sqlCount:253,projectionCount:253,recordCountDelta:0,
    sqlOnlyCount:0,projectionOnlyCount:0,sqlOnlySample:[],projectionOnlySample:[],
    sqlOnlyDeletedTombstones:0,sqlOnlyUnexplained:0,
    evidenceState:'PROJECTION_SQL_IDS_AGREE_AT_READ_TIME',completeIdComparison:true},
   suspiciousTextRecords:9,suspiciousSample:[{id:'<img src=x onerror=alert(1)>',fields:['businessName'],status:'Lead'}],
   explainedBySoftDeletedTombstones:true,mismatchDetected:false};
 }
};
vm.runInNewContext(block,ctx,{filename:'v66148-ui-methods.js'});
(async()=>{
 await ctx.sbcAcceptCrmDiagnostics();
 assert.equal(trace.length,1);
 assert(output.innerHTML.includes('Retained Deleted tombstones: 55'));
 assert(output.innerHTML.includes('SQL-only NOT marked Deleted: 0'));
 assert(output.innerHTML.includes('No recovery action indicated'));
 assert(!output.innerHTML.includes('Unexplained SQL/CRM differences'));
 assert(output.innerHTML.includes('&lt;img src=x'));
 assert(!output.innerHTML.includes('<img'));
 console.log('PASS V66.148: CRM owner shows expected Deleted exclusions, keeps corrupt holds and safe HTML');
})().catch(e=>{console.error(e);process.exitCode=1});
