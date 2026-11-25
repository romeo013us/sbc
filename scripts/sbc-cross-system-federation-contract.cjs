'use strict';
// Run with two extracted, verified release roots. Synthetic records only.
// No provider requests, live DB, actual payment or genuine account activation.
const assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
if(process.argv.length!==4)throw Error('Usage: node scripts/sbc-cross-system-federation-contract.cjs <command-center-root> <office-box-root>');
const cc=path.resolve(process.argv[2]),ob=path.resolve(process.argv[3]);
const sender=require(path.join(cc,'enterprise/v66112-officebox-postcommit.cjs'));
const {signHandoffV2}=require(path.join(cc,'enterprise/v6674-officebox-v2-handoff.cjs'));
const {probe}=require(path.join(cc,'enterprise/v66127-officebox-federation-probe.cjs'));
const install=require(path.join(ob,'officebox-federation.js'));
const {installSbcEntitlements}=require(path.join(ob,'sbc-entitlements.js'));
const {writeAccess}=require(path.join(ob,'subscription-policy.js'));
const secret=crypto.randomBytes(32).toString('hex'),origin='https://office.example.test';
process.env.NODE_ENV='test';process.env.OFFICE_BOX_ORIGIN=origin;process.env.SBC_HANDOFF_V2_REQUIRED='true';process.env.SBC_ENTITLEMENT_SYNC_ENABLED='true';
const routes=new Map(),app={get:(p,h)=>routes.set('GET '+p,h),post:(p,h)=>routes.set('POST '+p,h)};
const state={activations:new Map(),users:new Map(),tenants:new Map(),rental:new Map(),sbcLinks:new Map(),entitlementEvents:new Map()};
const now=()=>new Date().toISOString(),tid='tenant_1234567890abcdef';
const persisted=[];let sessions=0;
install(app,{asyncRoute:f=>f,appState:state,ok:(res,data)=>res.json({ok:true,data}),id:p=>p==='tenant'?tid:'usr_fixture',now,clean:(v,n)=>String(v??'').slice(0,n),durableUpsert:async(type,tenant,item)=>persisted.push({type,tenant,item}),getPool:()=>null,WEBHOOK_SECRET:secret,passwordRecord:()=>({salt:'fixture',hash:'fixture'}),verifyActivationOwner:async()=>false,setSession:async()=>{sessions++},audit(){}});
installSbcEntitlements(app,{appState:state,getPool:()=>null,WEBHOOK_SECRET:secret,now,audit(){}});
async function call(method,route,body,headers={}){let status=200,result;await routes.get(method+' '+route)({body,get:k=>headers[k]}, {status(n){status=n;return this},json(x){result=x;return this}});return {status,ok:status>=200&&status<300,json:async()=>result,body:result};}
const order={id:'order_fixture001',customer_id:'customer_fixture001',product:'Office Box Business',status:'Paid',price:99,notes:JSON.stringify({officeBoxSku:'OFFICE_BOX_BUSINESS',squareOrderId:'square_order001',squarePaymentId:'square_payment001',squarePaymentStatus:'PAID'})};
const customer={id:order.customer_id,business_name:'Synthetic Company',email:'fixture@example.test',industry:'Retail'};
const payment={id:'square_payment001',order_id:'square_order001',location_id:'square_location001',status:'COMPLETED',amount_money:{currency:'USD',amount:9900}};
let captured;
const transport=async(url,opts)=>{assert.equal(new URL(url).origin,origin);captured=opts;return call(opts.method,new URL(url).pathname,Buffer.from(opts.body),opts.headers);};
const deps={pool:{query:async(sql,args)=>{assert.equal(args[0],7);return [sql.includes('sbc_orders')?[order]:[customer]]}},squareApi:async()=>({payment}),fetch:transport,secret,locationId:payment.location_id,baseUrl:origin};
async function signedEntitlement(body){const raw=Buffer.from(JSON.stringify(body)),ts=String(Math.floor(Date.now()/1000));return call('POST','/api/sbc/entitlements',raw,{'x-sbc-timestamp':ts,'x-sbc-signature':'sha256='+crypto.createHmac('sha256',secret).update(ts+'.').update(raw).digest('hex')});}
(async()=>{
 const probeResult=await probe({origin,secret,transport});assert.equal(probeResult.authenticated,true);assert.equal(state.activations.size,0);
 const first=await sender.reconcile({tenantId:7,orderId:order.id},deps);assert.equal(first.status,'INVITATION_PENDING');assert.equal(state.tenants.size,0);assert.equal(persisted.length,2);
 const wire=JSON.parse(captured.body);const again=await sender.reconcile({tenantId:7,orderId:order.id},deps);assert.equal(again.duplicate,true);assert.equal(again.activationUrl,null);assert.equal(persisted.length,2);
 const altered=signHandoffV2({...wire,payload:{...wire.payload,plan:'team'}},secret);const conflict=await call('POST',altered.path,Buffer.from(altered.body),altered.headers);assert.equal(conflict.status,409);
 const tampered=await call('POST',altered.path,Buffer.from(altered.body+' '),altered.headers);assert.equal(tampered.status,401);
 const token=new URL(first.activationUrl).searchParams.get('token'),fixturePassword=crypto.randomBytes(16).toString('hex');
 const tokenRecord=state.activations.get(crypto.createHash('sha256').update(token).digest('hex'));
 const expiry=tokenRecord.expiresAt;tokenRecord.expiresAt=new Date(Date.now()-1000).toISOString();
 await assert.rejects(()=>sender.reconcile({tenantId:7,orderId:order.id},deps),/INVITATION_EXPIRED/);
 tokenRecord.expiresAt=expiry;
 const activated=await call('POST','/api/integrations/sbc/activate',{token,password:fixturePassword,owner_name:'Fixture'});assert.equal(activated.status,200);assert.equal(sessions,1);assert.equal(writeAccess(state.rental.get(tid)).allowed,false);
 await assert.rejects(()=>sender.reconcile({tenantId:7,orderId:order.id},deps),/INVITATION_ALREADY_ACTIVATED/);
 const replay=await call('POST','/api/integrations/sbc/activate',{token,password:fixturePassword});assert.equal(replay.status,404);assert.equal(sessions,1);
 const base={schema:'sbc.office-box.entitlement.v1',eventId:'sbc_evt_fixture0001',tenantId:tid,customerId:customer.id,plan:'business',status:'ACTIVE',orderId:order.id,paymentReference:payment.id,verifiedAt:now()};
 const denied=await signedEntitlement(base);assert.equal(denied.status,422);assert.equal(writeAccess(state.rental.get(tid)).allowed,false);
 // Test-signed assertion, not a production Square subscription readback or sender.
 const full={...base,eventId:'sbc_evt_fixture0002',billingProvider:'SQUARE_SUBSCRIPTIONS',providerStatus:'ACTIVE',subscriptionId:'subscription_fixture001',currentPeriodStart:new Date(Date.now()-86400000).toISOString(),currentPeriodEnd:new Date(Date.now()+29*86400000).toISOString()};
 const active=await signedEntitlement(full);assert.equal(active.status,200);assert.equal(writeAccess(state.rental.get(tid)).allowed,true);assert.equal(writeAccess(state.rental.get(tid),Date.parse(full.currentPeriodEnd)).allowed,false);
 const duplicate=await signedEntitlement(full);assert.equal(duplicate.body.duplicate,true);
 const wrong=await signedEntitlement({...full,plan:'team'});assert.equal(wrong.status,409);
 const canceled=await signedEntitlement({...full,eventId:'sbc_evt_fixture0003',status:'CANCELED',providerStatus:'CANCELED',verifiedAt:new Date(Date.parse(full.verifiedAt)+1000).toISOString()});assert.equal(canceled.status,200);assert.equal(writeAccess(state.rental.get(tid)).allowed,false);
 console.log('PASS: actual Command Center sender -> Office Box signed receiver; zero-charge probe, invite, exact replay, conflict, tamper, activation, single-use token, recurring evidence, expiration, cancellation. Synthetic dependencies; no MySQL or provider verification.');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
