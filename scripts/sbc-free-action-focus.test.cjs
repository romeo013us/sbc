'use strict';
// Synthetic, no network, no MySQL writes, no SMS/email, no AI APIs.
const assert=require('node:assert/strict');
const {planActions}=require('../enterprise/sbc-free-action-focus.cjs');
const register=require('../routes/sbc-free-action-focus.cjs').register;
const now='2026-11-21';
const rows=[
 {id:'lead_due_0001',tenant_id:7,business_name:'South Beach Auto',phone:'3055551212',status:'Lead',assigned_to:'manager_001',follow_up:'2026-11-20'},
 {id:'lead_block_002',tenant_id:7,business_name:'Blocked Lead',phone:'3055559999',status:'Do Not Call',assigned_to:'manager_001',follow_up:'2026-11-19'},
 {id:'lead_new_0003',tenant_id:7,business_name:'New Prospect',phone:'3055554444',status:'Lead',assigned_to:'',follow_up:null},
 {id:'lead_future_4',tenant_id:7,business_name:'Future Customer',phone:'3055551717',status:'Customer',assigned_to:'manager_001',follow_up:'2026-11-24'},
 {id:'lead_other_05',tenant_id:7,business_name:'Other Manager',phone:'3055558333',status:'Lead',assigned_to:'manager_002',follow_up:'2026-11-19'},
 {id:'lead_bad_0006',tenant_id:7,business_name:'Broken Date',phone:'',status:'Lead',assigned_to:'manager_001',follow_up:'not-a-date'}
];
const actor={id:'manager_001',role:'account_manager',active:true};
const manager=planActions({tenantId:7,actor,rows,today:now,limit:25});
assert.equal(manager.ok,true);
assert.equal(manager.readOnly,true);
assert.equal(manager.requiresAi,false);
assert.equal(manager.messagesSent,0);
assert.equal(manager.actions.every(a=>a.accountId!=='lead_new_0003'&&a.accountId!=='lead_other_05'),true);
assert.equal(manager.actions.find(a=>a.accountId==='lead_due_0001').code,'FOLLOW_UP_DUE');
assert.equal(manager.actions.find(a=>a.accountId==='lead_block_002').code,'CONTACT_RESTRICTION_REVIEW');
assert.equal(manager.actions.find(a=>a.accountId==='lead_bad_0006').code,'FOLLOW_UP_DATE_REVIEW');
assert.equal(manager.actions.find(a=>a.accountId==='lead_future_4').code,'FOLLOW_UP_UPCOMING');
assert.equal(manager.actions.some(a=>a.code==='ASSIGN_MANAGER'),false);
assert.equal(manager.actions.every(a=>/^[\w.:-]+$/.test(a.accountId)),true);
assert.equal(JSON.stringify(manager).includes('305555'),false,'no phone contact values in action response');
assert.deepEqual(planActions({tenantId:7,actor,rows,today:now,limit:25}),manager,'stable deterministic output');
const owner=planActions({tenantId:7,actor:{id:'owner_001',role:'owner',active:true},rows,today:now});
assert.equal(owner.actions.find(a=>a.accountId==='lead_new_0003').code,'ASSIGN_MANAGER');
assert.equal(owner.actions.find(a=>a.accountId==='lead_other_05').code,'FOLLOW_UP_DUE');
assert.equal(owner.actions.length,6);
const limited=planActions({tenantId:7,actor,rows,today:now,limit:2});
assert.equal(limited.actions.length,2);
assert.equal(limited.total,4);
for(const fail of [
 {tenantId:0,actor,rows,today:now},
 {tenantId:7,actor:{id:'x',role:'lead_researcher'},rows,today:now},
 {tenantId:7,actor:{id:'x',role:'owner',active:false},rows,today:now},
 {tenantId:7,actor,rows:[...rows,{...rows[0],tenant_id:999}],today:now},
 {tenantId:7,actor,rows:null,today:now}
])assert.throws(()=>planActions(fail));
assert.equal(planActions({tenantId:7,actor,rows:[],today:now}).total,0);
const handlers=new Map(),queries=[];
const app={get:(p,...args)=>handlers.set(p,args.at(-1))};
const users=[{id:'manager_001',role:'account_manager',tenantId:7,active:true}];
let unavailable=false;
register(app,{auth:()=>{},tenantForRead:()=>7,getContext:()=>({
 db:{users},
 mysqlPool:{query:async(sql,args)=>{if(unavailable)throw Error('MYSQL_UNAVAILABLE');assert.match(sql,/^SELECT /);queries.push({sql,args});return [rows.filter(r=>!sql.includes('assigned_to=?')||r.assigned_to===args[1])];}}
})});
const route=handlers.get('/api/sbc/free-actions/today');assert.equal(typeof route,'function');
function res(){return {code:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.code=n;return this},json(x){this.body=x;return this}}}
(async()=>{
 let reply=res();await route({user:{id:'manager_001',role:'account_manager',active:true},query:{limit:'10'}},reply);
 assert.equal(reply.code,200);assert.equal(reply.headers['Cache-Control'],'no-store');
 assert.equal(reply.body.total,4);
 assert.equal(queries[0].args[0],7);assert.equal(queries[0].args[1],'manager_001');
 assert.match(queries[0].sql,/assigned_to=\?/);
 reply=res();await route({user:{id:'owner_001',role:'owner',active:true},query:{}},reply);
 assert.equal(reply.code,200);assert.equal(reply.body.total,6);
 reply=res();await route({user:{id:'researcher',role:'lead_researcher'},query:{}},reply);
 assert.equal(reply.code,403);
 unavailable=true;reply=res();await route({user:{id:'owner_001',role:'owner',active:true},query:{}},reply);
 assert.equal(reply.code,503,'backend outage is NOT zero work');
 assert.equal(reply.body.ok,false);
 console.log('[SUPER SBC NO-PAID-AI] PASS: owner/manager scoped rules, no contact, no writes, predictable next actions, fail closed');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
