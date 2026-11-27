'use strict';
/* Acceptance war: real registered HTTP handlers + transactional in-memory SQL fake.
 * No Square API, payment provider, email, vendor purchase, remote DB or production state.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const ROUTES=require('../routes/sbc-sales-command-v1.cjs');
const clone=x=>structuredClone(x);
const key=(t,m,month)=>t+':'+m+':'+month;
const orderKey=(t,o)=>t+':'+o;
function fakeDb(){
 let data={customers:new Map(),orders:new Map(),credits:new Map(),terms:new Map(),statements:new Map(),audit:[]};
 const sql=(state,query,params)=>{
  if(query.startsWith('SELECT id,assigned_to FROM sbc_customers')){
   const [tenant,id]=params,x=state.customers.get(orderKey(tenant,id));return [x?[clone(x)]:[]];
  }
  if(query.startsWith('SELECT id,customer_id FROM sbc_orders')){
   const [tenant,id]=params,x=state.orders.get(orderKey(tenant,id));return [x?[clone(x)]:[]];
  }
  if(query.startsWith('SELECT tier,agreement_reference FROM sbc_commission_terms')||
     query.startsWith('SELECT tier FROM sbc_commission_terms')){
   const [tenant,manager,month]=params,x=state.terms.get(key(tenant,manager,month));return [x?[clone(x)]:[]];
  }
  if(query.startsWith('SELECT status FROM sbc_commission_statement')||
     query.startsWith('SELECT * FROM sbc_commission_statement')){
   const [tenant,manager,month]=params,x=state.statements.get(key(tenant,manager,month));return [x?[clone(x)]:[]];
  }
  if(query.startsWith('SELECT order_id FROM sbc_sales_credit')&&query.includes('AND order_id=?')){
   const [tenant,id]=params,x=state.credits.get(orderKey(tenant,id));return [x?[{order_id:id}]:[]];
  }
  if(query.startsWith('SELECT order_id FROM sbc_sales_credit')){
   const [tenant]=params;return [[...state.credits.values()].filter(c=>c.tenant_id===tenant).map(c=>({order_id:c.order_id}))];
  }
  if(query.startsWith('SELECT * FROM sbc_sales_credit')){
   const [tenant,manager]=params;return [[...state.credits.values()].filter(c=>c.tenant_id===tenant&&c.manager_id===manager).map(clone)];
  }
  if(query.startsWith('INSERT INTO sbc_commission_terms')){
   const [t,m,month,tier,agreement_reference,confirmed_by]=params;
   if(state.terms.has(key(t,m,month)))throw Error('duplicate terms');
   state.terms.set(key(t,m,month),{tier,agreement_reference,confirmed_by});return [{affectedRows:1}];
  }
  if(query.startsWith('INSERT INTO sbc_sales_credit')){
   const [t,id,customer,manager,source,gross,direct,labor,processing,refund,captured,hash,actor,evidence]=params;
   if(state.credits.has(orderKey(t,id)))throw Error('duplicate credit');
   state.credits.set(orderKey(t,id),{tenant_id:t,order_id:id,customer_id:customer,manager_id:manager,source,
    gross_cents:gross,direct_cost_cents:direct,labor_cents:labor,processing_cents:processing,
    refund_cents:refund,captured_at:captured,square_payment_hash:hash,owner_actor:actor,owner_evidence:evidence});
   return [{affectedRows:1}];
  }
  if(query.startsWith('INSERT INTO sbc_commission_statement')){
   const [t,m,month,tier,quota,revenue,profit,commission,status,created_by]=params;
   state.statements.set(key(t,m,month),{tier,quota_cents:quota,revenue_cents:revenue,profit_cents:profit,
    commission_cents:commission,status,created_by,closed_at:'2026-11-02T00:00:00Z'});return [{affectedRows:1}];
  }
  if(query.startsWith('INSERT INTO sbc_commission_audit')){
   state.audit.push({tenant_id:params[1],manager_id:params[2],month_key:params[3],action:params[4]});return [{affectedRows:1}];
  }
  if(query.startsWith('UPDATE sbc_commission_statement_v1 SET status=')){
   const paid=query.includes("status='PAID'");
   const [actor,reference,t,m,month]=paid?params:[params[0],null,params[1],params[2],params[3]];
   const saved=state.statements.get(key(t,m,month));
   if(!saved)throw Error('missing statement');
   saved.status=paid?'PAID':'APPROVED';
   if(paid){saved.paid_by=actor;saved.external_payment_reference=reference;}
   else saved.approved_by=actor;
   return [{affectedRows:1}];
  }
  throw Error('Unexpected SQL: '+query);
 };
 return {pool:{async query(q,p=[]){return sql(data,q,p)},
  async getConnection(){let transaction;return{
   async beginTransaction(){transaction=clone(data)},
   async query(q,p=[]){assert(transaction);return sql(transaction,q,p)},
   async commit(){data=transaction;transaction=undefined},
   async rollback(){transaction=undefined},release(){}
  }}
 },setCustomer(x){data.customers.set(orderKey(x.tenant_id,x.id),x)},
 setOrder(x){data.orders.set(orderKey(x.tenant_id,x.id),x)},state(){return clone(data)}};
}
function appFixture(){
 const fake=fakeDb(),handlers=new Map();
 const owner={id:'owner',role:'owner',tenantId:1,active:true},
  alice={id:'alice',role:'account_manager',tenantId:1,active:true};
 const db={users:[alice,{id:'bob',role:'account_manager',tenantId:1,active:true},
   {id:'other-tenant',role:'account_manager',tenantId:2,active:true}],orders:[]};
 ROUTES.register({get:(p,a,fn)=>handlers.set('GET '+p,fn),
  post:(p,a,fn)=>handlers.set('POST '+p,fn)},{auth:(_req,_res,next)=>next?.(),
  getContext:()=>({db,mysqlPool:fake.pool,recoveryRequired:()=>false}),
  tenantForRead:req=>req.tenantId,writer:()=>{}});
 function addPaid(label,{assigned='alice',tenant=1,paymentStatus='PAID',testOnly=false}={}){
  const customerId='customer-'+label,id='order-'+label;
  fake.setCustomer({tenant_id:tenant,id:customerId,assigned_to:assigned});
  fake.setOrder({tenant_id:tenant,id,customer_id:customerId});
  const o={tenantId:tenant,id,customerId,price:400,paymentStatus,testOnly,
    squareOrderId:'square_order_'+label,squarePaymentId:'square_payment_'+label,
    squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-10-15T16:00:00Z'};
  db.orders.push(o);return o;
 }
 async function request(method,route,body={},user=owner,params={},query={}){
  const handler=handlers.get(method+' '+route);assert(handler,'missing '+route);
  let code=200,payload;const res={setHeader(){},status(s){code=s;return this},json(v){payload=v;return this}};
  await handler({user,tenantId:user.tenantId,body,params,query},res);
  return {code,payload};
 }
 const terms=(manager='alice')=>request('POST','/api/owner/sales-command/terms',
  {managerId:manager,month:'2026-10',tier:'standard',agreementReference:'SIGNED_AGREEMENT_'+manager,
   confirm:'SIGNED_AGREEMENT_CONFIRMED'});
 const credit=(order,manager='alice')=>request('POST','/api/owner/sales-command/credits',
  {managerId:manager,orderId:order.id,source:'NEW_CUSTOMER',directCostCents:16000,
   laborCents:0,processingCents:0,refundCents:0,costEvidence:'Vendor cost invoice '+order.id,
   confirm:'OWNER_VERIFIED_CAPTURE_AND_COSTS'});
 const close=()=>request('POST','/api/owner/sales-command/statements/close',
  {managerId:'alice',month:'2026-10',confirm:'CLOSE_MONTH_FOR_OWNER_REVIEW'});
 const transition=(suffix,reference='')=>request('POST','/api/owner/sales-command/statements/:managerId/:month/'+suffix,
  suffix==='approve'?{confirm:'APPROVE_COMMISSION_STATEMENT'}:
   {confirm:'RECORD_ALREADY_SENT_PAYMENT',paymentReference:reference},
  owner,{managerId:'alice',month:'2026-10'});
 return {fake,db,owner,alice,addPaid,request,terms,credit,close,transition};
}
test('collected Square order -> manager quota -> month close -> owner approval -> external payment record',async()=>{
 const h=appFixture();assert.equal((await h.terms()).code,201);
 const orders=Array.from({length:7},(_,i)=>h.addPaid('sale'+i));
 for(const order of orders)assert.equal((await h.credit(order)).code,201);
 const ownerView=await h.request('GET','/api/owner/sales-command/overview',{},h.owner,{}, {month:'2026-10'});
 assert.equal(ownerView.code,200);
 const manager=ownerView.payload.managers.find(x=>x.managerId==='alice');
 assert.equal(manager.revenueCents,280000);
 assert.equal(manager.commissionCents,16800);
 const managerView=await h.request('GET','/api/sbc/sales/compensation/me',{},h.alice,{}, {month:'2026-10'});
 assert.equal(managerView.code,200);assert.equal(managerView.payload.commissionCents,16800);
 assert.equal(managerView.payload.profitCents,undefined);
 const draft=await h.close();assert.equal(draft.code,200);
 assert.equal(draft.payload.status,'DRAFT');
 assert.notEqual((await h.transition('paid','EXTERNAL_0001')).code,200);
 assert.equal((await h.transition('approve')).code,200);
 const paid=await h.transition('paid','EXTERNAL_0001');
 assert.equal(paid.code,200);assert.equal(paid.payload.paymentInitiated,false);
 assert.equal(h.fake.state().statements.get(key(1,'alice','2026-10')).status,'PAID');
 assert.equal(h.fake.state().credits.size,7);
 assert.notEqual((await h.transition('paid','EXTERNAL_0001')).code,200);
});
test('duplicate credit never doubles monthly sales and untrusted/QA accounts are blocked',async()=>{
 const h=appFixture(),valid=h.addPaid('valid');
 assert.equal((await h.credit(valid)).code,201);
 const duplicate=await h.credit(valid);assert.equal(duplicate.code,200);assert.equal(duplicate.payload.existing,true);
 const refund=h.addPaid('refund',{paymentStatus:'REFUNDED'});
 const qa=h.addPaid('qa',{testOnly:true});
 const wrong=h.addPaid('wrong',{assigned:'bob'});
 assert.notEqual((await h.credit(refund)).code,201);
 assert.notEqual((await h.credit(qa)).code,201);
 assert.notEqual((await h.credit(wrong)).code,201);
 const blocked=await h.request('POST','/api/owner/sales-command/credits',{managerId:'alice',orderId:valid.id},h.alice);
 assert.equal(blocked.code,403);
 assert.equal(h.fake.state().credits.size,1);
 assert.equal(h.fake.state().audit.filter(x=>x.action==='PAID_ORDER_RECONCILED').length,1);
});
test('late chargeback prevents stale monthly statement closure',async()=>{
 const h=appFixture();assert.equal((await h.terms()).code,201);
 const order=h.addPaid('chargeback');assert.equal((await h.credit(order)).code,201);
 order.paymentStatus='CHARGEBACK';
 const closed=await h.close();assert.notEqual(closed.code,200);
 assert.equal(h.fake.state().statements.size,0);
});

test('V2 signed terms are explicit, immutable, and survive close and approval using the original version',async()=>{
 const h=appFixture(),path='/api/owner/sales-command/terms';
 const terms={managerId:'alice',month:'2026-10',tier:'standard_v2',agreementReference:'SIGNED_NEW_V2_AGREEMENT',confirm:'SIGNED_AGREEMENT_CONFIRMED'};
 assert.equal((await h.request('POST',path,terms)).code,422);
 const signed={...terms,confirmMonthlyQuotaCents:216700,confirmCommissionBps:900};
 assert.equal((await h.request('POST',path,signed)).code,201);
 assert.equal((await h.request('POST',path,signed)).code,200);
 assert.equal((await h.terms()).code,422);
 for(let i=0;i<6;i++)assert.equal((await h.credit(h.addPaid('v2sale'+i))).code,201);
 const v=await h.request('GET','/api/sbc/sales/compensation/me',{},h.alice,{}, {month:'2026-10'});
 assert.equal(v.payload.commissionCents,12960);
 assert.equal(v.payload.quotaCents,216700);assert.equal(v.payload.tier,'standard_v2');
 const draft=await h.close();assert.equal(draft.code,200);
 assert.equal(draft.payload.statement.commissionCents,12960);
 assert.equal((await h.transition('approve')).code,200);
 assert.equal((await h.transition('paid','EXT_V2_001')).code,200);
 assert.equal(h.fake.state().statements.get(key(1,'alice','2026-10')).tier,'standard_v2');
});
