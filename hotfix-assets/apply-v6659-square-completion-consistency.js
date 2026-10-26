'use strict';
// Compiled runtime patch: fail closed before any Square payment/order mutation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6659_SQUARE_COMPLETION_CONSISTENCY';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' expected once found '+n);return s.replace(a,b);}
function patchServer(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate install');
 s=once(s,"const SBC_SQUARE_SAFETY=require('./enterprise/v6645-square-checkout-safety.cjs');",
 "const SBC_SQUARE_SAFETY=require('./enterprise/v6645-square-checkout-safety.cjs');\nconst SBC_V6659_SQUARE_PROOF=require('./enterprise/v6659-square-webhook-proof.cjs');\n// "+MARKER+': reconcile even when a legacy Paid text label predates real capture.',
 'register captured payment validator');
 const before="  if(!order)return {ignored:true,reason:'No matching SBC order',squareOrderId,squarePaymentId};";
 const after=before+"\n  // Validate Square order, location, payment ID, amount and currency before modifying anything.\n  if(status==='COMPLETED'){\n    const proof=SBC_V6659_SQUARE_PROOF.validateCompleted(payment,order,orderParsed(order),rec,process.env.SQUARE_LOCATION_ID);\n    if(!proof.ok)return {ok:false,orderId:order.id,status:'RECONCILIATION_REQUIRED',code:proof.code};\n  }";
 s=once(s,before,after,'guard before financial mutation');
 s=once(s,
  "  if(!rec){rec={id:id('sqpay'),sbcOrderId:order.id",
  "  // Refuse out-of-order PENDING/FAILED/CANCELED events that could undo recorded capture.\n  if(status!=='COMPLETED' && SBC_V6659_SQUARE_PROOF.persistedCompletion(orderParsed(order),{id:squarePaymentId,order_id:squareOrderId}))\n    return {ignored:true,reason:'STALE_NONCOMPLETED_EVENT_AFTER_CAPTURE',orderId:order.id};\n  if(!rec){rec={id:id('sqpay'),sbcOrderId:order.id",
  'no post-capture status downgrades');
 s=once(s,
  "    const alreadyPaid=String(order.paymentStatus||'').toUpperCase()==='PAID' || String(orderParsed(order).squarePaymentStatus||'').toUpperCase()==='PAID';",
  "    const alreadyPaid=SBC_V6659_SQUARE_PROOF.persistedCompletion(orderParsed(order),payment);",
  'real Square proof rather than a stale Paid label');
 new vm.Script(s,{filename:'server.js'});return s;
}
function apply(root){
 const serverPath=path.join(root,'server.js');
 const helperSource=path.join(__dirname,'../enterprise/v6659-square-webhook-proof.cjs');
 const helperTarget=path.join(root,'enterprise/v6659-square-webhook-proof.cjs');
 if(!fs.existsSync(serverPath)||!fs.existsSync(helperSource)||!fs.existsSync(path.dirname(helperTarget)))throw Error(MARKER+': required path missing');
 const patched=patchServer(fs.readFileSync(serverPath,'utf8'));
 new vm.Script(fs.readFileSync(helperSource,'utf8'),{filename:helperSource});
 fs.writeFileSync(serverPath,patched);fs.copyFileSync(helperSource,helperTarget);
 return {marker:MARKER,files:['server.js','enterprise/v6659-square-webhook-proof.cjs'],noProductionWrites:true};
}
module.exports={MARKER,patchServer,apply};
