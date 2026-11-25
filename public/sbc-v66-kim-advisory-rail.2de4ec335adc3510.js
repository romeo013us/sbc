/* SBC V66 kim-advisory-rail · checked-in scripts retain startup order */
/* BEGIN sbc-kim-ui-hardening-v6429.js */
try {
/* SBC V65.1.23 — canonical Kim UI ownership guard. Loaded after all legacy UI modules. */
(function(){'use strict';
const RELEASE='65.1.23',DOCK='sbcAiDock',LAUNCH='ckLauncher';
let timer=null,observer=null;
const legacy=['#sbcKimLauncher','.akx-launcher','.sbc-kim-bottom-launcher'];
function q(s){return document.querySelector(s)}
function clean(){legacy.forEach(s=>document.querySelectorAll(s).forEach(el=>{if(el.id!==LAUNCH)el.remove()}));document.querySelectorAll('#'+DOCK).forEach((el,i)=>{if(i>0)el.remove()});}
function wire(){
  const d=q('#'+DOCK), b=q('#'+LAUNCH); if(!d||!b)return;
  b.classList.remove('hidden'); b.hidden=false; b.style.display='flex';
  b.onclick=(e)=>{e.preventDefault();e.stopPropagation();window.sbcKimCanonical?.open?.();};
  d.dataset.release=RELEASE;
  const input=q('#sbcAiInput'),send=q('#sbcAiSend');
  if(input)input.style.pointerEvents='auto'; if(send)send.style.pointerEvents='auto';
}
function enforce(){clean();wire();}
function boot(){
  enforce();
  if(observer)observer.disconnect();
  observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,30)});
  observer.observe(document.body,{childList:true,subtree:true});
  window.__SBC_KIM_UI_RELEASE__=RELEASE;
  window.__SBC_KIM_UI_LOCKED__=true;
  // Keep the global release identity owned by the V66 finalizer.
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: sbc-kim-ui-hardening-v6429.js", sbcBundleError);
}
/* END sbc-kim-ui-hardening-v6429.js */
;
/* BEGIN sbc-autonomy-control-v6430.js */
try {
(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,opts){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...opts});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||j.message||`HTTP ${r.status}`);return j}
async function load(){
 let d;try{d=await api('/api/autonomy/control/status')}catch(e){return render({offline:true,error:e.message})}
 const a=d.autonomy||{};const ex=a.openExceptions||[];const rec=d.recoverySafe;
 const target=document.querySelector('#content')||document.querySelector('main');if(!target)return;
 let p=document.getElementById('sbcAutonomyControl');if(!p){p=document.createElement('section');p.id='sbcAutonomyControl';p.className='sbc-autonomy-control';target.prepend(p)}
 p.innerHTML=`<div class="ac-head"><div><div class="ac-kicker">SBC AUTONOMOUS OPERATIONS CONTROL</div><h3>Romeo Exception-Only Operating System</h3><p>Routine work runs inside policy. Protected decisions remain yours.</p></div><div class="ac-mode"><span class="ac-pill ${a.paused?'red':'green'}">${a.paused?'PAUSED':'RUNNING'}</span><span class="ac-pill yellow">MODE: ${esc(a.mode||'GUARDED')}</span><span class="ac-pill ${d.financialMutationsAllowed?'red':'green'}">MONEY: ${d.financialMutationsAllowed?'OPEN':'OWNER CONTROLLED'}</span></div></div>
 <div class="ac-grid"><div class="ac-stat"><b>${a.metrics?.queued||0}</b><span>Queued</span></div><div class="ac-stat"><b>${a.metrics?.completed||0}</b><span>Completed</span></div><div class="ac-stat"><b>${a.metrics?.escalated||0}</b><span>Escalated</span></div><div class="ac-stat"><b>${ex.length}</b><span>Owner Exceptions</span></div></div>
 ${rec?'<div class="ac-recovery"><b>RECOVERY SAFE MODE</b><div>Authoritative CRM recovery is still required. Autonomous mutations are suspended. Your preserved lead-mesh records remain read-only.</div></div>':''}
 <div class="ac-actions"><button data-ac="sweep" class="primary" ${rec?'disabled title="Recovery lock active"':''}>Run Safe Sweep</button><button data-ac="sim">Run 10,000-Case Safety Test</button><button data-ac="pause" ${rec?'disabled title="Recovery lock active"':''}>Pause</button><button data-ac="resume" ${rec?'disabled title="Recovery lock active"':''}>Resume</button><button data-ac="mode" data-mode="AUTONOMOUS" ${rec?'disabled title="Recovery lock active"':''}>Set Autonomous</button></div>
 <div class="ac-exceptions"><b>OWNER EXCEPTION QUEUE</b>${ex.length?ex.slice(0,8).map(x=>`<div class="ac-exception"><strong>${esc(x.severity||'MEDIUM')}</strong>${esc(x.reason||x.type)} <span style="color:#b7c7d6">${esc(x.createdAt||'')}</span></div>`).join(''):'<div class="ac-exception">No open owner exceptions.</div>'}</div>`;
 p.querySelectorAll('[data-ac]').forEach(b=>b.onclick=async()=>{try{const act=b.dataset.ac;if(act==='sim'){const x=await api('/api/autonomy/control/simulate');alert(`Safety simulation: ${x.simulation.cases.toLocaleString()} cases\nAutomatic: ${x.simulation.auto.toLocaleString()}\nOwner required: ${x.simulation.ownerRequired.toLocaleString()}\nProtected boundary: ${x.simulation.protectedBoundaryIntact?'PASS':'FAIL'}`);return}if(act==='sweep')await api('/api/autonomy/control/sweep',{method:'POST',body:'{}'});else if(act==='pause')await api('/api/autonomy/control/pause',{method:'POST',body:'{}'});else if(act==='resume')await api('/api/autonomy/control/resume',{method:'POST',body:'{}'});else if(act==='mode')await api('/api/autonomy/control/mode',{method:'POST',body:JSON.stringify({mode:b.dataset.mode})});await load()}catch(e){alert(e.message)}})
}
function render(x){if(!x.offline)return;const target=document.querySelector('#content')||document.querySelector('main');if(!target)return;let p=document.getElementById('sbcAutonomyControl');if(!p){p=document.createElement('section');p.id='sbcAutonomyControl';p.className='sbc-autonomy-control';target.prepend(p)}p.innerHTML='<div class="ac-head"><div><div class="ac-kicker">SBC AUTONOMOUS OPERATIONS CONTROL</div><h3>Control Plane Offline</h3><p>The main Command Center remains available. Retry when the control service is ready.</p></div><button data-ac-retry>Retry</button></div>';p.querySelector('[data-ac-retry]')?.addEventListener('click',load)}
window.sbcAutonomyControlRefresh=load;document.addEventListener('DOMContentLoaded',()=>setTimeout(load,1500));
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: sbc-autonomy-control-v6430.js", sbcBundleError);
}
/* END sbc-autonomy-control-v6430.js */
;
/* BEGIN sbc-unattended-v6431.js */
try {
(function(){'use strict';
async function api(path,opts={}){if(typeof window.api==='function')return window.api(path,{...opts,timeoutMs:opts.timeoutMs||20000});const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},...opts});const raw=await r.text();let j=null;try{j=JSON.parse(raw)}catch{}if(!r.ok)throw new Error(j?.message||j?.error||`HTTP ${r.status}`);if(!j)throw new Error(/<html|<!doctype/i.test(raw)?'The server returned a sign-in page. Sign in again and refresh.':'The status endpoint returned invalid JSON.');return j}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function load(){const target=document.querySelector('#content')||document.querySelector('main');if(!target)return;let p=document.getElementById('sbcUnattended');if(!p){p=document.createElement('section');p.id='sbcUnattended';p.className='sbc-unattended';target.prepend(p)}try{const d=await api('/api/owner/unattended/status');const g=d.gate||{};const inv=g.inventory||{};const ready=!!g.ready;window.__sbcUnattendedCensus=d.recoveryCensus||{};p.innerHTML=`<div class="uh"><div><div style="font-size:12px;font-weight:800;letter-spacing:.08em">SBC 21-DAY UNATTENDED OPERATIONS</div><h3>${ready?'READY FOR CONTROLLED UNATTENDED OPERATIONS':'NOT CERTIFIED YET'}</h3><p>Designed so Romeo can work Texas/Florida adjusting and notary jobs without babysitting SBC.</p></div><span class="pill ${ready?'green':'yellow'}">${ready?'GREEN':'ATTENTION'}</span></div><div class="ugrid"><div class="stat"><b>${(d.recoveryCensus?.mysqlCustomers==null?'Unavailable':Number(d.recoveryCensus.mysqlCustomers))}</b><span>Current MySQL Customer Rows</span></div><div class="stat"><b>${(d.recoveryCensus?.preservedLeadMesh==null?'Unavailable':Number(d.recoveryCensus.preservedLeadMesh))}</b><span>Preserved Lead Mesh · Read Only</span></div><div class="stat"><b>${inv.hot||0}</b><span>Verified Hot Leads</span></div><div class="stat"><b>${inv.warm||0}</b><span>Verified Warm Leads</span></div><div class="stat"><b>${g.horizonDays||21}</b><span>Unattended Days</span></div></div><div class="blockers"><b>Gate</b><div>${g.blockers?.length?g.blockers.map(esc).join(' · '):'All readiness gates passed.'}</div></div><div class="actions"><button class="primary" data-u="brief">Daily Executive Brief</button><button data-u="sim">Simulate 21 Days</button><button data-u="refresh">Refresh Readiness</button></div>`;p.querySelectorAll('[data-u]').forEach(b=>b.onclick=async()=>{try{if(b.dataset.u==='brief'){const x=await api('/api/owner/unattended/brief');alert(x.brief.headline+'\n\nAuthoritative CRM leads: '+x.brief.leadInventory.total+'\nPreserved lead-mesh candidates: '+Number(window.__sbcUnattendedCensus?.preservedLeadMesh||0)+' (read-only)\nHot: '+x.brief.leadInventory.hot+'\nWarm: '+x.brief.leadInventory.warm+'\nQuotes: '+x.brief.revenue.quotes+'\nPaid orders: '+x.brief.revenue.paidOrders+'\n\nBlockers: '+(x.brief.blockers.join(', ')||'None'));}else if(b.dataset.u==='sim'){const x=await api('/api/owner/unattended/simulate-21d?dailyOutreach=25&conversionRate=0.02&avgOrderValue=349');alert('21-day simulation only — not a forecast.\n\nContacts: '+x.simulation.contacts+'\nModeled wins: '+x.simulation.won+'\nModeled revenue: $'+Number(x.simulation.revenue||0).toLocaleString());}else await load()}catch(e){alert(e.message)}})}catch(e){p.innerHTML='<div class="uh"><div><div style="font-size:12px;font-weight:800;letter-spacing:.08em">SBC 21-DAY UNATTENDED OPERATIONS</div><h3>Control Plane Offline</h3><p>The Command Center can continue loading. Readiness will retry.</p></div><span class="pill red">OFFLINE</span></div><div class="actions"><button data-u="retry">Retry</button></div>';p.querySelector('[data-u="retry"]').onclick=load}}
window.sbcUnattendedRefresh=load;document.addEventListener('DOMContentLoaded',()=>setTimeout(load,1800));
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: sbc-unattended-v6431.js", sbcBundleError);
}
/* END sbc-unattended-v6431.js */
