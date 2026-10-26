'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6640_PAYMENT_EVIDENCE_AND_SQUARE_PREFLIGHT';
function swap(s,old,updated,label){
 const count=s.split(old).length-1;
 if(count!==1)throw Error(MARKER+': '+label+' unexpected anchor count '+count);
 return s.replace(old,updated);
}
function apply(root){
 const ten=path.join(root,'enterprise/v56134-ten-brain.js');
 const god=path.join(root,'enterprise/v56134-god-tier-revenue.js');
 const sup=path.join(root,'enterprise/revenue-autopilot-supervisor-v552.js');
 const helper=path.join(__dirname,'../enterprise/v6640-payment-evidence.cjs');
 const target=path.join(root,'enterprise/v6640-payment-evidence.cjs');
 for(const file of [ten,god,sup,helper])if(!fs.existsSync(file))throw Error(MARKER+': missing '+file);
 let t=fs.readFileSync(ten,'utf8'),g=fs.readFileSync(god,'utf8'),s=fs.readFileSync(sup,'utf8');
 if(t.includes(MARKER)||g.includes(MARKER)||s.includes(MARKER))throw Error(MARKER+': already applied');
 t=swap(t,"const VERSION='56.13.4-10B';",
 "const VERSION='56.13.4-10B';\nconst PAYMENT_EVIDENCE=require('./v6640-payment-evidence.cjs');",'10-brain payment helper import');
 t=swap(t,"(orders||[]).filter(o=>!isSystemTestOrder(o)&&/PAID|COMPLETED|FULFILLED/i.test(String(o?.paymentStatus||o?.status||'')))",
 "(orders||[]).filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o))",'telemetry payment evidence');
 t=swap(t,"const paid=orders.filter(o=>!isSystemTestOrder(o)&&/PAID|COMPLETED|FULFILLED/i.test(String(o?.paymentStatus||o?.status||'')));",
 "const paid=orders.filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o));\n  const unverifiedFulfillmentOrders=orders.filter(o=>PAYMENT_EVIDENCE.unverifiedFulfillment(o)).length;",'10-brain paid snapshot');
 t=swap(t,"paidOrders:paid.length,recognizedRevenue:",
 "paidOrders:paid.length,unverifiedFulfillmentOrders,recognizedRevenue:",'10-brain ambiguity disclosure');
 g=swap(g,"const VERSION='56.13.4';","const VERSION='56.13.4';\nconst PAYMENT_EVIDENCE=require('./v6640-payment-evidence.cjs');",'God-Tier payment evidence import');
 const isPaidOld="function isPaid(order){\n  return PAID.has(String(order?.paymentStatus||'').toUpperCase()) ||\n    PAID.has(String(order?.squarePaymentStatus||'').toUpperCase()) ||\n    PAID.has(String(order?.status||'').toUpperCase());\n}";
 g=swap(g,isPaidOld,"function isPaid(order){return PAYMENT_EVIDENCE.confirmedPaid(order);}",'God-Tier trusted paid definition');
 g=swap(g,"paidOrders:paid.length,reconciliationCandidates:",
 "paidOrders:paid.length,unverifiedFulfillmentOrders:orders.filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.unverifiedFulfillment(o)).length,reconciliationCandidates:",
 'God-Tier ambiguity disclosure');
 const before="    let order=(db.orders||[]).find(o=>String(o.customerId)===String(c.id)";
 const after="    // "+MARKER+": reject a known-open Square circuit BEFORE changing order state.\n"+
 "    const sq=circuit('square');\n"+
 "    if(sq.state==='OPEN')throw Object.assign(new Error('square circuit is open.'),{code:'CIRCUIT_OPEN',retryAfterMs:Math.max(0,Number(sq.openedUntil||0)-Date.now())});\n"+
 "    if(sq.state==='HALF_OPEN'&&sq.halfOpenProbe)throw Object.assign(new Error('square half-open probe is busy.'),{code:'CIRCUIT_PROBE_BUSY'});\n"+
 before;
 s=swap(s,before,after,'preflight prior to mutating order list');
 for(const [f,code] of [[ten,t],[god,g],[sup,s]]){
   new vm.Script(code,{filename:path.basename(f)});
 }
 fs.copyFileSync(helper,target);
 fs.writeFileSync(ten,t);fs.writeFileSync(god,g);fs.writeFileSync(sup,s);
 return {marker:MARKER,files:['enterprise/v56134-ten-brain.js','enterprise/v56134-god-tier-revenue.js',
  'enterprise/revenue-autopilot-supervisor-v552.js','enterprise/v6640-payment-evidence.cjs'],
  noPaymentWrites:true,noDatabaseMigration:true,circuitPreflightBeforeOrderMutation:true,
  fulfillmentStateNotPaymentProof:true};
}
module.exports={apply,MARKER,swap};
