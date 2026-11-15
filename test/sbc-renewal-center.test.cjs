'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const policy=require('../enterprise/sbc-package-renewals-v20261115.cjs');
const register=require('../routes/sbc-renewal-center.cjs').register;
const square={tenantId:7,id:'order_001',customerId:'cust_001',product:'SBC Business Basic',squareOrderId:'sqord_12345',squarePaymentId:'sqp_12345',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-01T12:00:00Z'};
const customer={id:'cust_001',tenantId:7,businessName:'Client A',email:'client@example.test'};
function fixture(){
 const calls=[];const db={orders:[square],customers:[customer]};let rows=[];
 const pool={async getConnection(){return {async beginTransaction(){},async commit(){},async rollback(){},release(){},async query(sql,params){
 calls.push([sql,params]);
 if(sql.includes('FROM sbc_orders'))return [[square]];
 if(sql.includes('FROM sbc_customers'))return [[customer]];
 if(sql.startsWith('SELECT')&&sql.includes('FROM sbc_renewals'))return [params?.length===2?rows.filter(r=>r.tenant_id===params[0]&&r.id===params[1]):rows.filter(r=>r.tenant_id===params[0])];
 if(sql.includes('INSERT INTO sbc_renewals')){rows.push({tenant_id:params[10],id:params[0],customer_id:params[1],customer_name:params[2],service:params[3],due_date:params[4],amount:params[5],status:params[6],notes:params[7],created_at:params[8],updated_at:params[9]});return [{affectedRows:1}]}
 if(sql.startsWith('UPDATE sbc_renewals')){const r=rows.find(x=>x.tenant_id===params[3]&&x.id===params[4]);if(r){r.notes=params[0];r.status=params[1];r.updated_at=params[2];return [{affectedRows:1}]}return [{affectedRows:0}]}
 throw Error('Unexpected SQL: '+sql);
 }}},async query(sql,params){return (await this.getConnection()).query(sql,params)}};
 const app={get(p,...h){this[p]=h.at(-1)},post(p,...h){this[p]=h.at(-1)}};
 register(app,{auth:()=>{},getContext:()=>({db,mysqlPool:pool,recoveryRequired:()=>false}),tenantForRead:req=>req.tenantId});
 async function call(path,{body={},role='owner',tenantId=7}={}){
  const res={statusCode:200,status(n){this.statusCode=n;return this},setHeader(){},json(x){this.data=x;return this}};
  await app[path]({body,user:{role},tenantId},res);return res;
 }
 return {db,rows,calls,call};
}
const body={customerId:'cust_001',orderId:'order_001',packageCode:'basic',service:'security',securitySelected:true,
 activatedOn:'2026-11-01',providerExpiresOn:'2027-11-01',providerReference:'GD-activation-2026',
 customerAcknowledgementEvidence:'Signed customer agreement and disclosure on 2026-11-01',
 providerAutoRenewState:'DISABLED',customerAcknowledgedTerms:true,activationProofConfirmed:true,ownerApproved:true};
test('owner-approved security pricing and first-year inclusion',()=>{
 assert.equal(policy.offer('starter').securityAnnualCents,12900);
 assert.equal(policy.offer('basic').securityAnnualCents,7900);
 assert.equal(policy.offer('basic').cards,100);
 assert.equal(policy.securityTerms('essentials').firstYearIncluded,true);
 assert.equal(policy.securityTerms('complete').customerYearTwoSecurityCents,null);
 assert.deepEqual(policy.REMIND_DAYS,[90,60,30,14,7,1]);
});
test('owner role and authenticated tenant enforced',async()=>{
 const f=fixture();assert.equal((await f.call('/api/owner/renewals/enroll',{body,role:'caller'})).statusCode,403);
 assert.equal((await f.call('/api/owner/renewals/enroll',{body,tenantId:8})).statusCode,422);
 assert.equal(f.rows.length,0);
});
test('requires Square payment evidence and customer approval evidence',async()=>{
 const f=fixture();assert.equal((await f.call('/api/owner/renewals/enroll',{body:{...body,customerAcknowledgedTerms:false}})).statusCode,422);
 f.db.orders=[{...square,squarePaymentId:''}];assert.equal((await f.call('/api/owner/renewals/enroll',{body})).statusCode,422);
 assert.equal(f.rows.length,0);
});
test('registration writes once and is fully idempotent',async()=>{
 const f=fixture();const r=await f.call('/api/owner/renewals/enroll',{body});assert.equal(r.statusCode,201,JSON.stringify(r.data));
 assert.equal(r.data.renewal.amount,79);
 const second=await f.call('/api/owner/renewals/enroll',{body});assert.equal(second.statusCode,200);assert.equal(second.data.idempotent,true);
 assert.equal(f.rows.length,1);
 const list=await f.call('/api/owner/renewals/overview');assert.equal(list.statusCode,200);assert.equal(list.data.renewals.length,1);
 assert.equal(list.data.renewals[0].automaticCharge,false);
});
test('manual contact record is idempotent and does not send',async()=>{
 const f=fixture();const reg=await f.call('/api/owner/renewals/enroll',{body});const renewalId=reg.data.renewal.id;
 assert.equal((await f.call('/api/owner/renewals/contact',{role:'caller',body:{renewalId,channel:'phone',outcome:'CONTACTED',note:'Discussed renewal'}})).statusCode,403);
 const contact={renewalId,channel:'phone',outcome:'CONTACTED',note:'Confirmed discussion and follow-up',clientRequestId:'outreach-event-001'};
 const one=await f.call('/api/owner/renewals/contact',{body:contact});assert.equal(one.statusCode,200,JSON.stringify(one.data));
 const replay=await f.call('/api/owner/renewals/contact',{body:contact});assert.equal(replay.data.idempotent,true);
 assert.equal(f.calls.filter(x=>x[0].startsWith('UPDATE sbc_renewals')).length,1);
});
