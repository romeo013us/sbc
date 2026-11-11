'use strict';
/* Regression for legacy Smart Bulk Ingest, independent of production CRM/provider.
 * Test first (RED): malformed later CSV row MUST reject before ANY insert.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const register=require('../routes/v56131-revenue-finisher.js');
function harness(){
 const routes=new Map(),calls={mysql:0,save:0,assist:0,activity:0};
 const db={customers:[]};
 const ctx={writerReady:true,db,mysqlPool:{query:async()=>{calls.mysql++;return [[]]}},
  saveData:async()=>{calls.save++},
  enqueueLeadAssist:()=>{calls.assist++},
  addActivity:()=>{calls.activity++},
  sqlDateTime:v=>v};
 const app={post:(url,...handlers)=>routes.set(url,handlers.at(-1)),get:()=>{}};
 register(app,{auth:()=>{},ownerOnly:()=>{},getContext:()=>ctx});
 const csv=(rows)=>Buffer.from(['Business Name,Contact Name,Phone,Email,Notes',...rows].join('\n')+'\n','utf8').toString('base64');
 async function submit(route,rows){
  const request={user:{role:'lead_researcher',id:'synthetic-lorna'},tenantId:1,
   body:{filename:'synthetic.csv',batchId:'SYNTHETIC-1',contentBase64:csv(rows)}};
  const response={statusCode:200,jsonBody:null,
   status(n){this.statusCode=n;return this},json(body){this.jsonBody=body;return this}};
  await routes.get(route)(request,response);
  return response;
 }
 return {calls,db,submit};
}
test('preview reports a corrupted identity field without saving the CSV',async()=>{
 const h=harness();
 const r=await h.submit('/api/v56131/leads/bulk-preview',[
  'Café Niña,María,+13055550011,valid@example.test,New local owner',
  'Broken\u0001 Business,Owner,+13055550022,bad@example.test,Research only']);
 assert.equal(r.statusCode,200);
 assert.equal(r.jsonBody.ok,true);
 assert.equal(r.jsonBody.readyToIngest,false,'invalid batch must visibly block import');
 assert.deepEqual(r.jsonBody.invalidRows,[{row:2,fields:['businessName']}]);
 assert.deepEqual(h.calls,{mysql:0,save:0,assist:0,activity:0});
});
test('ingest rejects entire batch if later row is corrupt, with no partial MySQL writes',async()=>{
 const h=harness();
 const before=global.__SBC_REQUIRE_TENANT;
 global.__SBC_REQUIRE_TENANT=req=>req.tenantId;
 try{
  const r=await h.submit('/api/v56131/leads/bulk-ingest',[
   'Good Barber,Owner,+13055550033,hello@example.test,Verified source pending',
   'PK\u0003\u0004,Owner,+13055550044,broken@example.test,Binary data']);
  assert.equal(r.statusCode,422);
  assert.equal(r.jsonBody.code,'CORRUPT_CRM_TEXT_REJECTED');
  assert.equal(r.jsonBody.noLeadsWritten,true);
  assert.equal(r.jsonBody.readyToIngest,false);
  assert.deepEqual(r.jsonBody.invalidRows,[{row:2,fields:['businessName']}]);
  assert.deepEqual(h.calls,{mysql:0,save:0,assist:0,activity:0},'no partial writes, no Lead Assist side effects');
  assert.equal(h.db.customers.length,0);
 }finally{global.__SBC_REQUIRE_TENANT=before}
});
test('clean Unicode names still import and remain unverified pending research',async()=>{
 const h=harness();
 const before=global.__SBC_REQUIRE_TENANT;
 global.__SBC_REQUIRE_TENANT=req=>req.tenantId;
 try{
  const r=await h.submit('/api/v56131/leads/bulk-ingest',[
   'Café Niña,María,+13055550055,valid@example.test,Research not verified']);
  assert.equal(r.statusCode,201,JSON.stringify(r.jsonBody));
  assert.equal(r.jsonBody.added,1);
  assert.equal(h.db.customers[0].businessName,'Café Niña');
  assert.equal(h.db.customers[0].leadIntelligence.verificationStatus,'Unverified');
  assert.deepEqual(h.calls,{mysql:1,save:1,assist:1,activity:1});
 }finally{global.__SBC_REQUIRE_TENANT=before}
});
