'use strict';
const assert = require('node:assert/strict');
const {runWithTenantContext} = require('../enterprise/tenant-context.cjs');
const {revisionOfLead} = require('../enterprise/crm-revision-v6607.cjs');
const register = require('../routes/crm-edits-v6606.js');
async function run() {
  const route = {h:null};
  const app={patch(p,auth,handler){assert.equal(p,'/api/v6606/crm/leads/:id');route.h=handler;}};
  const row={id:'lead1',tenant_id:5,assigned_to:'jane',contact_name:'Jane',phone:'3055551200',email:'jane@example.org',status:'Lead',notes:'Original note',updated_at:'2026-10-24 10:00:01'};
  let saved={...row}, working=null, opened=0, released=0, commits=0, rollbacks=0, audits=0;
  let auditFailure=false,readbackMismatch=false,recoveryRequired=false;
  const conn={
    async beginTransaction(){working={...saved};},
    async query(sql,params){
      if(sql.startsWith('SELECT id,assigned_to'))return [[{...working}],[]];
      if(sql.startsWith('UPDATE sbc_customers')){
        const columns=[...sql.matchAll(/([a-z_]+)=\?/g)].map(m=>m[1]);
        const updates=columns.slice(0,-2);
        updates.forEach((col,i)=>{working[col]=params[i]});
        return [{affectedRows:1},[]];
      }
      if(sql.startsWith('SELECT id,tenant_id')) {
        const result={...working};
        if(readbackMismatch)result.notes='incorrect readback';
        return [[result],[]];
      }
      if(sql.startsWith('INSERT INTO sbc_activities')){
        if(auditFailure)throw Error('SIMULATED_AUDIT_INSERT_FAILURE');
        audits++;return [{affectedRows:1},[]];
      }
      throw Error('Unexpected query '+sql);
    },
    async commit(){assert.ok(working);saved={...working};working=null;commits++},
    async rollback(){working=null;rollbacks++},
    release(){released++}
  };
  register(app,{auth:()=>{},getContext:()=>({db:{customers:[]},mysqlPool:{getConnection:async()=>{opened++;return conn}},recoveryRequired:()=>recoveryRequired})});
  const response=()=>({code:200,headers:{},status(value){this.code=value;return this},setHeader(n,v){this.headers[n]=v},json(obj){this.body=obj;return this}});
  const req=(body,role='owner',userTenant=5)=>({params:{id:'lead1'},tenantId:5,user:{role,tenantId:userTenant,username:role==='caller'?'jane':'owner'},body});
  const originalToken=revisionOfLead(row);
  assert.match(originalToken,/^[0-9a-f]{64}$/);
  let x=response();recoveryRequired=true;await route.h(req({notes:'Blocked',revision:originalToken}),x);assert.equal(x.code,423);assert.equal(opened,0);
  recoveryRequired=false;
  x=response();await route.h(req({notes:'Missing ALS',revision:originalToken}),x);assert.equal(x.code,403);assert.equal(opened,0);
  await runWithTenantContext({tenantId:5,actorId:'owner'},async()=>{
    x=response();await route.h(req({notes:'Viewer',revision:originalToken},'viewer'),x);assert.equal(x.code,403);
    x=response();await route.h(req({notes:'No revision'}),x);assert.equal(x.code,400);assert.equal(x.body.code,'LEAD_REVISION_REQUIRED');
    x=response();await route.h(req({notes:'Tenant tampering',revision:originalToken},'owner',9),x);assert.equal(x.code,403);
    x=response();await route.h(req({notes:'SQL injection?',tenantId:9,revision:originalToken}),x);assert.equal(x.code,400);
    readbackMismatch=true;
    x=response();await route.h(req({notes:'Should fail',revision:originalToken}),x);assert.equal(x.code,503);assert.equal(saved.notes,'Original note');
    readbackMismatch=false;
    auditFailure=true;
    x=response();await route.h(req({notes:'Must roll back audit',revision:originalToken}),x);assert.equal(x.code,503);assert.equal(saved.notes,'Original note');
    auditFailure=false;
    x=response();await route.h(req({notes:'New verified note',revision:originalToken,status:'Contacted'}),x);assert.equal(x.code,200);assert.equal(x.body.durable,true);
    assert.equal(saved.notes,'New verified note');assert.equal(saved.status,'Contacted');
    assert.notEqual(x.body.data.revision,originalToken);
    const stale=response();await route.h(req({notes:'Stale overwrite attempt',revision:originalToken}),stale);
    assert.equal(stale.code,409);assert.equal(stale.body.code,'LEAD_STALE_REVISION');
    assert.equal(saved.notes,'New verified note');
    x=response();await route.h(req({notes:'Caller continuation',revision:revisionOfLead(saved)},'caller'),x);assert.equal(x.code,200);
    assert.equal(saved.notes,'Caller continuation');
  });
  assert.equal(commits,2,'only legitimate edits committed');
  assert.equal(audits,2,'only committed edits have audit event');
  assert.equal(opened,released,'no connection leaks');
  assert.ok(rollbacks>=3);
  console.log('PASS v6607 optimistic concurrency: ALS tenant, recovery lock, role, mandatory revision, rollback on bad readback/audit, stale 409, caller continuation, durable audit and no leaks');
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
