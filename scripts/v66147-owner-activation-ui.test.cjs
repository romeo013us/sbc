'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('./v66147-stage-owner-activation-ui.cjs');
const root=path.resolve(__dirname,'..');
const a=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const b=fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8');
assert.equal(a,b,'owner dashboard parity required');
const staged=S.patchApp(a);
assert.equal(S.patchApp(staged),staged,'idempotent');
assert(staged.includes('SBC_V66147_OWNER_SALES_DELIVERY_REVIEW_UI'));
assert(staged.includes('Review next 20 leads'));
assert(staged.includes('sbcAcceptActivationReview()'));
assert(staged.includes('sbcV66147ReviewLeadAt'));
assert(staged.includes('sbcV66147ReviewOrderAt'));
new vm.Script(staged,{filename:'v66147-app.js'});
if(process.argv.includes('--staged'))assert.equal(a,staged,'compiled GoDaddy UI must contain activation review');
const start=staged.indexOf('/* SBC_V66145_OWNER_ACCEPTANCE_DESK_UI');
const end=staged.indexOf('function badge(s)',start);
assert(start>0&&end>start);
const ui=staged.slice(start,end);
assert(!ui.includes("method:'POST'")&&!ui.includes("method:'DELETE'"),'acceptance actions GET only');
const out={isConnected:true,innerHTML:'',textContent:''};
const orderInput={value:''};
const calls=[],edits=[],s={me:{role:'owner'}},ctx={
 document:{getElementById(id){return ({sbcAcceptActivationResult:out,sbcAcceptOrder:orderInput})[id]||null}},
 state:s,toast:message=>{throw Error('unexpected '+message)},
 esc:v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])),
 editCustomer:id=>edits.push(id),sbcAcceptOrderLookup:()=>calls.push('checked-order'),
 api:async(url,opts)=>{
  calls.push(url);
  assert.equal(url,'/api/owner/revenue/activation-review?limit=20');
  assert(!opts.method||opts.method==='GET');
  return {counts:{reviewEligible:2,needsSourceVerification:2,missingCallablePhone:1},
   projectionMatchesSql:false,
   leadShortlist:[{id:'customer-001',businessName:'<img src=x onerror=alert(1)>',
    source:'Lorna',temperature:'warm',phoneLast4:'1234',reviewReason:'SOURCE_AND_IDENTITY_REVIEW_REQUIRED'}],
   paidOrderCandidates:[{orderId:'ord-live-001',product:'<script>alert(1)</script>',
    recordedAmount:99}],paidOrderCandidateCount:1,excludedQaOrders:2,
    statusOnlyOrdersNeedIndependentPaymentProof:1};
 }
};
vm.runInNewContext(ui,ctx,{filename:'v66147-ui-functions.js'});
ctx.sbcAcceptOrderLookup=()=>calls.push('checked-order');
assert.equal(typeof ctx.sbcAcceptActivationReview,'function');
assert.equal(typeof ctx.sbcV66147ReviewLeadAt,'function');
assert.equal(typeof ctx.sbcV66147ReviewOrderAt,'function');
(async()=>{
 await ctx.sbcAcceptActivationReview();
 assert(out.innerHTML.includes('Loaded CRM and MySQL counts differ'));
 assert(out.innerHTML.includes('NOT approved calling tasks'));
 assert(out.innerHTML.includes('Internal QA orders excluded: 2'));
 assert(out.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'));
 assert(out.innerHTML.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert(!out.innerHTML.includes('<script>'));
 assert(!out.innerHTML.includes('<img'));
 ctx.sbcV66147ReviewLeadAt(0);
 assert.deepEqual(edits,['customer-001'],'owner must explicitly open record to review');
 ctx.sbcV66147ReviewOrderAt(0);
 assert.equal(orderInput.value,'ord-live-001');
 assert(calls.includes('checked-order'),'owner must explicitly request acceptance check');
 s.me.role='caller';
 ctx.sbcV66147ReviewLeadAt(0);ctx.sbcV66147ReviewOrderAt(0);await ctx.sbcAcceptActivationReview();
 assert.equal(edits.length,1);assert.equal(calls.filter(x=>x==='checked-order').length,1,'caller cannot access owner controls');
 console.log('PASS V66.147: owner-only source-review and real-order buttons, XSS encoding, browser mirror, no contact');
})().catch(e=>{console.error(e);process.exitCode=1});
