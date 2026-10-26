'use strict';
// Executable tenant isolation with two synthetic tenants: no external providers.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const T=require(path.join(root,'enterprise/v6648-revenue-tenant.cjs'));
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
const leadA={id:'a',tenantId:7,businessName:'A',status:'Lead',leadScore:80,leadTemperature:'warm',verificationStatus:'Sales Ready',email:'a@example.invalid'};
const leadB={id:'b',tenantId:8,businessName:'B',status:'Lead',leadScore:90,leadTemperature:'hot',verificationStatus:'Sales Ready',email:'b@example.invalid'};
const noTenant={id:'legacy'};
for(const invalid of [undefined,null,0,'',-1,1.5,'oops',NaN,{},Infinity]){
 assert.throws(()=>T.requireTenant(invalid),/TENANT_CONTEXT_REQUIRED/);
 assert.throws(()=>T.scopeCustomers([leadA,leadB],invalid),/TENANT_CONTEXT_REQUIRED/);
}
assert.equal(T.requireTenant('7'),7);
assert.deepEqual(T.scopeCustomers([leadA,leadB,noTenant],7).map(x=>x.id),['a']);
assert.deepEqual(T.scopeCustomers([leadA,leadB,noTenant],8).map(x=>x.id),['b']);
const db={customers:[leadA,leadB,noTenant],orders:[{tenantId:7,id:'o7'},{tenantId:8,id:'o8'}],megaOpsStore:{fulfillmentJobs:[{tenantId:7,id:'j7'},{tenantId:8,id:'j8'}]}};
assert.deepEqual(T.scopeRevenueDb(db,7).orders.map(x=>x.id),['o7']);
assert.deepEqual(T.scopeRevenueDb(db,7).megaOpsStore.fulfillmentJobs.map(x=>x.id),['j7']);
assert.match(server,/SBC_V6648_TENANT_SCOPED_REVENUE/);
for(const name of ['verifyRevenueLeadPool','runRevenueFirstPlay','processRevenueFollowups']){
 const pattern=name==='runRevenueFirstPlay'?/async function runRevenueFirstPlay\(\{limit=10,reason='press-play',tenantId\}=\{\}\)\{\s*const sbcRevenueTenant=requireTenantValue\(tenantId\)/:
  name==='verifyRevenueLeadPool'?/async function verifyRevenueLeadPool\(\{limit=250,tenantId\}=\{\}\)\{\s*const sbcRevenueTenant=requireTenantValue\(tenantId\)/:
  /async function processRevenueFollowups\(\{tenantId\}=\{\}\)\{\s*const sbcRevenueTenant=requireTenantValue\(tenantId\)/;
 assert.match(server,pattern,name+' must fail closed on missing tenant');
}
assert.doesNotMatch(server,/tenantId===null\|\|Number\(c\?\.tenantId\)/);
assert.match(server,/await verifyRevenueLeadPool\(\{limit:req\.body\?\.limit\|\|250,tenantId:requireRequestTenant\(req\)\}\)/);
assert.match(server,/await runRevenueFirstPlay\(\{limit:req\.body\?\.limit\|\|10,reason:'press-play',tenantId:requireRequestTenant\(req\)\}\)/);
assert.match(server,/const sbcRevenueTenant=requireRequestTenant\(req\);\s*const customers=\(Array\.isArray\(db\.customers\)\?db\.customers:\[\]\)\.filter\(c=>Number\(c\?\.tenantId\)===sbcRevenueTenant/);
assert.doesNotMatch(server,/onRevenuePlay:\(\{limit,reason\}\)=>runRevenueFirstPlay\(\{limit,reason\}\)/);
global.__SBC_REQUIRE_TENANT=req=>T.requireTenant(req.tenantId);
const routes={};
const app={get(p,...f){routes['GET '+p]=f.at(-1)},post(p,...f){routes['POST '+p]=f.at(-1)}};
const verified=[],played=[];
const getContext=()=>({db,routeRevenueLead:()=>({route:'ROUTED_EMAIL'}),
 verifyRevenueLeadPool:async options=>{verified.push(options);return {checked:1,passed:1,needsReview:0}},
 runRevenueFirstPlay:async options=>{played.push(options);return {ok:true,processed:1}},
 audit:()=>{},saveData:async()=>{}});
for(const [file,opts] of [
 ['routes/v56131-revenue-pipeline.js',{auth:()=>{},ownerOnly:()=>{},getContext}],
 ['routes/v56133-revenue-sprint.js',{auth:()=>{},ownerOnly:()=>{},getContext}],
 ['routes/v56140-90day-revenue-command.js',{auth:()=>{},ownerOnly:()=>{},getContext,getKimMission:()=>null}]
])require(path.join(root,file))(app,opts);
function res(){return {statusCode:200,status(n){this.statusCode=n;return this},setHeader(){return this},json(body){this.body=body;return this}}}
async function fire(verb,url,req){const response=res();await routes[verb+' '+url](req,response);return response}
(async()=>{
 const req={tenantId:7,body:{limit:5,tenantId:8},user:{id:'owner',role:'owner'}};
 const status=await fire('GET','/api/v56131/revenue-pipeline/status',req);
 assert.deepEqual(status.body.items.map(x=>x.id),['a'],'request body cannot select tenant 8');
 for(const name of [
 '/api/v56131/revenue-pipeline/prepare',
 '/api/v56131/revenue-pipeline/play',
 '/api/v56133/revenue-sprint/prepare',
 '/api/v56133/revenue-sprint/play',
 '/api/v56140/revenue-command/revenue-play'
 ]){
  const out=await fire('POST',name,req);
  assert.notEqual(out.body?.ok,false,name+' unexpectedly failed');
 }
 assert.ok(verified.length>=3);assert.ok(played.length>=3);
 assert.ok(verified.every(x=>x.tenantId===7));
 assert.ok(played.every(x=>x.tenantId===7));
 const denied=await fire('GET','/api/v56131/revenue-pipeline/status',{user:req.user});
 assert.equal(denied.body.ok,false);assert.equal(denied.body.items,undefined);
 const {RevenueGrowthEngine}=require(path.join(root,'enterprise/sbc-revenue-growth-v56122.js'));
 const engine=new RevenueGrowthEngine({db:{customers:[leadA,leadB,noTenant],orders:[{tenantId:7,id:'o7',total:120},{tenantId:8,id:'o8',total:900}]},onRevenuePlay:async opts=>opts});
 const growth=await engine.cycle({tenantId:7,limit:2,auto:true});
 assert.equal(growth.metrics.leads,1);assert.equal(growth.metrics.revenue,120);
 assert.equal(growth.revenuePlay.tenantId,7);
 await assert.rejects(engine.cycle({auto:true}),/TENANT_CONTEXT_REQUIRED/);
 console.log('[SBC V6648] PASS: tenant-scoped leads, growth, play, pipeline, sprint, 90-day routes and fail-closed entrypoints');
})().catch(e=>{console.error('[SBC V6648] FAIL',e);process.exitCode=1});
