'use strict';
/* SBC V66.144 owner-only forensic search, disposable GoDaddy staging ONLY.
 * No SQL writes, CRM mutation, Square requests, contacts, or restore commands.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66144_CRM_FORENSIC_SEARCH';
const ANCHOR="app.get('/api/owner/lead-readiness',auth,ownerOnly,async(req,res)=>{";
function patchServer(input){
 let s=String(input||'');
 if(s.includes(MARK))return s;
 const count=s.split(ANCHOR).length-1;
 if(count!==1)throw Error('CRM_FORENSIC_ANCHOR_'+count);
 const route=[
 "// "+MARK+": no database mutations, contact attempts, or historical payment recreation.",
 "app.get('/api/owner/crm/forensics',auth,ownerOnly,async(req,res)=>{",
 " res.setHeader('Cache-Control','no-store');",
 " try{",
 "  const tid=requireRequestTenant(req);",
 "  const result=require('./enterprise/v66144-crm-forensics.cjs').inspect({",
 "   tenantId:tid,customers:db.customers||[],orders:db.orders||[],",
 "   query:req.query?.q,source:req.query?.source,createdBy:req.query?.createdBy,",
 "   status:req.query?.status,from:req.query?.from,to:req.query?.to,",
 "   limit:req.query?.limit,offset:req.query?.offset",
 "  });",
 "  result.sqlTenantCustomers=null;result.sqlTenantOrders=null;",
 "  result.sqlEvidence='UNAVAILABLE';",
 "  if(mysqlPool){try{",
 "   const [[customers]]=await mysqlPool.query('SELECT COUNT(*) AS n FROM sbc_customers WHERE tenant_id=?',[tid]);",
 "   const [[orders]]=await mysqlPool.query('SELECT COUNT(*) AS n FROM sbc_orders WHERE tenant_id=?',[tid]);",
 "   result.sqlTenantCustomers=Number(customers?.n||0);",
 "   result.sqlTenantOrders=Number(orders?.n||0);",
 "   result.sqlEvidence='TENANT_SCOPED_SELECT_ONLY';",
 "  }catch(_){result.sqlEvidence='QUERY_UNAVAILABLE';}}",
 "  result.projectionCountMismatch=result.sqlTenantCustomers!==null&&",
 "   (result.sqlTenantCustomers!==result.totalTenantCustomers||result.sqlTenantOrders!==result.totalTenantOrders);",
 "  if(result.projectionCountMismatch||result.sqlEvidence!=='TENANT_SCOPED_SELECT_ONLY')",
 "   result.notFoundInCurrentProjection=null;",
 "  return res.json(result);",
 " }catch(e){return res.status(Number(e?.status)||503).json({ok:false,readOnly:true,error:String(e?.code||'CRM_FORENSICS_UNAVAILABLE')});}",
 "});",
 ""
 ].join('\n');
 return s.replace(ANCHOR,route+ANCHOR);
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),original=fs.readFileSync(file,'utf8'),out=patchServer(original);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66144_ISOLATED_STAGE!=='YES')throw Error('CRM_FORENSIC_DISPOSABLE_STAGE_REQUIRED');
  fs.writeFileSync(file,out);console.log('V66.144 owner CRM forensic search staged');
 }else if(process.argv.includes('--verify-staged')){
  if(out!==original)throw Error('CRM_FORENSIC_NOT_IN_COMPILED_RELEASE');
  console.log('V66.144 owner CRM forensic search verified in compiled release');
 }else console.log('V66.144 anchors verified; source unchanged');
}
module.exports={MARK,patchServer};
