'use strict';
/* V66.148: status-aware CRM integrity truth in the existing owner dashboard.
 * Patches only isolated compiler copy; both browser mirrors stay byte-identical.
 * NO customer writes, restoration, bulk promotion or provider traffic.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66148_SOFT_DELETED_CRM_TRUTH_UI';
function once(s,a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error('SOFT_DELETED_UI_ANCHOR_'+label+'_'+n);
 return s.replace(a,()=>b);
}
function patchApp(input){
 let s=String(input||'');
 if(s.includes(MARK))return s;
 if(!s.includes('SBC_V66146_OWNER_CRM_DIAGNOSTICS_UI')||
    !s.includes('SBC_V66147_OWNER_SALES_DELIVERY_REVIEW_UI'))throw Error('SOFT_DELETE_UI_REQUIRES_EXISTING_DESK');
 s=once(s,
  'All statuses, including archived; search by name, email, source, phone last four, or Square reference.',
  'Active and archived records; SQL Deleted tombstones are intentionally excluded from loaded CRM. Search by name, email, source, phone last four, or Square reference.',
  'search-honesty');
 s=once(s,
  'Inspect the 9 suspect records by stable ID.',
  'Inspect suspect records by stable ID. SQL-only records may be intentionally retained Deleted tombstones.',
  'diagnostic-honesty');
 const previous="(d.projectionCountMismatch?'<p>⚠ MySQL count differs from loaded CRM — search misses are not proof of absence.</p>':'')+";
 const next=[
  "(d.sqlEvidence==='TENANT_SCOPED_VISIBLE_AND_ALL_SELECT_ONLY'?",
  " '<p>MySQL customer rows: '+esc(String(d.sqlTenantCustomers??'?'))+",
  " ' · Retained Deleted tombstones: '+esc(String(d.sqlDeletedCustomerTombstones??'?'))+",
  " ' · Visible SQL rows: '+esc(String(d.sqlVisibleTenantCustomers??'?'))+'</p>':'')+",
  "(d.projectionCountMismatch?'<p>⚠ Non-deleted MySQL record count differs from loaded CRM — investigate IDs and backups.</p>':'')+",
  "(d.sqlEvidence==='QUERY_UNAVAILABLE'?'<p>⚠ SQL count unavailable; absence in this view proves nothing.</p>':'')+"
 ].join('\n   ');
 s=once(s,previous,next,'forensics-visible-warning');
 const src="'<div>SQL-only sample: '+esc((x.sqlOnlySample||[]).join(', ')||'None')+'</div>'+";
 const dst=[
  "'<div>SQL-only sample: '+esc((x.sqlOnlySample||[]).join(', ')||'None')+'</div>'+",
  "'<div>Retained Deleted tombstones: '+esc(String(x.sqlOnlyDeletedTombstones??'unverified'))+",
  " ' · SQL-only NOT marked Deleted: '+esc(String(x.sqlOnlyUnexplained??'unverified'))+'</div>'+",
  "(x.sqlOnlyUnexplained>0?'<div>Non-Deleted SQL-only IDs for owner review: '+",
  " esc((x.sqlOnlyUnexplainedSample||[]).join(', ')||'None')+'</div>':'')+",
  "(x.expectedSoftDeleteExclusionOnly?'<p>Expected retained Deleted records are intentionally absent from the active CRM; do NOT automatically restore.</p>':'')+"
 ].join('\n     ');
 s=once(s,src,dst,'soft-delete-classification');
 const old="(d.mismatchDetected?'<p>⚠ Do not delete, reimport or merge records without backup and author audit.</p>':";
 const revised=[
  "(d.explainedBySoftDeletedTombstones?",
  " '<p>SQL-only rows are marked Deleted and intentionally not loaded. No recovery action indicated for those tombstones. Review corrupt text separately.</p>':",
  " d.mismatchDetected?'<p>⚠ Unexplained SQL/CRM differences: do not delete, reimport or merge without backup and author audit.</p>':"
 ].join('\n   ');
 s=once(s,old,revised,'avoid-false-missing-record-alert');
 // The marker is emitted as a comment in the acceptance desk code only.
 s=once(s,'/* SBC_V66146_OWNER_CRM_DIAGNOSTICS_UI */',
  '/* SBC_V66146_OWNER_CRM_DIAGNOSTICS_UI */\n/* '+MARK+' */','marker');
 return s;
}
function patchFiles({root=path.resolve(__dirname,'..'),apply=false}={}){
 const files=['public/app.js','browser_public/app.js'];
 const source=files.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
 if(source[0]!==source[1])throw Error('SOFT_DELETE_SOURCE_UI_MIRRORS_DIFFER');
 const out=source.map(patchApp);
 if(out[0]!==out[1])throw Error('SOFT_DELETE_RESULT_UI_MIRRORS_DIFFER');
 if(apply){
  if(process.env.SBC_V66148_ISOLATED_STAGE!=='YES')throw Error('SOFT_DELETE_UI_DISPOSABLE_STAGE_ONLY');
  files.forEach((p,i)=>fs.writeFileSync(path.join(root,p),out[i]));
 }
 return {changed:out[0]!==source[0],bytes:out[0].length};
}
if(require.main===module){
 const r=patchFiles({apply:process.argv.includes('--apply')});
 if(process.argv.includes('--verify-staged')&&r.changed)throw Error('SOFT_DELETE_UI_NOT_IN_RELEASE');
 console.log('[V66.148] Owner soft-deleted ID evidence '+(r.changed?'STAGED_READY':'COMPILED_PRESENT'));
}
module.exports={MARK,patchApp,patchFiles};
