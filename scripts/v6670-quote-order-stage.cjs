'use strict';
// V66.70: compile strict quote -> order checks into disposable staged GoDaddy runtime.
// Never modify release identity or published source except inside CI staging.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARK='SBC_V6670_QUOTE_ORDER_TRANSACTION_INTEGRITY';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARK+': '+label+' expected once found '+n);return s.replace(a,b)}
function patchServer(source){
 if(typeof source!=='string'||!source)throw Error(MARK+': master server required');
 if(source.includes(MARK))return {source,alreadyApplied:true};
 const start=source.indexOf("app.post('/api/sales-orders',auth,v25SalesAccess,");
 const end=source.indexOf("const PUBLIC_CHECKOUT_RATE=new Map();",start);
 if(start<0||end<=start)throw Error(MARK+': v25 sales route not found');
 let block=source.slice(start,end);
 const check=`const review=SBC_V6670_QUOTE_ORDER.examine({
 tenantId,customerId:b.customerId,quoteId:b.quoteId,clientRequestId:b.clientRequestId,
 total,quotes:db.quotes,orders:db.orders,customers:db.customers,email:b.customerEmail
});
if(!review.ok)return res.status(review.status).json({ok:false,code:review.code,noNewOrder:true,noPaymentLinkCreated:true});
if(review.existing)return res.status(200).json({
 ok:true,existing:true,orderId:review.existing.id,
 paymentStatus:'REQUIRES_AUTHORITATIVE_RECHECK',requiresReconciliation:true,
 noNewOrder:true,noPaymentLinkCreated:true,automaticRetry:false,
 message:'A matching order already exists. Check its saved payment link and Square status before continuing; do not charge again.'
});`;
 block=once(block,"let customerId=String(b.customerId||'');",check+"let customerId=String(b.customerId||'');",'pre-write order control');
 block=once(block,"notes:JSON.stringify({v25:true,quoteId,items,","notes:JSON.stringify({v25:true,quoteId,clientRequestId:String(b.clientRequestId||''),items,",'persist correlation key');
 const declaration="/* "+MARK+" */\nconst SBC_V6670_QUOTE_ORDER=require('./enterprise/v6670-quote-order-integrity.cjs');\n";
 const output=source.slice(0,start)+declaration+block+source.slice(end);
 new vm.Script(output,{filename:'sbc-v6670-compiled-server.js'});
 return {source:output,alreadyApplied:false};
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),before=fs.readFileSync(file,'utf8');
 const result=patchServer(before);
 if(patchServer(result.source).source!==result.source)throw Error(MARK+': not idempotent');
 if(process.argv.includes('--apply')){
  if(process.env.SBC_ENABLE_V6670_SOURCE_WRITE!=='YES')throw Error(MARK+': explicit CI write consent required');
  if(!result.alreadyApplied)fs.writeFileSync(file,result.source);
  console.log('[SBC V6670] staged compiled runtime updated; release receipt must be regenerated');
 }else console.log('[SBC V6670] PASS: master source compiles with idempotent quote-to-order acceptance');
}
module.exports={patchServer,MARK};