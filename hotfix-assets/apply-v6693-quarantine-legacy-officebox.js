'use strict';
/**
 * V6693: prevent uncommitted legacy Office Box invitations from paid Square
 * events containing an explicit Office Box purchase. This does NOT activate
 * V2; only a later approved, provider-confirmed durable worker may do that.
 * Normal SBC sales, CRM payment capture and unrelated fulfillment stay intact.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6693_OFFICE_BOX_LEGACY_PRECOMMIT_QUARANTINE';
const BEGIN="async function handleSquarePaymentEvent(event,baseOverride=''){";
const END='\nconst PAYMENT_LINKS =';
const START="    try{const handoff=await sendBig3OfficeBoxHandoff(order,{reason:'square-payment-completed'});";
const NEXT="\n    if(!orderParsed(order).customerIntakeSentAt)";
function exactlyOnce(source,value,label){
 const n=source.split(value).length-1;
 if(n!==1)throw Error(MARKER+': '+label+' expected exactly once; found '+n);
}
function patchServer(source){
 if(typeof source!=='string'||source.includes(MARKER))
  throw Error(MARKER+': absent or already installed source');
 exactlyOnce(source,BEGIN,'Square handler');
 const start=source.indexOf(BEGIN),end=source.indexOf(END,start);
 if(start<0||end<=start)throw Error(MARKER+': handler boundaries changed');
 let handler=source.slice(start,end);
 exactlyOnce(handler,START,'legacy handoff call');
 exactlyOnce(handler,NEXT,'customer intake continuation');
 const a=handler.indexOf(START),b=handler.indexOf(NEXT,a);
 if(b<=a)throw Error(MARKER+': unsafe handoff boundaries');
 const legacy=handler.slice(a,b);
 if(!legacy.includes("addActivity('big3_office_box_handoff'")||
    !legacy.includes("addActivity('big3_office_box_handoff_error'"))
  throw Error(MARKER+': legacy handoff signature changed');
 const guarded=[
  '    // '+MARKER+': no legacy Office Box provisioning before a committed capture.',
  '    const sbcOfficeBoxExplicitPurchase=(()=>{',
  '      const notes=orderParsed(order);',
  '      const lines=Array.isArray(notes.items)?notes.items:[];',
  "      const item=lines.some(line=>/^OFFICE_BOX(?:_|$)/i.test(String(line?.sku||'')));",
  "      const meta=/^OFFICE_BOX(?:_|$)/i.test(String(notes.officeBoxSku||order.officeBoxSku||''));",
  "      const product=/office[ _-]*box/i.test(String(order.product||'')+' '+String(notes.bundleId||''));",
  '      return item||meta||product;',
  '    })();',
  '    if(sbcOfficeBoxExplicitPurchase){',
  "      addActivity('office_box_legacy_handoff_quarantined',",
  "        'Office Box activation deferred until verified durable paid workflow for '+order.id,",
  "        {orderId:order.id,reason:'OFFICE_BOX_V2_COMMIT_PROOF_REQUIRED'});",
  '    }else{',
  legacy,
  '    }'
 ].join('\n');
 handler=handler.slice(0,a)+guarded+handler.slice(b);
 if(handler.indexOf('const sbcOfficeBoxExplicitPurchase')>=handler.indexOf('sendBig3OfficeBoxHandoff('))
  throw Error(MARKER+': legacy handoff not fenced');
 const patched=source.slice(0,start)+handler+source.slice(end);
 new vm.Script(patched,{filename:'server.js'});
 return patched;
}
function apply(root){
 const file=path.join(root,'server.js');
 if(!fs.existsSync(file))throw Error(MARKER+': compiled server missing');
 const original=fs.readFileSync(file,'utf8');
 const changed=patchServer(original);
 fs.writeFileSync(file,changed);
 return {marker:MARKER,files:['server.js'],noProductionWrites:true};
}
module.exports={MARKER,patchServer,apply};
