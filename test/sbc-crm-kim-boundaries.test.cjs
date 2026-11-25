'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCrmLeadHandlers}=require('../routes/sbc-crm-leads-v1.cjs');
const {createKimOrchestrator}=require('../routes/sbc-kim-orchestrator-v1.cjs');
const makeResponse=()=>({code:200,status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(){}});
function crmFixture(){
 const calls=[],db={customers:[]};let tenant=7,fail=false;
 const conn={async query(sql,values){calls.push({sql,values});if(sql.startsWith('SHOW COLUMNS'))return [[{Field:'tenant_id'}]];if(sql.startsWith('SELECT'))return [[]];if(fail)throw Error('synthetic insert failure');return [{}]},async beginTransaction(){calls.push('begin')},async commit(){calls.push('commit')},async rollback(){calls.push('rollback')},release(){calls.push('release')}};
 const h=createCrmLeadHandlers(()=>({requireRequestTenant:()=>tenant,mysqlPool:{getConnection:async()=>conn},getDb:()=>db,id:()=> 'fixture-id',now:()=> '2026-11-25T00:00:00Z',sqlDateTime:v=>v}));
 const r={row:1,businessName:'Fixture LLC',contactName:'',phone:'',email:'',website:'',websiteStatus:'',source:'fixture',notes:'',industry:'fixture'};
 const run=async dryRun=>{const res=makeResponse();await h.importRows({user:{id:'owner',role:'owner'}},res,{dryRun,normalized:[r],normPhone:v=>v,normEmail:v=>v,normName:v=>v.toLowerCase()});return res};
 return {run,calls,db,set tenant(v){tenant=v},set fail(v){fail=v}};
}
test('CRM preview uses tenant-bound duplicate lookup and no insert or transaction',async()=>{
 const f=crmFixture(),r=await f.run(true);
 assert.equal(r.body.tenantId,7);assert.equal(r.body.ready,1);assert.equal(r.body.imported,0);assert.equal(f.db.customers.length,0);
 assert(f.calls.some(v=>v.sql?.startsWith('SELECT')&&v.values[0]===7));assert(!f.calls.some(v=>v==='begin'||v.sql?.startsWith('INSERT')));
 assert.equal(f.calls.at(-1),'release');
});
test('CRM writes commit before memory update and roll back failures',async()=>{
 const f=crmFixture(),r=await f.run(false);assert.equal(r.body.imported,1);assert.equal(f.db.customers[0].tenantId,7);assert(f.calls.includes('commit'));
 const g=crmFixture();g.fail=true;const failed=await g.run(false);assert.equal(failed.code,500);assert(g.calls.includes('rollback'));assert(!g.calls.includes('commit'));assert.equal(g.db.customers.length,0);
 const bad=crmFixture();bad.tenant=0;assert.equal((await bad.run(true)).code,403);assert.deepEqual(bad.calls,[]);
});
test('Kim orchestration preserves staging checklist and durable-save-before-audit order',async()=>{
 const events=[],pipeline=[{id:'a',stage:'Staged'},{id:'b',stage:'Staged',blockedReason:'hold'},{id:'c',stage:'Staged'}],m={productionPipeline:pipeline};
 const deps={v24ProductionStore:()=>m,v24EnsurePipelineForPaidOrders(){},v24SyncPipelineWithJobs(){},kimProductionExceptions:()=>[],KIM_OPS:{version:'test',autoApprove:true,slaHours:24},now:()=> 'fixture-time',V24_PIPELINE_STAGES:['Staged','Approved','Processing'],kimProductionChecklist:p=>[{done:p.id!=='c'}],kimRouteRecommendation:()=> 'manual',kimLeadOpsSnapshot:()=>({}),getDb:()=>({users:[]}),kimControlHealth:()=>({}),megaSave:async()=>events.push('save'),audit:()=>events.push('audit'),KIM_SYSTEM_ACTOR:{id:'kim'}};
 const h=createKimOrchestrator(()=>deps);const result=await h.run('test');
 assert.equal(result.summary.production.counts.Processing,1);assert.equal(pipeline[0].assignedTo,'kim_system');assert.equal(pipeline[1].stage,'Staged');assert.equal(pipeline[2].stage,'Staged');assert.deepEqual(events,['save','audit']);
});
