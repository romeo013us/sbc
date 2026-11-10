'use strict';
/* V66.145 owner-only acceptance desk; disposable CI stage patches both mirrored JS assets.
 * All controls GET-only. Nothing sends messages, creates payments, or changes CRM.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66145_OWNER_ACCEPTANCE_DESK_UI';
const DASH='<button type="button" class="btn ghost" onclick="sbcOpenOwnerCheckoutLab()">🛒 Owner Checkout Lab ($0)</button>';
const MODAL="function closeModal(){$('#modal').classList.add('hidden')}";
const UI=String.raw`
/* SBC_V66145_OWNER_ACCEPTANCE_DESK_UI — owner-only, read-only. */
function sbcOpenOwnerAcceptanceDesk(){
 if(state.me?.role!=='owner')return toast('Owner access required');
 openModal('🛡️ Owner Acceptance Desk',
 '<div style="display:grid;gap:16px">'+
 '<p class="mini">Evidence only. No changes to customers, payment, suppliers or subscriptions.</p>'+
 '<section class="card"><div class="card-body"><h3>🔎 CRM history &amp; recovery evidence</h3>'+
 '<p class="mini">All statuses, including archived; search by name, email, source, phone last four, or Square reference.</p>'+
 '<input id="sbcAcceptSearch" maxlength="140" placeholder="Name, source or Square ID" style="width:100%;margin:6px 0">'+
 '<button type="button" class="btn" onclick="sbcAcceptCrmLookup()">Search CRM evidence</button>'+
 '<div id="sbcAcceptCrmResult" role="status" aria-live="polite" class="mini" style="margin-top:10px"></div></div></section>'+
 '<section class="card"><div class="card-body"><h3>📦 Delivery acceptance</h3>'+
 '<p class="mini">Real sales order ID only; $0 internal QA is not customer revenue.</p>'+
 '<input id="sbcAcceptOrder" maxlength="100" placeholder="Order ID" style="width:100%;margin:6px 0">'+
 '<button type="button" class="btn" onclick="sbcAcceptOrderLookup()">Check delivery evidence</button>'+
 '<div id="sbcAcceptOrderResult" role="status" aria-live="polite" class="mini" style="margin-top:10px"></div></div></section>'+
 '<p class="mini">No result from this screen certifies 9.5, bank settlement, supplier delivery, or an Office Box recurring subscription.</p></div>');
}
async function sbcAcceptCrmLookup(){
 if(state.me?.role!=='owner')return;
 const out=document.getElementById('sbcAcceptCrmResult'),input=document.getElementById('sbcAcceptSearch');
 if(!out||!input)return;
 out.textContent='Reading CRM evidence…';
 try{
  const q=String(input.value||'').trim().slice(0,140);
  const d=await api('/api/owner/crm/forensics?q='+encodeURIComponent(q)+'&limit=20',{timeoutMs:15000});
  if(!out.isConnected)return;
  const rows=Array.isArray(d.rows)?d.rows:[];
  out.innerHTML='<p><strong>'+esc(String(d.pagination?.totalMatches??0))+' matches</strong> · '+
   esc(String(d.totalTenantCustomers??0))+' tenant records · '+
   esc(String(d.suspiciousTextRecords??0))+' suspicious · '+esc(String(d.orphanOrderCount??0))+' orphan orders</p>'+
   (d.projectionCountMismatch?'<p>⚠ MySQL count differs from loaded CRM — search misses are not proof of absence.</p>':'')+
   rows.map(c=>'<div style="padding:7px 0;border-bottom:1px solid #ccc">'+
    '<strong>'+esc(c.businessName||'Unnamed')+'</strong>'+(c.suspiciousText?' ⚠ Suspect text':'')+
    '<div>'+esc(c.status||'')+' · '+esc(c.source||'')+
    ' · Created '+esc(c.createdAt||'Unknown')+'</div><div>ID '+esc(c.id||'')+
    ' · Orders '+esc(String(c.linkedOrderCount??0))+'</div></div>').join('')+
   (d.notFoundInCurrentProjection===true?'<p>No matching record in the loaded CRM; investigate backup and Square before recovery.</p>':'')+
   (d.pagination?.hasMore?'<p>Additional matches exist. Refine the search for a smaller result set.</p>':'')+
   '<p>Read-only: no records corrected or recreated.</p>';
 }catch(e){if(out.isConnected)out.textContent='CRM evidence unavailable: '+String(e?.message||e)}
}
async function sbcAcceptOrderLookup(){
 if(state.me?.role!=='owner')return;
 const out=document.getElementById('sbcAcceptOrderResult'),input=document.getElementById('sbcAcceptOrder');
 if(!out||!input)return;
 const id=String(input.value||'').trim().slice(0,100);
 if(!id){out.textContent='Enter a real order ID.';return}
 out.textContent='Checking MySQL and delivery receipts…';
 try{
  const d=await api('/api/owner/delivery/acceptance/'+encodeURIComponent(id),{timeoutMs:15000});
  if(!out.isConnected)return;
  const checks=Array.isArray(d.checks)?d.checks:[];
  out.innerHTML='<p><strong>'+esc(d.orderLabel||id)+'</strong></p>'+
   '<p>Recorded workflow evidence: '+(d.recordedWorkflowComplete?'complete (not provider-certified)':'HOLD')+'</p>'+
   checks.map(x=>'<div style="padding:5px 0">'+(x.passed?'✓ ':'⚠ ')+esc(x.id||'')+
   ': '+esc(x.detail||'')+'</div>').join('')+
   '<p><strong>9.5 live production certified: NO.</strong> Verify provider and customer receipts independently.</p>';
 }catch(e){if(out.isConnected)out.textContent='Delivery evidence unavailable: '+String(e?.message||e)}
}
`;
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error('ACCEPTANCE_UI_ANCHOR_'+label+'_'+n);return s.replace(a,()=>b);}
function patchApp(raw){
 let s=String(raw||'');
 if(s.includes(MARK))return s;
 s=once(s,DASH,DASH+'<button type="button" class="btn ghost" onclick="sbcOpenOwnerAcceptanceDesk()">🛡️ Owner Acceptance Desk</button>','dashboard');
 s=once(s,MODAL,MODAL+'\n'+UI,'modal');
 return s;
}
function patchFiles({root=path.resolve(__dirname,'..'),apply=false}={}){
 const paths=['public/app.js','browser_public/app.js'],originals=paths.map(p=>fs.readFileSync(path.join(root,p),'utf8'));
 if(originals[0]!==originals[1])throw Error('ACCEPTANCE_UI_SOURCE_PARITY_FAILED');
 const output=originals.map(patchApp);
 if(output[0]!==output[1])throw Error('ACCEPTANCE_UI_OUTPUT_PARITY_FAILED');
 if(apply){
  if(process.env.SBC_V66145_ISOLATED_STAGE!=='YES')throw Error('ACCEPTANCE_UI_DISPOSABLE_STAGE_ONLY');
  paths.forEach((p,i)=>fs.writeFileSync(path.join(root,p),output[i]));
 }
 return {changed:output[0]!==originals[0],marker:output[0].includes(MARK),bytes:output[0].length};
}
if(require.main===module){
 const r=patchFiles({apply:process.argv.includes('--apply')});
 if(process.argv.includes('--verify-staged')&&r.changed)throw Error('ACCEPTANCE_UI_NOT_STAGED');
 console.log('[V66.145] owner UI mirror verified '+r.bytes+' bytes');
}
module.exports={MARK,patchApp,patchFiles};
