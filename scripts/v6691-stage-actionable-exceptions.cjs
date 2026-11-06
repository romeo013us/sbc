'use strict';
/* V66.91: exact-anchor isolated-stage repair for legacy alerts.
 * Reuse canonical 10-Brain reconciliation. Never change payment, QA status,
 * vendor fulfillment, protected orders, or tenant assignment.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V6691_VERIFIED_ACTIONABLE_ALERTS';
const OLD="  orders.filter(o=>['Paid','PAID'].includes(String(o.paymentStatus||o.status))&&!['Completed','Delivered'].includes(String(o.fulfillmentStatus||''))).slice(0,20).forEach(o=>alerts.push({level:'warning',icon:'📦',title:'Paid order needs fulfillment',detail:\`${o.customerName||o.id} — ${o.product||'Order'}\`,orderId:o.id}));";
const NEW="  // "+MARK+": Square-proof, tenant-owned, no existing fulfillment job; system/QA tests excluded.\n  const exceptionTenantId=requireRequestTenant(req);\n  orders.filter(o=>Number(o.tenantId)===Number(exceptionTenantId)&&V56134_GOD_TIER.needsReconciliation(o,db.fulfillmentJobs||[])).slice(0,20).forEach(o=>alerts.push({level:'warning',icon:'📦',title:'Square-paid order needs reconciliation',detail:\`${o.customerName||o.id} — ${o.product||'Order'}\`,orderId:o.id}));";
function patchServer(source){
 const s=String(source||'');
 if(s.includes(MARK)){if(s.includes(OLD))throw Error('V6691_ALERT_MIXED_SOURCE');if(!s.includes(NEW))throw Error('V6691_ALERT_PATCH_MISMATCH');return s;}
 if(s.split(OLD).length!==2)throw Error('V6691_ALERT_ANCHOR_NOT_UNIQUE '+(s.split(OLD).length-1));
 if(!s.includes("const V56134_GOD_TIER = require('./enterprise/v56134-god-tier-revenue');"))throw Error('V6691_CANONICAL_REVENUE_MODULE_MISSING');
 if(!s.includes("function v23Alerts(req){"))throw Error('V6691_V23_ALERT_FUNCTION_MISSING');
 return s.replace(OLD,NEW);
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),original=fs.readFileSync(file,'utf8'),next=patchServer(original);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V6691_ISOLATED_STAGE!=='YES')throw Error('V6691_STAGE_ONLY');
  fs.writeFileSync(file,next);
  console.log('[SBC V66.91] QA-safe exception policy applied in disposable stage; regenerate receipt');
 }else console.log('[SBC V66.91] Read-only source check passed');
}
module.exports={MARK,OLD,NEW,patchServer};
