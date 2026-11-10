'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=require('../enterprise/v66147-owner-sales-delivery-evidence.cjs');
const S=require('./v66147-stage-owner-revenue-activation.cjs');
const customers=[
 {id:'a',tenantId:1,status:'Lead',businessName:'Alpha Barber',phone:'3055551111',leadTemperature:'hot',source:'Lorna',updatedAt:'2026-11-09'},
 {id:'b',tenantId:1,status:'Lead',businessName:'Beta Salon',phone:'3055552222',leadTemperature:'warm',source:'Lorna',verificationStatus:'Verified'},
 {id:'c',tenantId:1,status:'Lead',businessName:'Missing Number',phone:'',leadTemperature:'hot',source:'Lorna'},
 {id:'d',tenantId:1,status:'Lead',businessName:'DNC Shop',phone:'3055554444',notes:'do not call'},
 {id:'e',tenantId:1,status:'Lead',businessName:'Corrupt \u0001 Text',phone:'3055555555'},
 {id:'f',tenantId:1,status:'Lead',businessName:'SBC SYSTEM TEST — DO NOT SERVICE',phone:'3055556666',source:'SBC V47 Full-Cycle Test'},
 {id:'paid',tenantId:1,status:'Customer',businessName:'Customer Genuine'},
 {id:'qa',tenantId:1,status:'Customer',businessName:'SBC SYSTEM TEST',source:'SBC V47 Full-Cycle Test'},
 {id:'foreign',tenantId:2,status:'Lead',businessName:'Foreign Lead',phone:'3055557777'}
];
const orders=[
 {id:'order-real',tenantId:1,customerId:'paid',customerName:'Customer Genuine',product:'Google Profile Setup',price:99,
  squareOrderId:'ord-12345',squarePaymentId:'pay-12345',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-09T20:00:00Z'},
 {id:'order-qa',tenantId:1,customerId:'qa',customerName:'SBC SYSTEM TEST',product:'Test order',price:1,
  squareOrderId:'ord-qa',squarePaymentId:'pay-qa',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-09T20:00:00Z'},
 {id:'order-status-only',tenantId:1,customerId:'paid',product:'Website',price:199,paymentStatus:'PAID'},
 {id:'foreign-order',tenantId:2,customerId:'foreign',product:'foreign',price:100,
  squareOrderId:'ord-foreign',squarePaymentId:'pay-foreign',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-09T20:00:00Z'}
];
const inspect=(opts={})=>R.inspect({tenantId:1,customers,orders,...opts});
const d=inspect();
assert.equal(d.readOnly,true);assert.equal(d.noCustomersChanged,true);assert.equal(d.noOrdersChanged,true);
assert.equal(d.callAuthorizedAutomatically,0);assert.equal(d.reviewedAutomatically,0);assert.equal(d.autoMessages,0);
assert.equal(d.leadShortlist.length,2);assert.deepEqual(d.leadShortlist.map(x=>x.id),['a','b']);
assert.equal(d.leadShortlist[0].reviewReason,'SOURCE_AND_IDENTITY_REVIEW_REQUIRED');
assert.equal(d.leadShortlist[1].reviewReason,'EXISTING_VERIFICATION_REVIEW_REQUIRED');
assert.equal(d.counts.missingCallablePhone,1);
assert.equal(d.counts.internalTestSkipped,1);
assert(d.counts.textOrSuppressionHeld>=2);
assert.equal(d.paidOrderCandidates.length,1);assert.equal(d.paidOrderCandidates[0].orderId,'order-real');
assert.equal(d.excludedQaOrders,1);assert.equal(d.statusOnlyOrdersNeedIndependentPaymentProof,1);
assert(!JSON.stringify(d).includes('Foreign Lead'));assert(!JSON.stringify(d).includes('foreign-order'));
assert(!JSON.stringify(d).includes('3055551111'),'no full phone export');
assert.equal(inspect({limit:1}).leadShortlist.length,1);
assert.throws(()=>inspect({tenantId:0}),/TENANT_CONTEXT_REQUIRED/);
const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const staged=S.patchServer(server);
assert.equal(S.patchServer(staged),staged);
new vm.Script(staged);
if(process.argv.includes('--staged'))assert.equal(server,staged,'compiled GoDaddy runtime must expose owner route');
const begin=staged.indexOf("app.get('/api/owner/revenue/activation-review'");
const end=staged.indexOf("app.get('/api/owner/lead-readiness'",begin);
assert(begin>0&&end>begin);
let handler;const queries=[];
vm.runInNewContext(staged.slice(begin,end),{
 app:{get(url,auth,owner,fn){assert.equal(url,'/api/owner/revenue/activation-review');assert.equal(auth,'authentication');assert.equal(owner,'owner-only');handler=fn}},
 auth:'authentication',ownerOnly:'owner-only',requireRequestTenant:()=>1,db:{customers,orders},
 mysqlPool:{async query(sql,args){queries.push(sql);assert.deepEqual(Array.from(args),[1]);
 return [[{n:sql.includes('sbc_customers')?8:3}]];}},
 require:p=>{assert.equal(p,'./enterprise/v66147-owner-sales-delivery-evidence.cjs');return R}
});
assert.equal(typeof handler,'function');
(async()=>{
 let response,status=200;
 const res={setHeader(k,v){assert.equal(k,'Cache-Control');assert.equal(v,'no-store')},
 status(n){status=n;return this},json(v){response=v;return this}};
 await handler({query:{limit:'20'}},res);
 assert.equal(status,200);
 assert.equal(response.paidOrderCandidates.length,1);
 assert.equal(response.projectionMatchesSql,true);
 assert.equal(queries.length,2);
 assert(queries.every(q=>/^SELECT COUNT\(\*\)/.test(q)&&q.includes('WHERE tenant_id=?')));
 console.log('PASS V66.147: owner-only, tenant-scoped, zero-contact lead review, QA-excluded order selection, SQL truth gate');
})().catch(e=>{console.error(e);process.exitCode=1});
