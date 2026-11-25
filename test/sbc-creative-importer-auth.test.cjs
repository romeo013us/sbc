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
