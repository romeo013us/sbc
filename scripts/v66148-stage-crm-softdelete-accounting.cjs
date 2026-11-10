'use strict';
/* V66.148 read-only SQL status-aware forensic contract (disposable CI stage).
 * Existing published/source server remains unchanged until the compiled release.
 * MySQL's retained Deleted tombstones are NOT automatically restored or touched.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66148_SQL_SOFT_DELETE_ACCOUNTING';
const OLD_CUSTOMERS="SELECT id FROM sbc_customers WHERE tenant_id=? ORDER BY id LIMIT 2001";
const NEW_CUSTOMERS="SELECT id,status FROM sbc_customers WHERE tenant_id=? ORDER BY id LIMIT 2001";
const OLD_ORDERS="SELECT id FROM sbc_orders WHERE tenant_id=? ORDER BY id LIMIT 2001";
const NEW_ORDERS="SELECT id,status FROM sbc_orders WHERE tenant_id=? ORDER BY id LIMIT 2001";
const OLD_FORENSICS=[
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
 "   (result.sqlTenantCustomers!==result.totalTenantCustomers||result.sqlTenantOrders!==result.totalTenantOrders);"
].join('\n');
const NEW_FORENSICS=[
 "  // "+MARK+": visible SQL rows and in-memory CRM must use the same Deleted filter.",
 "  result.sqlTenantCustomers=null;result.sqlTenantOrders=null;",
 "  result.sqlVisibleTenantCustomers=null;result.sqlVisibleTenantOrders=null;",
 "  result.sqlDeletedCustomerTombstones=null;result.sqlDeletedOrderTombstones=null;",
 "  result.sqlEvidence='UNAVAILABLE';",
 "  if(mysqlPool){try{",
 "   const [[customers]]=await mysqlPool.query('SELECT COUNT(*) AS n FROM sbc_customers WHERE tenant_id=?',[tid]);",
 "   const [[orders]]=await mysqlPool.query('SELECT COUNT(*) AS n FROM sbc_orders WHERE tenant_id=?',[tid]);",
 "   const [[visibleCustomers]]=await mysqlPool.query(\"SELECT COUNT(*) AS n FROM sbc_customers WHERE tenant_id=? AND COALESCE(status,'') <> 'Deleted'\",[tid]);",
 "   const [[visibleOrders]]=await mysqlPool.query(\"SELECT COUNT(*) AS n FROM sbc_orders WHERE tenant_id=? AND COALESCE(status,'') <> 'Deleted'\",[tid]);",
 "   result.sqlTenantCustomers=Number(customers?.n||0);",
 "   result.sqlTenantOrders=Number(orders?.n||0);",
 "   result.sqlVisibleTenantCustomers=Number(visibleCustomers?.n||0);",
 "   result.sqlVisibleTenantOrders=Number(visibleOrders?.n||0);",
 "   result.sqlDeletedCustomerTombstones=result.sqlTenantCustomers-result.sqlVisibleTenantCustomers;",
 "   result.sqlDeletedOrderTombstones=result.sqlTenantOrders-result.sqlVisibleTenantOrders;",
 "   result.sqlEvidence='TENANT_SCOPED_VISIBLE_AND_ALL_SELECT_ONLY';",
 "  }catch(_){result.sqlEvidence='QUERY_UNAVAILABLE';}}",
 "  result.projectionCountMismatch=result.sqlVisibleTenantCustomers===null?null:",
 "   (result.sqlVisibleTenantCustomers!==result.totalTenantCustomers||result.sqlVisibleTenantOrders!==result.totalTenantOrders);"
].join('\n');
function one(s,oldText,newText,label){
 const n=s.split(oldText).length-1;
 if(n!==1)throw Error('SOFT_DELETE_FORENSICS_ANCHOR_'+label+'_'+n);
 return s.replace(oldText,newText);
}
function patchServer(raw){
 let s=String(raw||'');
 if(s.includes(MARK))return s;
 if(!s.includes('SBC_V66146_OWNER_CRM_ID_RECONCILIATION')||
    !s.includes('SBC_V66144_CRM_FORENSIC_SEARCH'))throw Error('SQL_SOFT_DELETE_REQUIRES_OWNER_FORENSICS');
 s=one(s,OLD_CUSTOMERS,NEW_CUSTOMERS,'customers');
 s=one(s,OLD_ORDERS,NEW_ORDERS,'orders');
 s=one(s,OLD_FORENSICS,NEW_FORENSICS,'forensic-visible-count');
 s=one(s,"result.sqlEvidence!=='TENANT_SCOPED_SELECT_ONLY'",
   "result.sqlEvidence!=='TENANT_SCOPED_VISIBLE_AND_ALL_SELECT_ONLY'",'forensics-reliability');
 // Preserve raw counts and immutable prewrite snapshot, but compare the same
 // visible (not status='Deleted') set the runtime actually hydrated. Without
 // this, an increasing historical tombstone fraction can lock genuine CRM writes.
 const oldSafety='    const safety=assessPersistenceSafety(authoritativeCore,sourceCore);';
 const visibleSafety=[
  '    // SBC_V66148_VISIBLE_CORE_PERSISTENCE_GUARD: compare like-for-like loaded vs SQL.',
  '    const [[visibleCoreRow]]=await conn.query(`',
  '      SELECT',
  "       (SELECT COUNT(*) FROM sbc_customers WHERE tenant_id=? AND COALESCE(status,'') <> 'Deleted') AS customers,",
  "       (SELECT COUNT(*) FROM sbc_quotes WHERE tenant_id=? AND COALESCE(status,'') <> 'Deleted') AS quotes,",
  "       (SELECT COUNT(*) FROM sbc_orders WHERE tenant_id=? AND COALESCE(status,'') <> 'Deleted') AS orders,",
  "       (SELECT COUNT(*) FROM sbc_renewals WHERE tenant_id=? AND COALESCE(status,'') <> 'Deleted') AS renewals",
  '    `,[TENANT_DEFAULT_ID,TENANT_DEFAULT_ID,TENANT_DEFAULT_ID,TENANT_DEFAULT_ID]);',
  '    const visibleCore={customers:Number(visibleCoreRow?.customers||0),quotes:Number(visibleCoreRow?.quotes||0),',
  '      orders:Number(visibleCoreRow?.orders||0),renewals:Number(visibleCoreRow?.renewals||0)};',
  '    const safety=assessPersistenceSafety(visibleCore,sourceCore);'
 ].join('\\n');
 s=one(s,oldSafety,visibleSafety,'visible-persistence-safety');
 s=one(s,'      counts:authoritativeCore,\\n      sourceCounts:sourceCore,',
   '      counts:authoritativeCore,\\n      visibleCounts:visibleCore,\\n      sourceCounts:sourceCore,','preserve-raw-backup-census');
 return s;
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),src=fs.readFileSync(file,'utf8'),next=patchServer(src);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66148_ISOLATED_STAGE!=='YES')throw Error('SQL_SOFT_DELETE_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,next);
 }
 if(process.argv.includes('--verify-staged')&&src!==next)throw Error('SQL_SOFT_DELETE_NOT_IN_STAGED_RUNTIME');
 console.log('[V66.148] status-aware forensic route '+(next===src?'COMPILED_PRESENT':'VALIDATED'));
}
module.exports={MARK,patchServer,OLD_FORENSICS,NEW_FORENSICS};
