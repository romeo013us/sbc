'use strict';
/* V66.147 stage-only authenticated owner preview: no outreach, CRM mutations or vendor actions. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66147_OWNER_REVENUE_ACTIVATION_REVIEW';
const ANCHOR="app.get('/api/owner/lead-readiness',auth,ownerOnly,async(req,res)=>{";
const ROUTE=[
 "// "+MARK+" owner-only, tenant-scoped read-side launch candidates.",
 "app.get('/api/owner/revenue/activation-review',auth,ownerOnly,async(req,res)=>{",
 " res.setHeader('Cache-Control','no-store');",
 " try{",
 "  const tid=requireRequestTenant(req);",
 "  const d=require('./enterprise/v66147-owner-sales-delivery-evidence.cjs').inspect({",
 "   tenantId:tid,customers:db.customers||[],orders:db.orders||[],limit:req.query?.limit",
 "  });",
 "  d.sqlTenantCustomers=null;d.sqlTenantOrders=null;d.sqlEvidence='UNAVAILABLE';",
 "  if(mysqlPool){try{",
 "   const [[c]]=await mysqlPool.query('SELECT COUNT(*) AS n FROM sbc_customers WHERE tenant_id=?',[tid]);",
 "   const [[o]]=await mysqlPool.query('SELECT COUNT(*) AS n FROM sbc_orders WHERE tenant_id=?',[tid]);",
 "   d.sqlTenantCustomers=Number(c?.n||0);d.sqlTenantOrders=Number(o?.n||0);",
 "   d.sqlEvidence='TENANT_SCOPED_SELECT_ONLY';",
 "  }catch(_){d.sqlEvidence='QUERY_UNAVAILABLE';}}",
 "  d.projectionMatchesSql=d.sqlTenantCustomers===null?null:",
 "   d.sqlTenantCustomers===(db.customers||[]).filter(c=>c&&Number(c.tenantId??c.tenant_id)===tid).length&&",
 "   d.sqlTenantOrders===(db.orders||[]).filter(o=>o&&Number(o.tenantId??o.tenant_id)===tid).length;",
 "  return res.json(d);",
 " }catch(e){return res.status(Number(e?.status)||503).json({ok:false,readOnly:true,error:String(e?.code||'OWNER_ACTIVATION_REVIEW_UNAVAILABLE')});}",
 "});",
 ""
].join('\n');
function patchServer(input){
 const s=String(input||'');
 if(s.includes(MARK))return s;
 if(!s.includes('SBC_V66146_OWNER_CRM_ID_RECONCILIATION'))throw Error('ACTIVATION_REQUIRES_CRM_DIAGNOSTICS');
 const n=s.split(ANCHOR).length-1;if(n!==1)throw Error('ACTIVATION_SERVER_ANCHOR_'+n);
 return s.replace(ANCHOR,ROUTE+ANCHOR);
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),original=fs.readFileSync(file,'utf8'),next=patchServer(original);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66147_ISOLATED_STAGE!=='YES')throw Error('ACTIVATION_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,next);
 }
 if(process.argv.includes('--verify-staged')&&original!==next)throw Error('ACTIVATION_ROUTE_NOT_STAGED');
 console.log('[V66.147] owner activation read-only route '+(next===original?'PRESENT':'VALIDATED'));
}
module.exports={MARK,patchServer};
