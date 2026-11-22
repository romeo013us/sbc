'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ROUTE=require('../routes/sbc-sales-command-v1.cjs');
const STAGE=require('./v66160-stage-sales-command.cjs');
const ROLE=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
function setup(recovery=false,locked=null){
 const handlers=new Map(),calls=[];
 const db={users:[{id:'m1',tenantId:1,role:'account_manager',name:'Manager One',active:true},
                  {id:'m2',tenantId:2,role:'account_manager',name:'Foreign Worker',active:true}]};
 const pool={async query(sql,args){
  calls.push({sql,args});
  if(sql.startsWith('SELECT * FROM sbc_sales_credit_v1'))return [[]];
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
 return {handlers,calls,call,get writes(){return writes}};
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
