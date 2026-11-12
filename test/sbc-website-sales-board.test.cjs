'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express'),fs=require('node:fs'),path=require('node:path');
const {project,register}=require('../enterprise/sbc-website-sales-board.cjs');
const proof=(o,tid)=>{if(o.tenantId!==tid||!o.providerCaptured)throw Error('PAYMENT_EVIDENCE_REQUIRED')};
const customer=(id,extra={})=>({id,tenantId:1,businessName:'Synthetic '+id,status:'Lead',...extra});
const site=(id,customerId,status='Approved',extra={})=>({id,tenantId:1,customerId,status,offerTier:'essentials',...extra});
const data=()=>({
 customers:[customer('new'),customer('draft'),customer('approved'),customer('booked'),customer('paid'),customer('live'),
 customer('suppressed',{doNotCall:true}),customer('deleted',{status:'Deleted'}),customer('other',{tenantId:2,businessName:'Foreign Secret'})],
 sites:[site('d1','draft','Draft'),site('a1','approved'),site('b1','booked'),site('p1','paid'),site('l1','live'),site('s1','suppressed')],
 appointments:[{id:'apt1',tenantId:1,customerId:'booked',websiteId:'b1',status:'Scheduled',startAt:'2026-11-14T19:00:00Z'},
 {id:'apt2',tenantId:2,customerId:'other',status:'Scheduled',websiteId:'s99'}],
 orders:[{id:'pay1',tenantId:1,customerId:'paid',product:'Business Basic',price:349,providerCaptured:true},
 {id:'pay2',tenantId:1,customerId:'live',product:'Business Starter',price:199,providerCaptured:true},
 {id:'test-pay',tenantId:1,customerId:'booked',product:'Business Basic',price:349,providerCaptured:false},
 {id:'unrelated',tenantId:1,customerId:'suppressed',product:'Print Cards',price:499,providerCaptured:true},
 {id:'other-pay',tenantId:2,customerId:'other',product:'Business Basic',price:349,providerCaptured:true}],
 workOrders:[{id:'web1',tenantId:1,customerId:'live',orderId:'pay2',websiteId:'l1',status:'PUBLISHED',publicUrl:'https://example.org/'}]
});
test('tenant-scoped sales dashboard uses real approval, appointment, Square proof, not invented revenue',()=>{
 const d=data();const out=project({...d,tenantId:1,paidGuard:proof,limit:50});
 assert.equal(out.metrics.totalLeads,7);assert.equal(out.metrics.websitesBuilt,6);
 assert.equal(out.metrics.approvedWebsites,5);assert.equal(out.metrics.bookedMeetings,1);
 assert.equal(out.metrics.websiteBuyers,2);assert.equal(out.metrics.capturedWebsiteRevenueCents,54800);
 assert.equal(out.metrics.publishedWebsites,1);
 const stage=id=>out.rows.find(x=>x.customerId===id)?.stage;
 assert.equal(stage('new'),'NEEDS_WEBSITE');
 assert.equal(stage('draft'),'REVIEW_WEBSITE');
 assert.equal(stage('approved'),'READY_TO_CALL');
 assert.equal(stage('booked'),'APPOINTMENT_BOOKED');
 assert.equal(stage('paid'),'PAID_NEEDS_FULFILLMENT');
 assert.equal(stage('live'),'WEBSITE_PUBLISHED');
 assert.equal(stage('suppressed'),'SUPPRESSED');
 assert(!out.rows.some(x=>x.businessName==='Foreign Secret'));
 assert(!out.rows.some(x=>x.customerId==='deleted'));
 assert(!out.rows.some(x=>Object.prototype.hasOwnProperty.call(x,'email')));
 assert(!out.rows.some(x=>Object.prototype.hasOwnProperty.call(x,'phone')));
 assert.equal(out.metrics.unverifiedOrUnattributedOrdersExcluded,2);
});
test('only the latest version per customer controls stage; booked meeting requires approved matching site',()=>{
 const d=data();d.sites.push(site('draft-new','approved','Draft',{updatedAt:'2026-11-12T17:59:00Z'}));d.sites.find(x=>x.id==='a1').updatedAt='2026-11-10T12:00:00Z';
 d.appointments.push({id:'unapproved',tenantId:1,customerId:'draft',websiteId:'d1',status:'Scheduled',startAt:'2026-11-14T20:00:00Z'});
 const out=project({...d,tenantId:1,paidGuard:proof});
 assert.equal(out.rows.find(x=>x.customerId==='approved').stage,'REVIEW_WEBSITE');
 assert.equal(out.rows.find(x=>x.customerId==='draft').stage,'REVIEW_WEBSITE');
});
test('read-only endpoint is owner only and returns no cross-tenant records',async()=>{
 const d=data(),app=express(),owner={id:'owner',role:'owner',tenantId:1};
 app.use((req,res,next)=>{const role=req.header('x-role');req.user=role==='owner'?owner:role==='caller'?{...owner,role:'caller'}:null;next()});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user.role==='owner'?next():res.status(403).json({ok:false});
 register(app,{auth,ownerOnly,requireTenant:req=>req.user.tenantId,db:{customers:d.customers,orders:d.orders,appointments:d.appointments},
 getStore:()=>({websiteDemos:d.sites,websiteProductionOrders:d.workOrders}),paidGuard:proof});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 try{
  const call=async role=>{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/website-production/sales-board',{headers:role?{'x-role':role}:{}});return {status:r.status,body:await r.json()}};
  assert.equal((await call()).status,401);
  assert.equal((await call('caller')).status,403);
  const result=await call('owner');assert.equal(result.status,200);
  assert.equal(result.body.metrics.websiteBuyers,2);assert.equal(result.body.metrics.totalLeads,7);
  assert(!JSON.stringify(result.body).includes('Foreign Secret'));
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('sales cockpit is mounted in mirrored UI and can reopen an existing website without rebuilding',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const ui=read('public/sbc-website-sales-board-v1.js');
 assert.match(ui,/SBC Website Sales Pipeline/);
 assert.match(ui,/\/api\/website-production\/sales-board/);
 assert.match(ui,/SBC_WEBSITE_PRODUCTION\.openExisting/);
 assert.equal(ui,read('browser_public/sbc-website-sales-board-v1.js'));
 for(const name of ['public/index.html','browser_public/index.html'])assert.match(read(name),/sbc-website-sales-board-v1\.js/);
 const production=read('public/sbc-website-production-v1.js');
 assert.match(production,/async function openExisting/);
 assert.match(production,/SBC_WEBSITE_PRODUCTION.*openExisting/);
});

test('isolated release includes owner sales pipeline and never rebuilds an owner-approved website',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const {patchServer,MARK}=require('../scripts/v66-stage-website-sales-board.cjs');
 const staged=patchServer(src);
 assert(staged.includes(MARK));
 assert.equal(patchServer(staged),staged);
 assert.match(staged,/require\('\.\/enterprise\/sbc-website-sales-board\.cjs'\)\.register\(app/);
 assert.match(staged,/if\(existing\?\.status==='Approved'\)return existing/);
 assert.match(staged,/SBC_V6651_REQUIRE_PAID/);
 new (require('node:vm').Script)(staged);
 if(process.env.SBC_SALES_BOARD_EXPECT_STAGED==='YES')assert.equal(staged,src,'disposable package must have compiled sales board');
});
