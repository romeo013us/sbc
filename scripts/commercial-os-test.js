'use strict';
const assert=require('assert');
const {createCommercialOS,DEFAULT_PLANS,ROLE_PLAYBOOKS}=require('../enterprise/sbc-commercial-os-v602');
function fakePool(){
  const plans=new Map(); const tenants=new Map(); const ledger=new Map(); const onboarding=new Map(); const health=new Map(); let lid=1;
  return {async query(sql,args=[]){
    if(sql.startsWith('CREATE TABLE')) return [[],[]];
    if(sql.startsWith('INSERT INTO sbc_commercial_plans')) {plans.set(args[0],args);return [{affectedRows:1},[]];}
    if(sql.includes('SELECT tenant_id,status,plan_id FROM sbc_saas_tenants')) {const x=[...tenants.values()].find(v=>v.idem===args[0]);return [[x?{tenant_id:x.id,status:x.status,plan_id:x.plan}:undefined].filter(Boolean),[]];}
    if(sql.startsWith('INSERT INTO sbc_saas_tenants')) {if([...tenants.values()].some(v=>v.idem===args[4])){const e=new Error('dup');e.code='ER_DUP_ENTRY';throw e;}tenants.set(args[0],{id:args[0],business:args[1],plan:args[2],status:args[3],idem:args[4]});return [{affectedRows:1},[]];}
    if(sql.startsWith('INSERT INTO sbc_onboarding_runs')) {onboarding.set(args[0],{id:args[0],tenant:args[1],status:args[2],steps:args[3]});return [{affectedRows:1},[]];}
    if(sql.startsWith('INSERT INTO sbc_customer_health')) {health.set(args[0],{tenant_id:args[0],health_score:args[1],status:args[2],blockers_json:args[3]});return [{affectedRows:1},[]];}
    if(sql.startsWith('INSERT INTO sbc_commercial_ledger')) {if(ledger.has(args[1])){const e=new Error('dup');e.code='ER_DUP_ENTRY';throw e;}ledger.set(args[1],{tenant:args[0],event:args[1],amount:args[4]});return [{insertId:lid++},[]];}
    if(sql.startsWith('UPDATE sbc_saas_tenants')) {const t=tenants.get(args[0]); if(t)t.status='ACTIVE';return [{affectedRows:t?1:0},[]];}
    if(sql.startsWith('SELECT onboarding_id,steps_json')) {const x=[...onboarding.values()].find(v=>v.tenant===args[0]);return [[x?{onboarding_id:x.id,steps_json:x.steps}:undefined].filter(Boolean),[]];}
    if(sql.startsWith('UPDATE sbc_onboarding_runs')) return [{affectedRows:1},[]];
    if(sql.startsWith('SELECT tenant_id,health_score')) return [[health.get(args[0])].filter(Boolean),[]];
    if(sql.includes('SELECT COUNT(*) tenants')) return [[{tenants:tenants.size,activeTenants:[...tenants.values()].filter(x=>x.status==='ACTIVE').length,provisioning:0,atRisk:0}],[]];
    if(sql.includes('SUM(amount_cents)')) return [[{ledgerCents:[...ledger.values()].reduce((n,x)=>n+x.amount,0),ledgerEvents:ledger.size}],[]];
    if(sql.startsWith('SELECT plan_id,name')) return [[...plans.values()].map(x=>({plan_id:x[0],name:x[1],monthly_cents:x[2],setup_cents:x[3],active:1})),[]];
    if(sql.includes('FROM sbc_customer_health GROUP')) return [[],[]];
    throw new Error('Unhandled SQL: '+sql);
  },getConnection:async()=>{const tx={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},query:async function(sql,args){return fake.query(sql,args)},release:()=>{}};return tx;}};
}
const fake=fakePool();
(async()=>{
 const os=createCommercialOS({getPool:()=>fake}); await os.ensure();
 assert.equal(DEFAULT_PLANS.length,5); assert.ok(ROLE_PLAYBOOKS.owner);
 const a=await os.provisionTenant({businessName:'War Test Co',planId:'growth',idempotencyKey:'war-1'});
 assert.equal(a.replayed,false); assert.equal(a.status,'ACTIVE');
 const concurrent=await Promise.all([os.provisionTenant({businessName:'Concurrent Co',planId:'starter',idempotencyKey:'concurrent-1'}),os.provisionTenant({businessName:'Concurrent Co',planId:'starter',idempotencyKey:'concurrent-1'})]); assert.ok(concurrent.every(x=>x.ok));
 const b=await os.provisionTenant({businessName:'War Test Co',planId:'growth',idempotencyKey:'war-1'});
 assert.equal(b.replayed,true); assert.equal(b.tenantId,a.tenantId);
 const u=await os.recordUsage({tenantId:a.tenantId,eventType:'AI_USAGE',units:10,amountCents:125,eventId:'usage-1'});
 assert.equal(u.recorded,true); const ur=await os.recordUsage({tenantId:a.tenantId,eventType:'AI_USAGE',units:10,amountCents:125,eventId:'usage-1'}); assert.equal(ur.replayed,true);
 const h=await os.health(a.tenantId); assert.equal(h.status,'HEALTHY');
 const s=await os.summary(); assert.equal(Number(s.counts.activeTenants),2); assert.equal(Number(s.ledger.ledgerEvents),3);
 console.log('COMMERCIAL_OS_TEST PASS');
})().catch(e=>{console.error(e);process.exit(1)});
