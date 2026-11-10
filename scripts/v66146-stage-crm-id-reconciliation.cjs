'use strict';
/* V66.146, stage-only in disposable GitHub GoDaddy build. No source server rewrite. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66146_OWNER_CRM_ID_RECONCILIATION';
const ANCHOR="app.get('/api/owner/lead-readiness',auth,ownerOnly,async(req,res)=>{";
const ROUTE=[
 " // "+MARK+"; only tenant-scoped SELECT, no customer modification.",
 " app.get('/api/owner/crm/reconcile-ids',auth,ownerOnly,async(req,res)=>{",
 "  res.setHeader('Cache-Control','no-store');",
 "  try{",
 "   const tid=requireRequestTenant(req);",
 "   if(!mysqlPool)return res.status(503).json({ok:false,readOnly:true,error:'MYSQL_REQUIRED_FOR_ID_RECONCILIATION'});",
 "   const [cc]=await mysqlPool.query('SELECT COUNT(*) AS n FROM sbc_customers WHERE tenant_id=?',[tid]);",
 "   const [oc]=await mysqlPool.query('SELECT COUNT(*) AS n FROM sbc_orders WHERE tenant_id=?',[tid]);",
 "   const [customers]=await mysqlPool.query('SELECT id FROM sbc_customers WHERE tenant_id=? ORDER BY id LIMIT 2001',[tid]);",
 "   const [orders]=await mysqlPool.query('SELECT id FROM sbc_orders WHERE tenant_id=? ORDER BY id LIMIT 2001',[tid]);",
 "   const result=require('./enterprise/v66146-crm-id-reconciliation.cjs').inspect({",
 "    tenantId:tid,customers:db.customers||[],orders:db.orders||[],",
 "    sqlCustomers:customers||[],sqlOrders:orders||[],sqlCustomerCount:Number(cc?.[0]?.n),sqlOrderCount:Number(oc?.[0]?.n)",
 "   });",
 "   return res.json(result);",
 "  }catch(e){return res.status(503).json({ok:false,readOnly:true,error:'CRM_ID_RECONCILIATION_READ_UNAVAILABLE'});}",
 " });",
 ""
].join('\n');
function patchServer(input){
 const s=String(input||'');
 if(s.includes(MARK))return s;
 const n=s.split(ANCHOR).length-1;
 if(n!==1)throw Error('CRM_ID_RECONCILIATION_ANCHOR_'+n);
 if(!s.includes('SBC_V66144_CRM_FORENSIC_SEARCH'))throw Error('CRM_ID_RECON_REQUIRES_EXISTING_FORENSICS');
 return s.replace(ANCHOR,ROUTE+ANCHOR);
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),original=fs.readFileSync(file,'utf8'),next=patchServer(original);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66146_ISOLATED_STAGE!=='YES')throw Error('CRM_ID_RECONCILIATION_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,next);
 }
 if(process.argv.includes('--verify-staged')&&next!==original)throw Error('CRM_ID_RECONCILIATION_NOT_STAGED');
 console.log('[V66.146] tenant SQL ID reconciliation route '+(next===original?'PRESENT':'VALIDATED'));
}
module.exports={MARK,patchServer};
