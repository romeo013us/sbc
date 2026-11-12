'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const register=require('../routes/v56131-revenue-finisher.js');
const customers=[
 {id:'ours',tenantId:1,businessName:'Our Company',phone:'3055550101'},
 {id:'ours-sql',tenant_id:1,businessName:'Our SQL Company'},
 {id:'other',tenantId:2,businessName:'Private Other Company',email:'private@example.test'},
 {id:'unscoped',businessName:'Legacy Unscoped Company'}
];
function harness(){
 const handlers=new Map();let writes=0;
 register({get:(p,...h)=>handlers.set(p,h.at(-1)),post:(p,...h)=>handlers.set(p,h.at(-1))},{
  auth(){},ownerOnly(){},getContext:()=>({writerReady:true,db:{customers:[...customers]},
   mysqlPool:{query:async()=>{writes++;return [[]]}},saveData:async()=>{writes++}})
 });
 return {writes:()=>writes,async run(path,tenantId,role='owner'){
  let status=200,body;const headers={};
  const res={setHeader:(k,v)=>{headers[k]=v},status(n){status=n;return this},json(x){body=x;return this}};
  await handlers.get(path)({tenantId,user:{role},body:{filename:'leads.csv',contentBase64:Buffer.from('Business Name,Phone\nNew Company,3055550111\n').toString('base64')}},res);
  return {status,body,headers};
 }};
}
test('radar isolates records and aggregate counts by authenticated tenant',async()=>{
 const previous=global.__SBC_REQUIRE_TENANT;
 global.__SBC_REQUIRE_TENANT=req=>req.tenantId;
 try{
  const h=harness();const r=await h.run('/api/v56131/revenue/radar',1);
  assert.equal(r.status,200);
  assert.deepEqual(r.body.top.map(x=>x.id).sort(),['ours','ours-sql']);
  assert.equal(r.body.total,2);
  assert.equal(r.body.hot+r.body.warm+r.body.nurture,2);
  assert.equal(r.headers['Cache-Control'],'no-store');
  const other=await h.run('/api/v56131/revenue/radar',2);
  assert.deepEqual(other.body.top.map(x=>x.id),['other']);
  assert.equal(h.writes(),0);
 }finally{global.__SBC_REQUIRE_TENANT=previous}
});
test('invalid tenant cannot read radar or write import records',async()=>{
 const previous=global.__SBC_REQUIRE_TENANT;
 global.__SBC_REQUIRE_TENANT=req=>req.tenantId;
 try{
  for(const tenant of [undefined,null,0,-1,1.5,'bad',Infinity]){
   const h=harness();
   for(const route of ['/api/v56131/revenue/radar','/api/v56131/leads/bulk-ingest']){
    const r=await h.run(route,tenant);
    assert.equal(r.status,403,`${route}: ${tenant}`);
    assert.equal(r.body.code,'TENANT_REQUIRED');
    assert.equal(r.body.top,undefined);
   }
   assert.equal(h.writes(),0);
  }
 }finally{global.__SBC_REQUIRE_TENANT=previous}
});
test('research and caller accounts cannot access owner revenue radar',async()=>{
 const h=harness();
 for(const role of ['lead_researcher','caller'])assert.equal((await h.run('/api/v56131/revenue/radar',1,role)).status,403);
});

test('missing tenant resolver fails closed without writes or exposed rows',async()=>{
 const previous=global.__SBC_REQUIRE_TENANT;
 delete global.__SBC_REQUIRE_TENANT;
 try{
  const h=harness();
  for(const route of ['/api/v56131/revenue/radar','/api/v56131/leads/bulk-ingest']){
   const r=await h.run(route,1);
   assert.equal(r.status,403);assert.equal(r.body.code,'TENANT_REQUIRED');
  }
  assert.equal(h.writes(),0);
 }finally{global.__SBC_REQUIRE_TENANT=previous}
});
