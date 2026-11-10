'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const DELIVERY=require('../enterprise/v66144-order-delivery-acceptance.cjs');
const FORENSICS=require('../enterprise/v66144-crm-forensics.cjs');
const STAGE=require('./v66144-stage-crm-forensics.cjs');
const at=new Date().toISOString();
const customer={id:'customer_real_001',tenantId:1,businessName:'Local Small Business',
 email:'owner@example.org',status:'Customer'};
const order={id:'ord_customer_real_001',tenantId:1,customerId:customer.id,product:'Website Design',price:199,
 status:'Delivered',fulfillmentStatus:'Delivered',paymentStatus:'Paid',
 squareOrderId:'square_order_real_001',squarePaymentId:'square_payment_real_001',
 squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:at,notes:'{}'};
const committed={id:order.id,customer_id:customer.id,status:order.status,fulfillment_status:order.fulfillmentStatus};
const proof={type:'digital_activation',reference:'GODADDY-2026-43877',confirmedAt:at};
const input={tenantId:1,order,customer,components:[{id:'website',name:'Website Design'}],
 jobs:[],committedOrder:committed,fulfillment:{deliveryEvidence:proof}};
let result=DELIVERY.inspect(input);
assert.equal(result.recordedWorkflowComplete,true,'all INTERNAL recorded digital evidence present');
assert.equal(result.productionCertified,false,'recorded proof is not provider or customer attestation');
assert.equal(result.providerReadbackIndependent,false);
assert.equal(result.customerConfirmedIndependently,false);
result=DELIVERY.inspect({...input,committedOrder:null});
assert.equal(result.recordedWorkflowComplete,false);
assert(result.blockers.includes('ORDER_SQL_READBACK_REQUIRED'));
result=DELIVERY.inspect({...input,order:{...order,squarePaymentId:''}});
assert(result.blockers.includes('PROVIDER_PAYMENT_PROOF_REQUIRED'));
result=DELIVERY.inspect({...input,order:{...order,id:'qaorder_owner1'}});
assert.equal(result.recordedWorkflowComplete,false);
assert(result.blockers.includes('INTERNAL_QA_NOT_CUSTOMER_REVENUE'));
assert.throws(()=>DELIVERY.inspect({...input,order:{...order,tenantId:2}}),/TENANT_ORDER_NOT_FOUND/);
const officeOrder={...order,id:'ord_officebox_001',product:'Office Box Business',status:'Paid',fulfillmentStatus:'Ready for Fulfillment'};
const office=DELIVERY.inspect({...input,order:officeOrder,committedOrder:{...committed,id:officeOrder.id,status:officeOrder.status,fulfillment_status:officeOrder.fulfillmentStatus},components:[{id:'officebox',name:'Office Box Business'}]});
assert.equal(office.officeBox,true);
assert.equal(office.recordedWorkflowComplete,false);
assert(office.blockers.includes('OFFICEBOX_PROVIDER_PERIOD_AND_TENANT_READBACK_REQUIRED'));
const printOrder={...order,id:'ord_print_001',product:'Business Cards — 100'};
const printable=DELIVERY.inspect({...input,order:printOrder,committedOrder:{...committed,id:printOrder.id},
 components:[{id:'cards',name:'Business Cards — 100'}],
 jobs:[{tenantId:1,item_id:'cards',vendor:'vistaprint',status:'delivered',vendor_status:'delivered',
 vendor_order_number:'VISTA-ORDER-2026-1244',tracking_number:'9400111899223857773333'}],
 fulfillment:{deliveryEvidence:{type:'carrier_delivered',reference:'USPS-2026-44551',confirmedAt:at}}});
assert.equal(printable.print,true);
assert.equal(printable.recordedWorkflowComplete,true);
assert.equal(printable.evidence.recordedSupplierOrderNumbers,1);
const unproven=DELIVERY.inspect({...input,order:printOrder,committedOrder:{...committed,id:printOrder.id},
 components:[{id:'cards',name:'Business Cards — 100'}],jobs:[],
 fulfillment:{deliveryEvidence:{type:'carrier_delivered',reference:'USPS-2026-44551',confirmedAt:at}}});
assert.equal(unproven.recordedWorkflowComplete,false);
assert(unproven.blockers.includes('VENDOR_ORDER_REFERENCE_REQUIRED'));
const bundleOrder={...order,product:'Business Starter',notes:JSON.stringify({bundleId:'starter-199'})};
const bundle=DELIVERY.inspect({...input,order:bundleOrder,
 components:[{id:'domain',name:'Domain Registration'},{id:'cards',name:'Business Cards — 100'}],jobs:[]});
assert.equal(bundle.recordedWorkflowComplete,false);
assert(bundle.blockers.includes('BUNDLE_ITEMS_OPEN'));
const unmapped=DELIVERY.inspect({...input,order:bundleOrder,components:[{id:'website',name:'Business Starter'}],jobs:[]});
assert(unmapped.blockers.includes('BUNDLE_RECIPE_MAPPING_REQUIRED'));
const src=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const stage=STAGE.patchServer(src);
new vm.Script(stage);
assert.equal(STAGE.patchServer(stage),stage);
assert(stage.includes("app.get('/api/owner/delivery/acceptance/:orderId'"));
if(process.argv.includes('--staged'))assert.equal(stage,src,'compiled release must include delivery acceptance API');
const a=stage.indexOf("app.get('/api/owner/delivery/acceptance/:orderId'");
const b=stage.indexOf("app.get('/api/owner/lead-readiness'",a);
assert(a>0&&b>a);
let route,sqlCount=0;
const handlers={};
vm.runInNewContext(stage.slice(a,b),{
 app:{get(p,_a,_b,fn){handlers[p]=fn}},auth(){},ownerOnly(){},
 requireRequestTenant:()=>1,db:{orders:[order],customers:[customer]},
 mysqlPool:{async query(query,args){sqlCount++;assert.deepEqual(Array.from(args),[1,order.id]);
 if(query.includes('FROM sbc_orders'))return [[committed]];
 if(query.includes('FROM sbc_fulfillment_jobs'))return [[]];
 throw Error('Unexpected SQL');}},
 require(p){assert(p.endsWith('v66144-order-delivery-acceptance.cjs'));return DELIVERY},
 fulfillmentItemsForOrder:()=>[{id:'website',name:'Website Design'}],
 V400:{state:{orders:{[order.id]:{deliveryEvidence:proof}}}}
});
route=handlers['/api/owner/delivery/acceptance/:orderId'];assert.equal(typeof route,'function');
(async()=>{
 let status=200,payload;
 const res={setHeader(){},status(n){status=n;return this},json(x){payload=x;return this}};
 await route({params:{orderId:order.id}},res);
 assert.equal(status,200);assert.equal(payload.orderId,order.id);
 assert.equal(payload.productionCertified,false);assert.equal(sqlCount,2);
 console.log('PASS V66.144: read-only SQL-backed customer-order delivery acceptance, QA exclusion, supplier/OfficeBox proof');
})().catch(e=>{console.error(e);process.exitCode=1});
