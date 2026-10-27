'use strict';
// SBC V6648 - explicit server-authenticated tenant scope, no tenant-one fallback.
function requireTenant(value){
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});
 return n;
}
function scopeRows(rows,tenantId){
 const id=requireTenant(tenantId);
 return (Array.isArray(rows)?rows:[]).filter(row=>Number(row?.tenantId)===id);
}
function scopeCustomers(customers,tenantId){return scopeRows(customers,tenantId)}
function scopeRevenueDb(db,tenantId){
 const id=requireTenant(tenantId),source=db&&typeof db==='object'?db:{};
 const keys=['customers','orders','eliteCloserInteractions','aiCallSessions','revenueContactEvents'];
 const view={...source};
 for(const k of keys)view[k]=scopeRows(source[k],id);
 if(source.megaOpsStore&&typeof source.megaOpsStore==='object')view.megaOpsStore={...source.megaOpsStore,
  fulfillmentJobs:scopeRows(source.megaOpsStore.fulfillmentJobs,id)};
 return view;
}
module.exports={requireTenant,scopeRows,scopeCustomers,scopeRevenueDb};
