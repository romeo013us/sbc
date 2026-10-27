'use strict';
const assert=require('assert');
const {createStateKernel,VERSION,GOVERNANCE_STAGES,WORKLOADS,TRANSITIONS}=require('../enterprise/sbc-state-kernel-v604');
function fakePool(){
  const events=[]; const projections=new Map(); const commands=[]; const cells=[]; const gov=[];
  function result(sql,args){const q=sql.toLowerCase();
    if(q.includes('select event_id')&&q.includes('idempotency_key')) return [events.filter(e=>e.tenant_id===args[0]&&e.idempotency_key===args[1]).slice(0,1)];
    if(q.includes('select coalesce(max(sequence_no)')) return [[{next_no:(events.filter(e=>e.tenant_id===args[0]&&e.aggregate_id===args[1]).reduce((m,e)=>Math.max(m,e.sequence_no),0)+1)}]];
    if(q.includes('select version,state_json from sbc_state_projections')) {const x=projections.get(args[0]+'|'+args[1]); return [[x||undefined].filter(Boolean)];}
    if(q.includes('select version,state_json,state_hash')) {const x=projections.get(args[0]+'|'+args[1]); return [[x||undefined].filter(Boolean)];}
    if(q.includes('select event_type,payload_json')) return [events.filter(e=>e.tenant_id===args[0]&&e.aggregate_id===args[1]).sort((a,b)=>a.sequence_no-b.sequence_no)];
    if(q.includes('insert into sbc_state_events')) {events.push({event_id:args[0],tenant_id:args[1],aggregate_id:args[2],event_type:args[3],idempotency_key:args[4],sequence_no:args[5],payload_json:args[6],event_hash:args[7],created_at:args[8]});return [{affectedRows:1}];}
    if(q.includes('insert into sbc_state_projections')) {const key=args[0]+'|'+args[1]; if(q.includes('insert ignore')&&projections.has(key)) return [{affectedRows:0}]; projections.set(key,{version:args[2],state_json:args[3],state_hash:args[4],updated_at:new Date()});return [{affectedRows:1}];}
    if(q.includes('insert into sbc_command_bus')) {if(commands.some(c=>c.tenant_id===args[1]&&c.idempotency_key===args[4])) {const e=new Error('dup');e.code='ER_DUP_ENTRY';throw e;}commands.push({command_id:args[0],tenant_id:args[1],aggregate_id:args[2],command_type:args[3],idempotency_key:args[4],status:args[5],result_json:args[7]});return [{affectedRows:1}];}
    if(q.includes('select command_id')) return [commands.filter(c=>c.tenant_id===args[0]&&c.idempotency_key===args[1]).slice(0,1)];
    if(q.includes('insert into sbc_kernel_governance')) {gov.push(args);return [{affectedRows:1}];}
    if(q.includes('insert into sbc_kernel_cells')) {cells.push(args);return [{affectedRows:1}];}
    if(q.includes('select cell_id')) return [cells.map(a=>({cell_id:a[0],tenant_id:a[1],workload:a[2],status:a[3],capacity:a[4],active_jobs:a[5]}))];
    if(q.startsWith('create table')) return [{affectedRows:0}];
    return [[]];
  }
  return {query:async(sql,args)=>result(sql,args||[]),getConnection:async()=>({query:async(sql,args)=>result(sql,args||[]),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release:()=>{}})};
}
(async()=>{
 assert(VERSION.startsWith('60.4.2-')); assert.deepStrictEqual(GOVERNANCE_STAGES,['OBSERVE','DIAGNOSE','RECOMMEND','APPROVE','EXECUTE','VERIFY','ROLLBACK']); assert.deepStrictEqual(WORKLOADS,['CORE','SALES','TELEPHONY','FULFILLMENT','AI']);
 const pool=fakePool(); const k=createStateKernel({getPool:()=>pool}); await k.ensure();
 const a=await k.appendEvent({tenantId:'t1',aggregateId:'c1',eventType:'CUSTOMER_CREATED',payload:{status:'LEAD'},idempotencyKey:'i1'}); assert(!a.replayed&&a.projection.version===1);
 const b=await k.appendEvent({tenantId:'t1',aggregateId:'c1',eventType:'PAYMENT_CONFIRMED',payload:{status:'CUSTOMER',amountCents:34900},idempotencyKey:'i2'}); assert(b.projection.version===2);
 const r=await k.appendEvent({tenantId:'t1',aggregateId:'c1',eventType:'PAYMENT_CONFIRMED',payload:{status:'CUSTOMER',amountCents:34900},idempotencyKey:'i2'}); assert(r.replayed);
 assert((await k.getProjection('t1','c1',{fresh:true})).state.status==='CUSTOMER');
 const c=await k.command({tenantId:'t1',commandType:'REFRESH',payload:{},idempotencyKey:'cmd1'}); assert(c.ok&&!c.replayed); const cr=await k.command({tenantId:'t1',commandType:'REFRESH',payload:{},idempotencyKey:'cmd1'}); assert(cr.replayed);
 await k.setGovernance({tenantId:'t1',actionType:'DIAGNOSTIC',stage:'OBSERVE',actorId:'owner'}); await k.setGovernance({tenantId:'t1',actionId:'x',actionType:'DIAGNOSTIC',stage:'DIAGNOSE',previousStage:'OBSERVE',actorId:'owner'});
 let failed=false; try{await k.setGovernance({tenantId:'t1',actionType:'BAD',stage:'EXECUTE',previousStage:'OBSERVE',actorId:'owner'});}catch{failed=true} assert(failed);
 await k.heartbeatCell({tenantId:'t1',workload:'SALES',capacity:4,status:'ACTIVE',activeJobs:1}); assert((await k.cells('t1')).length===1);
 console.log(JSON.stringify({ok:true,version:VERSION,checks:['durable-event','idempotency','projection','command-bus','governance-transition','logical-cell'].map(x=>({name:x,ok:true}))},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
