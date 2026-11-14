'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService,createMemoryRepository}=require('../enterprise/sbc-account-social-core.cjs');
const now=()=>new Date('2026-11-13T18:00:00Z');
const owner={tenantId:1,id:'owner',role:'owner'};
const alice={tenantId:1,id:'alice',role:'account_manager'};
const bob={tenantId:1,id:'bob',role:'account_manager'};
const rogue={tenantId:2,id:'alice',role:'account_manager'};
const publisher={verify:async({providerAccountId})=>({verified:true,providerAccountId}),publish:async({post})=>({id:'meta-'+post.id})};
function fixture(overrides={}){
 const repo=createMemoryRepository({customers:[{tenantId:1,id:'c1',businessName:'Alfa Salon',status:'Lead',phone:'305-555-0100'},{tenantId:1,id:'c2',businessName:'Beta Plumbing',status:'Customer'},{tenantId:2,id:'c1',businessName:'Other tenant'}],users:[{tenantId:1,id:'alice',role:'account_manager',active:true},{tenantId:1,id:'bob',role:'account_manager',active:true},{tenantId:2,id:'alice',role:'account_manager',active:true}]});
 const service=createService({repository:repo,provider:overrides.provider||publisher,clock:now, publishingEnabled:overrides.publishingEnabled??true, writerReady:overrides.writerReady||(()=>true)});
 return {repo,service};
}
async function assigned(f){await f.service.assign(owner,{customerId:'c1',managerId:'alice'});return f;}
async function approved(f,{platform='facebook',customerId='c1',who=alice}={}){
 const ch=await f.service.connectChannel(owner,{customerId,platform,providerAccountId:'PAGE_001',secretRef:'vault:sbc/1/c1/facebook'});
 await f.service.verifyChannel(owner,ch.id);
 const post=await f.service.draftPost(who,{channelId:ch.id,body:'New offer for our clients!',mediaUrl:platform==='instagram'?'https://example.com/post.jpg':''});
 await f.service.submitPost(who,post.id);
 await f.service.approvePost(owner,post.id);
 await f.service.schedulePost(owner,post.id,'2026-11-13T19:00:00Z');
 return {ch,post};
}
test('CRM account is linked, not copied; only owner can assign an active account manager',async()=>{
 const f=fixture();let a=await f.service.assign(owner,{customerId:'c1',managerId:'alice'});
 assert.equal(a.customerId,'c1');assert.equal(a.managerId,'alice');
 assert.equal((await f.service.portfolio(alice)).accounts[0].businessName,'Alfa Salon');
 await assert.rejects(f.service.assign(alice,{customerId:'c2',managerId:'alice'}),/OWNER_REQUIRED/);
 await assert.rejects(f.service.assign(owner,{customerId:'missing',managerId:'bob'}),/CUSTOMER_NOT_FOUND/);
 await assert.rejects(f.service.assign(owner,{customerId:'c1',managerId:'nonexistent'}),/MANAGER_INVALID/);
 assert.equal((await f.service.portfolio(bob)).accounts.length,0);
});
test('cross-tenant and unassigned-manager account access fails closed',async()=>{
 const f=await assigned(fixture());
 assert.equal((await f.service.portfolio(rogue)).accounts.length,0);
 await assert.rejects(f.service.logInteraction(rogue,{customerId:'c1',kind:'call',summary:'test'}),/ACCOUNT_ACCESS_DENIED/);
 await assert.rejects(f.service.logInteraction(bob,{customerId:'c1',kind:'call',summary:'test'}),/ACCOUNT_ACCESS_DENIED/);
 await assert.rejects(f.service.connectChannel(rogue,{customerId:'c1',platform:'facebook',providerAccountId:'x',secretRef:'vault:x'}),/OWNER_REQUIRED/);
});
test('manager handoff preserves account history and restricts former manager',async()=>{
 const f=await assigned(fixture());await f.service.logInteraction(alice,{customerId:'c1',kind:'call',summary:'Needs a domain renewal'});
 await f.service.assign(owner,{customerId:'c1',managerId:'bob'});
 assert.equal((await f.service.portfolio(alice)).accounts.length,0);
 const p=await f.service.portfolio(bob);assert.equal(p.accounts.length,1);assert.equal(p.accounts[0].timeline[0].summary,'Needs a domain renewal');
 assert.equal(p.accounts[0].managerId,'bob');
 await assert.rejects(f.service.logInteraction(alice,{customerId:'c1',kind:'call',summary:'nope'}),/ACCOUNT_ACCESS_DENIED/);
});
test('social channels require owner, secret reference and provider identity verification',async()=>{
 const f=await assigned(fixture());
 await assert.rejects(f.service.connectChannel(owner,{customerId:'c1',platform:'facebook',providerAccountId:'page',secretRef:'EAA_REAL_TOKEN'}),/SECRET_REFERENCE_REQUIRED/);
 await assert.rejects(f.service.connectChannel(alice,{customerId:'c1',platform:'facebook',providerAccountId:'page',secretRef:'vault:a'}),/OWNER_REQUIRED/);
 const ch=await f.service.connectChannel(owner,{customerId:'c1',platform:'instagram',providerAccountId:'IG_234',secretRef:'vault:sbc/ig'});
 assert.equal(ch.status,'UNVERIFIED');assert(!JSON.stringify(ch).includes('EAA'));
 const result=await f.service.verifyChannel(owner,ch.id);assert.equal(result.status,'VERIFIED');
});
test('wrong external account identity is never permitted to publish',async()=>{
 const f=fixture({provider:{verify:async()=>({verified:true,providerAccountId:'WRONG'}),publish:publisher.publish}});
 const ch=await f.service.connectChannel(owner,{customerId:'c1',platform:'facebook',providerAccountId:'RIGHT',secretRef:'vault:right'});
 await assert.rejects(f.service.verifyChannel(owner,ch.id),/PROVIDER_ID_MISMATCH/);
});
test('client account and SBC own brand can have separate channels, posts, and no token exposure',async()=>{
 const f=await assigned(fixture());
 const c1=await f.service.connectChannel(owner,{customerId:'c1',platform:'facebook',providerAccountId:'ACME_PAGE',secretRef:'vault:acme'});
 const c2=await f.service.connectChannel(owner,{customerId:'c2',platform:'facebook',providerAccountId:'SBC_PAGE',secretRef:'vault:sbc'});
 assert.notEqual(c1.id,c2.id);
 assert.equal((await f.service.channels(owner,'c1')).length,1);
 assert.equal((await f.service.channels(owner,'c2'))[0].providerAccountId,'SBC_PAGE');
 assert(!JSON.stringify(await f.service.channels(owner,'c1')).includes('vault:acme'));
});
test('manager drafts but only owner approves; scheduling requires approved and verified channel',async()=>{
 const f=await assigned(fixture());
 const ch=await f.service.connectChannel(owner,{customerId:'c1',platform:'facebook',providerAccountId:'PAGE',secretRef:'vault:page'});
 let p=await f.service.draftPost(alice,{channelId:ch.id,body:'Hello world'});
 await assert.rejects(f.service.approvePost(alice,p.id),/OWNER_REQUIRED/);
 await assert.rejects(f.service.schedulePost(owner,p.id,'2026-11-13T19:00:00Z'),/INVALID_POST_TRANSITION/);
 await f.service.submitPost(alice,p.id);await f.service.approvePost(owner,p.id);
 await assert.rejects(f.service.schedulePost(owner,p.id,'2026-11-13T19:00:00Z'),/CHANNEL_NOT_VERIFIED/);
 await f.service.verifyChannel(owner,ch.id);
 const scheduled=await f.service.schedulePost(owner,p.id,'2026-11-13T19:00:00Z');assert.equal(scheduled.status,'SCHEDULED');
});
test('scheduled content never publishes before due time; posting requires active writer and explicit enable',async()=>{
 let sent=0;const counted={...publisher,publish:async x=>(sent++,publisher.publish(x))};
 const f=await assigned(fixture({provider:counted}));await approved(f);
 assert.equal((await f.service.publishDue({tenantId:1,role:'system',id:'worker'})).processed,0);
 assert.equal(sent,0);
 const disabled=await assigned(fixture({publishingEnabled:false,provider:counted}));await approved(disabled);
 await assert.rejects(disabled.service.publishDue({tenantId:1,role:'system',id:'worker'},{at:'2026-11-13T20:00:00Z'}),/PUBLISHING_DISABLED/);
 const cold=await assigned(fixture({writerReady:()=>false,provider:counted}));await approved(cold);
 await assert.rejects(cold.service.publishDue({tenantId:1,role:'system',id:'worker'},{at:'2026-11-13T20:00:00Z'}),/WRITER_NOT_READY/);
 assert.equal(sent,0);
});
test('at-most-once local claim and no automatic retries after an ambiguous provider response',async()=>{
 let calls=0;const f=await assigned(fixture({provider:{verify:publisher.verify,publish:async()=>{calls++;throw Error('timeout after provider may have accepted');}}}));
 const {post}=await approved(f);
 const actor={tenantId:1,role:'system',id:'worker'};
 const outcomes=await Promise.all([f.service.publishDue(actor,{at:'2026-11-13T20:00:00Z'}),f.service.publishDue(actor,{at:'2026-11-13T20:00:00Z'})]);
 assert.equal(calls,1);assert.equal(outcomes.reduce((n,x)=>n+x.processed,0),1);
 assert.equal((await f.service.getPost(owner,post.id)).status,'NEEDS_RECONCILIATION');
 await f.service.publishDue(actor,{at:'2026-11-14T20:00:00Z'});assert.equal(calls,1);
});
test('success is recorded once, all outbound content is approved and audit trail is append-only',async()=>{
 let calls=0;const f=await assigned(fixture({provider:{verify:publisher.verify,publish:async payload=>(calls++,publisher.publish(payload))}}));
 const {post}=await approved(f,{platform:'instagram'});
 const r=await f.service.publishDue({tenantId:1,role:'system',id:'worker'},{at:'2026-11-13T20:00:00Z'});
 assert.equal(r.processed,1);assert.equal(calls,1);
 assert.equal((await f.service.getPost(owner,post.id)).status,'PUBLISHED');
 assert.equal((await f.service.getPost(owner,post.id)).remoteId,'meta-'+post.id);
 assert.equal(f.repo.audit.some(x=>x.action==='SOCIAL_PUBLISHED'),true);
 await f.service.publishDue({tenantId:1,role:'system',id:'worker'},{at:'2026-11-14T20:00:00Z'});assert.equal(calls,1);
});
test('Instagram requires public HTTPS image, input must be well formed, DNC history is retained',async()=>{
 const f=await assigned(fixture());
 const ch=await f.service.connectChannel(owner,{customerId:'c1',platform:'instagram',providerAccountId:'IG_1',secretRef:'vault:ig1'});
 await assert.rejects(f.service.draftPost(alice,{channelId:ch.id,body:'hello'}),/INSTAGRAM_HTTPS_MEDIA_REQUIRED/);
 await assert.rejects(f.service.draftPost(alice,{channelId:ch.id,body:'hello',mediaUrl:'http://localhost/img'}),/INSTAGRAM_HTTPS_MEDIA_REQUIRED/);
 await f.service.logInteraction(alice,{customerId:'c1',kind:'do_not_contact',summary:'Contact requested no further outreach'});
 assert.equal((await f.service.portfolio(alice)).accounts[0].doNotContact,true);
});

test('deactivated manager loses access even if legacy assignment still points to that worker',async()=>{
 const r=createMemoryRepository({customers:[{tenantId:1,id:'c1',businessName:'Private Account'}],users:[{tenantId:1,id:'alice',role:'account_manager',active:true}]});
 const f=createService({repository:r,provider:publisher,clock:now});
 await f.assign(owner,{customerId:'c1',managerId:'alice'});
 assert.equal((await f.portfolio(alice)).accounts.length,1);
 r.disableWorker(1,'alice');
 assert.equal((await f.portfolio(alice)).accounts.length,0);
 await assert.rejects(f.logInteraction(alice,{customerId:'c1',kind:'note',summary:'should fail'}),/ACCOUNT_ACCESS_DENIED/);
});
test('manager social content is visible only for assigned customers and owner can review it',async()=>{
 const f=fixture();await f.service.assign(owner,{customerId:'c1',managerId:'alice'});
 const ch=await f.service.connectChannel(owner,{customerId:'c1',platform:'facebook',providerAccountId:'PAGE_100',secretRef:'vault:sbc/1/c1/facebook'});
 const post=await f.service.draftPost(alice,{channelId:ch.id,body:'Quality post awaiting review'});
 const own=await f.service.posts(alice,'c1');assert.equal(own.length,1);assert.equal(own[0].id,post.id);
 assert.equal((await f.service.posts(owner,'c1')).length,1);
 await assert.rejects(f.service.posts(bob,'c1'),/ACCOUNT_ACCESS_DENIED/);
 await assert.rejects(f.service.posts(alice,'c2'),/ACCOUNT_ACCESS_DENIED/);
});
