'use strict';
// V66.22 - Offline Phase 2-4 cross-product security and sales eligibility contract.
// These tests intentionally run without HTTP, secrets, real CRM records or providers.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const website=require('../enterprise/v6660-website-bridge.cjs');
const leads=require('../enterprise/v6625-lead-readiness-audit.cjs');
const F4=require('../enterprise/fantastic4-launch-os.js');
const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');

// PHASE 2 - Actual server route and UI role boundaries must remain present.
assert.match(server,/app\.get\('\/api\/users',auth,ownerOnly,/,
 'staff account list stays authenticated and owner-only');
assert.match(server,/app\.get\('\/api\/workforce\/lorna',auth,/,
 'researcher endpoint remains authenticated');
assert.match(server,/canSubmitResearchLeads\(req\.user\)/,
 'researcher workspace enforces least-privilege gate');
assert.match(server,/function ownerOnly\(req,res,next\)/);
assert.match(server,/app\.post\('\/api\/owner\/launch-qa\/create-order',auth,ownerOnly,/,
 'no staff/demo $1 order creation');

// PHASE 3 - real bridge signature algorithm, tested with artificial body and key.
const key='fixture-only-website-bridge-secret-32-bytes-minimum';
const at='1700000000',nonce='abababababababababababababababab',body=Buffer.from('{"businessName":"Test Only"}');
const input={key,host:'sbcmia.com',method:'POST',path:'/api/web-lead',at,nonce,body};
const signed=website.signature(input);
const req={headers:{'x-sbc-website-host':'sbcmia.com','x-sbc-website-timestamp':at,
 'x-sbc-website-nonce':nonce,'x-sbc-website-signature':signed},method:'POST',
 path:'/api/web-lead',rawBody:body};
const opts={key,nowSeconds:Number(at)};
assert.equal(website.verify(req,opts).ok,true,'valid request is authorized');
assert.equal(website.verify(req,opts).code,'SITE_BRIDGE_REPLAY_DENIED','replay denied');
assert.equal(website.verify({...req,rawBody:Buffer.from('{"businessName":"Tampered"}')},opts).code,'SITE_BRIDGE_SIGNATURE_INVALID');
assert.equal(website.verify({...req,headers:{...req.headers,'x-sbc-website-host':'attacker.example'}},opts).code,'SITE_BRIDGE_ORIGIN_OR_ROUTE_DENIED');
assert.equal(website.verify({...req,method:'GET'},opts).code,'SITE_BRIDGE_ORIGIN_OR_ROUTE_DENIED');
assert.equal(website.verify({...req,path:'/api/owner/launch-gates'},opts).code,'SITE_BRIDGE_ORIGIN_OR_ROUTE_DENIED');
assert.equal(website.verify({...req,headers:{...req.headers,'x-sbc-website-nonce':'abcd'}},opts).code,'SITE_BRIDGE_SIGNATURE_INVALID');
assert.equal(website.verify(req,{key,nowSeconds:Number(at)+600}).code,'SITE_BRIDGE_TIMESTAMP_INVALID');
assert.equal(website.verify(req,{key:''}).code,'SITE_BRIDGE_NOT_CONFIGURED');

// Fantastic 4 dry runs are simulated ONLY. They cannot be reported as actual provisioning.
const store={},dry=F4.dryRun(store,{orderId:'SYNTHETIC_ONLY'});
assert.equal(dry.mode,'FULL_DRY_RUN');
assert.match(dry.note,/Simulation only/);
assert.ok(dry.steps.every(x=>x.status==='PASS'));
assert.equal(F4.summary(store,{}).providerGates.wordpress,false,
 'a simulated WordPress blueprint is not an active provider integration');
const checklist=F4.qaTemplate(store,{orderId:'SYNTHETIC_ONLY'});
assert.equal(checklist.status,'OPEN');
assert.equal(checklist.items.length,9);
assert.ok(checklist.items.every(x=>x.status==='OPEN'),
 'QA is not automatically completed by mock handoff');

// PHASE 4 - suppression, tenancy, test orders and human verification.
const records=[
 {id:'one',tenantId:1,status:'Lead',leadTemperature:'Hot',verificationStatus:'Verified',phone:'305-555-0101',email:'owner@example.com'},
 {id:'two',tenantId:1,status:'Lead',leadTemperature:'Warm',verificationStatus:'Pending',phone:'305-555-0102'},
 {id:'three',tenantId:1,status:'Do Not Call',leadTemperature:'Hot',verificationStatus:'Verified',phone:'3055550103'},
 {id:'four',tenantId:1,status:'Lead',leadTemperature:'Hot',verificationStatus:'Verified',phone:'3055550104',testMode:true},
 {id:'five',tenantId:1,status:'Customer',leadTemperature:'Hot',verificationStatus:'Verified',phone:'3055550105'},
 {id:'six',tenantId:2,status:'Lead',leadTemperature:'Hot',verificationStatus:'Verified',phone:'3055550106'},
 {id:'seven',tenantId:1,status:'Lead',leadTemperature:'Hot',verificationStatus:'Sales Ready',email:'owner@example.com'},
 {id:'eight',tenantId:1,status:'Lead',leadTemperature:'Hot',verificationStatus:'Verified',phone:'3055550108',notes:'unsubscribe'}
];
const q=leads.inspect(records,1,{limit:20});
assert.equal(q.totalTenantRecords,7);
assert.equal(q.synthetic,1);
assert.equal(q.suppressedOrTerminal,3);
assert.equal(q.verifiedHumanCallReady,1,'only verified, eligible human call candidate');
assert.equal(q.needsRecordVerification,1);
assert.equal(q.manualResearchQueue,1);
assert.deepEqual(q.manualCallLeadIds,['one']);
assert.deepEqual(q.researchLeadIds,['two']);
const countsOnly=leads.inspect(records,1,{limit:0});
assert.equal(countsOnly.verifiedHumanCallReady,q.verifiedHumanCallReady,
 'counts-only summary must preserve eligible lead totals');
assert.equal(countsOnly.manualResearchQueue,q.manualResearchQueue,
 'counts-only summary must preserve research totals');
assert.deepEqual(countsOnly.manualCallLeadIds,[],
 'limit=0 must not expose any human-call lead IDs');
assert.deepEqual(countsOnly.researchLeadIds,[],
 'limit=0 must not expose any research lead IDs');
assert.equal(leads.inspect(records,1,{}).manualCallLeadIds.length,1,
 'omitted limit retains existing default behavior');
assert.equal(q.verifiedNoPhone,1);
assert.equal(q.verifiedEmailReviewReady,2);
assert.equal(q.noAutomaticCalls,true);
assert.equal(q.noAutomaticSMS,true);
assert.equal(q.paidSalesNotInferred,true);
assert.throws(()=>leads.inspect(records,0),/TENANT_CONTEXT_REQUIRED/);
console.log('[SBC V6622 PHASES 2-4] PASS signed website bridge, replay/tamper protection, role boundaries, dry-run honesty, tenant-scoped human sales eligibility; no real calls or orders');
