/* SBC System Guardian V1 — owner-facing integrity cockpit */
(()=>{'use strict';
const V='56.5.0'; const $=(s,r=document)=>r.querySelector(s);
async function api(path,options={}){const r=await fetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.error||`Request failed (${r.status})`);return b}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function open(){if($('#v564Guardian'))return load();const m=document.createElement('div');m.id='v564Guardian';m.className='v564-guardian-modal';m.innerHTML=`<div class="v564-guardian-backdrop"></div><section class="v564-guardian-card"><div class="v564-guardian-head"><div><span class="v564-guardian-kicker">SBC SYSTEM GUARDIAN · V1</span><h2>System Integrity</h2><p id="v564GuardianSub">Scanning the Command Center…</p></div><button class="v564-guardian-close" id="v564GuardianClose">×</button></div><div id="v564GuardianBody"></div></section>`;document.body.appendChild(m);$('#v564GuardianClose').onclick=()=>m.remove();$('.v564-guardian-backdrop',m).onclick=()=>m.remove();load()}
function render(d){const s=d.summary||{};const c=d.candidates||[];const cls=s.classifications||{};return `<div class="v564-guardian-grid"><div class="v564-guardian-stat"><small>FILES SCANNED</small><strong>${s.filesScanned||0}</strong></div><div class="v564-guardian-stat"><small>ROUTES</small><strong>${s.routeCount||0}</strong></div><div class="v564-guardian-stat"><small>PROTECTED</small><strong>${s.protectedCount||0}</strong></div><div class="v564-guardian-stat"><small>CLEANUP CANDIDATES</small><strong>${c.length}</strong></div><div class="v564-guardian-stat"><small>DUPLICATE GROUPS</small><strong>${s.duplicateFileGroups||0}</strong></div></div><div class="v564-guardian-actions"><button class="primary" data-guardian-action="snapshot">Create Known-Good Snapshot</button><button data-guardian-action="refresh">Refresh Audit</button></div><div class="v564-guardian-section"><h3>CLASSIFICATION</h3><div class="v564-guardian-list">${Object.entries(cls).map(([k,v])=>`<div class="v564-guardian-row"><span>${esc(k)}</span><strong>${v}</strong></div>`).join('')}</div></div><div class="v564-guardian-section"><h3>TOP CLEANUP CANDIDATES — NOTHING IS AUTO-DELETED</h3><div class="v564-guardian-list">${c.slice(0,15).map(x=>`<div class="v564-guardian-row"><code>${esc(x.file)}</code><span>${esc(x.class)}</span></div>`).join('')||'<div class="v564-guardian-row"><span>No candidates found.</span></div>'}</div></div>`}
async function load(){
  const body=$('#v564GuardianBody');
  if(!body)return;
  body.innerHTML='<p>Running integrity audit…</p>';
  try{
    const r=await api('/api/v56/guardian/audit');
    body.innerHTML=render(r);
    const sub=$('#v564GuardianSub');
    if(sub)sub.innerHTML=`<span class="v564-guardian-ok">● Guardian active</span> · ${new Date().toLocaleTimeString()}`;
    const snapshotButton=body.querySelector('[data-guardian-action="snapshot"]');
    const refreshButton=body.querySelector('[data-guardian-action="refresh"]');
    if(refreshButton)refreshButton.onclick=()=>load();
    if(snapshotButton)snapshotButton.onclick=async()=>{
      snapshotButton.disabled=true;
      snapshotButton.textContent='Creating…';
      try{
        const x=await api('/api/v56/guardian/snapshot',{method:'POST',body:'{}'});
        snapshotButton.textContent='✓ Snapshot Created';
        const p=document.createElement('p');
        p.className='v564-guardian-ok';
        p.textContent=`Known-good manifest created: ${x.snapshot}`;
        body.prepend(p);
      }catch(err){
        snapshotButton.disabled=false;
        snapshotButton.textContent='Create Known-Good Snapshot';
        const p=document.createElement('p');
        p.className='v564-guardian-danger';
        p.textContent=err.message;
        body.prepend(p);
      }
    };
  }catch(e){
    body.innerHTML=`<p class="v564-guardian-danger">Guardian audit failed: ${esc(e.message)}</p>`;
  }
}
function mount(){const actions=$('.top-actions');if(!actions||$('#v564GuardianButton'))return;const b=document.createElement('button');b.id='v564GuardianButton';b.className='icon-btn';b.type='button';b.title='Open SBC System Guardian';b.textContent='🛡 Guardian';b.onclick=open;actions.insertBefore(b,$('#sbcThemeToggle')||null)}
window.SBCGuardian={version:V,open,refresh:load};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
setTimeout(mount,1000);setTimeout(mount,3000);
})();
