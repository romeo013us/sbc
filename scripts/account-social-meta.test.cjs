'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createMetaProvider}=require('../enterprise/sbc-account-social-meta.cjs');
const channel={id:'ch1',tenantId:1,customerId:'c1',platform:'facebook',providerAccountId:'PAGE_22',secretRef:'vault:sbc/1/c1/fb',status:'VERIFIED'};
const post={id:'p1',tenantId:1,customerId:'c1',channelId:'ch1',platform:'facebook',body:'Only approved marketing content',approvedAt:'2026-11-13T18:00:00Z',ctaUrl:'https://sbcmia.com'};
function fake(body,ok=true,status=200){return {ok,status,json:async()=>body}}
test('Meta verification checks EXACT provider identity with account-scoped vault lookup',async()=>{
 let requested;const meta=createMetaProvider({resolveSecret:async p=>(requested=p,'long_secret_page_token'),fetchImpl:async()=>fake({id:'PAGE_22'})});
 assert.deepEqual(await meta.verify({tenantId:1,customerId:'c1',platform:'facebook',providerAccountId:'PAGE_22',secretRef:'vault:fb'}),{verified:true,providerAccountId:'PAGE_22'});
 assert.equal(requested.customerId,'c1');assert.equal(requested.secretRef,'vault:fb');
});
test('Facebook publishes to the customer page only and keeps bearer token off URL',async()=>{
 const calls=[];const meta=createMetaProvider({resolveSecret:async()=> 'long_secret_page_token',fetchImpl:async(url,opts)=>(calls.push({url,opts}),fake({id:'PAGE_22_100'}))});
 const out=await meta.publish({tenantId:1,customerId:'c1',channel,post});assert.equal(out.id,'PAGE_22_100');
 assert.equal(calls.length,1);assert.match(calls[0].url,/PAGE_22\/feed/);assert(!calls[0].url.includes('long_secret'));
 assert.equal(calls[0].opts.body.get('message'),post.body);assert.equal(calls[0].opts.headers.Authorization,'Bearer long_secret_page_token');
});
test('Instagram publishes only after image container reports FINISHED',async()=>{
 const requests=[];const igch={...channel,platform:'instagram',providerAccountId:'IG_22'};
 const igpost={...post,platform:'instagram',mediaUrl:'https://example.org/approved.jpg'};
 const meta=createMetaProvider({resolveSecret:async()=> 'long_secret_page_token',sleep:async()=>{},fetchImpl:async url=>{
  requests.push(url);if(url.includes('/media_publish'))return fake({id:'IG_POST_2'});
  if(url.includes('/media'))return fake({id:'CONTAINER_1'});
  if(url.includes('CONTAINER_1'))return fake({status_code:requests.filter(s=>s.includes('CONTAINER_1')).length===1?'IN_PROGRESS':'FINISHED'});
  throw Error('unexpected API path');}});
 const out=await meta.publish({tenantId:1,customerId:'c1',channel:igch,post:igpost});assert.equal(out.id,'IG_POST_2');assert.equal(requests.filter(x=>x.includes('CONTAINER_1')).length,2);
});
test('provider rejects account substitution before any secret lookup or network call',async()=>{
 let calls=0;const meta=createMetaProvider({resolveSecret:async()=>(calls++,'long_secret_page_token'),fetchImpl:async()=>{calls++;return fake({id:'irrelevant'})}});
 await assert.rejects(meta.publish({tenantId:1,customerId:'c2',channel,post}),/META_CHANNEL_POST_MISMATCH/);assert.equal(calls,0);
});
test('provider never retries a failed publishing HTTP request',async()=>{
 let calls=0;const meta=createMetaProvider({resolveSecret:async()=> 'long_secret_page_token',fetchImpl:async()=>(calls++,fake({error:{message:'Forbidden'}},false,403))});
 await assert.rejects(meta.publish({tenantId:1,customerId:'c1',channel,post}),/META_HTTP_403/);assert.equal(calls,1);
});
