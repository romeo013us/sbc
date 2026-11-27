'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../enterprise/sbc-campaign-core.cjs');
const {configuration,createWorker}=require('../enterprise/sbc-campaign-worker.cjs');
const {createGateway}=require('../enterprise/sbc-campaign-gateway.cjs');
const {createStore}=require('../enterprise/sbc-campaign-store.cjs');
const {reconcileChannel,CHANNELS}=require('../enterprise/sbc-marketing-readback.cjs');
const at=C.ANCHOR;
test('owner cadence across midnight, launch day, historical reports and DST',()=>{
 assert.equal(C.daySlots('2026-11-26').length,0);
 assert.deepEqual(C.daySlots('2026-11-27').map(s=>s.slot),['13','17','21']);
 assert.deepEqual(C.daySlots('2026-11-28').map(s=>s.slot),['01','05','09','13','17','21']);
 const slots=[...C.daySlots('2027-03-13'),...C.daySlots('2027-03-14'),...C.daySlots('2027-03-15')];
 assert(slots.slice(1).every((s,i)=>s.at-slots[i].at===C.INTERVAL));
 assert.equal(configuration('wrong').mode,'invalid');
 assert.equal(configuration('').mode,'external');
 assert.equal(configuration(new Date(at).toISOString()).mode,'native');
});
test('tracked links, approved media and distinct platform rotation',()=>{
 const plan=Array.from({length:6},(_,i)=>C.channels.map(p=>C.buildSlot(at+C.INTERVAL*i,p,C.evergreen))).flat();
 assert.equal(new Set(plan.map(s=>s.url)).size,24);
 assert.equal(new Set(plan.slice(0,4).map(s=>s.body)).size,4);
 assert(plan.every(s=>new URL(s.url).hostname==='sbcmia.com'&&C.approvedImages.includes(s.image)));
 assert.throws(()=>C.validateCampaign({...C.evergreen[0],image:'https://other.example/a.jpg'}));
});
test('text receipts count after mandate while unpublished Facebook and processing Google remain inconclusive',()=>{
 const now=at+1000,when=new Date(at).toISOString(),day='2026-11-27';
 const fb={account_id:CHANNELS.facebook.account,post_id:CHANNELS.facebook.account+'_12',permalink_url:'https://facebook.com/post/12',post_created_time:when,is_published:true};
 const google={account_id:CHANNELS.google.account,post_id:'accounts/1/'+CHANNELS.google.account+'/localPosts/12',post_search_url:'https://local.google.com/post/12',post_create_time:when,post_state:'LIVE'};
 for(const [p,row,invalid] of [['facebook',fb,{is_published:false}],['google',google,{post_state:'PROCESSING'}]]){
   assert.equal(reconcileChannel(p,{data:[row]},day,now).receipts.length,1);
   assert.equal(reconcileChannel(p,{data:[{...row,...invalid}]},day,now).receipts.length,0);
 }
});
test('LinkedIn uses provider response ID, reconciles the exact organization and tracked post',async()=>{
 const slot=C.buildSlot(at,'linkedin',C.evergreen),id='urn:li:share:123';
 const projected={id,author:'urn:li:organization:146995513',lifecycleState:'PUBLISHED',commentary:slot.body+' '+slot.url};
 const request=async(url,opts)=>{
   assert.equal(opts.redirect,'error');
   if(url.includes('/organizations/'))return Response.json({id:146995513});
   if(opts.method==='POST'){assert.equal(JSON.parse(opts.body).author,projected.author);return new Response(null,{status:201,headers:{'x-restli-id':id}});}
   if(url.includes('?'))return Response.json({elements:[projected]});
   return Response.json(projected);
 };
 const provider=createGateway({secret:async k=>({LINKEDIN_ORGANIZATION_ID:'146995513',LINKEDIN_API_VERSION:'202606',LINKEDIN_ACCESS_TOKEN:'fixture'}[k]),request});
 const p=await provider.connect('linkedin');
 assert.equal(await provider.publish(slot,p),id);
 assert.equal(await provider.discover(slot,p),id);
 assert(await provider.verify(slot,p,id));
 assert.equal(await provider.verify({...slot,link:slot.link+'x'},p,id),false);
});
test('attribution excludes pre-touch purchases, cross-tenant inquiries, QA and duplicate payments',()=>{
 const s={...C.buildSlot(at,'google',C.evergreen),state:'VERIFIED',providerId:'post',acceptedAt:at};
 const iso=ms=>new Date(at+ms).toISOString();
 const customer={id:'c',tenantId:1,leadIntelligence:{customerJourney:{inquiries:[{sourcePage:s.url,at:iso(1000)}]}}};
 const order={id:'o',tenantId:1,customerId:'c',price:125,createdAt:iso(2000),squarePaymentId:'p',squareOrderId:'o',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:iso(4000)};
 const db={customers:[customer,{...customer,id:'another',tenantId:2}],orders:[order,{...order,id:'before',squarePaymentId:'before',createdAt:iso(500)},{...order,id:'test',squarePaymentId:'test',sbcTest:true}]};
 assert.deepEqual(C.measure([s],db,1),[{campaign:s.campaign,trackedVisits:null,inquiries:1,orders:1,grossCapturedCents:12500}]);
 db.orders.push({...order,id:'conflict'});assert.equal(C.measure([s],db,1)[0].orders,0);
 assert.equal(C.measure([s],{},1),null);
});
test('SQL worker races, stale dispatch, provider outage, delayed Google visibility and restart',{skip:!process.env.SBC_CAMPAIGN_CI_PORT},async t=>{
 const mysql=require('mysql2/promise');
 const pool=mysql.createPool({host:'127.0.0.1',port:Number(process.env.SBC_CAMPAIGN_CI_PORT),user:'root',password:process.env.SBC_CAMPAIGN_CI_PASSWORD||'',database:'sbc_campaign_ci'});
 t.after(()=>pool.end());
 const tenant=730,db=createStore(pool,tenant);
 await db.setup();await pool.query('DELETE FROM sbc_organic_deliveries WHERE tenant=?',[tenant]);
 await pool.query('DELETE FROM sbc_organic_campaigns WHERE tenant=?',[tenant]);
 const cid=await db.add(C.validateCampaign(C.evergreen[0]));assert.equal((await db.catalog()).length,1);assert(await db.archive(cid));
 let now=at,canWrite=true,external=false;const sends=new Map(),seen=new Map();
 const gateway={
   async connect(p){if(p==='linkedin'&&now===at)throw Error('offline');return p;},async prepare(){},
   async publish(s){sends.set(s.content,(sends.get(s.content)||0)+1);seen.set(s.content,'fixture-'+s.content);if(s.platform==='facebook'&&now===at)throw Error('lost response');return seen.get(s.content);},
   async verify(s){return s.platform!=='google'||now>at;},async discover(s){return seen.get(s.content);}
 };
 const opts={tenant,getPool:()=>pool,canWrite:()=>canWrite,gateway,clock:()=>now,cutover:()=>external?'':new Date(at).toISOString()};
 const a=createWorker(opts),b=createWorker(opts);
 canWrite=false;await a.run();assert.equal(sends.size,0);
 canWrite=true;external=true;await a.run();assert.equal(sends.size,0);external=false;
 await Promise.all([a.run(),b.run()]);
 const states=()=>db.history(at,now).then(rows=>Object.fromEntries(rows.map(s=>[s.platform,s.state])));
 assert.deepEqual(await states(),{facebook:'UNKNOWN',google:'ACCEPTED',instagram:'VERIFIED',linkedin:'READY'});
 now+=200000;await b.run();assert(Object.values(await states()).every(s=>s==='VERIFIED'));
 assert.equal([...sends.values()].reduce((a,b)=>a+b,0),4);
 now=at+2*C.INTERVAL;await Promise.all([a.run(),b.run()]);
 let history=await db.history(at,now);assert.equal(history.length,12);assert.equal(history.filter(s=>s.state==='MISSED').length,4);
 now+=C.INTERVAL;
 const next=C.buildSlot(now,'facebook',C.evergreen);await db.seed([next]);const token=await db.claim(next,now);assert(await db.fence(next,token,now));
 now+=180001;await b.run();history=await db.history(next.at,next.at);
 assert.equal(history.find(s=>s.platform==='facebook').state,'UNKNOWN');
 assert.equal(sends.has(next.content),false);
});
