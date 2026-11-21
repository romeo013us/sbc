'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createService}=require('../enterprise/sbc-connected-journey.cjs');
const stamp='2026-11-20T15:00:00.000Z';
const owner={id:'boss',role:'owner',tenantId:1,active:true};
const manager={id:'am',role:'account_manager',tenantId:1,active:true};
const lead=()=>({requestId:'inquiry_0123456789abcdefghijklmnop',businessName:'Example Miami Garage',contactName:'Test Customer',email:'test@example.invalid',phone:'+13055550123',serviceSlug:'website-design',packageId:'starter',intent:'callback',preferredWindow:'Monday afternoon',timeZone:'America/New_York',message:'Please call about the starter website.',sourcePage:'https://sbcmia.com/contact.php?utm_source=facebook&utm_medium=organic_social&utm_campaign=super_sbc_growth&utm_content=starter'});
function fixture(){
 const db={users:[owner,manager],customers:[],tasks:[],orders:[],appointments:[],activities:[]};let seq=0,fail=false,writable=true;
 const service=createService({db,id:p=>p+'_'+(++seq),now:()=>stamp,writerReady:()=>writable,save:async()=>{if(fail)throw Error('synthetic storage failure');return {persisted:true}}});
 return {db,service,fail:()=>{fail=true},readOnly:()=>{writable=false}};
}
test('signed website intake retains service context, returns an opaque receipt, and routes one task to owner',async()=>{
 const {db,service}=fixture();const receipt=await service.intake(1,lead());
 assert.equal(receipt.accepted,true);assert.notEqual(receipt.id,db.customers[0].id);
 assert.deepEqual(Object.keys(receipt).sort(),['accepted','durable','id','ok']);
 const queue=service.queue(owner,1);
 assert.equal(queue.rows[0].serviceSlug,'website-design');assert.equal(queue.rows[0].packageId,'starter');
 assert.equal(queue.rows[0].intent,'callback');assert.equal(queue.rows[0].assignedTo,'boss');
 assert.equal(db.tasks.length,1);assert.equal(db.tasks[0].assignedTo,'boss');
 assert.equal(db.customers[0].status,'Lead');
 const replay=await service.intake(1,lead());assert.equal(replay.id,receipt.id);assert.equal(db.customers.length,1);assert.equal(db.tasks.length,1);
});
test('repeat request keys cannot change payload and failed saves leave no phantom accounts or tasks',async()=>{
 const f=fixture();await f.service.intake(1,lead());
 await assert.rejects(f.service.intake(1,{...lead(),intent:'quote'}),/INQUIRY_KEY_CONFLICT/);
 const broken=fixture();broken.fail();await assert.rejects(broken.service.intake(1,lead()),/NOT_COMMITTED/);
 assert.equal(broken.db.customers.length,0);assert.equal(broken.db.tasks.length,0);
 const ro=fixture();ro.readOnly();await assert.rejects(ro.service.intake(1,lead()),/WRITER_UNAVAILABLE/);
});
test('matching keeps verified contacts, source history and active AM ownership; shared contacts never guess an identity',async()=>{
 const f=fixture();f.db.customers.push({id:'known',tenantId:1,assignedTo:'am',businessName:'Verified Business',email:'test@example.invalid',phone:'+13055550123',status:'Lead',leadIntelligence:{researchBrief:{evidence:'kept'}}});
 await f.service.intake(1,{...lead(),contactName:'Unverified visitor',businessName:'Different public spelling'});
 assert.equal(f.db.customers.length,1);assert.equal(f.db.customers[0].businessName,'Verified Business');assert.equal(f.db.tasks[0].assignedTo,'am');
 assert.equal(f.db.customers[0].leadIntelligence.researchBrief.evidence,'kept');
 assert.equal(f.service.queue({...manager,id:'other'},1).rows.length,0);
 assert.throws(()=>f.service.detail('known',{...manager,tenantId:2},2),/ACCOUNT_NOT_FOUND/);
 f.db.customers.push({id:'conflict',tenantId:1,phone:'+13055550123',email:'other@example.invalid',status:'Lead'});
 await f.service.intake(1,{...lead(),requestId:'inquiry_9999999999abcdefghijklmnop'});
 assert.equal(f.db.customers.length,3);
});
test('inactive AM assignment routes review to owner and suppression never becomes outbound permission',async()=>{
 const f=fixture();f.db.users[1]={...manager,active:false};f.db.customers.push({id:'held',tenantId:1,assignedTo:'am',email:'test@example.invalid',status:'Do Not Call',doNotContact:true});
 await f.service.intake(1,lead());assert.equal(f.db.tasks[0].assignedTo,'boss');assert.match(f.db.tasks[0].title,/restrictions/);
 assert.equal(f.db.customers[0].doNotContact,true);assert.equal(f.service.queue(owner,1).rows[0].ownerFallback,true);
});
const paidOrder=(customerId,extra={})=>({id:'order1',tenantId:1,customerId,product:'Business Starter Website',price:199,paymentStatus:'Paid',notes:JSON.stringify({squareOrderId:'sqorder1',squarePaymentId:'sqpay1',squarePaymentStatus:'PAID',squarePaymentCompletedAt:stamp}),...extra});
test('verified payment creates one checklist; current customer approval and owner release precede delivery',async()=>{
 const f=fixture();await f.service.intake(1,lead());const cid=f.db.customers[0].id;f.db.orders.push(paidOrder(cid));
 await f.service.reconcile(owner,1);await f.service.reconcile(owner,1);assert.equal(f.db.tasks.filter(t=>t.journeyTaskKey==='delivery:order1').length,1);
 const act=(step,extra={})=>{const rev=f.service.detail(cid,owner,1).orders[0].revision;return f.service.progress('order1',owner,1,{step,expectedRevision:rev,...extra})};
 await assert.rejects(act('delivery',{deliveryUrl:'https://example.invalid/site'}),/PREVIOUS_STEPS_REQUIRED/);
 await act('intake');await act('build');await act('preview',{previewUrl:'https://example.invalid/private-preview'});await act('qa');
 const req={portalCustomer:f.db.customers[0],portalAccount:{id:'portal1',customerId:cid,tenantId:1,active:true}};
 await assert.rejects(f.service.approve(req,'order1',{expectedRevision:1,decision:'approve'}),/PROOF_CHANGED_REFRESH_REQUIRED/);
 await f.service.approve(req,'order1',{expectedRevision:2,decision:'approve'});
 f.db.customers[0].assignedTo='am';
 await assert.rejects(f.service.progress('order1',manager,1,{step:'release',expectedRevision:2}),/OWNER_REQUIRED/);
 await act('release');await act('delivery',{deliveryUrl:'https://example.invalid/final-site'});
 const summary=f.service.portalSummary({...req,portalCustomer:f.db.customers[0]});assert.equal(summary.orders[0].status,'Delivered');assert.equal(summary.orders[0].deliveryUrl,'https://example.invalid/final-site');
 f.db.orders[0].paymentStatus='Refunded';assert.equal(f.service.portalSummary({...req,portalCustomer:f.db.customers[0]}).orders[0].deliveryUrl,'');
 await assert.rejects(act('delivery',{deliveryUrl:'https://example.invalid/final-site'}),/PAYMENT_VERIFICATION_REQUIRED/);
});
test('customer portal isolates tenants and reschedule requests preserve the original booked time',async()=>{
 const f=fixture();await f.service.intake(1,lead());const cid=f.db.customers[0].id;
 f.db.orders.push(paidOrder(cid),paidOrder(cid,{id:'foreign',tenantId:2}));
 const req={portalCustomer:f.db.customers[0],portalAccount:{id:'p1',customerId:cid,tenantId:1}};
 assert.equal(f.service.portalSummary(req).orders.length,1);
 assert.throws(()=>f.service.portalSummary({...req,portalAccount:{...req.portalAccount,tenantId:2}}),/CUSTOMER_LOGIN_REQUIRED/);
 f.db.appointments.push({id:'appt1',tenantId:1,customerId:cid,status:'Scheduled',startAt:'2026-11-23T15:00:00Z',endAt:'2026-11-23T15:10:00Z'});
 const r=await f.service.reschedule(req,'appt1',{preferredWindow:'Tuesday afternoon'});assert.equal(r.status,'Awaiting confirmation');assert.equal(f.db.appointments[0].startAt,'2026-11-23T15:00:00Z');
 assert.equal(f.db.tasks.filter(t=>t.journeyTaskKey==='reschedule:appt1').length,1);
});
test('a readback outage retains the committed idempotency receipt and verifies it on retry',async()=>{
 const db={users:[owner],customers:[],tasks:[],activities:[],orders:[],appointments:[]};let seq=0,available=false;
 const s=createService({db,id:p=>p+'_'+(++seq),now:()=>stamp,writerReady:()=>true,save:async()=>({persisted:true}),confirmInquiry:async(t,c,a)=>available&&!!a});
 await assert.rejects(s.intake(1,lead()),/WEBSITE_INQUIRY_UNCONFIRMED/);assert.equal(db.customers.length,1);
 available=true;const r=await s.intake(1,lead());assert.equal(r.accepted,true);assert.equal(db.customers.length,1);assert.equal(db.tasks.length,1);
});
test('published website checkout prices are fixed independently of legacy internal packages',()=>{
 const {offer,amountMatches}=require('../enterprise/sbc-website-checkout-offers.cjs');
 assert.equal(offer('website-custom').price,499);assert.equal(offer('starter').price,199);assert.equal(offer('quickstart').price,99);
 assert.equal(amountMatches(offer('website-custom'),34900),false);assert.equal(amountMatches(offer('website-custom'),49900),true);assert.equal(offer('__proto__'),null);
});
test('a failed save reverses only its own changes while preserving concurrent researcher and payment writes',async()=>{
 const db={users:[owner],customers:[{id:'existing',tenantId:1,status:'Lead',email:'test@example.invalid',assignedTo:'boss',leadIntelligence:{researchBrief:{evidence:'old'}}}],tasks:[],activities:[],orders:[],appointments:[]};let seq=0;
 const s=createService({db,id:p=>p+'_'+(++seq),now:()=>stamp,writerReady:()=>true,save:async()=>{
  db.orders.push({id:'independent-paid-order',tenantId:1,status:'Paid'});db.customers[0].leadIntelligence.researchBrief.evidence='new researcher evidence';db.customers.push({id:'new-researcher-lead',tenantId:1});throw Error('synthetic save failure');
 }});
 await assert.rejects(s.intake(1,lead()),/NOT_COMMITTED/);assert.equal(db.orders.length,1);assert.equal(db.customers.length,2);
 assert.equal(db.customers[0].leadIntelligence.researchBrief.evidence,'new researcher evidence');assert.equal(db.customers[0].leadIntelligence.customerJourney,undefined);assert.equal(db.tasks.length,0);
});
test('vendor work is blocked until customer approval and owner release; portal hides staff identities',async()=>{
 const {requireRelease}=require('../enterprise/sbc-connected-journey.cjs'),f=fixture();await f.service.intake(1,lead());const c=f.db.customers[0];f.db.orders.push(paidOrder(c.id));await f.service.reconcile(owner,1);
 assert.throws(()=>requireRelease(f.db.orders[0]),/CUSTOMER_APPROVAL_AND_OWNER_RELEASE_REQUIRED/);
 const p=JSON.parse(f.db.orders[0].notes);p.customerJourney.steps.find(s=>s.key==='intake').actor='internal-staff-id';f.db.orders[0].notes=JSON.stringify(p);
 const summary=f.service.portalSummary({portalCustomer:c,portalAccount:{id:'p',customerId:c.id,tenantId:1}});assert(!JSON.stringify(summary).includes('internal-staff-id'));
});
test('verified customer can activate exactly once using a tenant-scoped expiring invitation',async()=>{
 const {createAccess}=require('../enterprise/sbc-customer-activation.cjs'),f=fixture();await f.service.intake(1,lead());const cid=f.db.customers[0].id;
 const access=createAccess(f.service,{hashPassword:p=>'synthetic-hash:'+p.length}),testPassphrase=require('node:crypto').randomBytes(24).toString('hex');
 await assert.rejects(access.invite(cid,manager,1,{contactVerified:true}),/ACCOUNT_NOT_FOUND/);
 const invitation=await access.invite(cid,owner,1,{contactVerified:true}),token=new URL(invitation.activationUrl).hash.slice(7);
 assert(!JSON.stringify(f.db).includes(token));await assert.rejects(access.activate(2,{token,password:testPassphrase}),/INVALID_OR_EXPIRED/);
 await access.activate(1,{token,password:testPassphrase});assert.equal(f.db.customerAccounts.length,1);assert.equal(f.db.customerAccounts[0].customerId,cid);assert.notEqual(f.db.customerAccounts[0].passwordHash,testPassphrase);
 await assert.rejects(access.activate(1,{token,password:testPassphrase}),/INVALID_OR_EXPIRED/);
});
test('rollback preserves a concurrent microtask and only reverts its own fields within JSON order notes',async()=>{
 const db={customers:[],orders:[{id:'o',notes:JSON.stringify({release:false})}]};
 const s=createService({db,id:()=>'',writerReady:()=>true,save:async()=>{db.orders[0].notes=JSON.stringify({...JSON.parse(db.orders[0].notes),provider:'concurrent provider event'});throw Error('save failed')}});
 await assert.rejects(s.transaction(()=>{db.orders[0].notes=JSON.stringify({release:true});queueMicrotask(()=>db.customers.push({id:'unrelated',tenantId:1}));return {ok:true}},['customers','orders']),/NOT_COMMITTED/);
 assert.equal(db.customers[0].id,'unrelated');assert.deepEqual(JSON.parse(db.orders[0].notes),{release:false,provider:'concurrent provider event'});
});
