'use strict';
// V6642: make Kim's autonomous mission obey canonical payment + tenant rules.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6642_KIM_MISSION_FINANCIAL_GOVERNANCE';
function change(source,before,after,label){
 const count=source.split(before).length-1;
 if(count!==1)throw Error(MARKER+': '+label+' expected 1 source anchor; found '+count);
 return source.replace(before,after);
}
function apply(root){
 const file=path.join(root,'enterprise/v56135-kim-mission-controller.js');
 if(!fs.existsSync(file))throw Error(MARKER+': Kim mission controller unavailable');
 let s=fs.readFileSync(file,'utf8');
 if(s.includes(MARKER))throw Error(MARKER+': duplicate invocation');
 s=change(s,"const VERSION='56.13.5-KIM-MISSION';",
  "const VERSION='56.13.5-KIM-MISSION';\n"+
  "const PAYMENT_EVIDENCE=require('./v6640-payment-evidence.cjs');\n"+
  "const REVENUE_GATE=require('./v56134-god-tier-revenue.js');\n"+
  "// "+MARKER+": share verified payment and durable fulfillment rules.",
  'canonical payment gate');
 s=change(s,
 "function safeMetric(db){\n  const orders=Array.isArray(db?.orders)?db.orders:[];\n  const paid=orders.filter(o=>/PAID|COMPLETED|FULFILLED/i.test(String(o?.paymentStatus||o?.status||'')));",
 "function safeMetric(db){\n  const orders=Array.isArray(db?.orders)?db.orders:[];\n  const paid=orders.filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o));",
 'accurate Kim revenue');
 s=change(s,'function safeMetric(db){',
  [
  'function isSystemTestOrder(o){',
  ' if(!o||typeof o!==\'object\')return false;',
  ' if(o.testMode===true||o.sbcTest===true)return true;',
  ' const n=String(o.customerName||o.customer_name||\'\').trim().toLowerCase();',
  ' const p=String(o.product||o.productName||\'\').trim().toLowerCase();',
  ' const notes=String(o.notes||\'\').trim().toLowerCase();',
  ' return n===\'sbc system test — do not service\'||n===\'sbc system test - do not service\'||/system test|do not service/.test(p+\' \'+notes);',
  '}',
  'function safeMetric(db){'
  ].join('\n'),'exclude synthetic test orders');
 s=change(s,
 "async function persist(){try{await saveData?.();}catch(e){logger.warn?.('[KIM MISSION] persistence degraded:',e.message);}}",
 "async function persist(){if(typeof saveData!=='function')throw new Error('KIM_DURABLE_SAVE_UNAVAILABLE');await saveData();}",
 'failed durable save must not claim success');
 s=change(s,
 "  async function reconcilePaidOrders(limit=MAX_BATCH,tenantId=null){\n    refreshCanonicalDb();\n    const paid=(db?.orders||[]).filter(o=>tenantId===null||Number(o?.tenantId)===Number(tenantId)).filter(o=>/PAID|COMPLETED/i.test(String(o?.paymentStatus||o?.status||'')) && String(o?.metadata?.kimMissionFulfillmentStarted||'')!=='true').slice(0,Math.min(MAX_BATCH,Math.max(1,Number(limit)||MAX_BATCH)));",
 [
 "  const fulfillmentInFlight=new Set();",
 "  async function reconcilePaidOrders(limit=MAX_BATCH,tenantId=null){",
 "    const scopedTenant=__sbcRequireTenantId(tenantId);",
 "    refreshCanonicalDb();",
 "    const durableJobs=Array.isArray(db.fulfillmentJobs)?db.fulfillmentJobs:[];",
 "    const paid=(db?.orders||[]).filter(o=>Number(o?.tenantId)===scopedTenant)",
 "      .filter(o=>!isSystemTestOrder(o)&&PAYMENT_EVIDENCE.confirmedPaid(o))",
 "      .filter(o=>REVENUE_GATE.needsReconciliation(o,durableJobs))",
 "      .filter(o=>String(o?.metadata?.kimMissionFulfillmentStarted||'')!=='true')",
 "      .slice(0,Math.min(MAX_BATCH,Math.max(1,Number(limit)||MAX_BATCH)));"
 ].join('\n'), 'tenant-scoped settled and deduplicated fulfillment');
 s=change(s,
 "    for(const order of paid){\n      try{\n        if(typeof godKim?.orchestrate!=='function')throw new Error('GodKim fulfillment orchestrator unavailable.');",
 [
 "    for(const order of paid){",
 "      const oid=String(order.id);",
 "      if(fulfillmentInFlight.has(oid))continue;",
 "      if(REVENUE_GATE.orderRisk(order).ownerClearanceRequired){",
 "        results.push({orderId:order.id,status:'OWNER_CLEARANCE_REQUIRED',amount:Number(order.price||order.total||0)});",
 "        continue;",
 "      }",
 "      fulfillmentInFlight.add(oid);",
 "      try{",
 "        if(typeof godKim?.orchestrate!=='function')throw new Error('GodKim fulfillment orchestrator unavailable.');"
 ].join('\n'), 'owner veto and single-flight');
 s=change(s,
 "        emit('kim_fulfillment_recovery','Kim could not start fulfillment and preserved the order for recovery.',{orderId:order.id,error:e.message});\n      }\n    }",
 "        emit('kim_fulfillment_recovery','Kim could not start fulfillment and preserved the order for recovery.',{orderId:order.id,error:e.message});\n      }finally{fulfillmentInFlight.delete(oid);}\n    }",
 'release fulfillment lock on failure');

 s=change(s,
 "function overview(){try{refreshCanonicalDb()}catch(_){/* read-only boot may hydrate later */}return",
 "function overview(tenantId){const tenant=__sbcRequireTenantId(tenantId);try{refreshCanonicalDb()}catch(_){/* read-only boot may hydrate later */}"+
 "const scopedCustomers=(db?.customers||[]).filter(c=>Number(c?.tenantId)===tenant);"+
 "const scopedOrders=(db?.orders||[]).filter(o=>Number(o?.tenantId)===tenant);"+
 "const visibleCustomerIds=new Set(scopedCustomers.map(c=>String(c.id)));"+
 "const visibleOrderIds=new Set(scopedOrders.map(o=>String(o.id)));return",
 'require tenant on Kim mission overview');
 s=change(s,"metrics:safeMetric(db),recentEvents:state.events.slice(0,20),missions:(db?.customers||[]).filter(c=>c?.sbcKimMission)",
  "metrics:safeMetric({orders:scopedOrders}),recentEvents:state.events.filter(e=>Number(e.meta?.tenantId)===tenant||"+
  "(e.meta?.customerId&&visibleCustomerIds.has(String(e.meta.customerId)))||"+
  "(e.meta?.orderId&&visibleOrderIds.has(String(e.meta.orderId)))).slice(0,20),missions:scopedCustomers.filter(c=>c?.sbcKimMission)",
 'isolate Kim mission metrics, events, and progress');
 const routesFile=path.join(root,'routes/v56135-kim-mission.js');
 if(!fs.existsSync(routesFile))throw Error(MARKER+': Kim API routes missing');
 let routes=fs.readFileSync(routesFile,'utf8');
 routes=change(routes,'getController().overview()',
 'getController().overview(global.__SBC_REQUIRE_TENANT(req))','authenticated tenant scoping of overview route');
 new vm.Script(routes,{filename:'routes/v56135-kim-mission.js'});
 new vm.Script(s,{filename:'v56135-kim-mission-controller.js'});
 fs.writeFileSync(file,s);fs.writeFileSync(routesFile,routes);
 return {marker:MARKER,files:['enterprise/v56135-kim-mission-controller.js','routes/v56135-kim-mission.js'],
  noProviderCall:true,noSchemaChange:true,strictTenant:true,ownerClearance:true,durableSaveFailClosed:true};
}
module.exports={apply,MARKER,change};
