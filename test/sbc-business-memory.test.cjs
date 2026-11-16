'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {register,DEFAULT_PROFILE,validate}=require('../enterprise/sbc-business-memory.cjs');
const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
const focus=fs.readFileSync(path.join(ROOT,'public/sbc-command-center-focus-v1.js'),'utf8');
const routes=fs.readFileSync(path.join(ROOT,'enterprise/sbc-website-production-routes.cjs'),'utf8');
const ui=fs.readFileSync(path.join(ROOT,'public/sbc-chatgpt-os-v1.js'),'utf8');
test('owner business-memory UI and route registered in primary Command Center',()=>{
 assert.match(html,/sbc-command-center-focus-v1\.js/);
 assert.match(focus,/sbc-chatgpt-os-v1\.js/);assert.match(focus,/sbc-chatgpt-os-v1\.css/);
 assert.match(routes,/SbcBusinessMemory\.register\(app,/);
 assert.match(ui,/api\/owner\/business-memory/);assert.match(ui,/sbc-chatgpt-os-include-memory/);
});
test('curated company profile has all six prices, systems, Kim and Kevin, but no personal health or credentials',()=>{
 assert.match(DEFAULT_PROFILE,/Successful By Choice/);
 for(const x of ['$99','$199','$499','$899','$1,499','$2,499','Office Box','Kim','Kevin'])assert.ok(DEFAULT_PROFILE.includes(x),x);
 assert.doesNotMatch(DEFAULT_PROFILE,/blood pressure|SSN|SBC_API_SECRET\s*=|PASSWORD\s*=/i);
});
test('credentials, oversized updates and unapproved memory saves are rejected',()=>{
 assert.equal(validate({expectedRevision:0,approved:true,content:'password=supersecret'}),null);
 assert.equal(validate({expectedRevision:0,approved:true,content:'sk-live-abcdefabcdefabcdef'}),null);
 assert.equal(validate({expectedRevision:0,approved:true,content:'a'.repeat(11000)}),null);
 assert.equal(validate({expectedRevision:0,approved:false,content:DEFAULT_PROFILE}),null);
 assert.ok(validate({expectedRevision:0,approved:true,content:DEFAULT_PROFILE}));
});
function harness({writer=true,saveOk=true}={}){
 let store={},saves=0,queue=Promise.resolve();const handlers={};
 const app={get:(p,...h)=>handlers['GET '+p]=h,put:(p,...h)=>handlers['PUT '+p]=h};
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false});
 const serial=job=>{const p=queue.then(job);queue=p.catch(()=>{});return p};
 register(app,{auth,ownerOnly,requireTenant:req=>req.user?.tenantId,getStore:()=>store,saveStore:async s=>{saves++;if(saveOk)store=s;return {ok:saveOk}},writerReady:()=>writer,serializeSiteMutation:serial});
 async function request(method,body,user={role:'owner',id:'ownerA',tenantId:1}){
  const chain=handlers[method+' /api/owner/business-memory'];assert.ok(chain);
  const req={body,user},res={statusCode:200,status(n){this.statusCode=n;return this},json(x){this.body=x;return this},setHeader(){}};
  for(let i=0;i<chain.length;i++){let next=false;await chain[i](req,res,()=>{next=true});if(i<chain.length-1&&!next)break}
  return res;
 }
 return {request,saves:()=>saves,store:()=>store};
}
test('approved owner memory supports revision locking, durable writes and history',async()=>{
 const h=harness(),start=await h.request('GET');assert.equal(start.body.profile.revision,0);assert.equal(h.saves(),0);
 const wrote=await h.request('PUT',{expectedRevision:0,approved:true,content:DEFAULT_PROFILE+'\nOwner note.'});
 assert.equal(wrote.statusCode,200);assert.equal(wrote.body.profile.revision,1);assert.equal(h.saves(),1);
 assert.equal((await h.request('PUT',{expectedRevision:0,approved:true,content:DEFAULT_PROFILE})).statusCode,409);
 const updated=await h.request('PUT',{expectedRevision:1,approved:true,content:DEFAULT_PROFILE+'\nNew owner note.'});
 assert.equal(updated.statusCode,200);assert.equal(updated.body.profile.revision,2);
 const read=await h.request('GET');assert.equal(read.body.revisions[0].revision,1);
});
test('owner and tenant boundaries, writer lock and save failures are fail-closed',async()=>{
 const h=harness();assert.equal((await h.request('PUT',{expectedRevision:0,approved:true,content:DEFAULT_PROFILE})).statusCode,200);
 assert.equal((await h.request('GET',{}, {role:'owner',id:'other',tenantId:1})).body.profile.revision,0);
 assert.equal((await h.request('GET',{}, {role:'owner',id:'ownerA',tenantId:2})).body.profile.revision,0);
 assert.equal((await h.request('GET',{}, {role:'sales',id:'staff',tenantId:1})).statusCode,403);
 assert.equal((await h.request('GET',{},null)).statusCode,401);
 const locked=harness({writer:false});assert.equal((await locked.request('PUT',{expectedRevision:0,approved:true,content:DEFAULT_PROFILE})).statusCode,423);
 const failed=harness({saveOk:false});assert.equal((await failed.request('PUT',{expectedRevision:0,approved:true,content:DEFAULT_PROFILE})).statusCode,503);
 assert.equal(failed.store().sbcBusinessKnowledgeProfiles,undefined);
});
