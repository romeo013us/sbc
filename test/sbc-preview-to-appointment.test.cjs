'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PREVIEW = require('../enterprise/sbc-preview-sales-policy.cjs');
const { patchServer, MARK } = require('../scripts/v66-stage-preview-to-appointment.cjs');

const owner={id:'owner',role:'owner',tenantId:1};
const caller={id:'sales-1',role:'caller',tenantId:1};
const customer={id:'customer-1',tenantId:1,assignedTo:'sales-1',businessName:'Synthetic Garage',status:'Lead'};
const demo={id:'demo-1',tenantId:1,customerId:customer.id,slug:'synthetic-garage-abcdef',status:'Draft'};

test('tenant and assignment gates fail closed for missing or foreign records',()=>{
 assert.equal(PREVIEW.sameTenant(customer,1),true);
 assert.equal(PREVIEW.sameTenant({...customer,tenant_id:2},1),false);
 assert.equal(PREVIEW.sameTenant({...customer,tenantId:undefined},1),false);
 assert.equal(PREVIEW.canOperate(customer,owner,1),true);
 assert.equal(PREVIEW.canOperate(customer,caller,1),true);
 assert.equal(PREVIEW.canOperate({...customer,assignedTo:'someone-else'},caller,1),false);
 assert.equal(PREVIEW.canOperate(customer,{...caller,tenantId:2},1),false);
 assert.equal(PREVIEW.canOperate(customer,{id:'research',role:'lead_researcher',tenantId:1},1),false);
 assert.equal(PREVIEW.canOperate(customer,{id:'hr',role:'hr_manager',tenantId:1},1),false);
 assert.equal(PREVIEW.canReadDemo(demo,customer,owner,1),true);
 assert.equal(PREVIEW.canReadDemo({...demo,tenantId:2},customer,owner,1),false);
 assert.equal(PREVIEW.canReadDemo(demo,{...customer,assignedTo:'other'},caller,1),false);
});

test('preview is never public or checkout-ready until explicit owner review',()=>{
 assert.equal(PREVIEW.publicReady(demo,customer),false);
 assert.equal(PREVIEW.publicReady({...demo,status:'Ready'},customer),false);
 assert.equal(PREVIEW.publicReady({...demo,status:'Approved'},customer),true);
 assert.equal(PREVIEW.publicReady({...demo,status:'Approved',tenantId:2},customer),false);
 assert.equal(PREVIEW.publicReady({...demo,status:'Approved',archived:true},customer),false);
 assert.equal(PREVIEW.canCheckout({...demo,status:'Approved'},customer),false);
 assert.equal(PREVIEW.canCheckout({...demo,status:'Approved',checkoutEnabled:true},customer),true);
 assert.throws(()=>PREVIEW.reviewApproval({reviewedDetails:true,reviewedVisuals:false,reviewedContent:true}),/PREVIEW_REVIEW_REQUIRED/);
 assert.deepEqual(PREVIEW.reviewApproval({reviewedDetails:true,reviewedVisuals:true,reviewedContent:true}),{status:'Approved',checkoutEnabled:false});
});

test('unguessable slugs and honest caller scripts never claim verification without evidence',()=>{
 const first=PREVIEW.newSlug('Synthetic Garage'),second=PREVIEW.newSlug('Synthetic Garage');
 assert.match(first,/^synthetic-garage-[a-f0-9]{32}$/);
 assert.notEqual(first,second);
 const script=PREVIEW.salesScript({businessName:'Synthetic Garage',googleBusinessWebsiteStatus:'not_checked'}, {status:'Approved'});
 assert.match(script,/website preview/i);
 assert.doesNotMatch(script,/noticed you (?:didn't|do not|don't) have a website/i);
 assert.match(PREVIEW.salesScript({businessName:'Synthetic Garage',googleBusinessWebsiteStatus:'verified_missing'}, {status:'Approved'}),/no website linked/i);
 assert.doesNotMatch(PREVIEW.salesScript(customer,{status:'Draft'}),/put together a website preview/);
});

test('release stage is idempotent and preserves signed master until isolated build',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const staged=patchServer(source);
 assert(staged.includes(MARK));
 assert.equal(patchServer(staged),staged);
 new vm.Script(staged);
 if(process.env.SBC_PREVIEW_EXPECT_STAGED==='YES')assert.equal(staged,source);
 assert.match(staged,/app\.get\('\/api\/website-demos\/:id\/preview',auth/);
 assert.match(staged,/app\.post\('\/api\/website-demos\/:id\/approve',auth,ownerOnly/);
 assert.match(staged,/SBC_PREVIEW_SALES\.publicReady\(d,c\)/);
 assert.match(staged,/SBC_PREVIEW_SALES\.canCheckout\(d,c\)/);
 assert.match(staged,/SBC_PREVIEW_SALES\.newSlug/);
 assert.match(staged,/status:'Draft'/);
 assert.match(staged,/SBC_PREVIEW_SALES\.canOperate/);
 assert.match(staged,/X-Robots-Tag/);
});
