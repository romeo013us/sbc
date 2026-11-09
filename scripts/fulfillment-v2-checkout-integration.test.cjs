'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const worker=fs.readFileSync(path.join(__dirname,'../workers/checkout-event-worker.js'),'utf8');
test('existing canonical checkout worker stages work in original transaction',()=>{
 assert(worker.includes('SBC_FULFILLMENT_V2_PLAN_STEPS'));
 assert(worker.includes('SBC_FULFILLMENT_V2_SKUS'));
 assert(worker.includes('stagePaidCheckoutPlan(connection'));
 const at=worker.indexOf('stagePaidCheckoutPlan(connection');
 assert(at>worker.indexOf('await connection.beginTransaction()'));
 assert(at<worker.lastIndexOf('await connection.commit()'));
});
test('unmapped catalog recipe is held for owner review',()=>{
 assert.match(worker,/checkout\.order_id/);
 assert.match(worker,/NEEDS_CATALOG_MAPPING/);
 assert.match(worker,/owner_clearance_required/);
});
