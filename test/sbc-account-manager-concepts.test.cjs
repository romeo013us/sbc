'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const policy=require('../enterprise/sbc-ai-concept-access.cjs');
const customer={id:'c1',tenantId:7,assignedTo:'am1'};
test('only owner or assigned account manager can prepare private concept',()=>{
 assert.equal(policy.canCreate({role:'owner',id:'owner',tenantId:7},customer,7),true);
 assert.equal(policy.canCreate({role:'account_manager',id:'am1',tenantId:7},customer,7),true);
 assert.equal(policy.canCreate({role:'account_manager',id:'am2',tenantId:7},customer,7),false);
 assert.equal(policy.canCreate({role:'account_manager',id:'am1',tenantId:8},customer,7),false);
 assert.equal(policy.canCreate({role:'lead_researcher',id:'am1',tenantId:7},customer,7),false);
 assert.equal(policy.canCreate({role:'manager',id:'am1',tenantId:7},customer,7),false);
 assert.equal(policy.canCreate({role:'account_manager',id:'am1',tenantId:7},{...customer,assignedTo:null},7),false);
});
test('assigned staff may not approve, publish, or send customer websites',()=>{
 assert.equal(policy.canRelease({role:'account_manager',id:'am1',tenantId:7}),false);
 assert.equal(policy.canRelease({role:'owner',id:'owner',tenantId:7}),true);
});
test('server handoff and ZIP vault enforce account-scoped creation, not global staff access',()=>{
 const handoff=fs.readFileSync(require.resolve('../enterprise/sbc-ai-site-handoff.cjs'),'utf8');
 const vault=fs.readFileSync(require.resolve('../enterprise/sbc-ai-zip-proposals.cjs'),'utf8');
 assert.match(handoff,/conceptOnly/);
 assert.match(vault,/conceptOnly/);
 assert.match(handoff,/app\.get\(ROOT,auth,conceptOnly/);
 assert.match(vault,/app\.post\(ROOT\+'\/uploads\/:tier',auth,conceptOnly/);
 assert.match(vault,/app\.post\(ROOT\+'\/uploads\/:uploadId\/select',auth,ownerOnly/);
});
test('owner and account manager see Generate and ChatGPT handoff in both browser roots',()=>{
 for(const root of ['public','browser_public']){
  const smart=fs.readFileSync(root+'/sbc-smart-calling-v1.js','utf8');
  const production=fs.readFileSync(root+'/sbc-website-production-v1.js','utf8');
  assert.match(smart,/account_manager/);
  assert.match(production,/canPrepareConcept/);
  assert.match(production,/sbcAIHandoffLaunch/);
 }
});
