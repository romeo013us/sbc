'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {runWithTenantContext}=require('../enterprise/tenant-context.cjs');
const register=require('../routes/account-portfolios-v1.cjs');
test('owner assigns batches, customer relationship persists, transfers are auditable, manager schedules follow-up',async()=>{
 const people=[
  {id:'m1',name:'Account A',role:'caller',active:true,tenantId:5},
  {id:'m2',name:'Account B',role:'caller',active:true,tenantId:5},
  {id:'inactive',role:'caller',active:false,tenantId:5},
  {id:'foreign',role:'caller',active:true,tenantId:9}
 ];
 const base=[
  {id:'a',tenant_id:5,assigned_to:'',status:'Lead',follow_up:null,created_at:'2026-10-01'},
  {id:'b',tenant_id:5,assigned_to:'',status:'Customer',follow_up:null,created_at:'2026-10-02'},
  {id:'c',tenant_id:5,assigned_to:'m1',status:'Customer',follow_up:null,created_at:'2026-10-03'},
  {id:'d',tenant_id:9,assigned_to:'',status:'Lead',follow_up:null,created_at:'2026-10-04'},
  {id:'e',tenant_id:5,assigned_to:'',status:'Do Not Call',follow_up:null,created_at:'2026-10-05'},
  {id:'f',tenant_id:5,assigned_to:'',status:'Lead',follow_up:null,created_at:'2026-10-06'}
 ];
 let rows=structuredClone(base),events=[],writes=0,recovery=false,badAudit=false;
 const pool={async getConnection(){
  let working=structuredClone(rows),added=[],opened=false;
  return {
   async beginTransaction(){opened=true;},
   async query(sql,params){
    if(sql.startsWith('SELECT assigned_to,status,follow_up'))return [[...working.filter(c=>c.tenant_id===params[0])],[]];
    if(sql.startsWith('SELECT id,assigned_to,status,follow_up,tenant_id FROM sbc_customers')){
      if(sql.includes('id IN ('))return [[...working.filter(c=>c.tenant_id===params[0]&&params.slice(1).includes(c.id))],[]];
      if(sql.includes('AND id=?'))return [[...working.filter(c=>c.tenant_id===params[0]&&c.id===params[1])],[]];
      return [[...working.filter(c=>c.tenant_id===params[0]&&(!c.assigned_to)&&!['Lost','Do Not Call'].includes(c.status)).sort((a,b)=>a.created_at.localeCompare(b.created_at)).slice(0,params[1])],[]];
    }
    if(sql.startsWith('UPDATE sbc_customers SET assigned_to=')){
      const [next,stamp,tenant,id,prior]=params;
      const row=working.find(x=>x.tenant_id===tenant&&x.id===id);
      if(!row||((prior==null&&!['',null].includes(row.assigned_to))||(prior!=null&&row.assigned_to!==prior)))return [{affectedRows:0},[]];
      row.assigned_to=next;row.updated_at=stamp;return [{affectedRows:1},[]];
    }
    if(sql.startsWith('UPDATE sbc_customers SET follow_up=')){
      const [date,stamp,tenant,id,assignee]=params;
      const row=working.find(x=>x.tenant_id===tenant&&x.id===id);
      if(!row||(assignee!=null&&row.assigned_to!==assignee))return [{affectedRows:0},[]];
      row.follow_up=date;row.updated_at=stamp;return [{affectedRows:1},[]];
    }
    if(sql.startsWith('INSERT INTO sbc_activities')){
      if(badAudit)throw Error('SIMULATED_AUDIT_FAILURE');
      added.push(JSON.parse(params[3]));return [{affectedRows:1},[]];
    }
    throw Error('Unexpected query: '+sql);
   },
   async commit(){rows=working;events.push(...added);writes++;opened=false;},
   async rollback(){opened=false;},
   release(){if(opened)throw Error('Leaked transaction');}
  };
 }};
 const app=express();app.use(express.json());
 app.use((req,res,next)=>{
  const key=req.get('x-test')||'owner';
  req.user=key==='owner'?{id:'owner',role:'owner',tenantId:5,username:'owner'}:key==='m1'?{...people[0],username:'m1'}:
    key==='m2'?{...people[1],username:'m2'}:key==='other'?{id:'other',role:'owner',tenantId:9,username:'other'}:
    key==='guest'?null:{id:'nobody',role:'viewer',tenantId:5};
  if(!req.user)return next();
  return runWithTenantContext({tenantId:req.user.tenantId,actorId:req.user.id},()=>next());
 });
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 register(app,{auth,getContext:()=>({db:{users:people,customers:[]},mysqlPool:pool,recoveryRequired:()=>recovery})});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 const call=async(method,url,body,who='owner')=>{
  const r=await fetch('http://127.0.0.1:'+server.address().port+url,{method,headers:{'Content-Type':'application/json','x-test':who},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json()};
 };
 const pre='/api/v6606/crm/account-portfolios';
 try{
  assert.equal((await call('GET',pre+'/summary',null,'guest')).status,401);
  assert.equal((await call('GET',pre+'/summary',null,'m1')).status,403);
  assert.equal((await call('POST',pre+'/assign-batch',{managerId:'m1',amount:2},'m1')).status,403);
  assert.equal((await call('POST',pre+'/assign-batch',{managerId:'foreign',amount:2})).status,403);
  assert.equal((await call('POST',pre+'/assign-batch',{managerId:'inactive',amount:2})).status,400);
  assert.equal((await call('POST',pre+'/assign-batch',{managerId:'m1',amount:999})).status,400);
  assert.equal((await call('POST',pre+'/assign-batch',{managerId:'m1',accountIds:['d']})).status,404);
  recovery=true;assert.equal((await call('POST',pre+'/assign-batch',{managerId:'m1',amount:2})).status,423);recovery=false;
  const first=await call('POST',pre+'/assign-batch',{managerId:'m1',amount:2});
  assert.equal(first.status,200);
  assert.equal(first.data.assigned,2);
  assert.equal(rows.find(x=>x.id==='a').assigned_to,'m1');
  assert.equal(rows.find(x=>x.id==='b').assigned_to,'m1','existing customers must retain assigned account manager');
  assert.equal(rows.find(x=>x.id==='e').assigned_to,'','DNC must never be assigned by auto batch');
  assert.equal(rows.find(x=>x.id==='d').assigned_to,'','no foreign-tenant records touched');
  const second=await call('POST',pre+'/assign-batch',{managerId:'m2',amount:2});
  assert.equal(second.status,200);assert.equal(second.data.assigned,1);
  assert.equal(rows.find(x=>x.id==='f').assigned_to,'m2');
  assert.equal((await call('POST',pre+'/assign-batch',{managerId:'m2',accountIds:['a']})).status,409,'no silent account stealing');
  assert.equal((await call('POST',pre+'/c/transfer',{managerId:'m2',expectedManagerId:'bad',reason:'Owner reassignment after review'})).status,409);
  const tr=await call('POST',pre+'/c/transfer',{managerId:'m2',expectedManagerId:'m1',reason:'Customer requests a new dedicated account manager'});
  assert.equal(tr.status,200);
  assert.equal(rows.find(x=>x.id==='c').assigned_to,'m2');
  assert(events.some(x=>x.customerId==='c'&&x.fromManagerId==='m1'&&x.toManagerId==='m2'&&x.reason.includes('requests')));
  assert.equal((await call('POST',pre+'/c/follow-up',{dueDate:'2026-12-10',purpose:'Review annual services'},'m1')).status,403);
  assert.equal((await call('POST',pre+'/e/follow-up',{dueDate:'2026-12-10',purpose:'Ignore do not call'},'owner')).status,409);
  assert.equal((await call('POST',pre+'/c/follow-up',{dueDate:'not-date',purpose:'Talk'},'m2')).status,400);
  const fu=await call('POST',pre+'/c/follow-up',{dueDate:'2026-12-10',purpose:'Review managed hosting renewal and support needs'},'m2');
  assert.equal(fu.status,200);
  assert.equal(rows.find(x=>x.id==='c').follow_up,'2026-12-10');
  assert(events.some(x=>x.customerId==='c'&&x.purpose.includes('hosting')));
  assert.equal((await call('GET',pre+'/summary')).data.managers.some(x=>x.id==='m2'&&x.customers>=1),true);
  const before=JSON.stringify(rows),priorWrites=writes;
  badAudit=true;
  assert.equal((await call('POST',pre+'/a/transfer',{managerId:'m2',expectedManagerId:'m1',reason:'Staff transition after account review'})).status,503);
  badAudit=false;
  assert.equal(JSON.stringify(rows),before,'transaction rolls back when history cannot be written');
  assert.equal(writes,priorWrites);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
