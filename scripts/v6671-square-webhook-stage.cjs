'use strict';
// Only operates on CI's disposable release checkout; never edits GoDaddy live.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARK='SBC_V6671_SQUARE_AUTHORITATIVE_READBACK';
function once(s,old,next,label){
 const n=s.split(old).length-1;if(n!==1)throw Error(MARK+': '+label+' expected once, got '+n);
 return s.replace(old,next);
}
function patchServer(source){
 if(!source||typeof source!=='string')throw Error(MARK+': expected compiled server');
 if(source.includes(MARK))return {source,alreadyApplied:true};
 let s=source;
 const before="async function handleSquarePaymentEvent(event,baseOverride=''){\n  const payment=event?.data?.object?.payment||event?.data?.object||{};";
 const after="async function handleSquarePaymentEvent(event,baseOverride=''){\n  let payment=event?.data?.object?.payment||event?.data?.object||{};";
 s=once(s,before,after,'event payment declaration');
 s=once(s,
 "if(!order)return {ignored:true,reason:'No matching SBC order',squareOrderId,squarePaymentId};",
 "if(!order)return status==='COMPLETED'\n    ?{ok:false,status:'RECONCILIATION_REQUIRED',code:'SQUARE_COMPLETED_PAYMENT_UNMATCHED',squareOrderId,squarePaymentId}\n    :{ignored:true,reason:'No matching SBC order',squareOrderId,squarePaymentId};",
 'unmatched payment evidence');
 const old="  // Validate Square order, location, payment ID, amount and currency before modifying anything.\n  if(status==='COMPLETED'){";
 const next=`  // A signed webhook is only a notification. Read Square's authoritative Payment
  // before recognizing paid revenue; transient provider errors propagate to retry.
  if(status==='COMPLETED'){
    const provider=await squareApi('/v2/payments/'+encodeURIComponent(squarePaymentId));
    const checked=SBC_V6671_SQUARE_WEBHOOK.verifyReadback(payment,provider?.payment);
    if(!checked.ok)return {ok:false,orderId:order.id,status:'RECONCILIATION_REQUIRED',code:checked.code};
    payment=provider.payment;
  }
  // Validate Square order, location, payment ID, amount and currency before modifying anything.
  if(status==='COMPLETED'){`;
 s=once(s,old,next,'provider readback gate');
 s=once(s,
 "const SBC_V6659_SQUARE_PROOF=require('./enterprise/v6659-square-webhook-proof.cjs');",
 "const SBC_V6659_SQUARE_PROOF=require('./enterprise/v6659-square-webhook-proof.cjs');\n/* "+MARK+" */\nconst SBC_V6671_SQUARE_WEBHOOK=require('./enterprise/v6671-square-webhook-readback.cjs');",
 'readback helper import');
 const state="rec.status='PROCESSED';rec.processedAt=now();rec.result=result;rec.lastError='';";
 const n=s.split(state).length-1;
 if(n!==2)throw Error(MARK+': two queue paths expected got '+n);
 s=s.split(state).join("rec.status=SBC_V6671_SQUARE_WEBHOOK.outcome(result);rec.processedAt=now();rec.result=result;rec.lastError='';");
 new vm.Script(s,{filename:'sbc-v6671-staged-webhook-server.js'});
 return {source:s,alreadyApplied:false};
}
if(require.main===module){
 const filename=path.resolve(__dirname,'../server.js'),source=fs.readFileSync(filename,'utf8');
 const result=patchServer(source);
 if(patchServer(result.source).source!==result.source)throw Error(MARK+': non-idempotent compiler');
 if(process.argv.includes('--apply')){
  if(process.env.SBC_ENABLE_V6671_SOURCE_WRITE!=='YES')throw Error(MARK+': disposable CI write approval required');
  if(!result.alreadyApplied)fs.writeFileSync(filename,result.source);
  console.log('[SBC V6671] verified source compiler updated isolated staged runtime');
 }else console.log('[SBC V6671] PASS: Square readback and reconciliation boundaries compiled in-memory');
}
module.exports={patchServer,MARK};
