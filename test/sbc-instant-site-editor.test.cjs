'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Editor=require('../enterprise/sbc-instant-site-editor.cjs');
const Factory=require('../enterprise/sbc-prospect-site-factory.cjs');

test('native editable site fields are normalized and survive a render without AI',()=>{
 const site={id:'demo1',status:'Draft',offerTier:'starter',slug:'fictional-shop',industry:'Barber',
   customer:{businessName:'Fictional Shop',city:'Miami'}};
 const input={headline:'Handcrafted experiences',subheadline:'Haircuts for every day',
  about:'Our crew welcomes new guests.',services:['Precision cuts','Beard care','Styling'],
  themeVariant:2,showGallery:false,showVideo:false,showFaq:true};
 const result=Editor.apply(site,{expectedVersion:0,siteEdits:input});
 assert.equal(result.siteEditsVersion,1);
 assert.equal(result.siteEdits.headline,input.headline);
 assert.equal(result.siteEdits.themeVariant,2);
 assert.equal(result.status,'Draft');
 assert.equal(site.siteEdits,undefined,'never mutate the existing shared site');
 const html=Factory.renderPage(result,'home');
 assert.match(html,/Handcrafted experiences/);
 assert.match(html,/Haircuts for every day/);
 assert.match(html,/Precision cuts/);
 assert.match(html,/Beard care/);
 assert.match(html,/Our crew welcomes new guests/);
 assert.doesNotMatch(html,/SAMPLE GALLERY \/ CREATIVE DIRECTION/);
 assert.doesNotMatch(html,/SAMPLE VIDEO · NOT THE REAL BUSINESS/);
 assert.match(html,/id="faq"/);
 assert.match(html,/noindex,nofollow,noarchive/);
 const reread=Factory.renderPage(JSON.parse(JSON.stringify(result)),'home');
 assert.equal(html,reread,'saved editor data renders consistently across reloads');
});

test('save rejects stale revisions, unknown fields, oversized inputs and editing approved sites',()=>{
 const site={id:'site1',status:'Draft',siteEditsVersion:1,siteEdits:{headline:'Current'}};
 assert.throws(()=>Editor.apply(site,{expectedVersion:0,siteEdits:{headline:'Lost change'}}),/STALE_SITE_VERSION/);
 assert.throws(()=>Editor.apply(site,{expectedVersion:1,siteEdits:{script:'alert(1)'}}),/UNSUPPORTED_SITE_FIELD/);
 assert.throws(()=>Editor.apply(site,{expectedVersion:1,siteEdits:{headline:'x'.repeat(201)}}),/INVALID_SITE_CONTENT/);
 assert.throws(()=>Editor.apply(site,{expectedVersion:1,siteEdits:{services:Array(20).fill('a')}}),/INVALID_SITE_CONTENT/);
 assert.throws(()=>Editor.apply({...site,status:'Approved'},{expectedVersion:1,siteEdits:{headline:'Oops'}}),/APPROVED_SITE_LOCKED/);
 assert.throws(()=>Editor.apply({...site,archived:true},{expectedVersion:1,siteEdits:{headline:'Oops'}}),/SITE_ARCHIVED/);
 const safe=Editor.apply(site,{expectedVersion:1,siteEdits:{headline:'<script>alert(1)</script>'}});
 assert.doesNotMatch(Factory.renderPage({...safe,customer:{businessName:'Fictional',city:'Miami'}},'home'),/<script>alert\(1\)<\/script>/);
});

test('owner-only editor API is tenant scoped, writer gated and versioned across durable saves',async()=>{
 const owner={id:'owner1',role:'owner',tenantId:1};
 const worker={id:'worker1',role:'caller',tenantId:1};
 const foreign={id:'owner2',role:'owner',tenantId:2};
 let store={websiteDemos:[
  {id:'draft-1',tenantId:1,customerId:'cust1',status:'Draft',siteEditsVersion:0},
  {id:'approved-1',tenantId:1,customerId:'cust1',status:'Approved'},
  {id:'foreign-1',tenantId:2,customerId:'cust2',status:'Draft'}
 ],websiteProductionOrders:[]};
 let writer=true,saves=0;
 const app=express();app.use(express.json());
 app.use((req,res,next)=>{req.user=req.get('x-test')==='owner'?owner:req.get('x-test')==='worker'?worker:req.get('x-test')==='foreign'?foreign:null;next();});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user.role==='owner'?next():res.status(403).json({ok:false});
 require('../enterprise/sbc-website-production-routes.cjs').register(app,{auth,ownerOnly,requireTenant:req=>req.user.tenantId,
  db:{users:[],orders:[]},getStore:()=>store,saveStore:async next=>{store=structuredClone(next);saves++;return {ok:true}},
  writerReady:()=>writer,paidGuard:()=>{}});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const call=async(method,url,body,who='owner')=>{
  const r=await fetch('http://127.0.0.1:'+server.address().port+url,{method,
   headers:{'Content-Type':'application/json',...(who?{'x-test':who}:{})},
   body:body?JSON.stringify(body):undefined});
  return {status:r.status,body:await r.json()};
 };
 const route='/api/website-production/sites/draft-1/editor';
 try{
  assert.equal((await call('GET',route,undefined,'')).status,401);
  assert.equal((await call('GET',route,undefined,'worker')).status,403);
  assert.equal((await call('GET','/api/website-production/sites/foreign-1/editor')).status,404);
  assert.equal((await call('GET',route)).body.site.siteEditsVersion,0);
  assert.equal((await call('PATCH',route,{expectedVersion:0,siteEdits:{headline:'Bad'}},'worker')).status,403);
  assert.equal((await call('PATCH','/api/website-production/sites/foreign-1/editor',{expectedVersion:0,siteEdits:{headline:'Foreign'}})).status,404);
  assert.equal((await call('PATCH','/api/website-production/sites/approved-1/editor',{expectedVersion:0,siteEdits:{headline:'Oops'}})).status,409);
  writer=false;
  assert.equal((await call('PATCH',route,{expectedVersion:0,siteEdits:{headline:'Locked'}})).status,423);
  writer=true;
  const saved=await call('PATCH',route,{expectedVersion:0,siteEdits:{headline:'Local excellence',services:['A','B'],themeVariant:1}});
  assert.equal(saved.status,200);
  assert.equal(saved.body.ok,true);
  assert.equal(saved.body.site.siteEditsVersion,1);
  assert.equal(saves,1);
  const reread=await call('GET',route);
  assert.equal(reread.body.site.siteEdits.headline,'Local excellence');
  const stale=await call('PATCH',route,{expectedVersion:0,siteEdits:{headline:'Second writer'}});
  assert.equal(stale.status,409);
  assert.equal(saves,1);
  assert.equal((await call('GET',route)).body.site.siteEdits.headline,'Local excellence');
  assert.equal((await call('PATCH',route,{expectedVersion:1,siteEdits:{evil:'x'}})).status,400);
  assert.equal(saves,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
