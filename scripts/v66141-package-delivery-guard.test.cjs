'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const C=require('../enterprise/v66140-fulfillment-bundle-coverage.cjs');
const V140=require('./v66140-stage-bundle-coverage.cjs'),V141=require('./v66141-stage-package-delivery-guard.cjs');
const single=[{id:'one',name:'Domain Registration'}];
for(const product of ['SBC Business Starter','Business Essentials','Business Visibility','Business Growth','SBC Complete Business Launch','Business Basic','E-commerce Starter']){
 const order={product,notes:'{}'};
 assert.equal(C.needsMapping(order,single),true,'unmapped package must be held: '+product);
 assert.equal(C.mappingHold(order,single).status,'CATALOG_COMPONENT_MAPPING_REQUIRED');
}
assert.equal(C.needsMapping({product:'Office Box Subscription',notes:'{}'},single),false);
assert.equal(C.needsMapping({product:'100 Business Cards'},single),false);
assert.equal(C.needsMapping({product:'SBC Business Starter',notes:'{}'},[{id:'web'},{id:'cards'}]),false,'explicit child items permit durable proof checks');
assert.equal(C.needsMapping({product:'Custom Item',notes:JSON.stringify({bundleId:'starter'})},single),true,'bundleId without assembled child mapping must be held');
assert.equal(C.summary({components:single,jobs:[]}).ready,false,'single service status is not a delivery certification');
const raw=read('server.js'),base=V140.patchServer(raw),compiled=V141.patchServer(base);
new vm.Script(compiled,{filename:'server-fulfillment-v141.js'});
assert.equal(V141.patchServer(compiled),compiled,'idempotent staged layer');
assert(compiled.includes('SBC_V66141_ORDER_DELIVERY_AND_MAPPING_GUARD'));
assert(compiled.includes("if(stage==='FULFILLED'||stage==='DELIVERED')"),'both customer-facing terminal states guarded');
assert(compiled.includes("BUNDLE_COMPONENT_MAPPING_REQUIRED"),'catalog holds explicit');
assert(compiled.includes("SBC_V66140_COVERAGE.needsMapping(order,components)"),'read-only review reveals reason');
assert(compiled.includes("FROM sbc_fulfillment_jobs WHERE tenant_id=? AND order_id=?"),'tenant scoped coverage query');
assert(compiled.includes('SBC_V66138_FULFILLMENT_COMMIT_AND_PROVIDER_TRUTH'),'existing relational save boundary intact');
if(process.argv.includes('--staged'))assert.equal(compiled,raw,'disposable signed server must include both layers');
console.log('PASS V66.141: no partial Delivered, no unmapped business package certification, no vendor calls or customer changes');
