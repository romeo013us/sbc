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

test('client refuses insecure or redirected origins and signs each request',async()=>{
 const C=require('../scripts/sbc-autonomous-refill-sync.cjs');
 assert.throws(()=>C.endpoint('http://example.invalid',A.PLAN),/HTTPS/);
 assert.throws(()=>C.endpoint('https://example.invalid/extra',A.PLAN),/HTTPS/);
 const seen=new Set();
 const check=A.createCreativeImporterAuth({getKey:()=>key,consume:async n=>{if(seen.has(n))return false;seen.add(n);return true;}});
 const fetcher=async(url,o)=>{
  assert.equal(url.origin,'https://example.invalid');assert.equal(o.redirect,'error');
  await check({method:o.method,path:url.pathname,body:JSON.parse(o.body),timestamp:o.headers['x-sbc-creative-time'],nonce:o.headers['x-sbc-creative-nonce'],signature:o.headers['x-sbc-creative-signature']});
  return {ok:true,json:async()=>({ok:true,tenantId:1,approved:5,missing:[],assets:[]})};
 };
 const result=await C.sync({origin:'https://example.invalid',key,fetcher,render:()=>{throw Error('unnecessary rendering')}});
 assert.deepEqual(result,{staged:0,approved:5,low:true,productionCertified:false});
 assert.equal(seen.size,1);
});
test('machine import validates signed drafts and never grants an owner or publisher role',async t=>{
 const express=require('express');
 const {registerCreativeMachine}=require('../routes/sbc-creative-machine.cjs');
 const {createBundle}=require('../enterprise/sbc-social-creative-bundle.cjs');
 const {slots}=require('../enterprise/sbc-social-asset-engine.cjs');
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
 const app=express(),seen=new Set();let writes=0;
 const pool={query:async(sql,p)=>{if(sql.startsWith('INSERT')){if(seen.has(p[1]))throw Object.assign(Error(),{code:'ER_DUP_ENTRY'});seen.add(p[1]);}return [[]];}};
 const ledgerFactory=options=>({stage:async(actor,rows)=>{
  assert.equal(actor.id,'creative_replenisher');assert.equal(actor.role,'system');
  assert.equal(rows[0].state,'DRAFT');
  assert.equal(options.verifyPng(rows[0].png).dhash,rows[0].dhash);
  writes++;return {staged:rows.length};
 }});
 registerCreativeMachine(app,{corporateTenant:1,getPool:()=>pool,canWrite:()=>true,getKey:()=>key,getSigningKey:()=>publicKey,clock:()=>now,ledgerFactory});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const png=Buffer.alloc(64);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(1080,16);png.writeUInt32BE(1080,20);
 const row={...slots('2026-11-25')[0],png,sha256:crypto.createHash('sha256').update(png).digest('hex'),dhash:'0123456789abcdef',width:1080,height:1080,service:'Websites',caption:'Fixture only'};
 const bundle=createBundle([row],{tenantId:1,privateKey,now});
 const r=fixture({path:A.IMPORT,body:bundle});
 const send=()=>fetch('http://127.0.0.1:'+server.address().port+A.IMPORT,{method:'POST',headers:{'Content-Type':'application/json','x-sbc-creative-time':r.timestamp,'x-sbc-creative-nonce':r.nonce,'x-sbc-creative-signature':r.signature},body:JSON.stringify(r.body)});
 assert.equal((await send()).status,200);assert.equal(writes,1);
 assert.equal((await send()).status,409);assert.equal(writes,1);
});
