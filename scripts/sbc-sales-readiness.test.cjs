'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {register}=require('../routes/sbc-sales-command-v1.cjs');
const names=['sbc_sales_credit_v1','sbc_commission_terms_v1','sbc_commission_statement_v1','sbc_commission_audit_v1'];
function setup({missing=[],recovery=false,unavailable=false}={}){
 const handlers=new Map(),queries=[];let writes=0;
 const pool={async query(sql,params){queries.push({sql,params});if(unavailable)throw Object.assign(Error('Database read unavailable'),{code:'ER_ACCESS_DENIED_ERROR'});
  if(missing.some(name=>sql.includes('FROM '+name+' ')))throw Object.assign(Error('Missing table'),{code:'ER_NO_SUCH_TABLE'});
  return [[]];},async getConnection(){throw Error('Unexpected write connection')}};
 register({get:(url,_auth,fn)=>handlers.set('GET '+url,fn),post:(url,_auth,fn)=>handlers.set('POST '+url,fn)},
 {auth:(req,res,next)=>next?.(),getContext:()=>({db:{users:[]},mysqlPool:pool,recoveryRequired:()=>recovery}),
  tenantForRead:req=>req.tenantId,writer:()=>{writes++}});
 async function request(user={id:'owner',tenantId:1,role:'owner',active:true}){
  const h=handlers.get('GET /api/owner/sales-command/readiness');assert(h,'readiness route should exist');
  let code=200,body;const res={setHeader(){},status(s){code=s;return this},json(x){body=x;return this}};
  await h({tenantId:1,user},res);return {code,body};
 }
 return {request,queries,get writes(){return writes}};
}
test('readiness scans all four tenant-scoped commission tables without writes',async()=>{
 const x=setup(),r=await x.request();assert.equal(r.code,200);
 assert.equal(r.body.ready,true);assert.equal(r.body.schemaReady,true);
 assert.equal(r.body.providerCalls,0);assert.equal(r.body.migrationExecuted,false);
 assert.equal(x.writes,0);assert.equal(x.queries.length,4);
 for(let i=0;i<4;i++){assert(x.queries[i].sql.includes(names[i]));assert.deepEqual(x.queries[i].params,[1]);}
});
test('missing migrations return explicit not-ready state, no startup DDL',async()=>{
 const x=setup({missing:['sbc_commission_terms_v1','sbc_commission_audit_v1']});
 const r=await x.request();assert.equal(r.code,200);assert.equal(r.body.ready,false);
 assert.deepEqual(r.body.missingTables,['sbc_commission_terms_v1','sbc_commission_audit_v1']);
 assert.equal(x.writes,0);
});
test('database recovery hold denies commission writes even when tables exist',async()=>{
 const r=await setup({recovery:true}).request();assert.equal(r.code,200);
 assert.equal(r.body.schemaReady,true);assert.equal(r.body.writeReady,false);assert.equal(r.body.ready,false);
});
test('owner authentication and DB read errors fail closed without leaking raw SQL',async()=>{
 const denied=await setup().request({id:'mgr',tenantId:1,role:'account_manager',active:true});
 assert.equal(denied.code,403);
 const failure=await setup({unavailable:true}).request();assert.equal(failure.code,503);
 assert.equal(failure.body.code,'SALES_SCHEMA_READ_UNAVAILABLE');
 assert(!JSON.stringify(failure.body).includes('Database read unavailable'));
});
