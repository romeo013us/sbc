'use strict';
const assert=require('node:assert/strict');
const {runWithTenantContext}=require('../enterprise/tenant-context.cjs');
const register=require('../routes/crm-edits-v6606');
const app={routes:[],patch(path,...handlers){this.routes.push({path,handler:handlers.at(-1)})}};
const response=()=>({code:200,status(n){this.code=n;return this},setHeader(){},json(data){this.data=data;return this}});
async function run(){
 let opens=0,commits=0,rollbacks=0,releases=0,history=[],activityFailure=false;
 const conn={
  async beginTransaction(){},
  async query(sql,params){
   history.push({sql,params});
   if(sql.startsWith('SELECT id,assigned_to'))return [[{id:'lead1',assigned_to:'jane'}],[]];
   if(sql.startsWith('UPDATE sbc_customers'))return [{affectedRows:1},[]];
   if(sql.startsWith('SELECT id,tenant_id'))return [[{id:'lead1',tenant_id:5,status:'Contacted',notes:'Called'}],[]];
   if(sql.startsWith('INSERT INTO sbc_activities')){if(activityFailure)throw Error('AUDIT_INSERT_FAILED');return [{affectedRows:1},[]];}
   throw Error('Unexpected SQL '+sql);
  },
  async commit(){commits++},async rollback(){rollbacks++},release(){releases++}
 };
 const customer={id:'lead1',tenant_id:5,notes:'Old'};
 let locked=true;
 register(app,{auth:()=>{},getContext:()=>({mysqlPool:{getConnection:async()=>{opens++;return conn}},db:{customers:[customer]},recoveryRequired:()=>locked})});
 assert.equal(app.routes.length,1);
 const handler=app.routes[0].handler;
 const req={params:{id:'lead1'},tenantId:5,user:{role:'owner',tenantId:5,username:'owner'},body:{notes:'Called',status:'Contacted'}};
 let r=response();await handler(req,r);assert.equal(r.code,423);assert.equal(opens,0);
 locked=false;
 r=response();await handler(req,r);assert.equal(r.code,403);assert.equal(opens,0,'missing ALS must block before connection');
 await runWithTenantContext({tenantId:5,actorId:'owner'},async()=>{
  r=response();await handler({...req,user:{role:'viewer',tenantId:5}},r);assert.equal(r.code,403);assert.equal(opens,0);
  r=response();await handler({...req,body:{tenantId:2}},r);assert.equal(r.code,400);assert.equal(opens,0);
  r=response();await handler({...req,tenantId:9},r);assert.equal(r.code,403);assert.equal(opens,0);
  r=response();await handler({...req,user:{role:'caller',username:'other',tenantId:5}},r);assert.equal(r.code,403);assert.equal(commits,0);
  activityFailure=true;
  r=response();await handler({...req,user:{role:'caller',username:'jane',tenantId:5}},r);assert.equal(r.code,503);assert.equal(commits,0);assert.equal(rollbacks>=2,true);
  activityFailure=false;
  r=response();await handler({...req,user:{role:'caller',username:'jane',tenantId:5}},r);assert.equal(r.code,200);assert.equal(r.data.durable,true);
 });
 assert.equal(commits,1);assert.equal(customer.notes,'Called');assert.equal(customer.status,'Contacted');
 const updates=history.filter(x=>x.sql.startsWith('UPDATE'));assert.equal(updates.length,2);
 for(const update of updates){assert.match(update.sql,/WHERE tenant_id=\? AND id=\?/);assert.equal(update.params.at(-2),5);assert.equal(update.params.at(-1),'lead1');assert.equal((update.sql.match(/\?/g)||[]).length,update.params.length);}
 assert.equal(history.filter(x=>x.sql.startsWith('INSERT INTO sbc_activities')).length,2);
 assert.equal(opens,releases,'no leaked connections');
 console.log('PASS v6606 edit workflow: recovery, tenant, roles, assignment, no arbitrary fields, durable transaction, rollback on audit failure, release');
}
run().catch(e=>{console.error(e);process.exitCode=1});
