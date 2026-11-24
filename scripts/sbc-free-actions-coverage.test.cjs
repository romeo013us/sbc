'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {register}=require('../routes/sbc-free-action-focus.cjs');
const {easternToday,planActions}=require('../enterprise/sbc-free-action-focus.cjs');
const actor={id:'owner_001',role:'owner',active:true};
const row=(id,patch={})=>({id,tenant_id:7,business_name:'Business '+id,phone:'5550100',status:'Lead',assigned_to:'manager_001',follow_up:null,...patch});
function fixture(records){
 let handler,observed;
 const app={get(_path,_auth,h){handler=h}};
 register(app,{auth(){},tenantForRead:()=>7,getContext:()=>({db:{users:[{id:'manager_001',tenantId:7,role:'account_manager',active:true}]},mysqlPool:{query:async(sql,args)=>{observed={sql,args};return [records]}}})});
 return {observed:()=>observed,async call(user=actor){let status=200,body;const res={setHeader(){},status(n){status=n;return this},json(v){body=v;return this}};await handler({user,query:{limit:12}},res);return {status,body};}};
}
test('authorized sample prioritizes dated obligations before newest records and uses one extra row to detect truncation',async()=>{
 const before=easternToday(),records=[row('old_due',{follow_up:'2025-11-01'}),...Array.from({length:500},(_,i)=>row('recent_'+i))];
 const f=fixture(records),r=await f.call(),after=easternToday();
 assert.equal(r.status,200);
 assert.match(f.observed().sql,/ORDER BY CASE WHEN follow_up <= \? THEN 0 ELSE 1 END, CASE WHEN follow_up <= \? THEN follow_up ELSE NULL END, created_at DESC,id ASC LIMIT 501$/);
 const cutoffs=[before,after].map(day=>new Date(Date.parse(day+'T12:00:00Z')+7*86400000).toISOString().slice(0,10));
 const args=f.observed().args;
 assert.equal(args[0],7);assert.equal(args[1],args[2]);assert(cutoffs.includes(args[1]));
 assert.equal(r.body.sampledRecords,500);assert.equal(r.body.moreRecordsPossible,true);
 assert.equal(r.body.actions[0].accountId,'old_due');assert.equal(r.body.actions[0].code,'FOLLOW_UP_DUE');
 assert.equal(r.body.samplePolicy,'DUE_FIRST_BOUNDED');
 assert.equal(r.body.counts.QUALIFICATION_QUEUE_REVIEW,1);
 assert.equal(r.body.queueCounts.QUALIFICATION_QUEUE_REVIEW,499);
});
test('exactly 500 eligible rows are not falsely labeled truncated; staff remain scoped',async()=>{
 const f=fixture(Array.from({length:500},(_,i)=>row('lead_'+i)));
 const r=await f.call({id:'manager_001',role:'account_manager',active:true});
 assert.equal(r.status,200);assert.equal(r.body.sampledRecords,500);assert.equal(r.body.moreRecordsPossible,false);
 assert.match(f.observed().sql,/tenant_id=\?.*assigned_to=\?/);assert.equal(f.observed().args[1],'manager_001');
});
test('an invalid database date is flagged as a data-quality action rather than failing the entire sample',()=>{
 const p=planActions({tenantId:7,actor,today:'2026-11-24',rows:[row('invalid_date',{follow_up:new Date(NaN)}),row('valid_date',{follow_up:'2026-11-23'})]});
 assert.equal(p.actions.find(x=>x.accountId==='invalid_date').code,'FOLLOW_UP_DATE_REVIEW');
 assert.equal(p.actions[0].accountId,'valid_date');
});
