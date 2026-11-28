'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createController}=require('../enterprise/v56135-kim-mission-controller.js');

function customer(id,tenantId,leadTemperature,verificationStatus,extras={}){
 return {id,tenantId,leadTemperature,verificationStatus,status:'Lead',...extras};
}
test('advisory explains warm/hot qualification gaps without auto-promoting anyone or leaking records',async()=>{
 const db={orders:[],customers:[
  customer('unverified-sensitive-name',1,'Warm','Needs Verification'),
  customer('sales-ready',1,'Hot','Sales Ready'),
  customer('dnc',1,'Warm','Sales Ready',{doNotContact:true}),
  customer('already-customer',1,'Hot','Sales Ready',{status:'active'}),
  customer('cold',1,'Cold','Needs Verification'),
  customer('another-tenant',2,'Hot','Sales Ready'),
  customer('unresolved',null,'Warm','Sales Ready')
 ]};
 const info=[];const logger={info:(...args)=>info.push(args),warn:()=>{},error:()=>{}};
 const service=createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},logger});
 const out=await service.cycle({tenantId:1,limit:20,advisoryOnly:true});
 assert.equal(out.tenantCustomers,5);
 assert.equal(out.tenantWarmHot,4);
 assert.equal(out.qualifiedWarmHot,1);
 assert.equal(out.prospects,1);
 assert.equal(out.unresolvedTenantRecords,1);
 assert.deepEqual(out.qualificationReasons,{
   warmHotTotal:4,warmHotQualified:1,warmHotNeedsVerification:1,
   warmHotSuppressed:1,warmHotExistingCustomer:1,warmHotOther:0
 });
 assert.equal(out.externalActions,0);
 assert.equal(out.writeAttempts,0);
 const diagnostic=info.find(row=>String(row[0]).includes('eligibility reasons'));
 assert(diagnostic,'safe aggregate eligibility explanation should be logged for the operator');
 const dump=JSON.stringify(diagnostic);
 assert(!dump.includes('unverified-sensitive-name'));
 assert(!dump.includes('another-tenant'));
 assert(!dump.includes('sales-ready'));
});

test('no verified warm/hot customers emits counts but never claims all leads are qualified',async()=>{
 const db={orders:[],customers:[customer('lead1',1,'Hot','Owner Review'),customer('lead2',1,'Warm','Needs Verification')]};
 const out=await createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},logger:{info(){}}}).cycle({tenantId:1,advisoryOnly:true});
 assert.equal(out.qualifiedWarmHot,0);
 assert.equal(out.qualificationReasons.warmHotNeedsVerification,2);
 assert.equal(out.qualificationReasons.warmHotQualified,0);
});

test('Kim produces one evidence-based departmental operating plan without executing actions',async()=>{
 const captured=(id,price,extra={})=>({id,tenantId:1,customerId:'lead1',price,status:'New',paymentStatus:'Paid',squareOrderId:'order_'+id,squarePaymentId:'receipt_'+id,squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:new Date().toISOString(),...extra});
 const db={customers:[customer('lead1',1,'Hot','Sales Ready'),customer('verify1',1,'Warm','Needs Verification'),customer('blocked',1,'Hot','Sales Ready',{doNotContact:true}),customer('foreign',2,'Hot','Sales Ready')],orders:[
 captured('ready',199),captured('held',10000),captured('duplicate_a',499),captured('duplicate_b',499,{squarePaymentId:'receipt_duplicate_a'}),captured('fulfilled',799,{status:'Delivered'}),captured('foreign',900,{tenantId:2}),captured('qaorder_123',1),captured('synthetic',999,{testMode:true})
 ],fulfillmentJobs:[]};
 const original=JSON.stringify(db);
 const service=createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},saveData(){throw Error('unexpected write')},logger:{info(){}}});
 const out=await service.cycle({tenantId:1,advisoryOnly:true});
 const plan=out.operatingPlan;
 assert.equal(plan.scope,'TENANT_CANONICAL_SNAPSHOT');assert.equal(plan.execution,'ADVISORY_ONLY');
 assert.equal(plan.commercial.recognizedRevenueCents,1099800);
 assert.equal(plan.commercial.paymentIdentityConflicts,1);
 assert.equal(plan.departments.find(d=>d.id==='sales').decisions.find(d=>d.code==='HUMAN_SALES_REVIEW').count,1);
 assert.equal(plan.departments.find(d=>d.id==='research').decisions.find(d=>d.code==='VERIFY_WARM_HOT').count,1);
 assert.equal(plan.departments.find(d=>d.id==='fulfillment').decisions.find(d=>d.code==='PAID_WITHOUT_JOB').count,1);
 assert.equal(plan.departments.find(d=>d.id==='owner').decisions.find(d=>d.code==='OWNER_CLEARANCE').count,1);
 assert.equal(plan.departments.find(d=>d.id==='finance').decisions.find(d=>d.code==='PAYMENT_RECONCILIATION').count,2);
 assert.equal(JSON.stringify(db),original);assert(!JSON.stringify(plan).includes('receipt_'));assert(!JSON.stringify(plan).includes('lead1'));
});
test('Kim treats unavailable or unscoped fulfillment job evidence as unknown, not zero backlog',async()=>{
 const db={customers:[],orders:[{id:'o',tenantId:1,price:199,status:'New',squareOrderId:'order_o',squarePaymentId:'receipt_o',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:new Date().toISOString()}]};
 const service=createController({db,tenBrain:{BRAINS:[]},logger:{info(){}}});
 const a=await service.cycle({tenantId:1,advisoryOnly:true});
 assert.equal(a.operatingPlan.coverage.fulfillment,'UNAVAILABLE');
 assert.equal(a.operatingPlan.departments.find(d=>d.id==='fulfillment').decisions[0].count,null);
 db.fulfillmentJobs=[{id:'job1',orderId:'o'}];
 const b=await service.cycle({tenantId:1,advisoryOnly:true});
 assert.equal(b.operatingPlan.coverage.fulfillment,'UNSCOPED_RECORDS');
 assert.equal(b.operatingPlan.departments.find(d=>d.id==='fulfillment').decisions[0].count,null);
});

test('owner-only GET plan uses authenticated tenant, never an execution cycle',async()=>{
 const register=require('../routes/v56135-kim-mission');
 const handlers=new Map(),auth=()=>{},ownerOnly=()=>{};
 const prior=global.__SBC_REQUIRE_TENANT;
 global.__SBC_REQUIRE_TENANT=req=>req.tenant;
 let observed;
 const controller={cycle:async opts=>{observed=opts;return {ok:true,advisoryOnly:true,operatingPlan:{schema:1,execution:'ADVISORY_ONLY',scope:'TENANT_CANONICAL_SNAPSHOT',departments:[]}}}};
 register({get:(p,...h)=>handlers.set(p,h),post(){}},{auth,ownerOnly,getController:()=>controller});
 const route=handlers.get('/api/v56135/kim-mission/operating-plan');
 assert.equal(route[0],auth);assert.equal(route[1],ownerOnly);
 const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(x){this.body=x;return this}});
 try{
  let res=response();await route[2]({tenant:7,user:{role:'owner'},query:{tenantId:99,advisoryOnly:false}},res);
  assert.equal(res.code,200);assert.equal(observed.tenantId,7);assert.equal(observed.advisoryOnly,true);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.operatingPlan.execution,'ADVISORY_ONLY');
  controller.cycle=async()=>({ok:true,skipped:true});
  res=response();await route[2]({tenant:7,user:{role:'owner'}},res);assert.equal(res.code,503);assert.equal(res.body.ok,false);
 }finally{global.__SBC_REQUIRE_TENANT=prior;}
});
test('Kim owner interface presents departmental evidence and isolates legacy controls',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const js=fs.readFileSync(path.join(__dirname,'../public/kim-operations-os.js'),'utf8');
 const win={},calls=[];let unavailable=false;
 const plan={schema:1,scope:'TENANT_CANONICAL_SNAPSHOT',execution:'ADVISORY_ONLY',coverage:{fulfillment:'UNAVAILABLE'},commercial:{recognizedRevenueCents:19901,recognizedPaidOrders:1,proof:'Recorded capture only'},departments:[{id:'finance',decisions:[{code:'PAYMENT_RECONCILIATION',count:2,priority:0,status:'REVIEW_REQUIRED',action:'Review <unsafe> receipts'}]},{id:'fulfillment',decisions:[{code:'PAID_WITHOUT_JOB',count:null,priority:1,status:'EVIDENCE_REQUIRED',action:'Review job evidence'}]}]};
 const ctx={window:win,document:{querySelector:()=>null},addEventListener(){},fetch:async(url,opts)=>{calls.push({url,opts});return {ok:!unavailable||url!=='/api/v56135/kim-mission/operating-plan',json:async()=>url==='/api/v56135/kim-mission/operating-plan'?{ok:true,operatingPlan:plan}:{ok:true,production:{counts:{Staged:3},checklists:[],exceptions:[]}}}}};
 vm.runInNewContext(js,ctx);
 const html=await win.sbcKimOperationsView();
 assert.match(html,/Department operating plan/i);assert.match(html,/199\.01/);assert.match(html,/Payment reconciliation/i);assert.match(html,/Evidence required/i);assert.match(html,/Review &lt;unsafe&gt; receipts/);assert(!html.includes('<unsafe>'));
 assert.match(html,/<details[^>]*>.*Existing production controls/s);
 assert(calls.every(c=>!c.opts.method||c.opts.method==='GET'));
 unavailable=true;const failed=await win.sbcKimOperationsView();assert.match(failed,/Operating plan unavailable/i);assert(!failed.includes('199.01'));
});

test('Kim advisory and dispatch share reconciled paid-order eligibility and tenant job scope',async()=>{
 const capture=(id,price=199,extra={})=>({id,tenantId:1,customerId:'customer_one',price,status:'New',paymentStatus:'Paid',squareOrderId:'square_order_'+id,squarePaymentId:'square_receipt_'+id,squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-01T12:00:00Z',...extra});
 const orders=[capture('ready'),capture('held',10000),capture('dup_a'),capture('dup_b',199,{squarePaymentId:'square_receipt_dup_a'}),capture('qaorder_synthetic'),capture('invalid_cents',1.001),capture('has_job'),capture('foreign',199,{tenantId:2}),capture('started',199,{metadata:{kimMissionFulfillmentStarted:'true'}})];
 const db={customers:[customer('customer_one',1,'Warm','Sales Ready')],orders,fulfillmentJobs:[{tenantId:1,orderId:'has_job'},{tenantId:2,orderId:'ready'}]};
 const calls=[];let writes=0;
 const service=createController({db,tenBrain:{BRAINS:[]},godKim:{orchestrate:async({order})=>{calls.push(order.id);return {ok:true,stage:'POLICY_GATED'}}},saveData:async()=>{writes++},logger:{info(){}}});
 const plan=(await service.cycle({tenantId:1,advisoryOnly:true})).operatingPlan;
 assert.equal(plan.departments.find(d=>d.id==='fulfillment').decisions[0].count,1);
 assert.equal(plan.departments.find(d=>d.id==='owner').decisions[0].count,1);
 assert.equal(calls.length,0);assert.equal(writes,0);
 const run=await service.reconcilePaidOrders(20,1);
 assert.deepEqual(calls,['ready']);assert.equal(run.heldForOwner,1);assert.equal(run.dispatchCandidates,1);
 assert.equal(run.coverage,'SCOPED_SNAPSHOT');assert.equal(writes,1);
});
test('Kim dispatch cannot turn missing or unscoped job evidence into new fulfillment',async()=>{
 const order={id:'paid',tenantId:1,price:199,status:'New',paymentStatus:'Paid',squareOrderId:'so',squarePaymentId:'sp',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-01T12:00:00Z'};
 const db={customers:[],orders:[order]};
 let calls=0,writes=0;
 const service=createController({db,tenBrain:{BRAINS:[]},godKim:{orchestrate:async()=>{calls++}},saveData:async()=>{writes++},logger:{info(){}}});
 for(const [jobs,coverage] of [[undefined,'UNAVAILABLE'],[[{orderId:'legacy'}],'UNSCOPED_RECORDS']]){
  db.fulfillmentJobs=jobs;
  const r=await service.reconcilePaidOrders(20,1);
  assert.equal(r.coverage,coverage);assert.equal(r.attempted,0);assert.equal(r.dispatchCandidates,0);
 }
 assert.equal(calls,0);assert.equal(writes,0);assert.equal(order.metadata,undefined);
});

test('Intelligence Factory extends the existing owner plan with bounded measured departmental evidence',async()=>{
 const db={customers:[customer('private_name',1,'Hot','Needs Verification'),customer('foreign_name',2,'Hot','Sales Ready')],orders:[],fulfillmentJobs:[]};
 const service=createController({db,tenBrain:{BRAINS:[]},saveData(){throw Error('unexpected write')},logger:{info(){}}});
 const out=await service.cycle({tenantId:1,advisoryOnly:true});
 const factory=out.operatingPlan.intelligenceFactory;
 assert.equal(factory.schema,1);assert.equal(factory.mode,'DETERMINISTIC_ADVISORY');assert.equal(factory.providerCalls,0);
 assert.equal(factory.agents.length,9);assert.equal(factory.agents.find(a=>a.id==='research').reviewCount,1);
 assert.equal(factory.agents.find(a=>a.id==='marketing').status,'EVIDENCE_REQUIRED');
 assert.equal(factory.agents.find(a=>a.id==='academy').status,'EVIDENCE_REQUIRED');
 assert.equal(factory.runtime.externalInferenceEnabled,false);assert.equal(factory.runtime.speechEnabled,false);
 assert(Number.isFinite(factory.profile.durationMs));assert(factory.profile.durationMs>=0);
 assert(!JSON.stringify(factory).includes('private_name'));assert(!JSON.stringify(factory).includes('foreign_name'));
});
test('Factory tool proposals cannot grant execution authority or cross tenant scope',()=>{
 const F=require('../enterprise/sbc-intelligence-factory.cjs');
 for(const tool of ['send_message','charge_payment','publish_post','shell','__proto__','read_snapshot']){
  const r=F.reviewProposal({agent:'marketing',tool,tenantId:2},{tenantId:1});assert.equal(r.allowed,false);
 }
 assert.equal(F.reviewProposal({agent:'finance',tool:'charge_payment',tenantId:1},{tenantId:1}).allowed,false);
 assert.equal(F.reviewProposal({agent:'research',tool:'review_research',tenantId:1},{tenantId:1}).allowed,true);
 assert.equal(F.reviewProposal({agent:'sales',tool:'review_research',tenantId:1},{tenantId:1}).allowed,false);
});
test('Factory creative readiness distinguishes missing evidence, reused art and complete approved slots',()=>{
 const F=require('../enterprise/sbc-intelligence-factory.cjs'),date='2026-11-25';
 assert.equal(F.creativeReadiness(undefined,date).status,'EVIDENCE_REQUIRED');
 const slot=(date,slot,hash)=>({date,slot,sha256:hash,approved:true,mediaVerified:true,channels:['facebook','instagram','linkedin','google_business']});
 const dates=Array.from({length:7},(_,i)=>new Date(Date.UTC(2026,10,25+i)).toISOString().slice(0,10));
 const rows=dates.flatMap((d,i)=>[slot(d,'AM',(i*2+1).toString(16).padStart(64,'0')),slot(d,'PM',(i*2+2).toString(16).padStart(64,'0'))]);
 assert.equal(F.creativeReadiness({rows,history:[],historyComplete:true},date).readySlots,14);
 const r=F.creativeReadiness({rows,history:[{date:'2026-11-24',sha256:rows[0].sha256}],historyComplete:true},date);
 assert.equal(r.readySlots,13);assert.equal(r.blockedSlots,1);
 assert.equal(F.creativeReadiness({rows,history:[],historyComplete:false},date).status,'EVIDENCE_REQUIRED');
});
test('Factory research and speech evaluation require source evidence and synthetic EN/ES samples',()=>{
 const F=require('../enterprise/sbc-intelligence-factory.cjs');
 assert.equal(F.researchEvidence([{url:'https://example.invalid',verifiedAt:'2026-11-25T10:00:00Z',observed:true}],Date.parse('2026-11-25T12:00:00Z')).usableSources,1);
 assert.equal(F.researchEvidence([{url:'file:///private',verifiedAt:'2026-11-25T10:00:00Z',observed:true}],Date.parse('2026-11-25T12:00:00Z')).usableSources,0);
 assert.equal(F.speechBenchmark([{language:'en',synthetic:false,reference:'hello',hypothesis:'hello'}]).status,'EVIDENCE_REQUIRED');
 const r=F.speechBenchmark([{language:'en',synthetic:true,reference:'hello world',hypothesis:'hello world'},{language:'es',synthetic:true,reference:'buenos días',hypothesis:'buenos'}]);
 assert.equal(r.languages.en.wordErrorRate,0);assert.equal(r.languages.es.wordErrorRate,0.5);assert.equal(r.productionCertified,false);
});

test('NVIDIA lab defaults to disabled and refuses remote, credentialed and redirecting endpoints',async()=>{
 const {runLab}=require('../enterprise/sbc-nvidia-lab.cjs');
 let calls=0;const transport=async()=>{calls++;throw Error('unexpected network')};
 assert.equal((await runLab({},transport)).status,'DISABLED');
 for(const url of ['https://integrate.api.nvidia.com','http://user:secret@127.0.0.1:8000','http://127.0.0.1:8000/v1','http://localhost:8000','http://127.0.0.1.example.invalid:8000']){
  await assert.rejects(runLab({SBC_NVIDIA_LAB_ENABLED:'1',SBC_NVIDIA_NIM_URL:url,SBC_NVIDIA_NIM_MODEL:'nvidia/test-model'},transport),/LOCAL_ENDPOINT_REQUIRED/);
 }
 assert.equal(calls,0);
});
test('NVIDIA lab calls only exact documented NIM endpoints with fixed synthetic input and rejects tool proposals',async()=>{
 const {runLab}=require('../enterprise/sbc-nvidia-lab.cjs');const calls=[];
 const env={SBC_NVIDIA_LAB_ENABLED:'1',SBC_NVIDIA_NIM_URL:'http://127.0.0.1:18000',SBC_NVIDIA_NIM_MODEL:'nvidia/test-model',SBC_NVIDIA_EMBED_URL:'http://127.0.0.1:18001',SBC_NVIDIA_EMBED_MODEL:'nvidia/test-embed'};
 const fake=async(url,options)=>{calls.push({url,options});const p=new URL(url).pathname;
  if(p==='/v1/health/ready')return new Response('{}');
  if(p==='/v1/models')return Response.json({data:[{id:new URL(url).port==='18000'?'nvidia/test-model':'nvidia/test-embed'}]});
  if(p==='/v1/chat/completions')return Response.json({choices:[{message:{content:'REVIEW'}}]});
  if(p==='/v1/embeddings')return Response.json({data:[{index:0,embedding:[0.1,0.2]}]});
  throw Error('unexpected path');
 };
 const r=await runLab(env,fake);assert.equal(r.status,'SYNTHETIC_PROBE_PASSED');assert.equal(r.reasoning.passed,true);assert.equal(r.embedding.dimensions,2);assert.equal(r.productionCertified,false);
 assert.equal(calls.length,6);assert(calls.every(c=>c.options.redirect==='error'&&!c.options.headers.authorization));
 assert.equal(JSON.parse(calls[2].options.body).max_tokens,32);
 assert(!JSON.stringify(r).includes('0.1,0.2'));
 await assert.rejects(runLab(env,async(u,o)=>new URL(u).pathname==='/v1/chat/completions'?Response.json({choices:[{message:{content:'REVIEW',tool_calls:[{id:'unsafe'}]}}]}):fake(u,o)),/UNEXPECTED_MODEL_OUTPUT/);
});
test('NVIDIA lab stops at failed readiness or unserved model and validates bounded vector output',async()=>{
 const {runLab}=require('../enterprise/sbc-nvidia-lab.cjs');const env={SBC_NVIDIA_LAB_ENABLED:'1',SBC_NVIDIA_NIM_URL:'http://127.0.0.1:18000',SBC_NVIDIA_NIM_MODEL:'nvidia/test-model'};
 let calls=0;await assert.rejects(runLab(env,async()=>{calls++;return new Response('offline',{status:503})}),/NVIDIA_HTTP_FAILURE/);assert.equal(calls,1);
 calls=0;await assert.rejects(runLab(env,async()=>{calls++;return Response.json({data:[]})}),/MODEL_NOT_SERVED/);assert.equal(calls,2);
});

test('AI-Q standalone lab uses bounded exact local API calls and reconciles the same synthetic job',async()=>{
 const {aiqLab}=require('../enterprise/sbc-nvidia-research-lab.cjs');
 const {createServer}=require('node:http');const requests=[];let status='SUBMITTED',mismatch=false;
 const job='sbc-lab-1234567890abcdef1234567890abcdef';
 const server=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):null;requests.push({path:req.url,method:req.method,body});
  let result;
  if(req.url==='/health')result={status:'healthy',dask_available:true,db:'ok',encryption:{ready:true}};
  else if(req.url==='/v1/jobs/async/agents')result={agents:[{agent_type:'deep_researcher'}]};
  else if(req.url==='/v1/data_sources')result=[{id:'knowledge_layer'}];
  else if(req.url==='/v1/jobs/async/submit'&&req.method==='POST')result={job_id:job,status:'SUBMITTED',agent_type:'deep_researcher'};
  else if(req.url==='/v1/jobs/async/job/'+job)result={job_id:mismatch?'other':job,status,agent_type:'deep_researcher'};
  else if(req.url==='/v1/jobs/async/job/'+job+'/report')result={job_id:job,has_report:true,report:'# Synthetic report'};
  else if(req.url==='/v1/jobs/async/job/'+job+'/state')result={job_id:job,has_state:true,artifacts:{sources:{found_urls:['https://example.invalid/a'],cited_urls:['https://example.invalid/a']}}};
  else {res.writeHead(404);return res.end();}
  res.setHeader('content-type','application/json');res.end(JSON.stringify(result));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  assert.equal((await aiqLab({})).status,'DISABLED');
  const env={SBC_AIQ_LAB_ENABLED:'1',SBC_AIQ_URL:'http://127.0.0.1:'+server.address().port};
  assert.equal((await aiqLab(env)).status,'DISCOVERED');assert.equal(requests.length,3);
  const e={...env,SBC_AIQ_JOB_ID:job,SBC_AIQ_MODE:'submit'};
  await assert.rejects(aiqLab(e),/ISOLATED_LAB_ACK_REQUIRED/);assert.equal(requests.length,3);
  assert.equal((await aiqLab({...e,SBC_AIQ_ISOLATED_ACK:'1'})).status,'SUBMITTED');
  const post=requests.filter(x=>x.method==='POST');assert.equal(post.length,1);assert.deepEqual(post[0].body.data_sources,['knowledge_layer']);assert.equal(post[0].body.job_id,job);
  assert.equal((await aiqLab({...e,SBC_AIQ_MODE:'status'})).status,'SUBMITTED');
  status='SUCCESS';const out=await aiqLab({...e,SBC_AIQ_MODE:'status'});assert.equal(out.status,'REPORT_REVIEW_REQUIRED');assert.equal(out.citedSourceCount,1);assert.equal(out.productionCertified,false);assert(!JSON.stringify(out).includes('Synthetic report'));
  mismatch=true;await assert.rejects(aiqLab({...e,SBC_AIQ_MODE:'status'}),/AIQ_JOB_IDENTITY_MISMATCH/);
  assert.equal(requests.filter(x=>x.method==='POST').length,1);
 }finally{await new Promise(r=>server.close(r));}
});
test('Retriever lab requests passage and query embeddings separately and measures bilingual ranking',async()=>{
 const {retrieverLab}=require('../enterprise/sbc-nvidia-research-lab.cjs');const bodies=[];
 const env={SBC_RETRIEVER_LAB_ENABLED:'1',SBC_NVIDIA_EMBED_URL:'http://127.0.0.1:18001',SBC_NVIDIA_EMBED_MODEL:'nvidia/test-embed'};
 const fake=async(url,opts)=>{const p=new URL(url).pathname;
  if(p==='/v1/health/ready')return new Response('{}');
  if(p==='/v1/models')return Response.json({data:[{id:'nvidia/test-embed'}]});
  const b=JSON.parse(opts.body);bodies.push(b);
  assert.equal(b.modality,'text');assert.equal(b.input.length,4);
  return Response.json({model:b.model,data:b.input.map((_,i)=>({index:i,embedding:Array.from({length:4},(_,j)=>Number(i===j))})).reverse()});
 };
 assert.equal((await retrieverLab({},fake)).status,'DISABLED');
 const r=await retrieverLab(env,fake);assert.equal(r.status,'SYNTHETIC_RANKING_MEASURED');assert.equal(r.accuracy,1);assert.equal(r.english.correct,2);assert.equal(r.spanish.correct,2);assert.deepEqual(bodies.map(b=>b.input_type),['passage','query']);
 assert.equal(r.productionCertified,false);assert(!Object.hasOwn(r,'vectors'));
 await assert.rejects(retrieverLab(env,async(u,o)=>new URL(u).pathname==='/v1/embeddings'?Response.json({model:'nvidia/test-embed',data:[{index:0,embedding:[1]}]}):fake(u,o)),/INVALID_EMBEDDING_BATCH/);
});

test('NVIDIA owner readiness distinguishes actual SDK checks, fixture protocols and unverified runtime',()=>{
 const {buildFactory}=require('../enterprise/sbc-intelligence-factory.cjs');
 const n=buildFactory({departments:[]}).nvidiaReadiness;
 assert.equal(n.schema,1);assert.equal(n.scope,'RECORDED_DEVELOPMENT_EVIDENCE');
 assert.equal(n.productionCertified,false);assert.equal(n.activeProviders,0);
 assert.equal(n.components.length,10);assert.equal(new Set(n.components.map(c=>c.id)).size,10);
 const by=Object.fromEntries(n.components.map(c=>[c.id,c]));
 assert.equal(by.guardrails.evidence,'ACTUAL_SDK_TESTED');
 assert.equal(by.relay.evidence,'ACTUAL_SDK_TESTED');
 assert.equal(by.riva.evidence,'SDK_FIXTURE_PROTOCOL_TESTED');
 assert.equal(by.aiq.evidence,'FIXTURE_PROTOCOL_TESTED');
 assert.equal(by.openshell.evidence,'POLICY_ONLY');
 assert.equal(by.nemoclaw.evidence,'DOCUMENTED_ONLY');
 assert.equal(by.cuda.evidence,'DRIVER_PROBE_FIXTURE_TESTED');
 assert(n.components.every(c=>c.production==='NOT_VERIFIED'&&c.nextGate.length>0));
 assert(n.components.every(c=>/^https:\/\/github\.com\/romeo013us\/sbc\/(actions\/runs|pull)\/[0-9]+$/.test(c.reference)));
 n.components[0].production='ACTIVE';
 assert.equal(buildFactory({departments:[]}).nvidiaReadiness.components[0].production,'NOT_VERIFIED');
});
test('Kim owner shows integration evidence without implying live models or adding execution controls',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const {buildFactory}=require('../enterprise/sbc-intelligence-factory.cjs');
 const plan={schema:1,scope:'TENANT_CANONICAL_SNAPSHOT',execution:'ADVISORY_ONLY',commercial:{recognizedRevenueCents:0,recognizedPaidOrders:0},departments:[]};
 plan.intelligenceFactory=buildFactory(plan);
 const win={},requests=[];
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/kim-operations-os.js'),'utf8'),{window:win,document:{querySelector:()=>null},addEventListener(){},fetch:async(url,o)=>{requests.push({url,o});return {ok:true,json:async()=>url.endsWith('operating-plan')?{ok:true,operatingPlan:plan}:{production:{}}}}});
 const html=await win.sbcKimOperationsView();
 assert.match(html,/NVIDIA integration readiness/);assert.match(html,/NeMo Guardrails/);assert.match(html,/NemoClaw/);assert.match(html,/No active NVIDIA providers/);assert.match(html,/Production not verified/);
 assert.match(html,/github\.com\/romeo013us\/sbc\/actions\/runs\/45661442784/);
 assert.equal(requests.length,2);assert(requests.every(r=>!r.o.method||r.o.method==='GET'));
 plan.intelligenceFactory.nvidiaReadiness.components[0].reference='javascript:alert(1)';
 const invalid=await win.sbcKimOperationsView();assert(!invalid.includes('javascript:'));assert.match(invalid,/Integration evidence unavailable/);
});

test('Kim legacy overview and cycle use the same reconciled revenue as the owner operating plan',async()=>{
 const capture=(id,price,extra={})=>({id,tenantId:1,customerId:'c1',price,status:'Delivered',paymentStatus:'Paid',squareOrderId:'so_'+id,squarePaymentId:'sp_'+id,squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-01T12:00:00Z',...extra});
 const db={customers:[customer('c1',1,'Cold','Needs Verification')],orders:[capture('valid',199),capture('dup_a',499),capture('dup_b',499,{squarePaymentId:'sp_dup_a'}),capture('qaorder_123',1),capture('fraction',1.001),capture('foreign',999,{tenantId:2}),{id:'label',tenantId:1,price:100,status:'Paid',paymentStatus:'Paid'}],fulfillmentJobs:[]};
 const s=createController({db,tenBrain:{BRAINS:[]},saveData:async()=>{},logger:{info(){}}});
 const plan=(await s.cycle({tenantId:1,advisoryOnly:true})).operatingPlan;
 assert.equal(plan.commercial.recognizedRevenueCents,19900);
 assert.equal(s.overview(1).metrics.recognizedRevenue,199);
 assert.equal(s.overview(1).metrics.paidOrders,1);
 const run=await s.cycle({tenantId:1});
 assert.equal(run.metrics.recognizedRevenue,199);assert.equal(run.metrics.paidOrders,1);
 assert.equal(s.overview(2).state.lastCycleResult,null);
 assert.equal(s.overview(2).metrics.recognizedRevenue,999);
});

test('switching Kim cycle tenant never exposes the prior tenant cycle while a new cycle is in flight',async()=>{
 let release;const waiting=new Promise(resolve=>{release=resolve});
 const db={customers:[],orders:[],fulfillmentJobs:[]};
 const service=createController({db,tenBrain:{BRAINS:[]},saveData:async()=>{},logger:{info(){}}});
 await service.cycle({tenantId:1});
 assert.equal(service.overview(1).state.lastCycleResult.ok,true);
 db.orders.push({id:'other_paid',tenantId:2,price:199,status:'New',paymentStatus:'Paid',squareOrderId:'other_so',squarePaymentId:'other_sp',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-01T12:00:00Z'});
 // Use an unresolved eligible mission to pause the new tenant before reporting.
 db.customers.push(customer('other_c',2,'Hot','Sales Ready'));
 const otherService=createController({db,tenBrain:{BRAINS:[],evaluate:async()=>{await waiting;return {action:'CONTINUE_CONVERSATION'}}},godKim:{orchestrate:async()=>({ok:true,stage:'POLICY_GATED'})},saveData:async()=>{},logger:{info(){}}});
 await otherService.cycle({tenantId:1});
 const pending=otherService.cycle({tenantId:2});
 try{
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(otherService.overview(2).state.lastCycleResult,null);
  assert.equal(otherService.overview(1).state.lastCycleResult,null);
 }finally{release();await pending}
});

test('verification bottleneck breaks down 560 records without promotion, disclosure or side effects',async()=>{
 const groups=[
  ...Array.from({length:200},(_,i)=>customer('private-missing-'+i,1,'Warm','Needs Verification')),
  ...Array.from({length:100},(_,i)=>customer('private-review-'+i,1,'Hot','Owner Review',{phone:'3055550100'})),
  ...Array.from({length:100},(_,i)=>customer('private-conflict-'+i,1,'Hot','Unverified',{leadIntelligence:{verificationStatus:'Verified'},email:'private@example.test'})),
  ...Array.from({length:100},(_,i)=>customer('private-status-'+i,1,'Warm','')),
  ...Array.from({length:60},(_,i)=>customer('private-other-'+i,1,'Warm','Research incomplete',{email:'private@example.test'})),
  customer('foreign-secret',2,'Hot','Needs Verification'),
  customer('suppressed-secret',1,'Hot','Needs Verification',{doNotCall:true})
 ];
 const db={customers:groups,orders:[],fulfillmentJobs:[]},before=JSON.stringify(db),logs=[];
 const controller=createController({db,saveData(){assert.fail('unexpected write')},tenBrain:{BRAINS:[]},logger:{info:(...args)=>logs.push(args)}});
 const result=await controller.cycle({tenantId:1,advisoryOnly:true});
 const expected={total:560,needsVerification:200,ownerReview:100,explicitlyUnverified:100,missingStatus:100,otherStatus:60,nestedVerifiedConflict:100,missingContactMethod:300};
 assert.deepEqual(result.verificationReviewEvidence,expected);
 assert.deepEqual(result.operatingPlan.leadVerificationReview,expected);
 assert.equal(result.qualificationReasons.warmHotNeedsVerification,560);
 assert.equal(result.qualifiedWarmHot,0);assert.equal(result.externalActions,0);assert.equal(result.writeAttempts,0);
 assert.equal(JSON.stringify(db),before);
 const output=JSON.stringify([logs,result.operatingPlan]);
 assert(!output.includes('private-'));assert(!output.includes('private@example.test'));assert(!output.includes('foreign-secret'));
});

test('owner plan shows reconciled verification breakdown and rejects incomplete or conflicting evidence',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const db={orders:[],customers:[customer('one',1,'Warm','Needs Verification'),customer('two',1,'Hot','Unverified'),customer('three',1,'Hot','Owner Review',{phone:'3055550100'})]};
 const plan=(await createController({db,tenBrain:{BRAINS:[]},logger:{info(){}}}).cycle({tenantId:1,advisoryOnly:true})).operatingPlan;
 const win={},calls=[];vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/kim-operations-os.js'),'utf8'),{window:win,document:{querySelector:()=>null},addEventListener(){},fetch:async(url,opts)=>{calls.push(opts);return {ok:true,json:async()=>url.endsWith('/operating-plan')?{ok:true,operatingPlan:plan}:{ok:true,production:{}}}}});
 const html=await win.sbcKimOperationsView();
 assert.match(html,/Lead verification breakdown/);assert.match(html,/Needs verification<\/span><strong>1<\/strong>/);assert.match(html,/Explicitly unverified<\/span><strong>1<\/strong>/);assert.match(html,/Owner review<\/span><strong>1<\/strong>/);assert.match(html,/Missing contact method<\/span><strong>2<\/strong>/);
 assert.match(html,/Do not mark leads verified without supporting evidence/);assert(calls.every(c=>!c.method||c.method==='GET'));
 plan.leadVerificationReview.total=999;assert.match(await win.sbcKimOperationsView(),/Verification breakdown unavailable/);
 delete plan.leadVerificationReview;assert.match(await win.sbcKimOperationsView(),/Verification breakdown unavailable/);
});

test('Kim revenue intelligence is read-only and explains unavailable profit rather than inventing a margin',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const stamp=new Date(Date.now()-60000).toISOString();
 const db={customers:[customer('real',1,'Warm','Verified')],orders:[{id:'paid',tenantId:1,customerId:'real',price:299,status:'New',paymentStatus:'Paid',squareOrderId:'order_fixture',squarePaymentId:'capture_fixture',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:stamp}],fulfillmentJobs:[]};
 const before=JSON.stringify(db);
 const plan=(await createController({db,tenBrain:{BRAINS:[]},saveData(){assert.fail('unexpected write')},logger:{info(){}}}).cycle({tenantId:1,advisoryOnly:true})).operatingPlan;
 assert.equal(plan.revenueIntelligence.status,'available');
 assert.equal(plan.revenueIntelligence.executionAllowed,false);assert.equal(plan.revenueIntelligence.profit.netProfitCents,null);assert.equal(plan.revenueIntelligence.windows.length,2);
 assert.equal(JSON.stringify(db),before);
 const win={},calls=[];vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/kim-operations-os.js'),'utf8'),{window:win,document:{querySelector:()=>null},addEventListener(){},fetch:async(url,opts)=>{calls.push(opts);return {ok:true,json:async()=>url.endsWith('/operating-plan')?{ok:true,operatingPlan:plan}:{ok:true,production:{}}}}});
 const html=await win.sbcKimOperationsView();
 assert.match(html,/Revenue Intelligence 360/);assert.match(html,/7 completed days/);assert.match(html,/30 completed days/);
 assert.match(html,/Net profit unavailable/);assert.match(html,/UTC/);assert(calls.every(c=>!c.method||c.method==='GET'));
 assert.equal(fs.readFileSync(path.join(__dirname,'../public/kim-operations-os.js'),'utf8'),fs.readFileSync(path.join(__dirname,'../browser_public/kim-operations-os.js'),'utf8'));
});
