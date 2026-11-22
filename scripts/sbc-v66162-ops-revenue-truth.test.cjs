'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function inspect(data){
 const code=read('public/v32-2-upgrade.js').replace('  function metrics(){','  window.__TEST_METRICS__=function metrics(){');
 const window={state:{data}},document={readyState:'loading',addEventListener(){}};
 const context={window,document,console:{log(){}}};
 vm.runInNewContext(code,context,{filename:'v32-2-upgrade.js'});
 assert.equal(typeof window.__TEST_METRICS__,'function');
 return window.__TEST_METRICS__();
}
test('operations dashboard excludes status-only sales, refunded payments and synthetic test orders',()=>{
 const valid={id:'valid',customerId:'c1',price:200,cost:50,paymentStatus:'PAID',squarePaymentStatus:'COMPLETED',squarePaymentId:'sp1',squareOrderId:'so1',squarePaymentCompletedAt:'2026-11-21T18:00:00Z'};
 const fake={id:'status-only',price:799,cost:120,paymentStatus:'PAID'};
 const refunded={...valid,id:'refunded',squarePaymentId:'sp2',squareOrderId:'so2',price:500,paymentStatus:'REFUNDED'};
 const synthetic={...valid,id:'qa',squarePaymentId:'sp3',squareOrderId:'so3',sbcTest:true,price:900};
 const stopped={...valid,id:'stopped',squarePaymentId:'sp4',squareOrderId:'so4',squarePaymentStatus:'CHARGEBACK',price:400};
 const paidWithNoDate={...valid,id:'nodate',squarePaymentId:'sp5',squareOrderId:'so5',squarePaymentCompletedAt:'',price:100};
 const impossiblePrice={...valid,id:'invalid-amount',squarePaymentId:'sp6',squareOrderId:'so6',price:-80};
 const result=inspect({orders:[valid,fake,refunded,synthetic,stopped,paidWithNoDate,impossiblePrice],quotes:[{id:'quote',status:'Won',total:2000}]});
 assert.equal(result.paidOrders,1,'only captured and non-test Square order is counted');
 assert.equal(result.revenue,200,'quoted/won, status-only and test dollars excluded');
 assert.equal(result.cost,50,'only paid captured order direct costs deducted');
 assert.equal(result.margin,150);
});
test('operations UI labels ledger-derived figures conservatively',()=>{
 const code=read('public/v32-2-upgrade.js');
 assert(!code.includes('NET RECORDED MARGIN'));
 assert(!code.includes('Paid orders + won/paid quotes'));
 assert(code.includes('Square capture metadata'));
 assert.equal(code,read('browser_public/v32-2-upgrade.js'));
});
