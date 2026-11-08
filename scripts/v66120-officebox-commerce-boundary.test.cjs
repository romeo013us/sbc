'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const policy=require('../enterprise/v66120-officebox-commerce-boundary.cjs');
const stage=require('./v66120-stage-officebox-commerce-boundary.cjs');
const base={customerName:'Example Business',items:[{id:'website',name:'Website Design',qty:1,unitPrice:199}]};
assert.equal(policy.guardOneTimeSquareSale(base,base.items).ok,true);
for(const candidate of [
 {officeBoxSku:'OFFICE_BOX_BUSINESS'},
 {officeBoxPlan:'team'},
 {items:[{id:'office_box_business',name:'Business',unitPrice:99}]},
 {items:[{id:'office-box-starter',name:'Starter',unitPrice:49}]},
 {items:[{id:'other',name:'Office Box Professional',unitPrice:149}]},
 {items:[{id:'other',name:'Other',sku:'OFFICE_BOX_TEAM',unitPrice:199}]},
 {items:[{id:'other',name:'Other',officeBoxSku:'OFFICE_BOX_STARTER',unitPrice:49}]}
]){
 const body={...base,...candidate};
 const result=policy.guardOneTimeSquareSale(body,body.items);
 assert.equal(result.ok,false,JSON.stringify(candidate));
 assert.equal(result.code,'OFFICEBOX_RECURRING_CHECKOUT_REQUIRED');
}
assert.equal(policy.guardOneTimeSquareSale({items:[{id:'professional',name:'SBC Complete Business Launch',unitPrice:699}]},[{id:'professional',name:'SBC Complete Business Launch'}]).ok,true,'$699 one-time foundation must remain sellable');
assert.equal(policy.protectedNotes({items:[{id:'unlisted',sku:'OFFICE_BOX_BUSINESS'}]}),true);
assert.equal(policy.protectedNotes({officeBoxActivationUrl:'https://invalid.example.test/?token=do-not-issue'}),true);
assert.equal(policy.protectedNotes({items:[{id:'cards100',name:'Business Cards'}]}),false);
const original=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const patched=stage.patchServer(original);
assert.equal(stage.patchServer(patched),patched,'idempotent');
assert(patched.includes(stage.MARK));
assert(patched.includes('requiresRecurringCheckout:true'));
assert(patched.includes('SBC_V66120_OB_COMMERCE.protectedNotes(n)'));
assert(patched.indexOf('SBC_V66120_OB_COMMERCE.guardOneTimeSquareSale')<patched.indexOf("if(!String(b.customerName||'').trim())return res.status(400)"),'block before creating buyer/order/link');
assert(patched.includes("SBC_V66112_PAID_ORDER_AUTO_V2"),'post-commit V2 remains intact');
if(process.argv.includes('--staged'))assert.equal(original,patched,'verify shipped runtime exactly');
console.log('[SBC V66.120] PASS: no one-time Square Office Box subscription, no forged owner notes, foundation packages preserved; staged route idempotent');
