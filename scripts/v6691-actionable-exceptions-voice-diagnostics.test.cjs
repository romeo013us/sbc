'use strict';
// V66.91 synthetic read-only regression: QA quarantine, tenant isolation,
// actionable exception navigation and persistent sanitized Voice failures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const policy=require('../enterprise/v56134-god-tier-revenue.js');
const {MARK,OLD,patchServer}=require('./v6691-stage-actionable-exceptions.cjs');
const server=read('server.js'),compiled=patchServer(server);
assert.equal(patchServer(compiled),compiled,'stage must be idempotent');
new vm.Script(compiled,{filename:'compiled-server.js'});
if(process.argv.includes('--staged'))assert.equal(compiled,server,'staged server contains exception policy');
assert.equal(compiled.split(MARK).length-1,1);
assert(!compiled.includes(OLD),'old label-only paid order warning removed');
const start=compiled.indexOf('function v23Alerts(req){'),end=compiled.indexOf('function v23Overview(req){',start);
assert(start>=0&&end>start,'v23 alert route exists');
const fnCode=compiled.slice(start,end)+'\nv23Alerts;';
function captured(id,price,tenantId=7,extra={}){
 return {id,tenantId,price,customerName:'Actual Customer',product:'Website package',
   paymentStatus:'Paid',squareOrderId:'sq_order_'+id,squarePaymentId:'sq_payment_'+id,
   squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-06T21:00:00Z',...extra};
}
const qa=captured('qa',1,7,{customerName:'SBC Launch QA Test Customer',product:'SBC Launch QA - $1 Test Service',
   fulfillmentStatus:'QA VERIFIED - NO FULFILLMENT',
   notes:JSON.stringify({sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT'}})});
const synthetic=captured('system',100,7,{customerName:'SBC SYSTEM TEST — DO NOT SERVICE',product:'SBC FULL-CYCLE SYSTEM TEST'});
const real=captured('genuine',199);
const withJob=captured('has-job',349);
const otherTenant=captured('other-tenant',599,8);
const paidLabelOnly={id:'label-only',tenantId:7,customerName:'Not Square paid',product:'Business order',paymentStatus:'Paid',status:'Paid',price:699};
const db={orders:[qa,synthetic,real,withJob,otherTenant,paidLabelOnly],customers:[],quotes:[],tasks:[],
  fulfillmentJobs:[{id:'job-1',orderId:'has-job',status:'Pending',tenantId:7}]};
const scope={db,V56134_GOD_TIER:policy,requireRequestTenant:req=>req.tenantId,now:()=>new Date().toISOString(),today:()=>new Date().toISOString().slice(0,10),Date};
const fn=vm.runInNewContext(fnCode,scope);
const results=fn({tenantId:7});
assert.equal(results.length,1,'only real paid/unfulfilled order without job is actionable');
assert.equal(results[0].orderId,'genuine');
assert.match(results[0].title,/Square-paid order needs reconciliation/);
assert(!results.some(x=>['qa','system','has-job','other-tenant','label-only'].includes(x.orderId)),'QA, system, already queued, other tenant, and paid-label-only suppressed');
assert.equal(policy.needsReconciliation(qa,[]),false,'QA retains hold, no fulfillment');
assert.equal(policy.needsReconciliation(synthetic,[]),false,'system tests never fulfilled');
assert.equal(db.orders.length,6,'read-only alerts never mutate business records');
const alertsUi=read('public/v32-3-expansion.js');
assert.equal(alertsUi,read('browser_public/v32-3-expansion.js'));
new vm.Script(alertsUi,{filename:'v32-3-expansion.js'});
assert.match(alertsUi,/SBC_V6691_ACTIONABLE_EXCEPTION_UI/);
assert.match(alertsUi,/data-v23-open=/,'exception buttons now carry safe action target');
assert.match(alertsUi,/bindExceptionActions\(\)/);
assert.match(alertsUi,/window\.sbcV23OpenException=/);
assert.match(alertsUi,/read-only review/,'order exception opens non-mutating inspection');
assert(!alertsUi.includes('dismissAllAlerts'),'no destructive global warning dismiss');
const app=read('public/app.js'),mirror=read('browser_public/app.js');
assert.equal(app,mirror,'phone browser mirrors match');
new vm.Script(app,{filename:'app.js'});
const p1=app.indexOf('// SBC_V6691_VOICE_DIAGNOSTIC'),p2=app.indexOf('async function ensureSbcVoice(){',p1);
assert(p1>=0&&p2>p1,'phone diagnostic helper exists');
const storage=new Map(),alerts=[],elements={
  '#sbcVoiceDiagnosticPanel':{hidden:true},'#sbcVoiceDiagnosticDetail':{textContent:''}
};
const phoneCtx={$:id=>elements[id]||null,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  navigator:{clipboard:{writeText:async s=>alerts.push(s)}},toast:x=>alerts.push(x),Date,JSON,String};
const phone=vm.runInNewContext(app.slice(p1,p2)+'\n({sbcVoiceSafeDiagnostic,sbcVoiceRememberError,sbcVoiceCopySafeDiagnostic})',phoneCtx);
const token='eyJhbGciOiJIUzI1NiJ9.abc_def456ghijklmnop.qwerty123456789';
const d=phone.sbcVoiceRememberError({code:20103,message:'Access Token rejected: Bearer '+token},'device');
assert.equal(d.code,'20103');
assert(!JSON.stringify(d).includes(token),'never expose JWT');
assert.match(elements['#sbcVoiceDiagnosticDetail'].textContent,/20103/);
assert.equal(elements['#sbcVoiceDiagnosticPanel'].hidden,false);
assert.match(app,/sbcVoiceRememberError\(e,'device'\)/);
assert.match(app,/sbcVoiceRememberError\(e,'connection'\)/);
assert.match(app,/sbcVoiceRememberError\(e,'start'\)/);
const html=read('public/index.html');
assert.equal(html,read('browser_public/index.html'));
assert.match(html,/v32-3-expansion\.js\?v=66\.0\.91-actionable/);
assert.match(html,/app\.js\?v=66\.0\.91-voice-code/);
(async()=>{await phone.sbcVoiceCopySafeDiagnostic();
 assert(alerts.some(s=>s.includes('"code":"20103"')),'safe diagnostic copy includes error code');
 assert(!alerts.some(s=>s.includes(token)),'copied report never includes JWT');
 console.log('[SBC V66.91] PASS: QA/system isolated, Square proof, tenant/job guard, linked exception actions, redacted persistent Voice code, syntax/mirrors/cache verified');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
