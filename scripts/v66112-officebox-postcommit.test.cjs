'use strict';
const assert=require('node:assert/strict');
const api=require('../enterprise/v66112-officebox-postcommit.cjs');
const fs=require('node:fs'),path=require('node:path');
const stage=require('./v66112-stage-officebox-postcommit.cjs');
const stageSource=fs.readFileSync(path.resolve(__dirname,'..','server.js'),'utf8');
const stageTarget=stage.patchServer(stageSource);
assert.equal(stage.patchServer(stageTarget),stageTarget,'Office Box V2 staged patch must be idempotent');
assert(stageTarget.includes('SBC_V66112_PAID_ORDER_AUTO_V2'));
assert(stageTarget.includes('SBC_V66112_OFFICEBOX_COMMITTED_OWNER_RECONCILIATION'));
assert(stageTarget.indexOf('records.splice(5000); await saveData();')<stageTarget.indexOf('SBC_V66112_PAID_ORDER_AUTO_V2'),'auto-dispatch must follow committed payment');
assert(stageTarget.includes("if(status==='COMPLETED' && sbcWriterLeaseReady && MYSQL_RECOVERY_EVALUATED && !MYSQL_RECOVERY_REQUIRED && typeof require==='function')"));
if(process.argv.includes('--staged'))assert.equal(stageTarget,stageSource,'staged runtime must contain V2 post-commit automation');
const crypto=require('node:crypto');
const order={id:'ord_officebox_abc123',customer_id:'cust_officebox_abc123',product:'Office Box Business',status:'Paid',price:349,notes:JSON.stringify({officeBoxSku:'OFFICE_BOX_BUSINESS',squareOrderId:'square_order_abc123',squarePaymentId:'square_payment_abc123',squarePaymentStatus:'PAID'})};
const customer={id:'cust_officebox_abc123',business_name:'Synthetic Auto Detail',email:'synthetic@example.com',industry:'Auto Detailing'};
const payment={id:'square_payment_abc123',order_id:'square_order_abc123',location_id:'sq_location_abc123',status:'COMPLETED',amount_money:{currency:'USD',amount:34900}};
const secret=Buffer.alloc(40,0x63).toString('hex'); // synthetic HMAC fixture, not a credential
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture({o=order,c=customer,p=payment,response={ok:true,data:{accepted:true,activation_url:'https://office.example.test/activate?token=fake-token'}},commitOrder=true}={}){
 const calls={mysql:[],square:[],fetch:[]};
 const pool={query:async(sql,params)=>{calls.mysql.push({sql,params});if(sql.includes('FROM sbc_orders'))return [commitOrder?[clone(o)]:[]];if(sql.includes('FROM sbc_customers'))return [[clone(c)]];throw Error('UNEXPECTED_SQL')}};
 const deps={pool,baseUrl:'https://office.example.test',secret,locationId:'sq_location_abc123',
  squareApi:async url=>{calls.square.push(url);return {payment:clone(p)}},
  fetch:async(url,opts)=>{calls.fetch.push({url,opts});return {ok:true,json:async()=>clone(response)}}};
 return {deps,calls};
}
(async()=>{
 const t=fixture();
 const result=await api.reconcile({tenantId:1,orderId:order.id},t.deps);
 assert.equal(result.accepted,true);assert.equal(result.status,'INVITATION_PENDING');assert.equal(result.activationUrl,'https://office.example.test/activate?token=fake-token');
 assert.equal(t.calls.mysql.length,2);assert.equal(t.calls.square.length,1);assert.equal(t.calls.fetch.length,1);
 assert.deepEqual(t.calls.mysql[0].params,[1,order.id]);
 assert.deepEqual(t.calls.mysql[1].params,[1,order.customer_id]);
 assert.equal(t.calls.fetch[0].url,'https://office.example.test/api/sbc/handoff');
 assert.equal(t.calls.fetch[0].opts.redirect,'error');
 const sent=JSON.parse(t.calls.fetch[0].opts.body);
 assert.equal(sent.eventType,'customer.subscription.paid');
 assert.equal(sent.payload.plan,'business');
 const sig='sha256='+crypto.createHmac('sha256',secret).update(t.calls.fetch[0].opts.headers['x-sbc-timestamp']+'.'+t.calls.fetch[0].opts.body).digest('hex');
 assert.equal(t.calls.fetch[0].opts.headers['x-sbc-signature-v2'],sig);
 const noOrder=fixture({commitOrder:false});await assert.rejects(()=>api.reconcile({tenantId:1,orderId:order.id},noOrder.deps),/COMMITTED_ORDER_NOT_FOUND/);
 assert.equal(noOrder.calls.square.length,0);assert.equal(noOrder.calls.fetch.length,0);
 for(const [name,changes,reason] of [
  ['not paid',{status:'Pending'},'COMMITTED_ORDER_NOT_PAID'],
  ['no SKU',{notes:JSON.stringify({...JSON.parse(order.notes),officeBoxSku:''})},'EXPLICIT_PURCHASE_SKU_REQUIRED'],
  ['QA flag',{notes:JSON.stringify({...JSON.parse(order.notes),sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT'}})},'QA_ORDER_EXCLUDED'],
  ['no durable capture',{notes:JSON.stringify({...JSON.parse(order.notes),squarePaymentStatus:'PENDING'})},'DURABLE_SQUARE_PROOF_MISSING']
 ]){
   const f=fixture({o:{...order,...changes}});await assert.rejects(()=>api.reconcile({tenantId:1,orderId:order.id},f.deps),new RegExp(reason),name);assert.equal(f.calls.square.length,0,name);
 }
 for(const [name,changes,reason] of [
  ['Square wrong amount',{amount_money:{currency:'USD',amount:3}},'SQUARE_AMOUNT_MISMATCH'],
  ['Square not completed',{status:'PENDING'},'SQUARE_NOT_SETTLED'],
  ['Square wrong location',{location_id:'wrong_location'},'SQUARE_IDENTITY_MISMATCH'],
  ['Square wrong order',{order_id:'wrong_order'},'SQUARE_ORDER_MISMATCH']
 ]){
   const f=fixture({p:{...payment,...changes}});await assert.rejects(()=>api.reconcile({tenantId:1,orderId:order.id},f.deps),new RegExp(reason),name);assert.equal(f.calls.fetch.length,0,name);
 }
 const duplicate=fixture({response:{ok:true,data:{accepted:true,duplicate:true}}});
 const d=await api.reconcile({tenantId:1,orderId:order.id},duplicate.deps);assert.equal(d.status,'INVITATION_RECONCILIATION_REQUIRED');assert.equal(d.activationUrl,null);
 const noAck=fixture({response:{ok:false,error:'rejected'}});await assert.rejects(()=>api.reconcile({tenantId:1,orderId:order.id},noAck.deps),/HANDOFF_NOT_ACKNOWLEDGED/);
 const badHost=fixture();badHost.deps.baseUrl='http://localhost:3000';await assert.rejects(()=>api.reconcile({tenantId:1,orderId:order.id},badHost.deps),/HTTPS_ORIGIN_REQUIRED/);assert.equal(badHost.calls.square.length,0);
 const noSecret=fixture();noSecret.deps.secret='short';await assert.rejects(()=>api.reconcile({tenantId:1,orderId:order.id},noSecret.deps),/SECRET_NOT_CONFIGURED/);
 const invalidTenant=fixture();await assert.rejects(()=>api.reconcile({tenantId:0,orderId:order.id},invalidTenant.deps),/TENANT_REQUIRED/);
 console.log('[SBC V66.112] PASS: existing committed MySQL order, exact Square provider payment, authorized Office Box SKU, signed V2 HTTPS, replay handling, fail-closed boundaries; no live calls');
})().catch(e=>{console.error(e);process.exitCode=1});
