'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {CHANNELS,businessDate,validDay,reconcileChannel,createReadback} = require('../enterprise/sbc-marketing-readback.cjs');
const {registerMarketingReceipts,validateInput} = require('../routes/sbc-marketing-receipts.cjs');
const day='2026-11-24',now=Date.parse(day+'T20:00:00Z'), stamp=day+'T15:33:00+0000';
const pic='https://media.example.invalid/approved.jpg';
const fixture={
  facebook:{account_id:CHANNELS.facebook.account,post_id:CHANNELS.facebook.account+'_100',post_created_time:stamp,
    permalink_url:'https://www.facebook.com/example/posts/100',media_type:'photo',full_picture:pic,is_published:'True'},
  instagram:{account_id:CHANNELS.instagram.reportingAccount,media_owner_username:CHANNELS.instagram.handle,media_id:'200',
    timestamp:stamp,media_permalink:'https://www.instagram.com/p/example/',media_type:'IMAGE',media_product_type:'FEED',media_url:pic},
  linkedin:{account_id:CHANNELS.linkedin.account,post_id:'urn:li:share:300',share_owner:'urn:li:organization:'+CHANNELS.linkedin.account,
    share_activity:'urn:li:activity:301',share_published_time:stamp,share_post_type:'image',share_image_url:pic},
  google:{account_id:CHANNELS.google.account,post_id:'accounts/111/'+CHANNELS.google.account+'/localPosts/400',post_state:'LIVE',
    post_create_time:stamp,post_media_format:'PHOTO',post_media_google_url:pic,post_search_url:'https://local.google.com/place?id=400'}
};
const reconcile=(k,...data)=>reconcileChannel(k,{data},day,now);
test('each authorized channel returns only distinct image receipts with provider links',()=>{
  for(const [key,row] of Object.entries(fixture)) {
    const report=reconcile(key,row,row);
    assert.equal(report.receipts.length,1);assert.equal(report.status,'READ_BACK');
    assert(report.receipts[0].link.startsWith('https://'));
    assert.equal(reconcile(key,{...row,account_id:'wrong'}).receipts.length,0);
  }
  assert.equal(reconcile('linkedin',fixture.linkedin).receipts[0].link,'https://www.linkedin.com/feed/update/urn:li:activity:301/');
});
test('a preview picture, IG story, wrong Google location, other LinkedIn owner, or missing photo cannot verify publication',()=>{
  const variants={facebook:{media_type:'link'},instagram:{media_product_type:'STORY'},linkedin:{share_owner:'urn:li:organization:999'},google:{post_state:'PROCESSING'}};
  for(const [key,patch] of Object.entries(variants)) assert.equal(reconcile(key,{...fixture[key],...patch}).status,'INCONCLUSIVE');
  assert.equal(reconcile('google',{...fixture.google,post_id:'accounts/111/locations/999/localPosts/400'}).receipts.length,0);
  assert.equal(reconcile('instagram',{...fixture.instagram,media_owner_username:'other'}).receipts.length,0);
  assert.equal(reconcile('facebook',{...fixture.facebook,full_picture:'',permalink_url:'https://example.invalid/post'}).receipts.length,0);
  assert.equal(reconcile('linkedin').status,'NO_READBACK');
  assert.throws(()=>reconcileChannel('google',{status:'processing',data:[]},day,now));
});
test('Eastern date handles winter, daylight saving time and the evening UTC rollover',()=>{
  assert.equal(businessDate('2026-11-24T02:45:00Z'),'2026-11-23');
  assert.equal(businessDate('2026-07-02T03:59:59Z'),'2026-07-01');
  assert.equal(businessDate('2026-07-02T04:00:00Z'),'2026-07-02');
  assert.equal(reconcile('google',{...fixture.google,post_create_time:'2026-11-24T02:45:00.123456789Z'}).receipts.length,0);
  assert.equal(reconcile('instagram',{...fixture.instagram,timestamp:'2026-11-24T15:33:00'}).receipts.length,0);
  assert.equal(validDay('2026-02-30'),false);
});
test('checks are scoped GETs, coalesced and isolated, including a provider timeout',async()=>{
  let calls=0;
  const read=createReadback({clock:()=>now,getKey:async()=>'local-fixture',request:async(url,o)=>{
    calls++;const channel=Object.values(CHANNELS).find(c=>url.pathname==='/'+c.connector);
    assert.equal(url.origin,'https://connectors.windsor.ai');assert.equal(url.searchParams.get('select_accounts'),channel.account);
    assert.equal(o.method,'GET');assert.equal(o.redirect,'error');assert.equal(url.searchParams.get('fields'),channel.fields);
    assert.equal(url.searchParams.get('date_to'),day);
    if(channel===CHANNELS.linkedin)throw Error('private details');
    return {ok:true,json:async()=>({data:[]})};
  }});
  const [a,b]=await Promise.all([read(day),read(day)]);assert.equal(a,b);assert.equal(calls,4);
  assert.equal(a.channels.find(c=>c.platform==='linkedin').status,'PROVIDER_UNAVAILABLE');
  assert(!JSON.stringify(a).includes('private details'));
  assert.throws(()=>read('2026-12-01'));assert.throws(()=>read('2026-11-00'));
  const past=createReadback({clock:()=>now,getKey:async()=>'fixture',request:async(url)=>{
    assert.equal(url.searchParams.get('date_from'),'2026-11-23');assert.equal(url.searchParams.get('date_to'),day);
    return {ok:true,json:async()=>({data:[]})};
  }});
  assert((await past('2026-11-23')).channels.every(c=>c.status==='NO_READBACK'));
});
test('receipt route uses authenticated corporate owner, writer gate, and reads without schema writes',async t=>{
  let requests=0,queries=0;
  const app=express();
  registerMarketingReceipts(app,{auth:(req,res,next)=>req.headers['x-test-role']?next():res.sendStatus(401),
    ownerOnly:(req,res,next)=>req.headers['x-test-role']==='owner'?next():res.sendStatus(403),
    tenantOf:req=>Number(req.headers['x-test-tenant']),corporateTenant:1,clock:()=>now,
    getPool:()=>({query(sql){queries++;assert.match(sql,/^SELECT/);throw Object.assign(Error(),{code:'ER_NO_SUCH_TABLE'});}}),
    canWrite:()=>false,getKey:()=>'',request:()=>{requests++;throw Error();}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+'/api/marketing/publication-receipts';
  const headers={'x-test-role':'owner','x-test-tenant':'1'};
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{...headers,'x-test-role':'staff'}})).status,403);
  assert.equal((await fetch(url,{headers:{...headers,'x-test-tenant':'2'}})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers})).status,423);
  assert.equal((await fetch(url+'?day=2026-02-30',{headers})).status,400);
  const response=await fetch(url,{headers});assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();assert(result.channels.every(c=>c.status==='ACCESS_UNCONFIGURED'));
  assert.deepEqual(result.slots,[]);assert.equal(requests,0);assert.equal(queries,1);
});
test('attempts may lack an ID and supplied IDs must belong to the selected channel',()=>{
  assert.equal(validateInput({platform:'google',slot:'AM'}),null);
  for(const [channel,row] of Object.entries(fixture)) {
    const id=row.post_id||row.media_id;
    assert.equal(validateInput({platform:channel,slot:'AM',postId:id}),id);
  }
  for(const bad of [{platform:'toString',slot:'AM'},{platform:'linkedin',slot:'AM',postId:'https://example.invalid'},
    {platform:'facebook',slot:'AM',postId:'999_100'},{platform:'instagram',slot:'evening'}]) assert.throws(()=>validateInput(bad));
});
test('corporate rows never reach the internal scheduler or manual publisher',async()=>{
  const code=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
  const worker=code.slice(code.indexOf('async function sbcProcessDueMarketingPosts()'),code.indexOf('const sbcMarketingSchedulerTimer='));
  let examined=0;
  await vm.runInNewContext(worker+';sbcProcessDueMarketingPosts();',{TENANT_DEFAULT_ID:1,SBC_RUNTIME_READ_ONLY:false,
    MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true,
    mysqlPool:{query:async(sql,params)=>{examined++;assert.match(sql,/WHERE tenant_id<>\? AND status='SCHEDULED'/);assert.deepEqual(Array.from(params),[1]);return [[]];}}});
  assert.equal(examined,1);
  const line=code.split('\n').find(s=>s.startsWith("app.post('/api/marketing/content/:itemId/publish'"));
  let handler;
  vm.runInNewContext(line,{app:{post:(_path,_a,_o,fn)=>{handler=fn;}},auth(){},ownerOnly(){},requireRequestTenant:()=>1,TENANT_DEFAULT_ID:1});
  let status,body;
  await handler({}, {status(n){status=n;return this;},json(value){body=value;}});
  assert.equal(status,409);assert.equal(body.error,'EXTERNAL_PUBLISHER_OWNS_SBC_CHANNELS');
});
test('client Social Studio rejects the protected SBC account before resolving credentials',async()=>{
  const {createMetaProvider}=require('../enterprise/sbc-account-social-meta.cjs');
  let requests=0;
  const adapter=createMetaProvider({resolveSecret:()=>{requests++;},fetchImpl:()=>{requests++;}});
  for(const [platform,id] of [['facebook',CHANNELS.facebook.account],['instagram',CHANNELS.instagram.account],['instagram',CHANNELS.instagram.reportingAccount]]) {
    const channel={id:'client-channel',platform,tenantId:2,customerId:'client',providerAccountId:id,status:'VERIFIED'};
    const post={platform,tenantId:2,customerId:'client',channelId:channel.id,approvedAt:stamp};
    await assert.rejects(adapter.publish({tenantId:2,customerId:'client',channel,post}),{code:'EXTERNAL_PUBLISHER_OWNS_SBC_CHANNELS'});
  }
  assert.equal(requests,0);
});
