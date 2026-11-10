'use strict';
/* V66.146: owner forensic reconciliation of tenant-scoped ID sets.
 * Pure read model. No SQL writes, customer data mutation, recovery, or contact.
 * SQL snapshots are explicitly non-atomic with respect to in-memory activity.
 */
const {invalidFields}=require('./crm-text-integrity-v66140.cjs');
const {suspicious}=require('./v66144-crm-forensics.cjs');
const SAMPLE_LIMIT=40;
const ID_QUERY_LIMIT=2001;
function tenant(n){
 const id=Number(n);
 if(!Number.isSafeInteger(id)||id<1)throw Object.assign(Error('CRM_RECON_TENANT_REQUIRED'),{code:'CRM_RECON_TENANT_REQUIRED',status:403});
 return id;
}
function key(v){return String(v??'').trim()}
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
 return {entity:kind,sqlCount:total,projectionCount:projected.length,
  recordCountDelta:total-projected.length,completeIdComparison:!truncation,
  sqlOnlyCount:truncation?null:sqlOnly.length,projectionOnlyCount:truncation?null:projectionOnly.length,
  sqlOnlySample:truncation?[]:sqlOnly.slice(0,SAMPLE_LIMIT),
  projectionOnlySample:truncation?[]:projectionOnly.slice(0,SAMPLE_LIMIT),
  duplicateProjectionIds:projection.duplicates.slice(0,SAMPLE_LIMIT),
  blankProjectionIds:projection.missingIdCount,
  evidenceState:truncation?'INCOMPLETE_SQL_ID_WINDOW':
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
 const clean=c.evidenceState==='PROJECTION_SQL_IDS_AGREE_AT_READ_TIME'&&
   o.evidenceState==='PROJECTION_SQL_IDS_AGREE_AT_READ_TIME';
 return {ok:true,readOnly:true,noRecordsChanged:true,tenantId:tid,checkedAt:new Date().toISOString(),
  source:'TENANT_SCOPED_SQL_SELECT_VS_IN_MEMORY_PROJECTION',
  comparisonIsAtomic:false, sqlLimit:ID_QUERY_LIMIT, customerIds:c,orderIds:o,
  suspiciousTextRecords:suspect.length,suspiciousSample:fields.slice(0,SAMPLE_LIMIT),
  mismatchDetected:!clean,
  risk:clean?'NO_ID_MISMATCH_OBSERVED':'DO_NOT_ASSUME_SQL_OR_MEMORY_IS_AUTHORITATIVE_WITHOUT_BACKUP_REVIEW',
  note:'One live read can race with imports. This neither confirms a missing record nor repairs any record. Recheck after imports settle; compare immutable backups and audit before any recovery.'};
}
module.exports={inspect,summarize,tenant,ID_QUERY_LIMIT};
