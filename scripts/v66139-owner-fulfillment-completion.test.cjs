'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const V400=require('../enterprise/kim-fulfillment-control-v400.js');
const date='2026-11-09T21:00:00.000Z',reference='GODADDY-2026-8742';
const base=(id,provider,item,stage)=>({
 id,stage,orderNumber:id,customerId:'owner-test-customer',customerName:'Synthetic',
 vendor:{provider,status:'SUBMITTED',orderId:'PO-2026-1942',trackingNumber:''},
 items:[{id:'item',name:item,qty:1}],assets:[],proofs:[],
 checklist:{payment:true,customer:true,items:true,assets:true,preflight:true,proof:true,approval:true,vendor:true,shipping:false,delivery:false},
 history:[],shipping:{status:'NOT_SHIPPED',carrier:'',trackingNumber:''},
 financial:{revenue:199,cost:50,margin:null},updatedAt:date
});
const id='sbc_v66139_digital_synthetic',physicalId='sbc_v66139_physical_synthetic';
const before=[V400.capture(id),V400.capture(physicalId)];
try{
 const website=base(id,'internal','One-page website & hosting','IN_PRODUCTION');
 V400.state.orders[id]=website;
 assert.equal(V400.digitalEligible(website),true);
 assert.equal(V400.digitalEligible({...website,items:[{name:'Business cards and website'}]}),false,
  'bundled print may not bypass shipping as a digital-only service');
 assert.equal(V400.digitalEligible({...website,vendor:{provider:'vistaprint'}}),false,
  'print provider may not declare website activation');
 assert.throws(()=>V400.deliver(id,{name:'Owner'},{}),/DELIVERY_PROOF_REQUIRED/);
 assert.throws(()=>V400.deliver(id,{name:'Owner'},{type:'carrier_delivered',reference,confirmedAt:date}),/PHYSICAL_DELIVERY_MUST_FOLLOW_SHIPPING/);
 assert.equal(V400.state.orders[id].stage,'IN_PRODUCTION','invalid delivery preserves stage');
 const digital=V400.deliver(id,{name:'Owner'},{type:'digital_activation',reference,confirmedAt:date});
 assert.equal(digital.digital,true);
 assert.equal(digital.shipping.status,'NOT_APPLICABLE_DIGITAL');
 assert.equal(V400.state.orders[id].stage,'DELIVERED');
 assert.equal(V400.state.orders[id].checklist.shipping,false,'no fabricated shipment');
 assert.equal(V400.state.orders[id].checklist.delivery,true);
 V400.advance(id,'FULFILLED',{name:'Owner'});
 assert.equal(V400.state.orders[id].stage,'FULFILLED');

 const p=base(physicalId,'vistaprint','100 Business Cards','SHIPPED');
 p.shipping={carrier:'USPS',trackingNumber:'9400111899223857773333',status:'SHIPPED'};
 V400.state.orders[physicalId]=p;
 assert.equal(V400.digitalEligible(p),false);
 assert.throws(()=>V400.deliver(physicalId,{name:'Owner'},{type:'digital_activation',reference,confirmedAt:date}),/DIGITAL_ACTIVATION_NOT_ELIGIBLE/);
 const received=V400.deliver(physicalId,{name:'Owner'},{type:'carrier_delivered',reference:'USPS-2026-1902',confirmedAt:date});
 assert.equal(received.digital,false);
 assert.equal(V400.state.orders[physicalId].stage,'DELIVERED');
 assert.equal(received.shipping.status,'DELIVERED');
 V400.advance(physicalId,'FULFILLED',{name:'Owner'});
 assert.equal(V400.state.orders[physicalId].stage,'FULFILLED');

 const ui=read('public/v40-fulfillment.js'),mirror=read('browser_public/v40-fulfillment.js');
 assert.equal(ui,mirror,'both fulfillment views must stay exactly in sync');
 new vm.Script(ui,{filename:'v40-fulfillment.js'});
 for(const token of ['Record Supplier Receipt','Start Production','Confirm Delivered',
  'Verify Digital Activation','Close Fulfillment','v400ConfirmDelivered=confirmDelivered'])
  assert(ui.includes(token),'missing owner workflow control '+token);
 const html=read('public/index.html');
 assert.equal(html,read('browser_public/index.html'),'both owner pages use identical release asset URLs');
 assert(html.includes('/v40-fulfillment.js?v=66.140-service-coverage'),'browser must load latest fulfillment UI');
 console.log('PASS V66.139: digital activation without fake shipping, vendor print proof, manual closure, owner UI, mirror, and cache');
}finally{
 for(const snapshot of before)V400.restore(snapshot);
}
