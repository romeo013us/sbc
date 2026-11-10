'use strict';
/* V66.146: add a read-only reconciliation detail panel AFTER V66.145 UI stage.
 * Source/compiled mirrors remain byte-identical; no POST, provider I/O or AI.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66146_OWNER_CRM_DIAGNOSTICS_UI';
const HTML_ANCHOR="'<section class=\"card\"><div class=\"card-body\"><h3>📦 Delivery acceptance</h3>'+";
const FUNCTION_ANCHOR='async function sbcAcceptOrderLookup(){';
const SECTION=String.raw`
'<section class="card"><div class="card-body"><h3>🧩 CRM integrity diagnostics</h3>'+
'<p class="mini">Read-only SQL vs loaded-record IDs, not a restore. Inspect the 9 suspect records by stable ID. Counts may shift during imports.</p>'+
'<button type="button" class="btn ghost" onclick="sbcAcceptCrmDiagnostics()">Inspect SQL/CRM differences</button>'+
'<div id="sbcAcceptIdDiffResult" role="status" aria-live="polite" class="mini" style="margin-top:10px"></div></div></section>'+
`;
const FUNCTION=String.raw`
/* SBC_V66146_OWNER_CRM_DIAGNOSTICS_UI */
async function sbcAcceptCrmDiagnostics(){
 if(state.me?.role!=='owner')return;
 const out=document.getElementById('sbcAcceptIdDiffResult');
 if(!out)return;
 out.textContent='Comparing SQL IDs to loaded CRM IDs (read only)…';
 try{
  const d=await api('/api/owner/crm/reconcile-ids',{timeoutMs:20000});
  if(!out.isConnected)return;
  const fmt=(label,x)=>'<div style="padding:8px 0;border-bottom:1px solid #ddd"><strong>'+esc(label)+'</strong>'+
   '<div>MySQL '+esc(String(x?.sqlCount??'unavailable'))+' · Loaded '+
   esc(String(x?.projectionCount??'unavailable'))+' · Delta '+
   esc(String(x?.recordCountDelta??'unavailable'))+'</div>'+
   '<div>'+esc(x?.evidenceState||'NO_EVIDENCE')+'</div>'+
   (x?.completeIdComparison?
     '<div>SQL-only IDs: '+esc(String(x.sqlOnlyCount??0))+
     ' · Loaded-only IDs: '+esc(String(x.projectionOnlyCount??0))+'</div>'+
     '<div>SQL-only sample: '+esc((x.sqlOnlySample||[]).join(', ')||'None')+'</div>'+
     '<div>Loaded-only sample: '+esc((x.projectionOnlySample||[]).join(', ')||'None')+'</div>':
     '<p>More than 2,000 records or non-atomic query count discrepancy. No exhaustive conclusions.</p>')+
   '</div>';
  const suspect=Array.isArray(d.suspiciousSample)?d.suspiciousSample:[];
  out.innerHTML='<p><strong>Tenant-scoped ID reconciliation</strong> — no records were changed.</p>'+
   fmt('Customer records',d.customerIds)+fmt('Order records',d.orderIds)+
   '<p><strong>Text-integrity review: '+esc(String(d.suspiciousTextRecords??0))+' flagged records</strong></p>'+
   suspect.map(x=>'<div>ID '+esc(x.id||'missing-id')+' · Fields: '+
    esc((x.fields||[]).join(', '))+' · Status: '+esc(x.status||'')+'</div>').join('')+
   (d.mismatchDetected?'<p>⚠ Do not delete, reimport or merge records without backup and author audit.</p>':
    '<p>No ID discrepancy observed at this read time. This does not certify backup recovery.</p>')+
   '<p class="mini">This snapshot is not atomic with active employee imports. Repeat after imports stop.</p>';
 }catch(e){if(out.isConnected)out.textContent='Read-only CRM diagnostics unavailable: '+String(e?.message||e);}
}
`;
function one(s,a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error('CRM_DIAGNOSTICS_UI_ANCHOR_'+label+'_'+n);
 return s.replace(a,()=>b);
}
function patchApp(raw){
 let s=String(raw||'');
 if(s.includes(MARK))return s;
 if(!s.includes('SBC_V66145_OWNER_ACCEPTANCE_DESK_UI'))throw Error('CRM_DIAGNOSTICS_REQUIRES_OWNER_DESK');
 s=one(s,HTML_ANCHOR,SECTION+HTML_ANCHOR,'html');
 s=one(s,FUNCTION_ANCHOR,FUNCTION+'
'+FUNCTION_ANCHOR,'script');
 return s;
}
function patchFiles({root=path.resolve(__dirname,'..'),apply=false}={}){
 const names=['public/app.js','browser_public/app.js'];
 const source=names.map(n=>fs.readFileSync(path.join(root,n),'utf8'));
 if(source[0]!==source[1])throw Error('CRM_DIAGNOSTICS_SOURCE_MIRROR_MISMATCH');
 const output=source.map(patchApp);
 if(output[0]!==output[1])throw Error('CRM_DIAGNOSTICS_OUTPUT_MIRROR_MISMATCH');
 if(apply){
  if(process.env.SBC_V66146_ISOLATED_STAGE!=='YES')throw Error('CRM_DIAGNOSTICS_DISPOSABLE_STAGE_ONLY');
  names.forEach((n,i)=>fs.writeFileSync(path.join(root,n),output[i]));
 }
 return {changed:output[0]!==source[0],bytes:output[0].length};
}
if(require.main===module){
 const r=patchFiles({apply:process.argv.includes('--apply')});
 if(process.argv.includes('--verify-staged')&&r.changed)throw Error('CRM_DIAGNOSTICS_UI_NOT_STAGED');
 console.log('[V66.146] CRM reconciliation UI '+(r.changed?'STAGED_READY':'COMPILED_PRESENT'));
}
module.exports={patchApp,patchFiles,MARK};
