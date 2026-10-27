'use strict';
// V66.65 Square readiness: compiled no-charge, owner-only regression tests.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const helper=require(path.join(root,'enterprise/v6665-square-readiness.cjs'));
const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
const marker="app.get('/api/payments/square/readiness',auth,ownerOnly,async(req,res)=>{";
const at=source.indexOf(marker),end=at<0?-1:source.indexOf('\n});',at);
assert(at>=0&&end>at,'compiled owner-only readiness route missing');
const segment=source.slice(at,end+4);
assert.match(segment,/SBC_V6665_SQUARE_READINESS_TRIAGE/);
assert.match(segment,/productionCertified:false/);
assert.match(segment,/Cache-Control','no-store'/);
assert.doesNotMatch(segment,/\/v2\/online-checkout\/payment-links/);
assert.doesNotMatch(segment,/saveData\(|createSquarePaymentLinkForOrder\(|handleSquarePaymentEvent\(/);
new vm.Script(segment,{filename:'square-readiness-route.js'});

for(const x of [
 {configured:false,provider:{reachable:false,code:'NOT_CONFIGURED'},webhookConfigured:false,writerReady:false,ownerPaused:false,count:3},
 {configured:true,provider:{reachable:false,code:'HTTP_401'},webhookConfigured:true,writerReady:true,ownerPaused:false,count:1},
 {configured:true,provider:{reachable:true,code:'LOCATION_ACTIVE'},webhookConfigured:true,writerReady:true,ownerPaused:true,count:1},
 {configured:true,provider:{reachable:true,code:'LOCATION_ACTIVE'},webhookConfigured:true,writerReady:true,ownerPaused:false,count:0}
]){
 const r=helper.assess({...x,environment:'production'});
 assert.equal(r.blockers.length,x.count,'incorrect blocker grouping');
 assert.equal(r.preflightReady,x.count===0);
 assert.equal(r.productionCertified,false);
 assert.equal(r.paymentCapturedAndReconciled,false);
 assert.equal(r.autonomousSquareCircuit,'NOT_OBSERVED_BY_THIS_ENDPOINT');
 assert.equal(r.safeOperations.chargesInitiated,false);
 assert.equal(r.safeOperations.newOrdersCreated,false);
}
const secret='square-token-that-must-never-be-returned';
assert(!JSON.stringify(helper.assess({configured:true,provider:{reachable:false,code:'Bearer '+secret},environment:'production'})).includes(secret));
assert.equal(helper.assess({configured:true,provider:{reachable:false,code:'Bearer PRIVATE'},environment:'production'}).locationProbeCode,'UNKNOWN');

async function exercise({configured,webhook,writer,paused,reachable,code}){
 let registered,probeCalls=0,reported,headers={};
 const context={
  app:{get:(name,a,b,handler)=>{registered={name,a,b,handler}}},
  auth:{},ownerOnly:{},require:p=>{
   assert.equal(p,'./enterprise/v6665-square-readiness.cjs');
   return helper;
  },
  process:{env:{SQUARE_ACCESS_TOKEN:secret,SQUARE_LOCATION_ID:'loc_fake'}},
  squareConfigured:()=>configured,squareWebhookConfigured:()=>webhook,
  RUNTIME_GATE:{blocked:n=>{assert.equal(n,'NEW_CHECKOUTS');return paused}},
  SBC_RUNTIME_READ_ONLY:!writer,MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,
  sbcWriterLeaseReady:writer,
  SBC_SQUARE_LOCATION_PROBE:async args=>{
   probeCalls++;
   assert.equal(args.token,secret);
   return {reachable,code};
  },
  squareEnvironment:()=>'sandbox',SQUARE_API_VERSION:'2026-09-16'
 };
 vm.runInNewContext(segment,context,{timeout:1000});
 assert.equal(registered.name,'/api/payments/square/readiness');
 assert.equal(registered.a,context.auth);
 assert.equal(registered.b,context.ownerOnly);
 const res={setHeader:(k,v)=>{headers[k]=v},json:o=>{reported=o;return o}};
 await registered.handler({},res);
 assert.equal(headers['Cache-Control'],'no-store');
 assert.equal(probeCalls,configured?1:0);
 assert.equal(reported.productionCertified,false);
 assert.equal(reported.preflightReady,reported.ready);
 assert.equal(reported.triage.productionCertified,false);
 assert.equal(reported.triage.blockers.length===0,reported.ready);
 assert.equal(reported.triage.safeOperations.chargesInitiated,false);
 assert(!JSON.stringify(reported).includes(secret),'no Square auth secret in owner diagnostics');
 return reported;
}
(async()=>{
 await exercise({configured:false,webhook:false,writer:false,paused:true,reachable:false,code:'NOT_CONFIGURED'});
 await exercise({configured:true,webhook:true,writer:true,paused:false,reachable:true,code:'LOCATION_ACTIVE'});
 await exercise({configured:true,webhook:true,writer:true,paused:false,reachable:false,code:'HTTP_401'});
 for(const f of ['public/index.html','browser_public/index.html'])
  assert(fs.existsSync(path.join(root,f)),'frontend unchanged but required: '+f);
 console.log('[SBC V66.65] PASS compiled Square owner readiness blockers and truthful certification; zero provider writes or credentials exposed');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
