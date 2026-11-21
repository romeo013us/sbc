'use strict';
// Command Center / Office Box boundary. No HTTP, payments, customer records, or DB.
const assert=require('node:assert/strict');
const {interpretAck}=require('../enterprise/v6674-officebox-v2-handoff.cjs');
const origin='https://31qflm5uk6.c24.airoapp.ai';
const correlationId='sbc_officebox_'+('a'.repeat(24));
const token='A'.repeat(43);
const validUrl=origin+'/activate?token='+token;
const event={ok:true,data:{accepted:true,duplicate:false,correlationId,activation_url:validUrl}};
const expected={correlationId,origin};
function rejected(reply,why){
 const r=interpretAck(reply,expected);
 assert.equal(r.accepted,false,why);
 assert.equal(r.activationUrl??null,null,why);
}
const good=interpretAck(event,expected);
assert.equal(good.accepted,true);
assert.equal(good.activationUrl,validUrl);
assert.equal(good.reason,'PENDING_CUSTOMER_ACTIVATION');
for(const v of [
 null,undefined,'sbc_officebox_'+('b'.repeat(24)),'',123
])rejected({...event,data:{...event.data,correlationId:v}},'ACK cannot authorize a different correlation');
for(const url of [
 'https://officebox-attacker.test/activate?token='+token,
 'https://31qflm5uk6.c24.airoapp.ai.attacker.test/activate?token='+token,
 'http://31qflm5uk6.c24.airoapp.ai/activate?token='+token,
 'https://user:pass@31qflm5uk6.c24.airoapp.ai/activate?token='+token,
 origin+'/wrong?token='+token,
 origin+'/activate?token=short',
 origin+'/activate?token='+token+'&redirect=https://attacker.test',
 origin+'/activate?token='+token+'#fragment',
 origin+'/activate',
 ''
])rejected({...event,data:{...event.data,activation_url:url}},'ACK activation must be same-origin, single-use and exact path');
const duplicate={ok:true,data:{accepted:true,duplicate:true,correlationId}};
const d=interpretAck(duplicate,expected);
assert.equal(d.accepted,true);
assert.equal(d.duplicate,true);
assert.equal(d.activationUrl,null);
rejected({...duplicate,data:{...duplicate.data,correlationId:'sbc_officebox_'+('b'.repeat(24))}},'duplicate ACK must match exact correlation');
assert.equal(interpretAck({ok:false},expected).accepted,false);
assert.equal(interpretAck(event,{correlationId}).accepted,false,'no trusted origin');
assert.equal(interpretAck(event,{origin}).accepted,false,'no exact event identifier');
console.log('SBC OFFICEBOX ACK ORIGIN CONTRACT PASS: exact correlation, expected origin, activation path/token and replay safety');
