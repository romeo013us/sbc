'use strict';
/**
 * REVIEW-ONLY candidate — NOT registered in bootstrap or offline compiler.
 * Relocates the existing legacy Square->Office Box HTTP side effect after save.
 * Never enables new workers, schema mutation, or grants customer access.
 * This does NOT replace the legacy protocol with the V2 durable outbox.
 */
const vm=require('node:vm');
const MARKER='SBC_V6692_STAGED_OFFICE_BOX_AFTER_COMMIT';
const BEGIN="async function handleSquarePaymentEvent(event,baseOverride=''){";
const END='\nconst PAYMENT_LINKS =';
const SEND_START="    try{const handoff=await sendBig3OfficeBoxHandoff(order,{reason:'square-payment-completed'});";
const NEXT="\n    if(!orderParsed(order).customerIntakeSentAt)";
const SAVE="  records.splice(5000); await saveData(); return {ok:true,orderId:order.id,status:rec.status,squarePaymentId:rec.squarePaymentId};";
function exactlyOnce(source,value,label){
 const count=source.split(value).length-1;
 if(count!==1)throw Error(MARKER+': expected exactly one '+label+', found '+count);
}
function patchServer(source){
 if(typeof source!=='string'||source.includes(MARKER))throw Error(MARKER+': missing/previously patched source');
 exactlyOnce(source,BEGIN,'handler start');
 const begin=source.indexOf(BEGIN),end=source.indexOf(END,begin);
 if(begin<0||end<=begin)throw Error(MARKER+': handler boundaries changed');
 let handler=source.slice(begin,end);
 exactlyOnce(handler,SEND_START,'legacy paid handoff');
 exactlyOnce(handler,NEXT,'intake continuation');
 exactlyOnce(handler,SAVE,'terminal save');
 const pos=handler.indexOf(SEND_START),finish=handler.indexOf(NEXT,pos);
 if(finish<=pos)throw Error(MARKER+': unsafe handoff position');
 const old=handler.slice(pos,finish);
 if(!old.includes('big3_office_box_handoff_error')||!old.includes("addActivity('big3_office_box_handoff'"))
   throw Error(MARKER+': legacy handoff structure changed');
 const entry=BEGIN+'\n  // '+MARKER+': only send after the persisted payment and order commit.\n  let sbcOfficeBoxHandoffAfterSave=false;';
 handler=handler.replace(BEGIN,entry);
 const a=handler.indexOf(SEND_START),b=handler.indexOf(NEXT,a);
 handler=handler.slice(0,a)+'    sbcOfficeBoxHandoffAfterSave=true; // defer existing legacy HTTP until after commit.'+handler.slice(b);
 const after=[
  '  records.splice(5000);',
  '  // '+MARKER+': never send an invitation on a rejected payment commit.',
  '  const sbcOfficeBoxCommit=await saveData();',
  '  if(sbcOfficeBoxHandoffAfterSave &&',
  '     SBC_RUNTIME_READ_ONLY===false && MYSQL_RECOVERY_EVALUATED===true &&',
  '     MYSQL_RECOVERY_REQUIRED===false && sbcWriterLeaseReady===true &&',
  '     sbcWriterLeaseConn && mysqlPool && sbcOfficeBoxCommit?.skipped!==true){',
  old,
  '    // Legacy handoff updates order notes: persist its result too.',
  '    await saveData();',
  '  }',
  '  return {ok:true,orderId:order.id,status:rec.status,squarePaymentId:rec.squarePaymentId};'
 ].join('\n');
 handler=handler.replace(SAVE,after);
 const boundary=handler.indexOf('const sbcOfficeBoxCommit=await saveData()');
 if(handler.includes(SEND_START)&&handler.indexOf(SEND_START)<boundary)
   throw Error(MARKER+': legacy send is still pre-commit');
 const out=source.slice(0,begin)+handler+source.slice(end);
 new vm.Script(out,{filename:'server.js'});
 return out;
}
module.exports={MARKER,patchServer};
