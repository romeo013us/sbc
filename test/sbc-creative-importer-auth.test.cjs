'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A=require('../enterprise/sbc-creative-importer-auth.cjs');
const key=crypto.randomBytes(32).toString('base64'),now=Date.parse('2026-11-25T11:00:00Z');
const path=A.PLAN;
function fixture(overrides={}){
 const input={method:'POST',path,body:{},timestamp:String(now),nonce:crypto.randomBytes(16).toString('hex'),...overrides};
 return {...input,signature:A.sign(input,key)};
}
test('valid machine request is scoped and replay is consumed exactly once',async()=>{
 const seen=new Set(),verify=A.createCreativeImporterAuth({getKey:()=>key,clock:()=>now,consume:async nonce=>{if(seen.has(nonce))return false;seen.add(nonce);return true;}});
 const r=fixture();assert.equal(await verify(r),true);await assert.rejects(verify(r),/REPLAY/);
});
test('tampering, wrong routes, expired requests, and absent key reject before nonce writes',async()=>{
 let calls=0;const verify=A.createCreativeImporterAuth({getKey:()=>key,clock:()=>now,consume:async()=>{calls++;return true;}});
 const r=fixture();for(const bad of [{...r,body:{changed:true}},{...r,path:'/api/marketing/content'},{...r,method:'GET'},fixture({timestamp:String(now-301000)}),{...r,signature:'0'.repeat(64)}])await assert.rejects(verify(bad));
 assert.equal(calls,0);
 await assert.rejects(A.createCreativeImporterAuth({getKey:()=>'',clock:()=>now,consume:async()=>true})(r));
});
test('durable nonce store failure never authorizes a request',async()=>{
 await assert.rejects(A.createCreativeImporterAuth({getKey:()=>key,clock:()=>now,consume:async()=>{throw Error('DB unavailable')}})(fixture()));
});
test('Eastern schedule respects both summer and winter offsets',()=>{
 assert.equal(A.isRefillWindow(Date.parse('2026-07-01T10:15:00Z')),true);
 assert.equal(A.isRefillWindow(Date.parse('2026-11-25T11:15:00Z')),true);
 assert.equal(A.isRefillWindow(Date.parse('2026-07-01T11:15:00Z')),false);
 assert.equal(A.isRefillWindow(Date.parse('2026-11-25T10:15:00Z')),false);
});

test('machine routes expose only plan and draft import; writer gate blocks Preview',async()=>{
 const {registerCreativeMachine}=require('../routes/sbc-creative-machine.cjs');
 const routes=new Map(),app={post:(p,...h)=>routes.set(p,h.at(-1))};
 let writer=false,staged=0,consumed=0;
 const pool={query:async()=>{consumed++;return [[]]}};
 const ledgerFactory=()=>({snapshot:async()=>({approved:2,drafts:1,missing:[],assets:[{sha256:'a'.repeat(64),dhash:'b'.repeat(16),caption:'private copy',approved_by:'owner'}]}),stage:async()=>{staged++;return {staged:1}}});
 registerCreativeMachine(app,{corporateTenant:1,getPool:()=>pool,canWrite:()=>writer,getKey:()=>key,clock:()=>now,ledgerFactory,parse:(_q,_s,n)=>n(),limit:(_q,_s,n)=>n()});
 assert.deepEqual([...routes.keys()].sort(),[A.IMPORT,A.PLAN].sort());
 async function invoke(r){
  const req={method:r.method,path:r.path,originalUrl:r.path,body:r.body,headers:{'x-sbc-creative-time':r.timestamp,'x-sbc-creative-nonce':r.nonce,'x-sbc-creative-signature':r.signature}};
  const res={code:200,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};
  await routes.get(r.path)(req,res);return res;
 }
 assert.equal((await invoke(fixture())).code,423);assert.equal(consumed,0);
 writer=true;
 const result=await invoke(fixture());
 assert.equal(result.code,200);assert.equal(result.body.tenantId,1);assert.equal(result.body.approved,2);
 assert.deepEqual(result.body.assets,[{sha256:'a'.repeat(64),dhash:'b'.repeat(16)}]);
 assert.equal(staged,0);
 assert.equal((await invoke(fixture({body:{tenantId:2}}))).code,400);
 assert.equal((await invoke(fixture({path:A.IMPORT,body:{}}))).code,503);
 assert.equal(staged,0);
});
