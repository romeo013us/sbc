'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const LEDGER=require('../enterprise/sbc-outreach-consent-ledger.cjs');
const MAIL=require('../enterprise/sbc-consented-outreach-email.cjs');
const RELAY=require('../enterprise/sbc-outreach-signed-mailbox-relay.cjs');
const customer={id:'contact1',tenantId:1,email:'customer@example.org',businessName:'Test Repair Shop',
 leadIntelligence:{verificationStatus:'Verified',preservedInfo:'must survive'}};
assert.equal(MAIL.hasConsent(customer),false);
const before=LEDGER.snapshot(customer);
const stamp=new Date(Date.now()-300000).toISOString();
const state=LEDGER.record(customer,{date:stamp,method:'signup_form',
 source:'SBC website opt-in form completed by customer'});
assert.equal(state.marketingEmailConsent,true);
assert.equal(MAIL.hasConsent(customer),true);
const hydrated={...customer,leadIntelligence:JSON.parse(JSON.stringify(customer.leadIntelligence))};
assert.equal(MAIL.hasConsent(hydrated),true,'consent survives relational JSON round trip');
assert.equal(hydrated.leadIntelligence.preservedInfo,'must survive');
LEDGER.suppress(customer,{reason:'MANUAL_UNSUBSCRIBE'});
assert.equal(MAIL.hasConsent(customer),false);
assert.throws(()=>LEDGER.record(customer,{date:stamp,method:'signup_form',source:'SBC website opt-in form'}),/FRESH_CONSENT/);
LEDGER.restore(customer,before);
assert.equal(MAIL.hasConsent(customer),false);
assert.equal(customer.leadIntelligence.preservedInfo,'must survive');
const secret=crypto.randomBytes(36).toString('hex');
const ts=String(Math.floor(Date.now()/1000));
const event={tenantId:1,messageId:'message-one',fromAddress:'customer@example.org',
 toAddress:'info@sbcmia.com',subject:'Re: A quick idea for Test Repair Shop',
 text:'Can you show me the demo website?'};
const raw=Buffer.from(JSON.stringify(event));
const sig=crypto.createHmac('sha256',secret).update(ts).update('.').update(raw).digest('hex');
const env={SBC_MAIL_RELAY_SECRET:secret};
assert.equal(RELAY.verify(raw,{timestamp:ts,signature:sig},env),true);
assert.equal(RELAY.verify(raw,{timestamp:ts,signature:'00'.repeat(32)},env),false);
assert.equal(RELAY.verify(Buffer.from('{}'),{timestamp:ts,signature:sig},env),false);
assert.equal(RELAY.verify(raw,{timestamp:String(Number(ts)-4000),signature:sig},env),false);
const db={customers:[customer,{id:'contact2',tenantId:2,email:'customer@example.org',businessName:'Foreign Tenant'}],
 tasks:[{id:'outbound1',tenantId:1,customerId:'contact1',type:'SBC Next-Day Call',
  outboundEmailStatus:'PROVIDER_ACCEPTED_NOT_DELIVERED',outboundEmailAcceptedAt:new Date().toISOString()}]};
let seq=0;
const apply=body=>RELAY.apply(db,body,{now:()=>new Date().toISOString(),makeId:p=>p+'_'+(++seq)});
let x=apply(event);
assert.equal(x.kind,'POSSIBLE_APPOINTMENT');
assert.equal(x.changed,true);
assert.equal(db.tasks.length,2);
assert.equal(db.tasks[0].type,'SBC Inbound Reply Review');
assert.equal(db.tasks[0].tenantId,1);
assert.equal(db.tasks[1].replyStatus,'RECEIVED_REVIEW_REQUIRED');
x=apply(event);
assert.equal(x.duplicate,true);
assert.equal(db.tasks.length,2);
assert.throws(()=>apply({...event,tenantId:2,messageId:'message-other'}),/NO_PREVIOUS_CONFIRMED_OUTBOUND_EMAIL/);
const existing=LEDGER.snapshot(customer);
const stop=apply({...event,messageId:'message-stop',text:'unsubscribe'});
assert.equal(stop.kind,'UNSUBSCRIBE');
assert.equal(LEDGER.outbound(customer).emailUnsubscribed,true);
assert.equal(MAIL.hasConsent(customer),false);
stop.undo();
assert.deepEqual(customer.leadIntelligence,existing.value);
const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');
assert.match(source,/JSON\.stringify\(c\.leadIntelligence\|\|\{\}\)/,'SQL stores lead intelligence to JSON');
assert.match(source,/safeJsonParse\(r\.lead_intelligence_json,\s*\{\}\)/,'SQL reads lead intelligence JSON');
console.log('PASS SBC outreach: SQL-durable opt-in/out, fresh re-consent, HMAC, reply triage, tenant isolation and retry rollback');
