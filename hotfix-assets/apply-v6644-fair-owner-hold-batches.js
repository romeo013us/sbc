'use strict';
/**
 * SBC V6644: fair autonomous fulfillment reconciliation. Owner-held orders
 * must not consume dispatch batch slots. This adjusts two established,
 * existing fulfillment paths without weakening payment/tenant/owner guards.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6644_FAIR_OWNER_HOLD_BATCH';
function replaceOnce(source,from,to,label){
 const count=source.split(from).length-1;
 if(count!==1)throw Error(MARKER+' '+label+' expected exactly one anchor, found '+count);
 return source.replace(from,to);
}
function apply(root){
 const km=path.join(root,'enterprise/v56135-kim-mission-controller.js');
 const gt=path.join(root,'enterprise/v56134-god-tier-revenue.js');
 if(!fs.existsSync(km)||!fs.existsSync(gt))throw Error(MARKER+' required runtime files missing');
 let k=fs.readFileSync(km,'utf8'),g=fs.readFileSync(gt,'utf8');
 if(k.includes(MARKER)||g.includes(MARKER))throw Error(MARKER+' applied twice');
 k=replaceOnce(k,
 "    const paid=(db?.orders||[]).filter(o=>Number(o?.tenantId)===scopedTenant)\n"+
 "      .filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o))\n"+
 "      .filter(o=>REVENUE_GATE.needsReconciliation(o,durableJobs))\n"+
 "      .filter(o=>String(o?.metadata?.kimMissionFulfillmentStarted||'')!=='true')\n"+
 "      .slice(0,Math.min(MAX_BATCH,Math.max(1,Number(limit)||MAX_BATCH)));\n"+
 "    const results=[];",
 [
 "    // "+MARKER+": partition BEFORE the slice; large owner holds must not starve small paid orders.",
 "    const cap=Math.min(MAX_BATCH,Math.max(1,Number(limit)||MAX_BATCH));",
 "    const eligible=(db?.orders||[]).filter(o=>Number(o?.tenantId)===scopedTenant)",
 "      .filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o))",
 "      .filter(o=>REVENUE_GATE.needsReconciliation(o,durableJobs))",
 "      .filter(o=>String(o?.metadata?.kimMissionFulfillmentStarted||'')!=='true');",
 "    const held=eligible.filter(o=>REVENUE_GATE.orderRisk(o).ownerClearanceRequired);",
 "    const paid=eligible.filter(o=>!REVENUE_GATE.orderRisk(o).ownerClearanceRequired)",
 "      .filter(o=>!fulfillmentInFlight.has(String(o.id))).slice(0,cap);",
 "    const results=held.slice(0,cap).map(o=>({orderId:o.id,status:'OWNER_CLEARANCE_REQUIRED',amount:REVENUE_GATE.orderRisk(o).amount}));"
 ].join('\n'),'Kim partition before limit');
 k=replaceOnce(k,
 "      if(REVENUE_GATE.orderRisk(order).ownerClearanceRequired){\n"+
 "        results.push({orderId:order.id,status:'OWNER_CLEARANCE_REQUIRED',amount:Number(order.price||order.total||0)});\n"+
 "        continue;\n"+
 "      }\n",
 "",'remove post-batch Kim holds');
 k=replaceOnce(k,
 "    if(results.length)await persist();\n"+
 "    return {processed:results.length,results};",
 "    // Holds are advisory and must not cause repeated MySQL writes every cycle.\n"+
 "    const attempted=results.filter(r=>r.status==='FULFILLMENT_ORCHESTRATED'||r.status==='RECOVERY').length;\n"+
 "    if(attempted)await persist();\n"+
 "    return {processed:results.length,attempted,heldForOwner:held.length,dispatchCandidates:paid.length,results};",
 'do not persist advisory holds');
 g=replaceOnce(g,
 "  const candidates=(db.orders||[]).filter(o=>needsReconciliation(o,jobs)).slice(0,max);\n"+
 "  const results=[];",
 [
 "  // "+MARKER+": owner holds remain visible but cannot occupy fulfillment slots.",
 "  const eligible=(db.orders||[]).filter(o=>needsReconciliation(o,jobs));",
 "  const held=eligible.filter(o=>orderRisk(o).ownerClearanceRequired);",
 "  const candidates=eligible.filter(o=>!orderRisk(o).ownerClearanceRequired).slice(0,max);",
 "  const results=held.slice(0,max).map(o=>({orderId:o.id,status:'OWNER_CLEARANCE_REQUIRED',amount:orderRisk(o).amount}));"
 ].join('\n'),'GodTier partition before limit');
 g=replaceOnce(g,
 "    const risk=orderRisk(order);\n"+
 "    if(risk.ownerClearanceRequired){\n"+
 "      results.push({orderId:order.id,status:'OWNER_CLEARANCE_REQUIRED',amount:risk.amount});\n"+
 "      continue;\n"+
 "    }\n",
 "",'remove post-batch GodTier holds');
 g=replaceOnce(g,
 "  return {ok:true,version:VERSION,processed:results.length,candidates:candidates.length,results,generatedAt:new Date().toISOString()};",
 "  return {ok:true,version:VERSION,processed:results.length,heldForOwner:held.length,candidates:candidates.length,results,generatedAt:new Date().toISOString()};",
 'GodTier hold coverage');
 for(const [f,content] of [[km,k],[gt,g]]){
  new vm.Script(content,{filename:path.basename(f)});
  fs.writeFileSync(f,content);
 }
 return {marker:MARKER,files:['enterprise/v56135-kim-mission-controller.js','enterprise/v56134-god-tier-revenue.js'],
  partitionBeforeLimit:true,highValueOwnerClearancePreserved:true,
  realPaymentsUntouched:true,tenantFilterPreserved:true,readOnlyReview:true};
}
module.exports={apply,MARKER,replaceOnce};
