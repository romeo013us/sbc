'use strict';
/**
 * V6693 P0: explicit Office Box purchases cannot run generic SBC customer
 * provisioning, storefront generation, GodKim fulfillment, intake emails,
 * or the legacy Big3 Office Box HTTP handoff BEFORE the first committed
 * Square payment snapshot. A later authorized V2 reconciler may enqueue
 * only after MySQL readback, fresh Square GET and writer lease verification.
 * Ordinary SBC sales keep their legacy behavior unchanged.
 *
 * This is a fail-closed exact-anchor patch for the ISOLATED compiler. Never
 * mutate a running runtime directly. No schema, worker or external I/O here.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6693_OFFICE_BOX_LEGACY_PRECOMMIT_QUARANTINE';
const BEGIN="async function handleSquarePaymentEvent(event,baseOverride=''){";
const END='\nconst PAYMENT_LINKS =';
const GENERIC_START="    try{await REVENUE_AUTOPILOT_V56150.recordFunnelEvent('payment_completed'";
const LEGACY_START="    try{const handoff=await sendBig3OfficeBoxHandoff(order,{reason:'square-payment-completed'});";
const GENERIC_END="\n  } else if(status==='CANCELED'||status==='FAILED'){";
function exactlyOnce(source,value,label){
 const n=source.split(value).length-1;
 if(n!==1)throw Error(MARKER+': '+label+' expected once, found '+n);
}
function patchServer(source){
 if(typeof source!=='string'||source.includes(MARKER))
  throw Error(MARKER+': absent or already installed source');
 exactlyOnce(source,BEGIN,'Square handler');
 const start=source.indexOf(BEGIN),end=source.indexOf(END,start);
 if(start<0||end<=start)throw Error(MARKER+': Square handler boundaries changed');
 let handler=source.slice(start,end);
 exactlyOnce(handler,GENERIC_START,'precommit generic fulfillment start');
 exactlyOnce(handler,LEGACY_START,'legacy Office Box handoff');
 exactlyOnce(handler,GENERIC_END,'end of completed Square branch');
 const sideEffectsStart=handler.indexOf(GENERIC_START);
 const sideEffectsEnd=handler.indexOf(GENERIC_END,sideEffectsStart);
 const legacyIndex=handler.indexOf(LEGACY_START);
 if(sideEffectsStart<0||sideEffectsEnd<=sideEffectsStart||
    legacyIndex<=sideEffectsStart||legacyIndex>=sideEffectsEnd)
  throw Error(MARKER+': unsafe side-effect boundaries');
 // Keep the original generic fulfillment content byte-for-byte, including
 // existing website/printing payment, commissions, tasks and intake behavior.
 const original=handler.slice(sideEffectsStart,sideEffectsEnd);
 if(!original.includes('SBC_COMMERCIAL.provisionTenant')||
    !original.includes('V569_PRODUCTION_EXPANSION.provisionStorefront')||
    !original.includes('GOD_KIM.orchestrate')||
    !original.includes('sendOrderIntake(order,baseOverride)')||
    !original.includes("addActivity('big3_office_box_handoff'"))
  throw Error(MARKER+': expected generic side-effect coverage missing');
 const selected=[
  "    // "+MARKER+": explicit Office Box sales require dedicated POST-COMMIT V2 flow.",
  "    const sbcOfficeBoxExplicitPurchase=(()=>{",
  "      const notes=orderParsed(order);",
  "      const lines=Array.isArray(notes.items)?notes.items:[];",
  "      const hasLine=lines.some(line=>/^OFFICE_BOX(?:_|$)/i.test(String(line?.sku||'')));",
  "      const hasMeta=/^OFFICE_BOX(?:_|$)/i.test(String(notes.officeBoxSku||order.officeBoxSku||''));",
  "      const hasName=/office[ _-]*box/i.test(String(order.product||'')+' '+String(notes.bundleId||''));",
  "      return hasLine||hasMeta||hasName;",
  "    })();",
  "    if(!sbcOfficeBoxExplicitPurchase){",
  original,
  "    }else{",
  "      addActivity('office_box_precommit_fulfillment_quarantined',",
  "        'Office Box paid capture saved; generic fulfillment and legacy invitation held for '+order.id,",
  "        {orderId:order.id,reason:'OFFICE_BOX_V2_COMMITTED_MYSQL_PROVIDER_PROOF_REQUIRED'});",
  "    }",
 ].join('\n');
 handler=handler.slice(0,sideEffectsStart)+selected+handler.slice(sideEffectsEnd);
 if(handler.indexOf('const sbcOfficeBoxExplicitPurchase')>
    handler.indexOf('SBC_COMMERCIAL.provisionTenant('))
  throw Error(MARKER+': generic vendor call occurs before quarantine decision');
 const patched=source.slice(0,start)+handler+source.slice(end);
 new vm.Script(patched,{filename:'server.js'});
 return patched;
}
function apply(root){
 const file=path.join(root,'server.js');
 if(!fs.existsSync(file))throw Error(MARKER+': compiled server missing');
 const patched=patchServer(fs.readFileSync(file,'utf8'));
 fs.writeFileSync(file,patched);
 return {marker:MARKER,files:['server.js'],noProductionWrites:true};
}
module.exports={MARKER,patchServer,apply};
