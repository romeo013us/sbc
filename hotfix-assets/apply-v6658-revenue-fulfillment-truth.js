'use strict';
// V66.58: status-only paid labels cannot dispatch vendor work or inflate the revenue broadcast.
// Operates on compiled runtime only; no provider calls, database writes or schema edits.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6658_PROVENANCE_REVENUE_FULFILLMENT';
function once(s,from,to,name){const n=s.split(from).length-1;if(n!==1)throw Error(MARKER+': '+name+' count='+n);return s.replace(from,to)}
function patchEvidence(s){
 if(!s.includes('SBC_V6657_SQUARE_TENANT_BOUNDARIES'))throw Error(MARKER+': missing V6657 prerequisite');
 s=once(s," if(!o||typeof o!=='object')return false;\n if(squareLinked(o)&&!providerCapturedSquare(o))return false;",
 " if(!o||typeof o!=='object')return false;\n // "+MARKER+": refunds dominate older paid labels.\n const proof=proofFields(o);\n if(NEGATIVE.has(norm(o.paymentStatus))||NEGATIVE.has(proof.state))return false;\n if(squareLinked(o)&&!providerCapturedSquare(o))return false;",'refund priority');
 s=once(s,
 " const paid=rows.filter(confirmedPaid);\n const ambiguous=rows.filter(unverifiedFulfillment);\n const sum=paid.reduce((n,o)=>n+Number(o.price||o.total||0),0);",
 " const paid=rows.filter(providerCapturedSquare);\n const historicalPaid=rows.filter(confirmedPaid);\n const ambiguous=rows.filter(unverifiedFulfillment);\n const amount=o=>{const n=Number(o?.price??o?.total??0);return Number.isFinite(n)&&n>0&&n<1e9?n:0;};\n const sum=paid.reduce((n,o)=>n+amount(o),0);",'snapshot proof');
 s=once(s,
 " return {paidOrders:paid.length,recognizedPaidRevenue:Number(sum.toFixed(2)),\n  unverifiedFulfillmentOrders:ambiguous.length,\n  methodology:'Verified paymentStatus or Square payment status; fulfillment status never implies payment.',\n  excludesUnverifiedFulfillment:true};",
 " return {paidOrders:paid.length,recognizedPaidRevenue:Number(sum.toFixed(2)),\n  historicalStatusPaidOrders:historicalPaid.length,statusOnlyPaidNeedsReview:rows.filter(statusOnlyPayment).length,\n  unverifiedFulfillmentOrders:ambiguous.length,\n  methodology:'SBC-recorded Square settlement metadata only; not independent Square/bank verification. Status-only paid labels excluded.',\n  excludesUnverifiedFulfillment:true,providerVerificationPending:true};",'truthful snapshot');
 return s;
}
function patchServer(s){
 return once(s,
 " if(!E.confirmedPaid(order)||(E.squareLinked(order)&&!E.providerCapturedSquare(order)))throw Object.assign(new Error('PAYMENT_EVIDENCE_REQUIRED'),{code:'PAYMENT_EVIDENCE_REQUIRED'});",
 " // "+MARKER+": no vendor work from status-only claims or incomplete receipts.\n if(!E.providerCapturedSquare(order))throw Object.assign(new Error('PAYMENT_EVIDENCE_REQUIRED'),{code:'PAYMENT_EVIDENCE_REQUIRED'});",'fulfillment proof');
}
function patchRevenue(s){
 s=once(s,"function isPaid(order){return PAYMENT_EVIDENCE.confirmedPaid(order);}",
 "// "+MARKER+": a paid label cannot cause an autonomous fulfillment attempt.\nfunction isPaid(order){return PAYMENT_EVIDENCE.providerCapturedSquare(order);}",'autopilot proof');
 s=once(s,'  const revenue=paid.reduce((n,o)=>n+Number(o.price||o.total||0),0);',
 '  const revenue=paid.reduce((n,o)=>{const x=Number(o?.price??o?.total??0);return n+(Number.isFinite(x)&&x>0&&x<1e9?x:0);},0);','safe revenue amount');
 s=once(s,"truthGate:'Paid status and external fulfillment are reported only from existing verified SBC state.'",
 "truthGate:'Square-backed value uses stored SBC settlement metadata, NOT verified cash deposits; paid labels excluded.'",'snapshot truth');
 return s;
}
function patchBrain(s){
 s=once(s,'orders||[]).filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o)',
 'orders||[]).filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.providerCapturedSquare(o)','brain revenue proof');
 s=once(s,'!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o)',
 '!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.providerCapturedSquare(o)','brain snapshot proof');
 s=once(s,'const revenue=(orders||[]).filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.providerCapturedSquare(o)).reduce((n,o)=>n+Number(o?.price||o?.total||0),0);',
 'const revenue=(orders||[]).filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.providerCapturedSquare(o)).reduce((n,o)=>{const x=Number(o?.price??o?.total??0);return n+(Number.isFinite(x)&&x>0&&x<1e9?x:0);},0);','brain finite amount');
 s=once(s,'Number(paid.reduce((n,o)=>n+Number(o?.price||o?.total||0),0).toFixed(2))',
 'Number(paid.reduce((n,o)=>{const x=Number(o?.price??o?.total??0);return n+(Number.isFinite(x)&&x>0&&x<1e9?x:0);},0).toFixed(2))','brain finite snapshot');
 s=once(s,"truth:'Observed SBC state only; no synthetic sales or revenue.'",
 "truth:'Square settlement metadata recorded by SBC, not proof of deposited cash; status-only orders excluded.'",'brain truth');
 return s;
}
function patchBroadcast(s){return once(s,'<small>PAID REVENUE</small>','<small>SQUARE-BACKED VALUE</small>','honest KPI label')}
function apply(root){
 const pairs=[['enterprise/v6640-payment-evidence.cjs',patchEvidence],['server.js',patchServer],
  ['enterprise/v56134-god-tier-revenue.js',patchRevenue],['enterprise/v56134-ten-brain.js',patchBrain],
  ['public/god-tier-broadcast-v56-13-4.js',patchBroadcast],
  ['browser_public/god-tier-broadcast-v56-13-4.js',patchBroadcast]];
 const prepared=pairs.map(([rel,fn])=>{
  const file=path.join(root,rel),source=fs.readFileSync(file,'utf8');
  if(source.includes(MARKER))throw Error(MARKER+': duplicate '+rel);
  const result=fn(source);new vm.Script(result,{filename:rel});return {file,rel,result};
 });
 for(const p of prepared)fs.writeFileSync(p.file,p.result);
 return {marker:MARKER,files:prepared.map(x=>x.rel),noCustomerWrites:true,noProviderCalls:true};
}
module.exports={MARKER,apply,patchEvidence,patchServer,patchRevenue,patchBrain,patchBroadcast};
