'use strict';
/* V66.147 stage-only authenticated owner preview: no outreach, CRM mutations or vendor actions. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66147_OWNER_REVENUE_ACTIVATION_REVIEW';
const ANCHOR="app.get('/api/owner/lead-readiness',auth,ownerOnly,async(req,res)=>{";
const ROUTE=[
 "// SBC_V66147_OWNER_REVENUE_ACTIVATION_REVIEW owner-only, tenant-scoped read-side launch candidates.",
 "app.get('/api/owner/revenue/activation-review',auth,ownerOnly,async(req,res)=>{",
 " res.setHeader('Cache-Control','no-store');",
 " try{",
 "  const tid=requireRequestTenant(req);",
 "  const d=require('./enterprise/v66147-owner-sales-delivery-evidence.cjs').inspect({",
 "   tenantId:tid,customers:db.customers||[],orders:db.orders||[],limit:req.query?.limit",
 "  });",
 "  let customerCounts=null,orderCounts=null;",
 "  d.sqlEvidence='UNAVAILABLE';",
 "  if(mysqlPool){try{",
 "   const {readVisibleCounts}=require('./enterprise/v66146-crm-id-reconciliation.cjs');",
 "   [customerCounts,orderCounts]=await Promise.all([",
 "    readVisibleCounts(mysqlPool,tid,'customers'),readVisibleCounts(mysqlPool,tid,'orders')",
 "   ]);",
 "   d.sqlEvidence='TENANT_SCOPED_SELECT_ONLY';",
 "  }catch(_){d.sqlEvidence='QUERY_UNAVAILABLE';}}",
 "  d.sqlTenantCustomers=customerCounts?.total??null;",
 "  d.sqlTenantOrders=orderCounts?.total??null;",
 "  d.sqlVisibleTenantCustomers=customerCounts?.visible??null;",
 "  d.sqlVisibleTenantOrders=orderCounts?.visible??null;",
 "  d.projectionMatchesSql=customerCounts&&orderCounts?",
 "   customerCounts.visible===(db.customers||[]).filter(c=>c&&Number(c.tenantId??c.tenant_id)===tid).length&&",
 "   orderCounts.visible===(db.orders||[]).filter(o=>o&&Number(o.tenantId??o.tenant_id)===tid).length:null;",
 "  return res.json(d);",
 " }catch(e){return res.status(Number(e?.status)||503).json({ok:false,readOnly:true,error:String(e?.code||'OWNER_ACTIVATION_REVIEW_UNAVAILABLE')});}",
 "});",
 ""
].join('\n');
const LEAD_COUNTS=[
 "    let counts=null,sqlEvidence='unavailable';",
 "    try{if(mysqlPool){",
 "      const {readVisibleCounts}=require('./enterprise/v66146-crm-id-reconciliation.cjs');",
 "      counts=await readVisibleCounts(mysqlPool,tenantId,'customers');",
 "      sqlEvidence='SELECT_ONLY';",
 "    }}catch(_){sqlEvidence='query_unavailable';}",
 "    res.json({ok:true,version:BUILD_VERSION,recoveryRequired:Boolean(MYSQL_RECOVERY_REQUIRED),...result,",
 "      sqlTenantRecords:counts?.total??null,sqlVisibleTenantRecords:counts?.visible??null,",
 "      sqlDeletedRecordTombstones:counts?.deleted??null,sqlEvidence,",
 "      tenantHydrationDelta:counts?counts.visible-result.totalTenantRecords:null,",
 "      note:'Compares the loaded CRM count with tenant SQL rows excluding retained Deleted records.'});"
].join('\n');
function patchLeadCounts(source){
 const routeStart=source.indexOf(ANCHOR);
 const routeEnd=source.indexOf('\n});',routeStart);
 if(routeStart<0||routeEnd<0)throw Error('LEAD_READINESS_ROUTE_MISSING');
 const route=source.slice(routeStart,routeEnd);
 if(route.includes(LEAD_COUNTS))return source;
 const start=route.indexOf("    let sqlTenantRecords=null,sqlEvidence='unavailable';");
 const end=route.indexOf('\n  }catch(e){',start);
 if(start<0||end<0)throw Error('LEAD_READINESS_COUNT_ANCHOR_MISSING');
 return source.slice(0,routeStart+start)+LEAD_COUNTS+source.slice(routeStart+end);
}
function patchServer(input){
 const source=String(input||'');
 if(!source.includes('SBC_V66146_OWNER_CRM_ID_RECONCILIATION'))throw Error('ACTIVATION_REQUIRES_CRM_DIAGNOSTICS');
 const n=source.split(ANCHOR).length-1;
 if(n!==1)throw Error('ACTIVATION_SERVER_ANCHOR_'+n);
 if(!source.includes(MARK))return patchLeadCounts(source.replace(ANCHOR,ROUTE+ANCHOR));
 // The source branch retains the previous verified server. Upgrade the
 // existing activation handler only inside the isolated release build.
 const start=source.indexOf('// '+MARK);
 const end=source.indexOf('\n});',start);
 if(start<0||end<0||!source.slice(start,end).includes("app.get('/api/owner/revenue/activation-review',auth,ownerOnly,"))
  throw Error('ACTIVATION_EXISTING_ROUTE_MISSING');
 return patchLeadCounts(source.slice(0,start)+ROUTE.trimEnd()+source.slice(end+4));
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
