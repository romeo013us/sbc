'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {patch,ANCHOR,MARKER}=require('./stage-account-social-v1.cjs');
test('safe patch changes only one known CRM registration anchor, default dark',()=>{
 const before=`'use strict';\n${ANCHOR}\n app.get('/api/v566/crm/customer-360/:id',auth,()=>{});\n};`;
 const result=patch(before);assert.equal(result.changed,true);
 assert(result.source.includes(MARKER));
 assert(result.source.includes("process.env.SBC_ACCOUNT_SOCIAL_V1 === '1'"));
 assert(result.source.includes("app.get('/api/v566/crm/customer-360/:id'"));
 assert.equal(patch(result.source).changed,false,'idempotent source patch');
});
test('safe patch fails closed for unknown or ambiguous source',()=>{
 assert.throws(()=>patch('unrecognized source'),/ANCHOR_MISSING_OR_AMBIGUOUS/);
 assert.throws(()=>patch(ANCHOR+'\n'+ANCHOR),/ANCHOR_MISSING_OR_AMBIGUOUS/);
});
