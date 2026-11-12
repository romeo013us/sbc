'use strict';
/* V66.146: owner forensic reconciliation of tenant-scoped ID sets.
 * Pure read model. No SQL writes, customer data mutation, recovery, or contact.
 * SQL snapshots are explicitly non-atomic with respect to in-memory activity.
 */
const {invalidFields}=require('./crm-text-integrity-v66140.cjs');
const {suspicious}=require('./v66144-crm-forensics.cjs');
const SAMPLE_LIMIT=40;
const ID_QUERY_LIMIT=2001;
const CRM_TABLES={customers:'sbc_customers',orders:'sbc_orders'};
function tenant(n){
 const id=Number(n);
 if(!Number.isSafeInteger(id)||id<1)throw Object.assign(Error('CRM_RECON_TENANT_REQUIRED'),{code:'CRM_RECON_TENANT_REQUIRED',status:403});
 return id;
}
function key(v){return String(v??'').trim()}
async function readVisibleCounts(pool,tenantId,entity){
 if(!Object.hasOwn(CRM_TABLES,entity))throw Error('CRM_RECON_ENTITY_INVALID');
 const [rows]=await pool.query(
  `SELECT COUNT(*) AS total, COUNT(CASE WHEN COALESCE(status, '') <> 'Deleted' THEN 1 END) AS visible
   FROM ${CRM_TABLES[entity]} WHERE tenant_id=?`,[tenant(tenantId)]
 );
 const total=Number(rows?.[0]?.total??NaN),visible=Number(rows?.[0]?.visible??NaN);
 if(!Number.isSafeInteger(total)||!Number.isSafeInteger(visible)||visible<0||total<visible)
  throw Error('CRM_RECON_SQL_COUNT_INVALID');
 return {total,visible,deleted:total-visible};
}
function unique(rows){
 const seen=new Set(),duplicates=new Set(),missing=[];
 for(const row of rows){
  const id=key(row?.id);
  if(!id){missing.push(row);continue}
  if(seen.has(id))duplicates.add(id);
  seen.add(id);
 }
 return {seen,duplicates:[...duplicates].sort(),missingIdCount:missing.length};
}
function summarize(kind,tenantId,projectionRows,sqlRows,sqlCount){
 const tid=tenant(tenantId);
 const projected=(Array.isArray(projectionRows)?projectionRows:[]).filter(x=>x&&Number(x.tenantId??x.tenant_id)===tid);
 const observed=(Array.isArray(sqlRows)?sqlRows:[]);
 const total=Number(sqlCount);
 if(!Number.isSafeInteger(total)||total<0)throw Error('CRM_RECON_SQL_COUNT_INVALID');
 const truncation=total>=ID_QUERY_LIMIT||observed.length>=ID_QUERY_LIMIT||observed.length!==total;
 const sql=unique(observed),projection=unique(projected);
 const sqlOnly=[...sql.seen].filter(id=>!projection.seen.has(id)).sort();
 const projectionOnly=[...projection.seen].filter(id=>!sql.seen.has(id)).sort();
 // MySQL deliberately preserves "Deleted" tombstones. readRelational excludes
 // them from the loaded CRM and orders; do NOT mislabel these as lost rows.
 const sqlStatus=new Map(observed.map(r=>[key(r?.id),String(r?.status??'').trim().toLowerCase()]));
 const deleted=sqlOnly.filter(id=>sqlStatus.get(id)==='deleted');
 // Unknown or missing status must never be assumed soft-deleted.
 const unexplained=sqlOnly.filter(id=>sqlStatus.get(id)!=='deleted');
 const onlyTombstones=!truncation&&deleted.length>0&&unexplained.length===0&&
   projectionOnly.length===0&&projection.duplicates.length===0&&projection.missingIdCount===0;
 return {entity:kind,sqlCount:total,projectionCount:projected.length,
  recordCountDelta:total-projected.length,completeIdComparison:!truncation,
  sqlOnlyCount:truncation?null:sqlOnly.length,projectionOnlyCount:truncation?null:projectionOnly.length,
  sqlOnlySample:truncation?[]:sqlOnly.slice(0,SAMPLE_LIMIT),
  projectionOnlySample:truncation?[]:projectionOnly.slice(0,SAMPLE_LIMIT),
  sqlOnlyDeletedTombstones:truncation?null:deleted.length,
  sqlOnlyUnexplained:truncation?null:unexplained.length,
  sqlOnlyUnexplainedSample:truncation?[]:unexplained.slice(0,SAMPLE_LIMIT),
  expectedSoftDeleteExclusionOnly:onlyTombstones,
  duplicateProjectionIds:projection.duplicates.slice(0,SAMPLE_LIMIT),
  blankProjectionIds:projection.missingIdCount,
  evidenceState:truncation?'INCOMPLETE_SQL_ID_WINDOW':
   onlyTombstones?'SQL_DELETED_TOMBSTONES_EXCLUDED_AS_DESIGNED':
   sqlOnly.length||projectionOnly.length||projection.duplicates.length||projection.missingIdCount?'ID_RECONCILIATION_REQUIRED':
   'PROJECTION_SQL_IDS_AGREE_AT_READ_TIME'};
}
function inspect({tenantId,customers=[],orders=[],sqlCustomers=[],sqlOrders=[],sqlCustomerCount,sqlOrderCount}={}){
 const tid=tenant(tenantId);
 const c=summarize('customers',tid,customers,sqlCustomers,sqlCustomerCount);
 const o=summarize('orders',tid,orders,sqlOrders,sqlOrderCount);
 const suspect=(Array.isArray(customers)?customers:[]).filter(x=>x&&Number(x.tenantId??x.tenant_id)===tid&&suspicious(x));
 const fields=suspect.map(x=>({id:key(x.id),
  fields:invalidFields(x).length?invalidFields(x):['legacy_identity_pattern'],
  status:key(x.status).slice(0,50)})).sort((a,b)=>a.id.localeCompare(b.id));
 const clean=['PROJECTION_SQL_IDS_AGREE_AT_READ_TIME','SQL_DELETED_TOMBSTONES_EXCLUDED_AS_DESIGNED'];
 const expectedOnly=clean.includes(c.evidenceState)&&clean.includes(o.evidenceState);
 const rawCountMismatch=c.sqlCount!==c.projectionCount||o.sqlCount!==o.projectionCount;
 return {ok:true,readOnly:true,noRecordsChanged:true,tenantId:tid,checkedAt:new Date().toISOString(),
  source:'TENANT_SCOPED_SQL_SELECT_VS_IN_MEMORY_PROJECTION',
  comparisonIsAtomic:false, sqlLimit:ID_QUERY_LIMIT, customerIds:c,orderIds:o,
  suspiciousTextRecords:suspect.length,suspiciousSample:fields.slice(0,SAMPLE_LIMIT),
  mismatchDetected:!expectedOnly,rawCountMismatchDetected:rawCountMismatch,
  explainedBySoftDeletedTombstones:expectedOnly&&rawCountMismatch,
  risk:expectedOnly?(rawCountMismatch?'SOFT_DELETED_RECORDS_RETAINED_IN_SQL_EXCLUDED_FROM_CRM_BY_DESIGN':'NO_ID_MISMATCH_OBSERVED'):
    'DO_NOT_ASSUME_SQL_OR_MEMORY_IS_AUTHORITATIVE_WITHOUT_BACKUP_REVIEW',
  note:'SQL retains soft-deleted rows while the application intentionally omits them. Only statuses read from SQL can prove expected exclusions. Concurrent imports can race this read. Never bulk-restore or auto-contact historical records; verify an immutable backup and audit before any owner-approved recovery.'};
}
module.exports={inspect,summarize,tenant,readVisibleCounts,ID_QUERY_LIMIT};
