'use strict';
// V66.77: readonly public-payment catalog consistency; does not create charges or write CRM data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const mirror=fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8');
assert.equal(app,mirror,'browser mirror must match canonical app');
const start=app.indexOf('function payments(){');
const end=app.indexOf('async function runFullSystemTestOrder()',start);
assert(start>=0&&end>start,'expected isolated payment-center surface');
const p=app.slice(start,end);
for(const [quantity,price] of [['100',40],['250',50],['500',75],['1,000',110]]){
 assert(p.includes('Business Cards — '+quantity+"',"+price),'missing canonical quantity/price: '+quantity);
}
assert(!p.includes('Business Cards — 200'), 'superseded 200-card label must not appear');
assert(p.includes("['cards250','Business Cards — 250',50"),'new distinct 250-card SKU required');
assert(p.includes("checkoutLinks.cards250='https://square.link/u/HxgFM50Y'"),'owner-confirmed $50 checkout required');
assert(p.includes("checkoutLinks.expeditedShipping9='https://square.link/u/EF7DTDhT'"),'owner-confirmed separate $9 shipping checkout required');
assert(!p.includes('250-card Square item requires verification'),'old unverified link warning must be removed');
assert(p.includes('Optional expedited business-card shipping — $9'),'shipping fee must remain opt-in');
assert(p.includes('never added automatically'),'shipping fee must not be automatic');
assert(p.includes('Do not treat a shipping-fee receipt as payment'),'shipping payment is not the base order');




assert(p.includes('Expedited delivery is an optional +$9'),'rush shipping remains optional');
assert(p.includes('8 business days after final proof'),'standard timing starts after proof');
assert(p.includes('three initial design concepts'),'included designs disclosed');
assert(p.includes('Google listing is free; SBC service covers setup work.'),'free underlying Google listing disclosed');
assert(p.includes('ongoing website management are separate'),'website support scope is not unlimited');
assert(p.includes('This screen is not a live Square transaction feed'),'no false live-payment claim');
assert(!p.includes('SBCCheckout.autoCharge'),'no new customer autocharge');
for(const expected of [
'Payment Center — choose the right checkout.',
'Verify Existing $1 Order (read-only)',
"checkoutLinks.essentials='https://square.link/u/c8wuNr1c'"
]){
 assert(app.includes(expected),'existing checkout/QA contract must remain: '+expected);
}
assert(fs.readFileSync(path.join(root,'public/sbc-v6675-payment-readback.js'),'utf8').includes('/api/payments/square/order/'), 'protected read-only QA order API must remain in its dedicated module');
console.log('[SBC V66.77] PASS: 250-card copy, three designs, shipping, setup scope, owner-confirmed two Square links, shipping opt-in, browser parity');
