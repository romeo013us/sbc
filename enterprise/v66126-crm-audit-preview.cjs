'use strict';
// A read-only, tenant-scoped lead audit. No mutation, rank updates, merges,
// deletions, bulk archives, outbound contacts or external provider calls.
const UNSAFE=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]|\bxl\/(?:styles|workbook)\.xml\b|\[Content_Types\]\.xml|PK\x03\x04/u;
const norm=v=>String(v==null?'':v).normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu,' ');
function suspicious(row) {
 return ['businessName','contactName','phone','email','source'].some(k=>UNSAFE.test(String(row?.[k]??'')));
}
function preview(all,tenantId,opts={}) {
 const id=Number(tenantId);
 if(!Number.isSafeInteger(id)||id<1)throw new Error('CRM_AUDIT_TENANT_REQUIRED');
 const rows=(Array.isArray(all)?all:[]).filter(r=>r&&Number(r.tenantId)===id);
 const seen=new Map(),dupKeys=new Set(),bad=[];
 let hot=0,warm=0,cold=0;
 for(const r of rows){
   const t=String(r.leadTemperature||'').toLowerCase();
   if(t==='hot')hot++;else if(t==='warm')warm++;else cold++;
   if(suspicious(r))bad.push(String(r.id||''));
   // Mark potential duplicate *groups*, not duplicates to delete. Matching
   // names alone are insufficient to infer business identity.
   const name=norm(r.businessName),city=norm(r.city);
   if(name&&city){
     const key=name+'\u0000'+city;
     if(seen.has(key))dupKeys.add(key);else seen.set(key,true);
   }
 }
 const result={ok:true,readOnly:true,noRecordsChanged:true,total:rows.length,
   tenantRecords:rows.length,potentialDuplicateGroups:dupKeys.size,
   suspiciousTextRecords:bad.length,hot,warm,cold,removedDuplicates:0,
   note:'Review suspected data corruption and duplicates by stable ID after backup. This endpoint never merges, deletes, rates or saves leads.'};
 if(opts.includeIds===true)result.suspiciousRecordIds=bad.filter(Boolean).slice(0,32);
 return Object.freeze(result);
}
module.exports={preview,suspicious};
