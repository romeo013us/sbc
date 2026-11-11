'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../enterprise/v66153-owner-contact-history.cjs');
const t=Date.parse('2026-11-11T14:00:00Z');
const iso=n=>new Date(t-n*60000).toISOString();
const customers=[
 {id:'a',tenantId:1,businessName:'Miami Auto Service',phone:'+13050001111'},
 {id:'b',tenantId:1,businessName:'Suppressed Customer',doNotContact:true},
 {id:'foreign',tenantId:2,businessName:'Other Tenant'}
];
const acts=[
 {id:'emailA',tenant_id:1,activity_type:'email',created_at:iso(5),meta_json:JSON.stringify({customerId:'a',to:'private@example.com',message:'private body'})},
 {id:'smsA',tenant_id:1,activity_type:'sms',created_at:iso(4),meta_json:JSON.stringify({customerId:'a',sid:'SMabc',providerStatus:'queued',deliveryConfirmed:false})},
 {id:'smsB',tenant_id:1,activity_type:'sms',created_at:iso(6),meta_json:JSON.stringify({customerId:'b',deliveryConfirmed:true})},
 {id:'callA',tenant_id:1,activity_type:'call',created_at:iso(3),meta_json:JSON.stringify({customerId:'a',callLogId:'logA',notes:'private notes'})},
 {id:'wrong',tenant_id:2,activity_type:'email',created_at:iso(4),meta_json:JSON.stringify({customerId:'foreign'})}
];
const calls=[{id:'logA',tenantId:1,customerId:'a',status:'completed',endedAt:iso(3),notes:'secret customer details'}];
const reports=[{id:'reportA',customerId:'a',createdAt:iso(2),outcome:'Called back',notes:'should never leak'}];
const params={tenantId:1,customers,activities:acts,callLogs:calls,callReports:reports,now:t,hours:168};
const r=M.summarize(params);
assert.equal(r.ok,true);assert.equal(r.readOnly,true);assert.equal(r.modelCreditsUsed,0);
assert.deepEqual(r.counts,{email:1,sms:2,call:2});
assert.equal(r.contactsWithRecordedEvents,2);
assert.equal(r.contacts[0].name,'Miami Auto Service');
assert.equal(r.contacts[0].latest.email.label,'Email accepted by SMTP');
assert.match(r.contacts[0].latest.sms.evidence,/delivery not confirmed/);
assert.equal(r.contacts.find(x=>x.customerId==='b').suppressed,true);
assert.equal(r.contacts.find(x=>x.customerId==='b').reviewAfter,null);
assert.equal(r.contacts.find(x=>x.customerId==='a').reviewAfter,new Date(Date.parse(iso(2))+7*86400000).toISOString());
for(const privateValue of ['private@example.com','secret customer details','secret customer','should never leak','Other Tenant','+13050001111','SMabc'])
 assert(!JSON.stringify(r).includes(privateValue),'private/cross-tenant data leaked: '+privateValue);
assert.throws(()=>M.summarize({...params,tenantId:0}),/TENANT_REQUIRED/);
assert.throws(()=>M.summarize({...params,hours:2}),/WINDOW_INVALID/);
assert.throws(()=>M.summarize({...params,activities:null}),/SOURCES_REQUIRED/);
const ROOT=path.resolve(__dirname,'..');
const server=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
assert(server.includes("app.get('/api/owner/communications/activity',auth,ownerOnly"),'owner-only route missing');
assert(server.includes('MYSQL_RECOVERY_REQUIRED')&&server.includes('sbc_activities'),'must use tenant SQL evidence');
const ui=fs.readFileSync(path.join(ROOT,'public/sbc-unattended-notifications-v6504.js'),'utf8');
assert(ui.includes('/api/owner/communications/activity?hours='),'history endpoint not connected');
assert(ui.includes('Customer Contact History'),'customer history heading missing');
assert(ui.includes('Review again after'),'seven-day review guidance absent');
assert.equal(ui,fs.readFileSync(path.join(ROOT,'browser_public/sbc-unattended-notifications-v6504.js'),'utf8'));
console.log('PASS owner contact history: tenant isolation, statuses, redaction, seven-day review, owner route/UI parity');
