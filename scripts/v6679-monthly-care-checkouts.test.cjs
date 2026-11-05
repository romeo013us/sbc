'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const mirror=fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8');
assert.equal(src,mirror,'published and browser-public payment UI must remain identical');
const begin=src.indexOf('function payments(){'),end=src.indexOf('async function runFullSystemTestOrder()',begin);
assert(begin>=0&&end>begin,'payment screen boundaries preserved');
const payment=src.slice(begin,end);
assert(payment.includes('sbc-v6679-monthly-care'),'subscription checkout panel missing');
assert(payment.includes('const monthlyCarePlans=['),'subscription plan definition missing');
const plans=[
 ['SBC Website Care',79,'https://square.link/u/gxqiOz5W'],
 ['SBC Google Business Profile Care',79,'https://square.link/u/3q3PgBWR'],
 ['SBC Complete Local Presence Care',139,'https://square.link/u/kT4kfeCf']
];
for(const [name,price,url] of plans){
 assert(payment.includes("'"+name+"',"+price+","),'wrong care plan name or amount: '+name);
 assert(payment.split("'"+url+"'").length===2,'owner-supplied Square link must appear exactly once: '+name);
}
assert(payment.includes('MONTHLY · OPT-IN ONLY'),'recurring payment must be disclosed');
assert(payment.includes('No automatic enrollment, billing'),'do not imply automatic subscription');
assert(payment.includes('Verify in Square'),'owner confirmation still required');
assert(payment.includes('does not prove payment'),'no false checkout-completion claim');
assert(payment.includes('saving $19 per month'),'bundle savings must be correct');
assert(payment.includes('checkoutLinks.cards250='),'existing confirmed 250-card route preserved');
assert(payment.includes('checkoutLinks.expeditedShipping9='),'existing optional rush shipping preserved');
assert(payment.includes("checkoutLinks.essentials='https://square.link/u/c8wuNr1c'"),'$699 link preserved');
assert(src.includes('Verify Existing $1 Order (read-only)'),'original QA reconciliation preserved');
assert(!payment.includes('SBCCheckout.autoCharge'),'no automatic billing on payment screen');
console.log('[SBC V66.79 MONTHLY CARE] PASS: 3 recurring Square URLs, $79/$79/$139, no auto-enrollment, source parity');
