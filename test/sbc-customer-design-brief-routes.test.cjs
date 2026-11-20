'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {register}=require('../routes/sbc-customer-design-briefs.cjs');
const customer={id:'cust_1',tenant_id:1,business_name:'Synthetic Tire Co',assigned_to:'manager_1',status:'Interested'};
const customerOther={id:'cust_2',tenant_id:1,business_name:'Different Co',assigned_to:'manager_2',status:'Interested'};
const owner={id:'owner_1',role:'owner',tenantId:1,active:true};
const manager={id:'manager_1',role:'account_manager',tenantId:1,active:true};
const foreign={id:'owner_2',role:'owner',tenantId:2,active:true};
function database(opts={}){
 const rows=[];let wrote=0;
 const query=async(sql,args)=>{
  if(opts.designSchemaMissing&&sql.includes('sbc_customer_design_briefs_v1'))throw Object.assign(new Error('Synthetic missing design table'),{code:'ER_NO_SUCH_TABLE'});
  if(sql.includes('FROM sbc_customers WHERE tenant_id=? AND id=?')){
   return [[customer,customerOther].filter(c=>c.tenant_id===args[0]&&c.id===args[1])];
  }
  if(sql.startsWith('INSERT INTO sbc_customer_design_briefs_v1')){
   const [id,tenant_id,customer_id,kind,token_hash,status,requested_by,created_at,expires_at]=args;
   rows.push({id,tenant_id,customer_id,kind,token_hash,status,requested_by,created_at,expires_at,answers_json:null,submitted_at:null,reviewed_at:null});wrote++;return [{affectedRows:1}];
  }
  if(sql.includes('JOIN sbc_customers c')){
   return [rows.filter(b=>b.token_hash===args[0]).map(b=>({...b,business_name:[customer,customerOther].find(c=>c.id===b.customer_id)?.business_name}))];
  }
  if(sql.includes('SELECT id,customer_id,kind,status,answers_json')){
   return [rows.filter(b=>b.tenant_id===args[0]&&b.customer_id===args[1])];
  }
  if(sql.includes('SELECT customer_id FROM sbc_customer_design_briefs_v1')){
   return [rows.filter(b=>b.tenant_id===args[0]&&b.id===args[1]).map(b=>({customer_id:b.customer_id}))];
  }
  if(sql.includes('SET answers_json=?')){
   const b=rows.find(r=>r.token_hash===args[3]&&r.status===args[4]&&r.expires_at>args[5]);
   if(!b)return [{affectedRows:0}];
   b.answers_json=args[0];b.status=args[1];b.submitted_at=args[2];wrote++;return [{affectedRows:1}];
  }
  if(sql.includes('SET status=?,reviewed_at=?')){
   const b=rows.find(r=>r.tenant_id===args[2]&&r.id===args[3]&&r.status===args[4]);
   if(!b)return [{affectedRows:0}];b.status=args[0];b.reviewed_at=args[1];wrote++;return [{affectedRows:1}];
  }
  if(sql.includes('SET status=?')){
   const b=rows.find(r=>r.tenant_id===args[1]&&r.id===args[2]&&r.status===args[3]);
   if(!b)return [{affectedRows:0}];b.status=args[0];wrote++;return [{affectedRows:1}];
  }
  throw Error('Unexpected SQL: '+sql.slice(0,100));
 };
 return {rows,query,get writes(){return wrote}};
}
async function server(opts={}){
 const app=express();app.use(express.json({limit:'80kb'}));
 const db=database(opts),ctx={mysqlPool:db,recoveryRequired:()=>false};
 app.use((req,res,next)=>{
  req.user=req.header('x-test-user')==='owner'?owner:req.header('x-test-user')==='manager'?manager:req.header('x-test-user')==='foreign'?foreign:null;
  next();
 });
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 register(app,{auth,getContext:()=>ctx,tenantForRead:req=>req.user.tenantId});
 const instance=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 const base='http://127.0.0.1:'+instance.address().port;
 const ask=async(method,path,body,user)=>{
  const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{'x-test-user':user}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const type=res.headers.get('content-type')||'';
  return {status:res.status,headers:res.headers,body:type.includes('json')?await res.json():await res.text()};
 };
 return {db,ctx,ask,close:()=>new Promise(resolve=>instance.close(resolve))};
}
test('secure customer request supports form creation, one-time submission, review and tenant isolation',async()=>{
 const s=await server();
 try{
  assert.equal((await s.ask('POST','/api/sbc/design-briefs',{customerId:'cust_1',kind:'WEBSITE'})).status,401);
  assert.equal((await s.ask('POST','/api/sbc/design-briefs',{customerId:'cust_2',kind:'WEBSITE'},'manager')).status,403);
  assert.equal((await s.ask('POST','/api/sbc/design-briefs',{customerId:'cust_1',kind:'WEBSITE'},'foreign')).status,404);
  const made=await s.ask('POST','/api/sbc/design-briefs',{customerId:'cust_1',kind:'WEBSITE'},'manager');
  assert.equal(made.status,201);assert.equal(made.body.sent,false);
  const {urlPath,id}=made.body;
  assert.match(urlPath,/^\/request\/[a-f0-9]{64}$/);
  assert.equal(s.db.rows[0].token_hash.length,64);
  assert(!JSON.stringify(s.db.rows).includes(urlPath.slice('/request/'.length)),'raw bearer token must not be persisted');
  const page=await s.ask('GET',urlPath);
  assert.equal(page.status,200);assert.match(page.body,/sbcBriefForm/);
  assert.match(page.headers.get('x-robots-tag'),/noindex/);
  const meta=await s.ask('GET','/api/sbc/design-briefs/public/'+urlPath.split('/').pop());
  assert.equal(meta.status,200);assert.equal(meta.body.kind,'WEBSITE');
  const payload={businessName:'Synthetic Tire Co',contactName:'Pat Owner',contactEmail:'pat@example.com',consent:true,
   style:'bold',primaryColor:'#112233',secondaryColor:'#ffcc00',referenceUrls:['https://example.com'],
   services:'Tire service confirmed by customer',pages:['home','contact'],features:['contact_form']};
  const submitted=await s.ask('POST','/api/sbc/design-briefs/public/'+urlPath.split('/').pop(),payload);
  assert.equal(submitted.status,201);assert.equal(s.db.rows[0].status,'SUBMITTED');
  assert.equal((await s.ask('POST','/api/sbc/design-briefs/public/'+urlPath.split('/').pop(),payload)).status,409);
  const list=await s.ask('GET','/api/sbc/design-briefs/customer/cust_1',null,'owner');
  assert.equal(list.status,200);assert.equal(list.body.briefs.length,1);assert.equal(list.body.briefs[0].answers.primaryColor,'#112233');
  assert.equal((await s.ask('GET','/api/sbc/design-briefs/customer/cust_1',null,'foreign')).status,404);
  assert.equal((await s.ask('POST','/api/sbc/design-briefs/'+id+'/review',{},'owner')).status,200);
  assert.equal(s.db.rows[0].status,'REVIEWED');
 }finally{await s.close()}
});
test('recovery write lock prevents design request issue and unauthenticated customer submission',async()=>{
 const s=await server();
 try{
  s.ctx.recoveryRequired=()=>true;
  assert.equal((await s.ask('POST','/api/sbc/design-briefs',{customerId:'cust_1',kind:'WEBSITE'},'owner')).status,423);
  assert.equal(s.db.rows.length,0);
 }finally{await s.close()}
});

test('design request schema absence returns safe owner-actionable 503 instead of opaque MySQL details',async()=>{
 const s=await server({designSchemaMissing:true});
 try{
  const list=await s.ask('GET','/api/sbc/design-briefs/customer/cust_1',null,'owner');
  assert.equal(list.status,503);
  assert.equal(list.body.code,'DESIGN_REQUEST_SCHEMA_NOT_READY');
  assert.equal(JSON.stringify(list.body).includes('Synthetic'),false);
  const created=await s.ask('POST','/api/sbc/design-briefs',{customerId:'cust_1',kind:'WEBSITE'},'owner');
  assert.equal(created.status,503);
  assert.equal(created.body.code,'DESIGN_REQUEST_SCHEMA_NOT_READY');
  assert.equal(s.db.writes,0,'do not create phantom requests without approved schema setup');
 }finally{await s.close()}
});
