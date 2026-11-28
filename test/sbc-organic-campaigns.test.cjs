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
test('dated regional campaigns own only their selected channel and Eastern window',()=>{
 const spec=C.validateCampaign({...C.evergreen[0],channels:['linkedin'],start:'2026-11-28',end:'2026-11-28'}),catalog=[...C.evergreen,{...spec,id:'regional'}];
 const slot=C.daySlots('2026-11-28')[2].at;
 assert.equal(C.buildSlot(slot,'linkedin',catalog).campaign,'regional');
 assert.notEqual(C.buildSlot(slot,'google',catalog).campaign,'regional');
 assert.notEqual(C.buildSlot(slot+86400000,'linkedin',catalog).campaign,'regional');
 assert.throws(()=>C.validateCampaign({...spec,start:'2026-02-30'}));
});
test('direct gateways pin accounts and support feed images, text fallback and delayed Google visibility',async()=>{
 const s=p=>C.buildSlot(at,p,C.evergreen),ids=CHANNELS,fb=ids.facebook.account,ig=ids.instagram.account;
 const posts=new Map(),calls=[];let live=false;
 const parent='accounts/1/'+ids.google.account,googleId=parent+'/localPosts/12';
 const authorize=async platform=>({platform,verified:true,igId:ig,pageId:fb,locationId:ids.google.account.split('/')[1],parent,graphBase:'https://graph.facebook.com/v26.0',pageToken:'fixture',accessToken:'fixture'});
 const gateway=createGateway({authorize,request:async(url,o)=>{
   calls.push([url,o]);if(o.method==='HEAD')return new Response(null,{headers:{'content-type':'image/jpeg'}});
   if(url.endsWith('/photos'))return Response.json({id:'1234'});
   if(url.endsWith('/feed')){assert.equal(JSON.parse(o.body.get('attached_media[0]')).media_fbid,'1234');posts.set('facebook',o.body.get('message'));return Response.json({id:fb+'_11'});}
   if(url.includes(fb+'_11?'))return Response.json({id:fb+'_11',is_published:true,message:posts.get('facebook')});
   if(url.endsWith('/media')){posts.set('instagram',o.body.get('caption'));return Response.json({id:'33'});}
   if(url.includes('fields=status_code'))return Response.json({status_code:'FINISHED'});
   if(url.endsWith('media_publish')){assert.equal(o.body.get('creation_id'),'33');return Response.json({id:'44'});}
   if(url.includes('/44?'))return Response.json({id:'44',owner:{id:ig},media_product_type:'FEED',caption:posts.get('instagram')});
   if(url.endsWith('/localPosts')){const data=JSON.parse(o.body);assert.equal(data.media[0].mediaFormat,'PHOTO');posts.set('google',data.callToAction.url);return Response.json({name:googleId,state:'PROCESSING'});}
   if(url.endsWith(googleId))return Response.json({name:googleId,state:live?'LIVE':'PROCESSING',callToAction:{url:posts.get('google')}});
   throw Error('Unexpected URL');
 }});
 for(const platform of ['facebook','instagram','google']){
   const slot=s(platform),p=await gateway.connect(platform),asset=await gateway.prepare(slot,p),id=await gateway.publish(slot,p,asset);
   assert.equal(await gateway.verify(slot,p,id),platform!=='google');
   if(platform==='google'){live=true;assert(await gateway.verify(slot,p,id));}
   if(platform!=='instagram')assert.equal(await gateway.prepare({...slot,attempts:1},p),null);
 }
 assert(calls.length>=10);
 const wrong=createGateway({authorize:async()=>({verified:true,pageId:'2'})});
 await assert.rejects(wrong.connect('facebook'),/ACCOUNT_MISMATCH/);
});
test('actual Express owner routes parse campaign JSON before general application middleware',async t=>{
 const express=require('express'),{register}=require('../routes/sbc-organic-campaigns.cjs');
 let captured=null,writer=true;
 const app=express();
 const pool={query:async(sql,args)=>{
   if(sql.startsWith('INSERT INTO sbc_organic_campaigns')){captured=JSON.parse(args[2]);return [{affectedRows:1}];}
   if(sql.startsWith('SELECT'))return [[]];return [{}];
 }};
 const timer=register(app,{corporateTenant:1,getPool:()=>pool,canWrite:()=>writer,getData:()=>({customers:[],orders:[]}),clock:()=>at,cutover:()=>'',
   auth:(req,res,next)=>req.get('x-owner')?next():res.sendStatus(401),ownerOnly:(req,res,next)=>req.get('x-owner')==='owner'?next():res.sendStatus(403),tenantOf:req=>Number(req.get('x-tenant'))});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{timer.stop();return new Promise(r=>server.close(r));});
 const url='http://127.0.0.1:'+server.address().port+'/api/marketing/campaigns';
 const h={'x-owner':'owner','x-tenant':'1','content-type':'application/json'};
 assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{...h,'x-tenant':'2'}})).status,403);
 const snapshot=await (await fetch(url,{headers:h})).json();assert.equal(snapshot.plan.length,24);assert.equal(snapshot.mode.mode,'external');
 const options={method:'POST',headers:h,body:JSON.stringify(C.evergreen[0])};
 assert.equal((await fetch(url,options)).status,200);assert.equal(captured.title,C.evergreen[0].title);
 writer=false;assert.equal((await fetch(url,options)).status,423);
});

test('SQL reconciliation preserves dispatch boundary and attributes inquiries before delayed confirmation',{skip:!process.env.SBC_CAMPAIGN_CI_PORT},async t=>{
 const mysql=require('mysql2/promise');
 const pool=mysql.createPool({host:'127.0.0.1',port:Number(process.env.SBC_CAMPAIGN_CI_PORT),user:'root',password:process.env.SBC_CAMPAIGN_CI_PASSWORD||'',database:'sbc_campaign_ci'});
 t.after(()=>pool.end());
 const tenant=731,db=createStore(pool,tenant);
 await db.setup();await pool.query('DELETE FROM sbc_organic_deliveries WHERE tenant=?',[tenant]);
 const s=C.buildSlot(at,'facebook',C.evergreen),dispatch=at+1000,discovered=at+200000;
 await db.seed([s]);let token=await db.claim(s,at);assert(token);assert(await db.fence(s,token,dispatch));
 assert(await db.settle(s,token,'UNKNOWN','AMBIGUOUS_DELIVERY',at+60000,null,at+2000));
 let pending=(await db.pending(discovered))[0];assert.equal(pending.acceptedAt,null);
 await db.reconcile(pending,'lost-receipt',true,discovered);
 let [row]=await db.history(at,at);assert.equal(row.acceptedAt,dispatch);
 const data={customers:[{id:'c',tenantId:tenant,leadIntelligence:{customerJourney:{inquiries:[{sourcePage:s.url,at:new Date(dispatch+1).toISOString()},{sourcePage:s.url,at:new Date(dispatch-1).toISOString()}]}}}],orders:[]};
 assert.equal(C.measure([row],data,tenant)[0].inquiries,1);
 const crash=C.buildSlot(at,'google',C.evergreen);
 await db.seed([crash]);token=await db.claim(crash,at);assert(token);assert(await db.fence(crash,token,dispatch));
 await db.recover(discovered);pending=(await db.pending(discovered)).find(s=>s.platform==='google');assert.equal(pending.state,'UNKNOWN');
 await db.reconcile(pending,'crash-receipt',true,discovered);
 row=(await db.history(at,at)).find(s=>s.platform==='google');assert.equal(row.acceptedAt,dispatch);
 const retry=C.buildSlot(at,'linkedin',C.evergreen);
 await db.seed([retry]);token=await db.claim(retry,at);assert(token);assert(await db.fence(retry,token,dispatch));
 assert(await db.settle(retry,token,'READY','PROVIDER_REJECTED',at+3000,null,at+2000));
 token=await db.claim(retry,at+3000);assert(token);assert(await db.fence(retry,token,at+4000));
 assert(await db.settle(retry,token,'ACCEPTED',null,at+5000,'retry-receipt',at+5000));
 row=(await db.history(at,at)).find(s=>s.platform==='linkedin');assert.equal(row.acceptedAt,at+4000);
});
