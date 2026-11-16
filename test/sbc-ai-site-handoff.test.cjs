'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('../enterprise/sbc-ai-site-handoff.cjs');
function fixture(){
 const routes={};
 const app={get:(path,...fns)=>routes['GET '+path]=fns,put:(path,...fns)=>routes['PUT '+path]=fns};
 let data={aiWebsiteProposals:[]};
 const db={customers:[
  {id:11,tenantId:1,businessName:'C & T Auto Motors',industry:'Automotive',city:'Miramar',leadIntelligence:{researchBrief:{notes:'UNVERIFIED PRIVATE RESEARCH'}}},
  {id:22,tenantId:2,businessName:'Other tenant'}]};
 const saveStore=async next=>{data=next;return {ok:true}};
 H.register(app,{auth:()=>{},ownerOnly:()=>{},requireTenant:req=>req.tenantId,db,getStore:()=>data,saveStore,writerReady:()=>true,serializeSiteMutation:work=>work()});
 const call=async(method,id,tenantId=1,body={})=>{
  const handlers=routes[method+' /api/website-production/customers/:id/ai-proposals'];
  assert.equal(handlers.length,3);
  const req={params:{id:String(id)},tenantId,body,user:{id:'owner-1',role:'owner'}};
  const res={statusCode:200,headers:{},status(n){this.statusCode=n;return this},setHeader(k,v){this.headers[k]=v},json(v){this.body=v;return this}};
  await handlers[2](req,res);return res;
 };
 return {call,getData:()=>data};
}
test('creates a three-tier brief without unverified lead research',async()=>{
 const {call}=fixture();
 const r=await call('GET',11);
 assert.equal(r.statusCode,200);
 assert.match(r.body.prompt,/C & T Auto Motors/);
 assert.match(r.body.prompt,/\$199/);
 assert.match(r.body.prompt,/\$499/);
 assert.match(r.body.prompt,/\$799/);
 assert.doesNotMatch(r.body.prompt,/UNVERIFIED PRIVATE RESEARCH/);
});
test('tenant boundary prevents reading another business',async()=>{
 const {call}=fixture();
 assert.equal((await call('GET',22)).statusCode,404);
});
test('saves three separate tiers and rejects stale writes',async()=>{
 const {call,getData}=fixture();
 let r=await call('PUT',11,1,{tier:199,previewUrl:'https://example.com/starter',notes:'one page',expectedRevision:0});
 assert.equal(r.statusCode,200);assert.equal(r.body.revision,1);
 r=await call('PUT',11,1,{tier:499,previewUrl:'https://example.com/custom',notes:'multipage',expectedRevision:1});
 assert.equal(r.body.revision,2);
 r=await call('PUT',11,1,{tier:799,previewUrl:'https://example.com/advanced',notes:'advanced concept only',expectedRevision:2});
 assert.equal(r.body.revision,3);
 assert.equal(Object.keys(getData().aiWebsiteProposals[0].variants).length,3);
 assert.equal((await call('PUT',11,1,{tier:499,previewUrl:'https://other.example.com',expectedRevision:1})).statusCode,409);
});
test('rejects dangerous URLs and unsupported prices',async()=>{
 const {call}=fixture();
 assert.equal((await call('PUT',11,1,{tier:999,previewUrl:'https://example.com',expectedRevision:0})).statusCode,400);
 assert.equal((await call('PUT',11,1,{tier:199,previewUrl:'javascript:alert(1)',expectedRevision:0})).statusCode,400);
 assert.equal((await call('PUT',11,1,{tier:199,previewUrl:'http://localhost/x',expectedRevision:0})).statusCode,400);
});
