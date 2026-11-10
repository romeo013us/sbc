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
 const delivery=[
 "// SBC_V66144_ORDER_DELIVERY_ACCEPTANCE: owner-only SELECT and existing V400 read snapshot.",
 "app.get('/api/owner/delivery/acceptance/:orderId',auth,ownerOnly,async(req,res)=>{",
 " res.setHeader('Cache-Control','no-store');",
 " try{",
 "  const tid=requireRequestTenant(req),orderId=String(req.params.orderId||'');",
 "  const order=(db.orders||[]).find(o=>String(o.id)===orderId&&Number(o.tenantId??o.tenant_id)===tid);",
 "  if(!order)return res.status(404).json({ok:false,error:'ORDER_NOT_FOUND_IN_TENANT'});",
 "  if(!mysqlPool)return res.status(503).json({ok:false,error:'DURABLE_MYSQL_READBACK_REQUIRED'});",
 "  const [orderRows]=await mysqlPool.query('SELECT id,customer_id,status,fulfillment_status FROM sbc_orders WHERE tenant_id=? AND id=? LIMIT 1',[tid,orderId]);",
 "  const [jobs]=await mysqlPool.query('SELECT item_id,product,vendor,status,vendor_status,vendor_order_number,tracking_number FROM sbc_fulfillment_jobs WHERE tenant_id=? AND order_id=?',[tid,orderId]);",
 "  const customer=(db.customers||[]).find(c=>String(c.id)===String(order.customerId)&&Number(c.tenantId??c.tenant_id)===tid);",
 "  const result=require('./enterprise/v66144-order-delivery-acceptance.cjs').inspect({",
 "   tenantId:tid,order,customer,components:fulfillmentItemsForOrder(order),jobs:jobs||[],",
 "   committedOrder:orderRows?.[0]||null,fulfillment:V400.state.orders?.[orderId]||null",
 "  });",
 "  return res.json(result);",
 " }catch(e){return res.status(Number(e?.status)||503).json({ok:false,readOnly:true,error:String(e?.code||'DELIVERY_ACCEPTANCE_UNAVAILABLE')});}",
 "});",
 ""
 ].join('\\n');
 return s.replace(ANCHOR,route+delivery+ANCHOR);
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
