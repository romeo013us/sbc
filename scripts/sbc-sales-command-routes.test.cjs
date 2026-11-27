'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ROUTE=require('../routes/sbc-sales-command-v1.cjs');
const STAGE=require('./v66160-stage-sales-command.cjs');
const ROLE=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
function setup(recovery=false,locked=null,profiles=[]){
 const handlers=new Map(),calls=[];
 const db={users:[{id:'m1',tenantId:1,role:'account_manager',name:'Manager One',active:true},
                  {id:'m2',tenantId:2,role:'account_manager',name:'Foreign Worker',active:true}]};
 const pool={async query(sql,args){
  calls.push({sql,args});
  if(sql.startsWith('SELECT * FROM sbc_sales_credit_v1'))return [[]];
  if(sql.startsWith('SELECT tier, revision FROM sbc_am_workstation_profile_v2'))return [profiles.filter(p=>p.tenant_id===args[0]&&p.manager_id===args[1])];
  if(sql.startsWith('SELECT tier FROM sbc_commission_terms_v1'))return [[{tier:'standard'}]];
  if(sql.startsWith('SELECT * FROM sbc_commission_statement_v1'))return [locked?[locked]:[]];
  if(sql.startsWith('SELECT order_id FROM sbc_sales_credit_v1'))return [[]];
  throw Error('Unexpected read query: '+sql);
 },async getConnection(){throw Error('Should never reach mutation in guard tests')}};
 let writes=0;
 ROUTE.register({get:(p,a,f)=>handlers.set('GET '+p,f),
  post:(p,a,f)=>handlers.set('POST '+p,f)},{
  auth:(req,res,next)=>next?.(),getContext:()=>({db,mysqlPool:pool,recoveryRequired:()=>recovery}),
  tenantForRead:req=>req.tenantId,writer:()=>{writes++}
 });
 async function call(method,path,user,body={},query={},tenantId=1){
  let json,code=200,cache;
  const req={user,body,query,tenantId,params:{managerId:'m1',month:'2026-10'}},
        res={setHeader(k,v){cache=v},status(n){code=n;return this},json(v){json=v;return this}};
  await handlers.get(method+' '+path)(req,res);
  return {code,json,cache};
 }
 return {handlers,calls,call,db,get writes(){return writes}};
}
test('owner sees tenant-scoped manager summary without phantom payment',async()=>{
 const env=setup();
 const r=await env.call('GET','/api/owner/sales-command/overview',{id:'owner',role:'owner',tenantId:1}, {},{month:'2026-11'});
 assert.equal(r.code,200);
 assert.equal(r.json.managers.length,1);
 assert.equal(r.json.teamRevenueCents,0);
 assert.equal(r.json.teamMonthlyTargetCents,1300000);
 assert.equal(r.json.automaticTransfers,false);
 assert.equal(r.cache,'no-store');
 assert(env.calls.every(c=>c.args[0]===1));
});
test('manager can see only own progress, not owner dashboard or company profit',async()=>{
 const env=setup();
 const m={id:'m1',role:'account_manager',tenantId:1,active:true};
 const r=await env.call('GET','/api/sbc/sales/compensation/me',m,{}, {month:'2026-11'});
 assert.equal(r.code,200);assert.equal(r.json.managerId,'m1');
 assert.equal(r.json.profitCents,undefined);
 assert.equal(r.json.paymentInitiated,false);
 const blocked=await env.call('GET','/api/owner/sales-command/overview',m);
 assert.equal(blocked.code,403);
 const cross=await env.call('GET','/api/sbc/sales/compensation/me',{...m,tenantId:2});
 assert.equal(cross.code,403);
});
test('eligible order list excludes refunded, charged-back, and invalid-value captured orders',async()=>{
 const env=setup();
 env.db.orders=[
  {id:'valid',tenantId:1,customerId:'c1',price:199,paymentStatus:'PAID',paymentProvider:'square',squarePaymentId:'sq-valid',squarePaymentStatus:'COMPLETED',squareOrderId:'order-proof',squarePaymentCompletedAt:'2026-11-20T18:00:00Z'},
  {id:'refund',tenantId:1,customerId:'c1',price:199,paymentStatus:'REFUNDED',paymentProvider:'square',squarePaymentId:'sq-refund',squarePaymentStatus:'COMPLETED',squareOrderId:'order-proof',squarePaymentCompletedAt:'2026-11-20T18:00:00Z'},
  {id:'bad-price',tenantId:1,customerId:'c1',price:1000001,paymentStatus:'PAID',paymentProvider:'square',squarePaymentId:'sq-negative',squarePaymentStatus:'COMPLETED',squareOrderId:'order-proof',squarePaymentCompletedAt:'2026-11-20T18:00:00Z'}
 ];
 const r=await env.call('GET','/api/owner/sales-command/eligible-orders',{id:'owner',role:'owner',tenantId:1});
 assert.equal(r.code,200);
 assert(!r.json.candidates.some(x=>x.orderId==='refund'));
 assert(!r.json.candidates.some(x=>x.orderId==='bad-price'));
});
test('manager locked statement protects company profit fields',async()=>{
 const env=setup(false,{status:'APPROVED',revenue_cents:280000,profit_cents:9999999,commission_cents:16800,external_payment_reference:'private',closed_at:'2026-11-30'});
 const result=await env.call('GET','/api/sbc/sales/compensation/me',{id:'m1',role:'account_manager',tenantId:1,active:true},{},{month:'2026-11'});
 assert.equal(result.code,200);assert.equal(result.json.lockedStatement.commissionCents,16800);
 assert.equal(result.json.lockedStatement.profitCents,undefined);
 assert(!JSON.stringify(result.json).includes('9999999'));
 assert(!JSON.stringify(result.json).includes('private'));
});
test('owner can evaluate a bilingual candidate and run margin forecast without creating records',async()=>{
 const env=setup();const owner={id:'owner',role:'owner',tenantId:1};
 const scores={verifiedClosingHistory:20,englishRoleplay:15,spanishRoleplay:20,objectionClosing:20,crmFluency:10,accountOwnership:10,reliability:5};
 const evidence={referenceVerified:true,salesEvidenceVerified:true,englishLive:true,spanishLive:true,closingSimulationPassed:true};
 const score=await env.call('POST','/api/owner/sales-command/hiring/evaluate',owner,{scores,evidence});
 assert.equal(score.code,200);assert.equal(score.json.result.decision,'SHORTLIST');assert.equal(env.writes,0);
 const forecast=await env.call('POST','/api/owner/sales-command/hiring/forecast',owner,{monthlyRevenueCents:1300000,productGrossMarginBps:4000,standardManagers:1,seniorManagers:1,hoursPerWeek:30,fixedOverheadCents:100000});
 assert.equal(forecast.code,200);assert.equal(forecast.json.result.isForecast,true);
 const denied=await env.call('POST','/api/owner/sales-command/hiring/evaluate',{id:'m1',role:'account_manager',tenantId:1},{scores,evidence});
 assert.equal(denied.code,403);
});
test('write operations fail closed when preview is read-only or owner authorization absent',async()=>{
 const env=setup(true);
 const blocked=await env.call('POST','/api/owner/sales-command/credits',{id:'owner',role:'owner',tenantId:1});
 assert.equal(blocked.code,423);assert.equal(env.writes,0);
 const nonOwner=await env.call('POST','/api/owner/sales-command/credits',{id:'m1',role:'account_manager',tenantId:1});
 assert.equal(nonOwner.code,403);
});
test('sales APIs enforce manager role allowlist and block mutations',()=>{
 assert.equal(ROLE.allowed('GET','/api/sbc/sales/compensation/me'),true);
 for(const uri of ['/api/owner/sales-command/overview','/api/owner/sales-command/eligible-orders']){
  assert.equal(ROLE.allowed('GET',uri),false);
 }
 assert.equal(ROLE.allowed('POST','/api/owner/sales-command/credits'),false);
 assert.equal(ROLE.allowed('POST','/api/owner/sales-command/terms'),false);
});
test('isolated staging is idempotent and refuses unexpected source',()=>{
 const fake="function v9data(){}\nfunction SBC_V6649_REQUIRE_WRITER(){}\n"+ "app.get('/api/v9/payroll',auth,ownerOnly,(req,res)=>{});";
 const staged=STAGE.patchServer(fake);
 assert(staged.includes(STAGE.MARK));
 assert.equal(STAGE.patchServer(staged),staged);
 assert.throws(()=>STAGE.patchServer('test'),/SALES_COMMAND_REQUIRES_FULL_SECURE_SERVER/);
});

test('workforce policy and trial review are owner-only, tenant-scoped and read-only',async()=>{
 const env=setup(true),owner={id:'owner',role:'owner',tenantId:1};
 const policy=await env.call('GET','/api/owner/sales-command/workforce/policy',owner);
 assert.equal(policy.code,200);assert.equal(policy.json.policy.standard.spanish,'preferred');
 assert.equal(policy.json.policy.senior.commissionBps,1200);assert.equal(policy.json.activeCompensationTermsUnchanged,true);
 const q={managerId:'m1',tier:'senior',startDate:'2020-11-02',throughDate:'2020-11-20'};
 const review=await env.call('GET','/api/owner/sales-command/workforce/review',owner,{},q);
 assert.equal(review.code,200);assert.equal(review.json.review.targetCents,300000);
 assert.equal(review.json.ledgerCompletenessVerified,false);assert.equal(review.json.automaticPersonnelAction,false);
 assert.equal(env.writes,0);assert.equal(review.cache,'no-store');
 assert(env.calls.every(c=>c.args[0]===1&&c.args[1]==='m1'));
 const foreign=await env.call('GET','/api/owner/sales-command/workforce/review',owner,{}, {...q,managerId:'m2'});
 assert.equal(foreign.code,422);
 for(const path of ['/api/owner/sales-command/workforce/policy','/api/owner/sales-command/workforce/review']){
  const denied=await env.call('GET',path,{id:'m1',role:'account_manager',tenantId:1},{},q);
  assert.equal(denied.code,403);
 }
});

test('owner can record tier-specific interview observations without writing or automatically selecting a candidate',async()=>{
 const env=setup(true),owner={id:'owner',role:'owner',tenantId:1};
 const scores={independentClosing:25,coldCalling:20,objectionHandling:15,spokenCommunication:10,customerDiscovery:10,accountOwnership:5,technicalAptitude:5,professionalism:5,reliability:5};
 const evidence={englishLive:true,closingSimulationPassed:true};
 const uri='/api/owner/sales-command/hiring/evaluate';
 const standard=await env.call('POST',uri,owner,{tier:'standard',scores,evidence});
 assert.equal(standard.code,200);assert.equal(standard.json.result.minimumScore,80);assert.deepEqual(standard.json.result.missing,[]);
 const senior=await env.call('POST',uri,owner,{tier:'senior',scores,evidence});
 assert.equal(senior.code,200);assert(senior.json.result.missing.includes('LIVE_SPANISH_REQUIRED'));
 assert.equal(senior.json.result.automaticHiring,false);assert.equal(senior.json.result.decision,undefined);assert.equal(env.writes,0);
 const denied=await env.call('POST',uri,{id:'m1',role:'account_manager',tenantId:1},{tier:'standard',scores,evidence});assert.equal(denied.code,403);
});

test('workstation profile is self-scoped and never derives signed compensation from a presentation tier',async()=>{
 const env=setup(false,null,[{tenant_id:1,manager_id:'m1',tier:'standard',revision:2},{tenant_id:2,manager_id:'m2',tier:'senior',revision:1}]);
 const member={id:'m1',role:'account_manager',tenantId:1};
 const r=await env.call('GET','/api/sbc/sales/workstation/me',member,{}, {managerId:'m2',tier:'senior'});
 assert.equal(r.code,200);assert.equal(r.json.profile.tier,'standard');assert.equal(r.json.profile.weeklyQuotaCents,50000);
 assert.equal(r.json.profile.spanishRequirement,'preferred');assert.equal(r.json.profile.spanishAccessGranted,false);assert.equal(r.json.profile.compensationChanged,false);
 assert.equal(r.json.profile.revision,2);assert(env.calls.every(c=>c.args[0]===1&&c.args[1]==='m1'));
 const cross=await env.call('GET','/api/sbc/sales/workstation/me',{...member,tenantId:2});assert.equal(cross.code,403);
 const denied=await env.call('GET','/api/owner/sales-command/workstation/profile',member,{}, {managerId:'m1'});assert.equal(denied.code,403);
 const owner=await env.call('GET','/api/owner/sales-command/workstation/profile',{id:'owner',role:'owner',tenantId:1},{},{managerId:'m2'});assert.equal(owner.code,422);
});
test('unconfigured manager is not silently labeled senior or standard; no writes on profile reads',async()=>{
 const env=setup(true);const r=await env.call('GET','/api/sbc/sales/workstation/me',{id:'m1',role:'account_manager',tenantId:1});
 assert.equal(r.code,200);assert.equal(r.json.profile.tier,null);assert.equal(r.json.profile.weeklyQuotaCents,null);assert.equal(env.writes,0);
 const blocked=await env.call('POST','/api/owner/sales-command/workstation/profile',{id:'owner',role:'owner',tenantId:1},{managerId:'m1',tier:'standard'});
 assert.equal(blocked.code,423);assert.equal(env.writes,0);
});
test('owner can grant no profile privileges to managers via API and new self-read is narrowly allowlisted',()=>{
 assert.equal(ROLE.allowed('GET','/api/sbc/sales/workstation/me'),true);
 assert.equal(ROLE.allowed('POST','/api/sbc/sales/workstation/me'),false);
 assert.equal(ROLE.allowed('GET','/api/owner/sales-command/workstation/profile'),false);
 assert.equal(ROLE.allowed('POST','/api/owner/sales-command/workstation/profile'),false);
});
