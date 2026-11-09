'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const EVENTS=require('../enterprise/sbc-outbound-signed-events.cjs');
const {publicKey,privateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const env={SBC_SENDGRID_EVENT_PUBLIC_KEY:publicKey.export({type:'spki',format:'der'}).toString('base64')};
const time=Math.floor(Date.now()/1000).toString();
const body=Buffer.from(JSON.stringify([{event:'delivered',email:'hello@example.org',sbc_task_id:'taskA',
 sbc_tenant_id:'1',sg_event_id:'ev1'}]));
const signature=crypto.sign('sha256',Buffer.concat([Buffer.from(time),body]),privateKey).toString('base64');
assert.equal(EVENTS.verified(body,{timestamp:time,signature},env),true);
assert.equal(EVENTS.verified(body,{timestamp:time,signature:'invalid'},env),false);
assert.equal(EVENTS.verified(Buffer.from('[]'),{timestamp:time,signature},env),false);
assert.equal(EVENTS.verified(body,{timestamp:'1234567890',signature},env),false);
const db={tasks:[{id:'taskA',tenantId:1,type:'SBC Next-Day Call',customerId:'lead1',
 outboundEmailStatus:'PROVIDER_ACCEPTED_NOT_DELIVERED'}],
 customers:[{id:'lead1',tenantId:1,email:'hello@example.org',leadIntelligence:{sbcOutreach:{marketingEmailConsent:true,marketingEmailConsentAt:new Date().toISOString(),marketingEmailConsentSource:'SBC direct signup form record'}}}]};
const delivered=JSON.parse(body.toString());
let result=EVENTS.apply(db,delivered);
assert.deepEqual(result.changed,[{taskId:'taskA',event:'delivered'}]);
assert.equal(db.tasks[0].outboundEmailStatus,'DELIVERED_PROVIDER_VERIFIED');
result=EVENTS.apply(db,delivered);
assert.equal(result.changed.length,0,'duplicate event ignored');
result=EVENTS.apply(db,[{...delivered[0],sbc_tenant_id:2,sg_event_id:'ev2'}]);
assert.equal(result.changed.length,0,'cross-tenant rejected');
result=EVENTS.apply(db,[{...delivered[0],email:'other@example.org',sg_event_id:'ev3'}]);
assert.equal(result.changed.length,0,'wrong email rejected');
result=EVENTS.apply(db,[{...delivered[0],event:'group_unsubscribe',sg_event_id:'ev4'}]);
assert.equal(db.customers[0].leadIntelligence.sbcOutreach.emailUnsubscribed,true);
assert.equal(db.customers[0].leadIntelligence.sbcOutreach.marketingEmailConsent,false);
assert.match(db.tasks[0].outboundEmailStatus,/SUPPRESSED/);
result=EVENTS.apply(db,[{...delivered[0],event:'delivered',sg_event_id:'ev5'}]);
assert.match(db.tasks[0].outboundEmailStatus,/SUPPRESSED/,'late delivery cannot undo unsubscribe');
console.log('PASS SBC signed email receipts: ECDSA, body binding, replay, tenant, recipient, unsubscribe and late delivery');
