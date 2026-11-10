'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const OLD=require('./v66145-stage-owner-acceptance-ui.cjs');
const NEW=require('./v66146-stage-crm-id-ui.cjs');
const root=path.resolve(__dirname,'..'),raw=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const mirror=fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8');
assert.equal(raw,mirror,'all dashboard files must mirror exactly');
const pre=OLD.patchApp(raw),updated=NEW.patchApp(pre);
assert(updated.includes(NEW.MARK));assert.equal(NEW.patchApp(updated),updated);
assert(updated.includes('sbcAcceptCrmDiagnostics()'));
assert(updated.includes('/api/owner/crm/reconcile-ids'));
assert(!updated.includes("method:'POST'"),'owner acceptance view must stay read-only');
new vm.Script(updated,{filename:'acceptance-ui-v66146.js'});
if(process.argv.includes('--staged'))assert.equal(NEW.patchApp(raw),raw,'release must contain ID diagnostics');
const first=updated.indexOf('/* SBC_V66145_OWNER_ACCEPTANCE_DESK_UI'),end=updated.indexOf('function badge(s)',first);
assert(first>0&&end>first);
const output={isConnected:true,innerHTML:'',textContent:''};
const events=[],ctx={
 document:{getElementById:(id)=>({sbcAcceptIdDiffResult:output})[id]||null},
 state:{me:{role:'owner'}},esc:s=>String(s??'').replace(/[&<>'"]/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[ch]),
 api:async (url,opts)=>{
  events.push({url,opts});
  assert.equal(url,'/api/owner/crm/reconcile-ids');
  return {customerIds:{sqlCount:718,projectionCount:716,recordCountDelta:2,
    completeIdComparison:true,evidenceState:'ID_RECONCILIATION_REQUIRED',
    sqlOnlyCount:3,projectionOnlyCount:1,sqlOnlySample:['sql-only-001'],
    projectionOnlySample:['projection-only-001']},
   orderIds:{sqlCount:254,projectionCount:253,recordCountDelta:1,
    completeIdComparison:true,evidenceState:'ID_RECONCILIATION_REQUIRED',
    sqlOnlyCount:1,projectionOnlyCount:0,
    sqlOnlySample:['order-missing-001'],projectionOnlySample:[]},
   suspiciousTextRecords:1,suspiciousSample:[
    {id:'<img src=x onerror=alert(1)>',fields:['businessName','notes'],status:'<script>x</script>'}],
   mismatchDetected:true};
 }
};
vm.runInNewContext(updated.slice(first,end),ctx,{filename:'acceptance-desk-v66146.js'});
assert.equal(typeof ctx.sbcAcceptCrmDiagnostics,'function');
(async()=>{
 await ctx.sbcAcceptCrmDiagnostics();
 assert.equal(events.length,1);
 assert(!events[0].opts.method||events[0].opts.method==='GET');
 assert(output.innerHTML.includes('SQL-only IDs: 3'));
 assert(output.innerHTML.includes('Text-integrity review: 1'));
 assert(output.innerHTML.includes('sql-only-001'));
 assert(output.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert(output.innerHTML.includes('&lt;script&gt;x&lt;/script&gt;'));
 assert(!output.innerHTML.includes('<img'));
 assert(!output.innerHTML.includes('<script>'));
 console.log('PASS V66.146: dashboard diagnostic button, safe ID/field display, GET only, syntax and mirror parity');
})().catch(e=>{console.error(e);process.exitCode=1});
