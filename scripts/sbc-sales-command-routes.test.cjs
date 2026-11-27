'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ROUTE=require('../routes/sbc-sales-command-v1.cjs');
const STAGE=require('./v66160-stage-sales-command.cjs');
const ROLE=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
function setup(recovery=false,locked=null,profiles=[],trials=[],termsTier='standard',awards=[]){
 const handlers=new Map(),calls=[];
 const db={users:[{id:'m1',tenantId:1,role:'account_manager',name:'Manager One',active:true},
                  {id:'m2',tenantId:2,role:'account_manager',name:'Foreign Worker',active:true}]};
 const pool={async query(sql,args){
  calls.push({sql,args});
  if(sql.startsWith('SELECT * FROM sbc_sales_credit_v1'))return [[]];
  if(sql.startsWith('SELECT award_code,period_key,month_key,week_start,awarded_at FROM sbc_am_award_v2'))return [awards.filter(a=>a.tenant_id===args[0]&&a.manager_id===args[1])];
  if(sql.startsWith('SELECT m.tier,c.start_day,c.end_day FROM sbc_am_trial_member_v2'))return [trials.filter(p=>p.tenant_id===args[0]&&p.manager_id===args[1])];
  if(sql.startsWith('SELECT tier, revision FROM sbc_am_workstation_profile_v2'))return [profiles.filter(p=>p.tenant_id===args[0]&&p.manager_id===args[1])];
  if(sql.startsWith('SELECT tier FROM sbc_commission_terms_v1'))return [[{tier:termsTier}]];
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

test('owner can provision Standard but cannot bypass earned Senior promotion with revision checks and transactional audit',async()=>{
 const state=new Map(),audit=[],transactions=[];
 const key=(t,m)=>t+':'+m;
 const db={users:[{id:'m1',tenantId:1,role:'account_manager',active:true},{id:'m2',tenantId:2,role:'account_manager',active:true}]};
 const handlers=new Map();
 const conn={async beginTransaction(){transactions.push('begin');},async commit(){transactions.push('commit');},async rollback(){transactions.push('rollback');},release(){},
  async query(sql,args){
   if(sql.startsWith('SELECT tier, revision FROM sbc_am_workstation_profile_v2'))return [state.has(key(...args.slice(0,2)))?[state.get(key(...args.slice(0,2)))]:[]];
   if(sql.startsWith('INSERT INTO sbc_am_workstation_profile_v2')){const [t,m,tier,revision]=args;state.set(key(t,m),{tier,revision});return [{affectedRows:1}];}
   if(sql.startsWith('UPDATE sbc_am_workstation_profile_v2')){const [tier,revision,actor,t,m,expected]=args;if(state.get(key(t,m))?.revision!==expected)return [{affectedRows:0}];state.set(key(t,m),{tier,revision});return [{affectedRows:1}];}
   if(sql.startsWith('INSERT INTO sbc_commission_audit_v1')){audit.push(args);return [{affectedRows:1}];}
   throw Error('unexpected SQL '+sql);
  }};
 const pool={query:conn.query,getConnection:async()=>conn};
 ROUTE.register({get:(p,a,f)=>handlers.set('GET '+p,f),post:(p,a,f)=>handlers.set('POST '+p,f)},{
  auth:()=>{},getContext:()=>({db,mysqlPool:pool,recoveryRequired:()=>false}),tenantForRead:req=>req.tenantId,writer:()=>{}
 });
 const uri='/api/owner/sales-command/workstation/profile',owner={id:'owner',role:'owner',tenantId:1};
 const call=async(method,path,user,body={},query={})=>{let code=200,json;const res={setHeader(){},status(n){code=n;return this},json(v){json=v;return this}};await handlers.get(method+' '+path)({tenantId:1,user,body,query},res);return {code,json};};
 const base={managerId:'m1',tier:'standard',expectedRevision:0,confirm:'OWNER_CONFIRMED_WORKSTATION_TIER'};
 assert.equal((await call('POST',uri,owner,base)).code,200);
 assert.deepEqual(state.get('1:m1'),{tier:'standard',revision:1});
 assert.equal((await call('POST',uri,owner,base)).code,409);
 assert.equal((await call('POST',uri,owner,{...base,tier:'senior',expectedRevision:1})).code,422);
 assert.equal((await call('POST',uri,owner,{...base,tier:'senior',expectedRevision:1,bilingualEvidenceConfirmed:true})).code,422);
 assert.deepEqual(state.get('1:m1'),{tier:'standard',revision:1});
 const self=await call('GET','/api/sbc/sales/workstation/me',{id:'m1',role:'account_manager',tenantId:1});
 assert.equal(self.json.profile.weeklyQuotaCents,50000);assert.equal(self.json.profile.spanishAccessGranted,false);
 assert.equal((await call('POST',uri,owner,{...base,managerId:'m2'})).code,422);
 assert.equal(audit.length,1);assert(audit.every(x=>x[1]===1&&x[2]==='m1'&&x[4]==='WORKSTATION_PROFILE_CONFIGURED'));
 assert.equal(transactions.filter(x=>x==='commit').length,1);
 assert.equal(transactions.filter(x=>x==='rollback').length,2);
});

test('trial planning is owner-only, does not enroll workers, and does not initiate payroll',async()=>{
 const env=setup(true),owner={id:'owner',role:'owner',tenantId:1};
 const uri='/api/owner/sales-command/workforce/trial-plan',body={startDate:'2026-11-30',tiers:['standard','standard'],reserveCents:120000};
 const r=await env.call('POST',uri,owner,body);
 assert.equal(r.code,200);assert.equal(r.json.plan.reserveShortfallCents,12000);
 assert.equal(r.json.plan.enrollmentAuthorized,false);assert.equal(r.json.plan.firstPayday,null);
 assert.equal(r.json.plan.payrollInitiated,false);assert.equal(env.writes,0);
 assert.equal((await env.call('POST',uri,{id:'m1',role:'account_manager',tenantId:1},body)).code,403);
});

test('employee trial progress derives identity and dates from persisted enrollment, not query input',async()=>{
 const env=setup(false,null,[],[{tenant_id:1,manager_id:'m1',tier:'standard',start_day:'2020-11-02',end_day:'2020-12-01'},{tenant_id:2,manager_id:'m2',tier:'senior',start_day:'2020-11-02',end_day:'2020-12-01'}]);
 const uri='/api/sbc/sales/workforce/trial/me',member={id:'m1',role:'account_manager',tenantId:1};
 const r=await env.call('GET',uri,member,{}, {managerId:'m2',tier:'senior',startDate:'2026-11-30'});
 assert.equal(r.code,200);assert.equal(r.json.trial.tier,'standard');assert.equal(r.json.trial.startDate,'2020-11-02');
 assert.equal(r.json.trial.review.throughDate,'2020-12-01');assert.equal(r.json.trial.review.workdays,22);
 assert.equal(r.json.trial.review.grade,null);assert.equal(r.json.ledgerCompletenessVerified,false);
 assert(env.calls.every(c=>c.args[0]===1&&c.args[1]==='m1'));assert.equal(env.writes,0);
 assert.equal((await env.call('GET',uri,{...member,tenantId:2})).code,403);
 assert.equal((await env.call('GET',uri,{id:'owner',role:'owner',tenantId:1})).code,403);
 assert.equal(ROLE.allowed('GET',uri),true);assert.equal(ROLE.allowed('POST',uri),false);
});
test('trial enrollment writes are owner-only and blocked on recovery hold',async()=>{
 const env=setup(true),uri='/api/owner/sales-command/workforce/enroll';
 assert.equal((await env.call('POST',uri,{id:'m1',role:'account_manager',tenantId:1})).code,403);
 assert.equal((await env.call('POST',uri,{id:'owner',role:'owner',tenantId:1})).code,423);assert.equal(env.writes,0);
});

test('two paid trial members are committed together; a mismatched profile or duplicate rolls back the cohort',async()=>{
 const handlers=new Map(),state={cohorts:[],members:[],audits:[]};let staged;
 const db={users:[{id:'a',role:'account_manager',tenantId:1,active:true},{id:'b',role:'account_manager',tenantId:1,active:true}]};
 const conn={async beginTransaction(){staged=structuredClone(state)},async commit(){Object.assign(state,staged);staged=null},async rollback(){staged=null},release(){},async query(sql,args){
  if(sql.startsWith('SELECT tier, revision FROM sbc_am_workstation_profile_v2')){assert.equal(args[0],1);return [[{tier:args[1]==='a'?'standard':'senior',revision:1}]];}
  if(sql.startsWith('INSERT INTO sbc_am_trial_cohort_v2')){staged.cohorts.push(args);return [{affectedRows:1}];}
  if(sql.startsWith('INSERT INTO sbc_am_trial_member_v2')){if(staged.members.some(m=>m[0]===args[0]&&m[1]===args[1]))throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});staged.members.push(args);return [{affectedRows:1}];}
  if(sql.startsWith('INSERT INTO sbc_commission_audit_v1')){staged.audits.push(args);return [{affectedRows:1}];}
  throw Error('Unexpected SQL '+sql);
 }};
 ROUTE.register({get:(p,a,f)=>handlers.set('GET '+p,f),post:(p,a,f)=>handlers.set('POST '+p,f)},{auth:()=>{},getContext:()=>({db,mysqlPool:{getConnection:async()=>conn},recoveryRequired:()=>false}),tenantForRead:()=>1,writer:()=>{}});
 const start=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const body={startDate:start,reserveCents:200000,members:[{managerId:'a',tier:'standard',agreementReference:'signed-agreement-a'},{managerId:'b',tier:'senior',agreementReference:'signed-agreement-b'}],confirm:'OWNER_CONFIRMED_PAID_TRIAL',signedTermsConfirmed:true,payScheduleReviewed:true,fairOpportunityConfirmed:true};
 async function call(input){let code=200,json;await handlers.get('POST /api/owner/sales-command/workforce/enroll')({user:{id:'owner',role:'owner',tenantId:1},body:input},{setHeader(){},status(n){code=n;return this},json(x){json=x;return this}});return {code,json};}
 assert.equal((await call({...body,members:[body.members[0],{...body.members[1],tier:'standard'}]})).code,422);
 assert.equal(state.cohorts.length,0);
 const enrolled=await call(body);assert.equal(enrolled.code,201);assert.equal(enrolled.json.memberCount,2);
 assert.equal(state.cohorts.length,1);assert.equal(state.members.length,2);assert.equal(state.audits.length,2);
 assert(state.members.every(m=>/^[a-f0-9]{64}$/.test(m[4])));
 assert.equal((await call(body)).code,409);assert.equal(state.cohorts.length,1);assert.equal(state.members.length,2);
});

test('owner-only payroll calendar is advisory and does not invoke writer or trust sales results',async()=>{
 const env=setup(true),owner={id:'owner',role:'owner',tenantId:1};
 const uri='/api/owner/sales-command/workforce/pay-schedule';
 const input={startDate:'2026-11-30',firstPayday:'2026-12-18',agreementReference:'signed-pay-schedule-01',scheduleReviewed:true};
 const r=await env.call('POST',uri,owner,input);assert.equal(r.code,200);
 assert.equal(r.json.schedule.periods.length,3);assert.equal(r.json.schedule.earnedPayNeverPerformanceGated,true);
 assert.equal(r.json.schedule.paymentInitiated,false);assert.equal(env.writes,0);
 assert.equal((await env.call('POST',uri,{id:'m1',role:'account_manager',tenantId:1},input)).code,403);
});

test('recognition ignores browser-submitted revenue and is owner-only and read-only',async()=>{
 const env=setup(true,null,[],[],'standard_v2'),owner={id:'owner',role:'owner',tenantId:1};
 const uri='/api/owner/sales-command/workforce/recognition',input={managerId:'m1',month:'2020-11',weekStart:'2020-11-02',ledgerComplete:true,qualityReviewed:true,qualityPassed:true,weeklyRevenueCents:99999999,monthlyRevenueCents:99999999};
 const r=await env.call('POST',uri,owner,input);
 assert.equal(r.code,200);assert.deepEqual(r.json.result.eligibleForOwnerReview,[]);
 assert.equal(r.json.weeklyRevenueCents,0);assert.equal(r.json.independentlyVerified,false);assert.equal(env.writes,0);
 assert.equal((await env.call('POST',uri,{id:'m1',role:'account_manager',tenantId:1},input)).code,403);
 assert.equal((await env.call('POST',uri,owner,{...input,managerId:'m2'})).code,422);
 assert.equal((await env.call('POST',uri,owner,{...input,weekStart:'2020-11-03'})).code,422);
});

test('employee award history is self-scoped, read-only and excludes private owner evidence',async()=>{
 const rows=[{tenant_id:1,manager_id:'m1',award_code:'CERTIFIED_CLOSER',period_key:'2020-11-02',month_key:'2020-11',week_start:'2020-11-02',awarded_at:'2020-12-01',private_note:'private'},{tenant_id:2,manager_id:'m2',award_code:'ELITE',period_key:'2020-11-02'}];
 const env=setup(true,null,[],[],'standard_v2',rows),user={id:'m1',role:'account_manager',tenantId:1},uri='/api/sbc/sales/workforce/awards/me';
 const r=await env.call('GET',uri,user,{}, {managerId:'m2'});
 assert.equal(r.code,200);assert.equal(r.json.awards.length,1);assert.equal(r.json.awards[0].code,'CERTIFIED_CLOSER');assert.equal(r.json.awards[0].private_note,undefined);assert.equal(env.writes,0);
 assert.equal((await env.call('GET',uri,{...user,tenantId:2})).code,403);
 assert.equal(ROLE.allowed('GET',uri),true);assert.equal(ROLE.allowed('POST',uri),false);
 assert.equal((await env.call('POST','/api/owner/sales-command/workforce/awards',user)).code,403);
 assert.equal((await env.call('POST','/api/owner/sales-command/workforce/awards',{id:'owner',role:'owner',tenantId:1})).code,423);
});

test('trial academy snapshot uses existing server training state, not submitted scores or other employee ids',async()=>{
 const env=setup(true);const m={id:'m1',role:'account_manager',tenantId:1};
 const uri='/api/sbc/sales/workforce/academy/me';
 const r=await env.call('GET',uri,m,{}, {managerId:'m2',ready:true,score:100});
 assert.equal(r.code,200);assert.equal(r.json.academy.completedModules,0);assert.equal(r.json.academy.totalModules,12);
 assert.equal(r.json.academy.certified,false);assert.equal(r.json.academy.trainingMinutes,0);
 assert.equal(r.json.academy.earnedPayUnaffected,true);assert.equal(env.writes,0);
 assert.equal((await env.call('GET',uri,{...m,tenantId:2})).code,403);
 const owner=await env.call('GET','/api/owner/sales-command/workforce/academy',{id:'owner',role:'owner',tenantId:1},{},{managerId:'m1'});
 assert.equal(owner.code,200);assert.deepEqual(owner.json.academy,r.json.academy);
 assert.equal((await env.call('GET','/api/owner/sales-command/workforce/academy',m,{},{managerId:'m1'})).code,403);
 assert.equal(ROLE.allowed('GET',uri),true);assert.equal(ROLE.allowed('POST',uri),false);
 const G=require('../enterprise/sbc-am-academy-gates-v1.cjs');
 assert.equal(G.isTrainingSafeRoute('GET',uri),true);assert.equal(G.isTrainingSafeRoute('POST',uri),false);
 assert.equal(G.isTrainingSafeRoute('GET','/api/owner/sales-command/workforce/academy'),false);
});

test('trial payroll preview derives worker and tier from enrolled record, not browser rate or revenue',async()=>{
 const env=setup(true,null,[],[{tenant_id:1,manager_id:'m1',tier:'standard',start_day:'2020-11-02',end_day:'2020-12-01'}]);
 const owner={id:'owner',role:'owner',tenantId:1},uri='/api/owner/sales-command/workforce/payroll-preview';
 const b={managerId:'m1',periodIndex:0,trainingMinutes:480,otherPaidMinutes:3120,hoursReviewed:true,signedRateConfirmed:true,tier:'senior',hourlyCents:9999,revenueCents:0};
 const r=await env.call('POST',uri,owner,b);
 assert.equal(r.code,200);assert.equal(r.json.payroll.basePayCents,30000);assert.equal(r.json.payroll.tier,'standard');assert.equal(r.json.readOnly,true);assert.equal(env.writes,0);
 assert.equal((await env.call('POST',uri,{id:'m1',role:'account_manager',tenantId:1},b)).code,403);
 assert.equal((await env.call('POST',uri,owner,{...b,managerId:'m2'})).code,422);
 assert.equal((await env.call('POST',uri,owner,{...b,hoursReviewed:false})).code,422);
});

test('trial base payroll persists reviewed accrual once and records only an already-sent exact external base payment',async()=>{
 const handlers=new Map(),state={runs:[],audit:[]};let tx;
 const db={users:[{id:'m1',tenantId:1,role:'account_manager',active:false},{id:'m2',tenantId:2,role:'account_manager',active:true}]};
 function query(target,sql,args){
  if(sql.startsWith('SELECT m.tier,c.start_day,c.end_day FROM sbc_am_trial_member_v2'))return [[{tier:'standard',start_day:'2020-11-02',end_day:'2020-12-01'}]];
  if(sql.startsWith('SELECT * FROM sbc_am_base_payroll_v2'))return [target.runs.filter(r=>r.tenant_id===args[0]&&r.manager_id===args[1]&&(args.length<3||r.period_index===args[2]))];
  if(sql.startsWith('INSERT INTO sbc_am_base_payroll_v2')){
   const [tenant_id,manager_id,period_index,tier,period_start,period_end,training_minutes,other_paid_minutes,hourly_cents,base_pay_cents,evidence_hash,approved_by]=args;
   if(target.runs.some(r=>r.tenant_id===tenant_id&&r.manager_id===manager_id&&r.period_index===period_index))throw Object.assign(Error('duplicate'),{code:'ER_DUP_ENTRY'});
   target.runs.push({tenant_id,manager_id,period_index,tier,period_start,period_end,training_minutes,other_paid_minutes,hourly_cents,base_pay_cents,evidence_hash,approved_by,status:'APPROVED',payment_hash:null});return [{affectedRows:1}];
  }
  if(sql.startsWith('UPDATE sbc_am_base_payroll_v2 SET')){
   const [payment_hash,paid_by,t,m,i]=args,r=target.runs.find(r=>r.tenant_id===t&&r.manager_id===m&&r.period_index===i&&r.status==='APPROVED');
   if(!r)return [{affectedRows:0}];Object.assign(r,{status:'EXTERNAL_BASE_PAY_RECORDED',payment_hash,paid_by});return [{affectedRows:1}];
  }
  if(sql.startsWith('INSERT INTO sbc_commission_audit_v1')){target.audit.push(args);return [{affectedRows:1}];}
  throw Error('Unexpected SQL '+sql);
 }
 const conn={async beginTransaction(){tx=structuredClone(state)},async commit(){Object.assign(state,tx);tx=null},async rollback(){tx=null},release(){},async query(sql,args){return query(tx,sql,args);}};
 ROUTE.register({get:(p,a,f)=>handlers.set('GET '+p,f),post:(p,a,f)=>handlers.set('POST '+p,f)},{auth:()=>{},getContext:()=>({db,mysqlPool:{query:async(s,a)=>query(state,s,a),getConnection:async()=>conn},recoveryRequired:()=>false}),tenantForRead:()=>1,writer:()=>{}});
 const owner={id:'owner',role:'owner',tenantId:1};
 const root='/api/owner/sales-command/workforce/base-payroll';
 async function call(method,path,b={},user=owner,q={}){let code=200,json;await handlers.get(method+' '+path)({user,body:b,query:q},{setHeader(){},status(n){code=n;return this},json(x){json=x;return this}});return {code,json};}
 const b={managerId:'m1',periodIndex:0,trainingMinutes:480,otherPaidMinutes:3120,hoursReviewed:true,signedRateConfirmed:true,otherObligationsReviewed:true,legacyPayrollChecked:true,evidenceReference:'clock-review-record-01',confirm:'OWNER_APPROVED_STRAIGHT_TIME_BASE'};
 assert.equal((await call('POST',root+'/approve',{...b,legacyPayrollChecked:false})).code,422);
 assert.equal((await call('POST',root+'/approve',b)).code,201);
 assert.equal(state.runs[0].base_pay_cents,30000);assert.equal(state.runs[0].status,'APPROVED');
 assert.equal((await call('POST',root+'/approve',b)).code,409);
 const paid={managerId:'m1',periodIndex:0,amountCents:30000,paymentReference:'external-payment-0001',confirm:'OWNER_RECORD_ALREADY_SENT_BASE_PAY'};
 assert.equal((await call('POST',root+'/record-paid',{...paid,amountCents:29999})).code,422);
 assert.equal((await call('POST',root+'/record-paid',paid)).code,200);
 assert.equal((await call('POST',root+'/record-paid',paid)).code,409);
 assert.equal(state.runs[0].status,'EXTERNAL_BASE_PAY_RECORDED');assert.equal(state.audit.length,2);
 const view=await call('GET',root,{},owner,{managerId:'m1'});assert.equal(view.code,200);assert.equal(view.json.records[0].basePayCents,30000);assert.equal(view.json.records[0].paymentInitiated,false);assert.equal(view.json.records[0].paymentHash,undefined);
 assert.equal((await call('GET',root,{},owner,{managerId:'m2'})).code,422);
});
