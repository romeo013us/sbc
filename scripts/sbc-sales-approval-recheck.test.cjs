'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {register}=require('../routes/sbc-sales-command-v1.cjs');
const month='2026-10',managerId='manager-1',tenantId=1;
function fixture({refund=false,disputed=false,price=3000,lockedProfit=284000,status='DRAFT'}={}){
 const handlers=new Map(),queries=[],writes=[];
 const paymentId='sp_accepted_001';
 const order={id:'sale-1',customerId:'cust-1',tenantId,price,paymentStatus:refund?'REFUNDED':'PAID',
  squareOrderId:'so_accepted_001',squarePaymentId:paymentId,squarePaymentStatus:disputed?'CHARGEBACK':'COMPLETED',
  squarePaymentCompletedAt:'2026-10-12T15:00:00Z'};
 const credit={tenant_id:tenantId,order_id:'sale-1',customer_id:'cust-1',manager_id:managerId,
  captured_at:'2026-10-12 15:00:00.000',gross_cents:300000,direct_cost_cents:16000,
  labor_cents:0,processing_cents:0,refund_cents:0,source:'NEW_CUSTOMER',
  square_payment_hash:crypto.createHash('sha256').update(paymentId).digest('hex')};
 const statement={tenant_id:tenantId,manager_id:managerId,month_key:month,tier:'standard',status,
  quota_cents:260000,revenue_cents:300000,profit_cents:lockedProfit,commission_cents:28400};
 let txn=false;
 const pool={async getConnection(){return {
  async beginTransaction(){txn=true},async commit(){txn=false},async rollback(){txn=false},release(){},
  async query(sql,args){queries.push({sql,args});
   if(sql.includes('FROM sbc_commission_statement_v1')&&sql.startsWith('SELECT'))return [[{...statement}]];
   if(sql.includes('FROM sbc_sales_credit_v1')&&sql.startsWith('SELECT'))return [[{...credit}]];
   if(sql.startsWith('INSERT INTO sbc_commission_audit_v1')){writes.push(sql);return [{affectedRows:1}]}
   if(sql.startsWith('UPDATE sbc_commission_statement_v1')){writes.push(sql);return [{affectedRows:1}]}
   throw Error('unexpected '+sql);
  }
 }}};
 register({get:(p,_a,h)=>handlers.set('GET '+p,h),post:(p,_a,h)=>handlers.set('POST '+p,h)},
  {auth:(_req,_res,next)=>next?.(),getContext:()=>({db:{users:[{id:managerId,tenantId,role:'account_manager',active:true}],orders:[order]},mysqlPool:pool,recoveryRequired:()=>false}),
   tenantForRead:r=>r.tenantId,writer:()=>{}});
 async function call(kind='approve'){
  const path='/api/owner/sales-command/statements/:managerId/:month/'+kind,
   handler=handlers.get('POST '+path);assert(handler);
  let code=200,body;
  const res={status(s){code=s;return this},json(x){body=x;return this}};
  const req={user:{id:'owner',tenantId,role:'owner',active:true},tenantId,params:{managerId,month},
   body:kind==='approve'?{confirm:'APPROVE_COMMISSION_STATEMENT'}:{confirm:'RECORD_ALREADY_SENT_PAYMENT',paymentReference:'EXT_001100'}};
  await handler(req,res);return {code,body};
 }
 return {call,writes,queries,get txn(){return txn}};
}
test('refund after monthly close blocks owner commission approval, no ledger write',async()=>{
 const f=fixture({refund:true});const r=await f.call();
 assert.equal(r.code,409,JSON.stringify(r));assert.equal(r.body.code,'CAPTURE_OR_ORDER_CHANGED_RECONCILIATION_REQUIRED');
 assert.equal(f.writes.length,0);assert.equal(f.txn,false);
});
test('chargeback after monthly close blocks owner approval and paid attestation',async()=>{
 const a=fixture({disputed:true});const r=await a.call();
 assert.equal(r.code,409,JSON.stringify(r));assert.equal(a.writes.length,0);
 const b=fixture({disputed:true,status:'APPROVED'});const paid=await b.call('paid');
 assert.equal(paid.code,409,JSON.stringify(paid));assert.equal(b.writes.length,0);
});
test('mismatched locked profit cannot be approved even if order remains captured',async()=>{
 const a=fixture({lockedProfit:99999});const r=await a.call();
 assert.equal(r.code,409,JSON.stringify(r));assert.equal(a.writes.length,0);
});
test('unchanged order can be approved without rejecting a valid locked statement',async()=>{
 const a=fixture();const r=await a.call();
 assert.notEqual(r.code,409,JSON.stringify(r));
 assert.equal(a.txn,false);
});
