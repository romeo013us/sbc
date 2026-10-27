'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {assessPersistenceSafety}=require('../enterprise/integration/sbc-persistence-safety.cjs');

const baseline={customers:20,quotes:20,orders:20,renewals:20};

let r=assessPersistenceSafety(baseline,{customers:1,quotes:20,orders:20,renewals:20});
assert.strictEqual(r.ok,false);
assert.strictEqual(r.error,'CRM_BULK_REWRITE_BLOCKED_PARTIAL_SOURCE');

r=assessPersistenceSafety(baseline,{customers:0,quotes:20,orders:20,renewals:20});
assert.strictEqual(r.ok,false);
assert.strictEqual(r.error,'CRM_BULK_REWRITE_BLOCKED_SOURCE_EMPTY');

r=assessPersistenceSafety(baseline,{customers:17,quotes:20,orders:20,renewals:20});
assert.strictEqual(r.ok,false);
assert.strictEqual(r.error,'CRM_BULK_REWRITE_BLOCKED_PARTIAL_SOURCE');

r=assessPersistenceSafety(baseline,{customers:19,quotes:20,orders:20,renewals:20});
assert.strictEqual(r.ok,true);

r=assessPersistenceSafety({customers:0,quotes:0,orders:0,renewals:0},{customers:0,quotes:0,orders:0,renewals:0});
assert.strictEqual(r.ok,true);

const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
for(const table of ['sbc_customers','sbc_quotes','sbc_orders','sbc_renewals','sbc_activities','sbc_fulfillment_jobs']){
  assert(!new RegExp('DELETE\\\\s+FROM\\\\s+'+table,'i').test(server),`destructive delete remains for ${table}`);
}
assert(server.includes('ON DUPLICATE KEY UPDATE'),'row-level upsert path missing');
assert(server.includes('STALE_MODEL_REFUSED'),'optimistic concurrency refusal missing');
assert(!server.includes('db.customers=[]'),'legacy destructive startup reset remains');
console.log('V64.2.16 persistence safety behavior test: PASS');
