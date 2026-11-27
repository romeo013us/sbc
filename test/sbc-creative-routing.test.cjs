'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planRender}=require('../enterprise/creative-intelligence/render-policy.cjs');
const now=100000;
const worker=(overrides={})=>({id:'cpu-1',tenantId:7,authorized:true,healthy:true,heartbeatAt:now,engine:'ffmpeg',mode:'cpu',billing:'local',commercialApproved:true,availableSlots:1,...overrides});
const plan=(kind,workers=[],extra={})=>planRender({kind,tenantId:7,workers,now,...extra});
test('vector design is available on a browser without external services',()=>{
 assert.deepEqual(plan('vector-design'),{status:'ready',mode:'browser',engine:'native-svg',workerId:null,paidFallback:false});
});
test('GPU rendering waits rather than silently using a paid API or CPU',()=>{
 assert.equal(plan('ai-video',[worker(),worker({engine:'wan',mode:'gpu',billing:'paid'})]).status,'waiting');
});
test('healthy authorized local GPU is selected for video from any client device',()=>{
 const gpu=worker({id:'gpu-1',engine:'wan',mode:'gpu'});
 assert.deepEqual(plan('ai-video',[gpu]),{status:'ready',mode:'gpu',engine:'wan',workerId:'gpu-1',paidFallback:false});
});
test('tenant boundaries and commercial approval fail closed',()=>{
 const candidates=[worker({tenantId:8}),worker({authorized:false}),worker({commercialApproved:false}),worker({billing:'free-tier'}),worker({healthy:false})];
 assert.equal(plan('template-video',candidates).status,'waiting');
});
test('stale, future and busy workers are not selected',()=>{
 assert.equal(plan('template-video',[worker({heartbeatAt:now-60001}),worker({heartbeatAt:now+1}),worker({availableSlots:0})]).status,'waiting');
});
test('routing is deterministic and prefers greater available capacity',()=>{
 const workers=[worker({id:'b',availableSlots:2}),worker({id:'a',availableSlots:2}),worker({id:'c'})];
 assert.equal(plan('template-video',workers).workerId,'a');
 assert.equal(plan('template-video',workers.reverse()).workerId,'a');
});
test('client input cannot introduce arbitrary engines, URLs or paid fallback',()=>{
 assert.throws(()=>plan('unknown'),/INVALID_CREATIVE_KIND/);
 assert.throws(()=>plan('ai-image',[],{paidFallback:true}),/INVALID_CREATIVE_REQUEST/);
 assert.throws(()=>plan('ai-image',[],{tenantId:0}),/INVALID_CREATIVE_TENANT/);
 assert.equal(plan('ai-image',[worker({engine:'https://example.com',mode:'gpu'})]).status,'waiting');
});
test('audio and captions require separately approved compatible workers',()=>{
 assert.equal(plan('narration',[worker({engine:'kokoro'})]).engine,'kokoro');
 assert.equal(plan('captions',[worker({engine:'whisper.cpp'})]).engine,'whisper.cpp');
 assert.equal(plan('captions',[worker({engine:'kokoro'})]).status,'waiting');
});
