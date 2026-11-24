'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {fixture}=require('./helpers/connected-journey-fixture.cjs');
const {createService}=require('../enterprise/sbc-connected-journey.cjs');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'server.js'),'utf8');

test('HTTP journey includes researched and appointment-only CRM accounts while preserving tenant and assignment boundaries',async()=>{
 const f=await fixture();try{
  const records=Array.from({length:820},(_,i)=>({id:'lead'+i,tenantId:1,businessName:'Synthetic research '+i,status:'Lead',assignedTo:i===819?'am1':'boss'}));
  f.hydrate({users:[f.owner,f.manager],customers:[...records,{id:'foreign',tenantId:2,businessName:'Foreign sentinel',assignedTo:'am1',status:'Lead'},{id:'deleted',tenantId:1,status:'Deleted'},{id:'projection',tenantId:1,status:'Lead',_recoveryProjection:true}],orders:[],appointments:[{id:'appt',tenantId:1,customerId:'lead819',status:'Scheduled',startAt:'2099-01-01T15:00:00Z',endAt:'2099-01-01T15:30:00Z'}],tasks:[],activities:[],customerAccounts:[]});
  const read=async actor=>(await fetch(f.url+'/api/sbc/journey/queue',{headers:{'x-test-actor':actor}})).json();
  const owner=await read('owner');assert.equal(owner.counts.accounts,820,'research leads must not disappear before inquiry or purchase');
  assert(owner.rows.some(r=>r.customerId==='lead819'&&r.nextAction==='Prepare confirmed appointment'));
  assert(!owner.rows.some(r=>r.customerId==='foreign'));assert.equal(owner.readOnly,false);
  const am=await read('am');assert.deepEqual(am.rows.map(r=>r.customerId),['lead819']);assert.equal(f.writes,0);
 }finally{await f.close()}
});

test('actual MySQL hydration retains relational address, routing and staff approval without writes',async()=>{
 const start=source.indexOf('async function readRelational(){'),end=source.indexOf('async function writeRelational(',start);
 assert(start>0&&end>start);const statements=[];
 const SNAPSHOT_TENANTS=require('../enterprise/integration/sbc-snapshot-tenants.cjs');
 const routingState=SNAPSHOT_TENANTS.captureCallRouting({customers:[{id:'lead1',tenantId:1,salesQueueState:'spanish_callback',preferredContactLanguage:'es'}],users:[{id:'rep1',tenantId:1,role:'account_manager',active:true,spanishCallingApprovedByOwner:true}]});
 const context={SNAPSHOT_TENANTS,seed:{settings:{}},PERSISTENCE_EPOCH_KEY:'epoch',db:{},persistenceEpoch:0,normalize:x=>x,
  safeJsonParse:(s,f)=>{try{return JSON.parse(s)}catch{return f}},fromSqlDate:v=>v||'',fromSqlDateTime:v=>v||'',console,
  mysqlPool:{query:async sql=>{statements.push(sql);return [/FROM sbc_customers/.test(sql)?[{id:'lead1',tenant_id:1,business_name:'Synthetic Garage',address:'123 Example St, Miami, FL 33101',status:'Lead'}]:/FROM sbc_workforce_users/.test(sql)?[{id:'rep1',tenant_id:1,role:'account_manager',active:1}]:/FROM sbc_workspace/.test(sql)?[{payload:JSON.stringify({callRoutingStateV1:routingState})}]:[]]}}};
 const scoreStart=source.lastIndexOf('function leadQuality(c){'),scoreEnd=source.indexOf('function isActiveSalesLead(',scoreStart);
 assert(scoreStart>=0&&scoreEnd>scoreStart);
 vm.runInNewContext(source.slice(scoreStart,scoreEnd)+'\n'+source.slice(start,end)+'\nthis.hydrate=readRelational;',context);
 await context.hydrate();assert.equal(context.db.customers[0].address,'123 Example St, Miami, FL 33101');
 assert.equal(context.db.customers[0].tenantId,1);
 assert.equal(context.db.customers[0].leadTemperature,'Cold');
 assert.equal(context.db.customers[0].leadScore,20);
 assert.equal(context.db.customers[0].verificationStatus,'Needs Verification');
 assert.equal(context.db.customers[0].salesQueueState,'spanish_callback');
 assert.equal(context.db.customers[0].preferredContactLanguage,'es');
 assert.equal(context.db.users[0].spanishCallingApprovedByOwner,true);
 assert(statements.every(s=>/^SELECT\b/.test(s)));
});

test('actual session and bootstrap responses expose read-only Preview to client write guards',async()=>{
 let handler;const context={app:{get:(_path,_auth,fn)=>{handler=fn}},auth:()=>{},ADMIN_PASSWORD:false,BUILD_VERSION:'66.0.0',SBC_RUNTIME_READ_ONLY:true,MYSQL_RECOVERY_REQUIRED:false,
  CATALOG:{packages:[]},CALL_SCRIPTS:{},SBC_ROLE_PERMISSIONS:{account_manager:[]},storageMode:'mysql-relational-read-only',db:{settings:{},customers:[],activities:[],orders:[]},
  squareConfigured:()=>false,squareWebhookConfigured:()=>false,squareEnvironment:()=> 'sandbox',squarePaymentRecords:()=>[],ecosystemOrderSplit:()=>({}),opsOverview:()=>({counts:{},pipeline:{}}),isLornaLeadAccount:()=>false};
 const req={user:{id:'am1',name:'Synthetic Manager',role:'account_manager',active:true}};
 const response=()=>({setHeader(){},json(body){this.body=body;return this}});
 let start=source.indexOf("app.get('/api/me'"),end=source.indexOf("app.get('/api/system/published-performance'",start);
 vm.runInNewContext(source.slice(start,end),context);let res=response();await handler(req,res);assert.equal(res.body.readOnly,true);
 start=source.indexOf("app.get('/api/bootstrap'");end=source.indexOf('res.json(base)});',start)+'res.json(base)});'.length;
 vm.runInNewContext(source.slice(start,end),context);res=response();await handler(req,res);assert.equal(res.body.readOnly,true);
 context.SBC_RUNTIME_READ_ONLY=false;res=response();await handler(req,res);assert.equal(res.body.readOnly,false);
});

test('protected QA payment is excluded from customer workload and cannot enter customer delivery',async()=>{
 const f=await fixture();try{
  f.db.customers.push({id:'qa-customer',tenantId:1,businessName:'Synthetic QA',status:'Customer'});
  f.db.orders.push({id:'qa-order',tenantId:1,customerId:'qa-customer',product:'Synthetic QA service',price:1,paymentStatus:'Paid',notes:JSON.stringify({squareOrderId:'sq-order',squarePaymentId:'sq-payment',squarePaymentStatus:'PAID',squarePaymentCompletedAt:'2026-11-20T12:00:00Z',sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT',version:1},customerJourney:{revision:1,status:'Delivered',previewUrl:'https://example.invalid/proof',deliveryUrl:'https://example.invalid/deliverable',steps:[{key:'qa',completed:true},{key:'approval',completed:false}]}})});
  const q=f.service.queue(f.owner,1);assert.equal(q.counts.openOrders,0);assert.equal(q.rows[0].paidOrders,0);
  const order=f.service.detail('qa-customer',f.owner,1).orders[0];assert.equal(order.protectedQa,true);assert.match(order.status,/QA/);assert.deepEqual(order.steps,[]);assert.equal(order.previewUrl,'');assert.equal(order.deliveryUrl,'');assert.equal(order.canApprove,false);
  await assert.rejects(f.service.progress('qa-order',f.owner,1,{step:'intake',expectedRevision:0}),/PROTECTED_QA_ORDER/);
  await assert.rejects(f.service.approve({portalCustomer:f.db.customers[0],portalAccount:{id:'portal',customerId:'qa-customer',tenantId:1,active:true}},'qa-order',{expectedRevision:1,decision:'approve'}),/PROTECTED_QA_ORDER/);assert.equal(f.writes,0);
 }finally{await f.close()}
});

test('journey read-only capability remains available without a writable database',()=>{
 const owner={id:'owner',role:'owner',tenantId:1,active:true};
 const db={users:[owner],customers:[{id:'lead',tenantId:1,status:'Lead'}],orders:[],appointments:[]};
 const service=createService({db,id:()=> 'unused',save:async()=>{throw Error('must not write')},writerReady:()=>false});
 assert.equal(service.queue(owner,1).readOnly,true);assert.equal(service.detail('lead',owner,1).readOnly,true);
});

async function journeyClient(readOnly=true,rows=[{customerId:'lead1',businessName:'Synthetic Garage'}]){
 class Element{constructor(){this.value='';this.hidden=false;this.disabled=false;this.innerHTML='';this.textContent='';this.listeners={};this.classList={toggle(){}};this.controls=[]}addEventListener(k,fn){this.listeners[k]=fn}querySelectorAll(){return this.controls}appendChild(){}select(){}setAttribute(){}}
 const elements=Object.fromEntries(['search','queue','notice','detail','session','refresh','reconcile','run-reminders','reminder-mode','reminders','activation-link','count-accounts','count-inquiries','count-orders'].map(id=>[id,new Element()]));
 elements.detail.controls=[new Element(),new Element(),new Element()];
 const calls=[];const context={URLSearchParams,location:{search:'?account=lead1'},console,document:{getElementById:id=>elements[id],querySelectorAll:()=>Object.values(elements),createElement:()=>new Element()},
  fetch:async(p,opts={})=>{calls.push({path:p,method:opts.method||'GET'});const body=p==='/api/me'?{user:{role:'owner'}}:p.endsWith('/queue')?{readOnly,rows,counts:{accounts:rows.length}}:p.endsWith('/reminders')?{sendEnabled:false,receipts:[]}:p.endsWith('/accounts/lead1')?{readOnly,account:{customerId:'lead1',businessName:'Synthetic Garage'},inquiries:[],orders:[],appointments:[],events:[]}:{};return {ok:true,json:async()=>body}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'public/sbc-customer-journey-v1.js'),'utf8'),context);
 for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
 return {elements,calls};
}

test('real journey client disables read-only mutations and never submits activation or consent',async()=>{
 const {elements,calls}=await journeyClient();
 assert.equal(elements.reconcile.disabled,true);assert(elements.detail.controls.every(c=>c.disabled));
 elements.reconcile.listeners.click();
 elements.detail.listeners.click({target:{closest:()=>({dataset:{invite:true},disabled:false})}});
 elements.detail.listeners.submit({preventDefault(){},target:{id:'consent',elements:{}}});
 for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.filter(c=>c.method!=='GET').length,0,'read-only client must stop before posting');
 assert.match(elements.notice.textContent,/read.only/i);
});

test('writable journey keeps valid controls available',async()=>{
 const {elements}=await journeyClient(false);
 assert.equal(elements.reconcile.disabled,false);assert(elements.detail.controls.every(c=>!c.disabled));
});

test('journey renders a bounded queue while searching every authorized record',async()=>{
 const rows=Array.from({length:820},(_,i)=>({customerId:'lead'+i,businessName:'Synthetic research '+i}));
 const {elements}=await journeyClient(false,rows);
 assert.equal((elements.queue.innerHTML.match(/data-account=/g)||[]).length,80);
 assert.match(elements.queue.innerHTML,/820/);
 elements.search.value='Synthetic research 819';elements.search.listeners.input();
 assert.match(elements.queue.innerHTML,/data-account="lead819"/);
 assert.equal((elements.queue.innerHTML.match(/data-account=/g)||[]).length,1);
});

test('payment center presents current storefront offers separately from legacy Square packages',()=>{
 const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8'),start=app.indexOf('function payments(){');
 const next=app.slice(start+1).search(/\n(?:async )?function /);assert(start>0&&next>0);
 const context={state:{data:{settings:{paymentLinks:{}}},me:{role:'owner'},catalog:{packages:[]}},URL,esc:v=>String(v??''),money:v=>'$'+Number(v).toFixed(2)};
 vm.runInNewContext(app.slice(start,start+1+next)+'\nthis.renderPayments=payments;',context);
 const html=context.renderPayments(),current=html.match(/<section[^>]+data-sbc-current-offers[^>]*>[\s\S]*?<\/section>/)?.[0];
 assert(current,'current offers must be the first, distinct payment choice');
 for(const price of [99,199,499,799,999])assert(current.includes('$'+price+'.00'));
 assert.match(current,/sbcmia\.com\/checkout\.php\?package=starter/);assert.match(current,/sbcmia\.com\/checkout\.php\?package=custom/);
 assert.doesNotMatch(current,/square\.link|\$349|\$699/);
 assert.match(html,/Legacy website packages/);assert.match(html,/250 cards; standard shipping included/);
});

function taskRouteFixture(){
 const handlers={},db={customers:[{id:'c1',tenantId:1,businessName:'Own'},{id:'c2',tenantId:2,businessName:'Foreign'}],users:[{id:'r1',tenantId:1,role:'lead_researcher',name:'Own researcher',active:true},{id:'r2',tenantId:2,role:'lead_researcher',name:'Foreign researcher',active:true},{id:'o1',tenantId:1,role:'owner',active:true}],tasks:[{id:'foreign',tenantId:2,assignedTo:'r2',title:'Foreign task'},{id:'own',tenantId:1,assignedTo:'r1',title:'Own task',createdBy:'o1'},{id:'legacy',assignedTo:'r1',createdBy:'o1',title:'Legacy task'},{id:'ambiguous',title:'Unknown ownership'}],activities:[]};
 let writes=0,fail=false,next=0;
 const context={db,app:Object.fromEntries(['post','put','delete','get'].map(m=>[m,(p,...h)=>{handlers[m+' '+p]=h.at(-1)}])),auth(){},ownerOnly(){},requireRequestTenant(req){if(!req.tenantId)throw Error('tenant');return req.tenantId},now:()=> '2026-11-24T15:00:00Z',id:p=>p+'-'+(++next),addActivity(type,message,meta,tenantId){const a={id:'act-'+(++next),type,message,meta,tenantId};db.activities.unshift(a);return a},mysqlPool:{},SBC_RUNTIME_READ_ONLY:false,MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true,sbcShutdownStarted:false,saveData:async()=>{writes++;if(fail)throw Error('write failed')},console};
 const start=source.indexOf("app.post('/api/activities'"),end=source.indexOf('// SBC_P0P1_BOOKING_AND_DAILY_REVENUE:',start);assert(start>0&&end>start);
 vm.runInNewContext(source.slice(start,end),context);
 const call=async(method,path,{id='',tenantId=1,user={id:'o1',role:'owner'},body={}}={})=>{const res={code:200,status(n){this.code=n;return this},json(v){this.body=v;return this}};await handlers[method+' '+path]({tenantId,user,params:{id},body},res);return res};
 return {db,call,context,get writes(){return writes},set fail(v){fail=v}};
}
test('task routes reject foreign tenant customers, staff and task identifiers before writes',async()=>{
 const f=taskRouteFixture(),body={title:'National research',dueAt:'2026-11-30T16:00:00Z'};
 assert.equal((await f.call('post','/api/tasks',{body:{...body,assignedTo:'r2'}})).code,400);
 assert.equal((await f.call('post','/api/tasks',{body:{...body,customerId:'c2'}})).code,400);
 assert.equal((await f.call('put','/api/tasks/:id',{id:'foreign',body:{status:'Completed'}})).code,404);
 assert.equal((await f.call('delete','/api/tasks/:id',{id:'foreign'})).code,404);
 assert.equal((await f.call('put','/api/tasks/:id',{id:'ambiguous',body:{status:'Completed'}})).code,404);
 assert.equal(f.writes,0);assert.equal(f.db.tasks.length,4);
});
test('team task ownership is server-derived, legacy ownership is proven, employees cannot inject protected fields',async()=>{
 const f=taskRouteFixture();const made=await f.call('post','/api/tasks',{body:{title:'National research',dueAt:'2026-11-30T16:00:00Z',assignedTo:'r1',tenantId:2,createdBy:'forged'}});
 assert.equal(made.code,201);assert.equal(made.body.tenantId,1);assert.equal(made.body.createdBy,'o1');assert.equal(made.body.assignedTo,'r1');
 const actor={id:'r1',role:'lead_researcher'};
 assert.equal((await f.call('put','/api/tasks/:id',{id:'own',user:actor,body:{tenantId:2,createdBy:'forged'}})).code,400);
 assert.equal((await f.call('put','/api/tasks/:id',{id:'own',user:actor,body:{assignedTo:'r2'}})).code,403);
 assert.equal((await f.call('put','/api/tasks/:id',{id:'own',body:{assignedTo:'r2'}})).code,400);
 const done=await f.call('put','/api/tasks/:id',{id:'legacy',user:actor,body:{status:'Completed'}});
 assert.equal(done.code,200);assert.equal(done.body.tenantId,1);assert.equal(done.body.status,'Completed');assert.equal(done.body.assignedTo,'r1');
 assert.equal(f.db.tasks.find(t=>t.id==='own').createdBy,'o1');
});
test('team task writes fail closed in Preview and restore local task state after a rejected save',async()=>{
 const f=taskRouteFixture();const body={title:'Research',dueAt:'2026-11-30T16:00:00Z',assignedTo:'r1'};
 f.context.SBC_RUNTIME_READ_ONLY=true;
 assert.equal((await f.call('post','/api/tasks',{body})).code,423);assert.equal(f.writes,0);assert.equal(f.db.tasks.length,4);
 f.context.SBC_RUNTIME_READ_ONLY=false;f.fail=true;
 assert.equal((await f.call('post','/api/tasks',{body})).code,503);assert.equal(f.db.tasks.length,4);assert.equal(f.db.activities.length,0);
 assert.equal((await f.call('put','/api/tasks/:id',{id:'own',body:{status:'Completed'}})).code,503);assert.equal(f.db.tasks.find(t=>t.id==='own').status,undefined);
 assert.equal((await f.call('delete','/api/tasks/:id',{id:'own'})).code,503);assert(f.db.tasks.some(t=>t.id==='own'));
});
