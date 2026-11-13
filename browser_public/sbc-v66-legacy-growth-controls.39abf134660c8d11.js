/* SBC V66 legacy-growth-controls · checked-in scripts retain startup order */
/* BEGIN v37-kim-automation.js */
try {
(()=>{
 const $=s=>document.querySelector(s);
 async function req(url,opt={}){const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json'},...opt});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);return j}
 async function render(){const root=$('[data-view-panel="kim370"]')||document.querySelector('#app'); if(!root)return; try{const d=await req('/api/kim/v370/summary'); root.innerHTML=`<div class="kim370-wrap"><h1>🤖 Kim Automation Fabric</h1><p>Guarded autonomous operations · ${d.capabilityCount} automations · mode ${d.automationMode}</p><div class="kim370-actions"><button id="kim370Tick">Run Automation Sweep</button><button id="kim370Refresh">Refresh</button></div><div class="kim370-grid"><div class="kim370-card"><h3>Business Health</h3><strong>${d.health.score}/100</strong><p>${d.health.gates.filter(g=>g.ok).length}/${d.health.gates.length} gates healthy</p></div><div class="kim370-card"><h3>Missions</h3><strong>${d.metrics.missionsCreated}</strong><p>${d.missions.filter(m=>m.status==='QUEUED').length} queued</p></div><div class="kim370-card"><h3>Vendor Channels</h3>${Object.entries(d.vendorChannels).map(([k,v])=>`<span class="kim370-pill">${k}: ${v.status}</span>`).join('')}</div><div class="kim370-card"><h3>Automation Library</h3><p>${d.capabilities.map(c=>`<span class="kim370-pill">${c.id} ${c.name}</span>`).join('')}</p></div></div><div class="kim370-card"><h3>Active Missions</h3><div class="kim370-list">${d.missions.map(m=>`<div class="kim370-mission"><b>${m.priority}</b> · ${m.title}<div class="kim370-small">${m.detail}</div>${m.status==='QUEUED'?`<button data-complete="${m.id}">Complete</button>`:''}</div>`).join('')||'<p>No missions queued.</p>'}</div></div></div>`;
 $('#kim370Tick')?.addEventListener('click',async()=>{await req('/api/kim/v370/tick',{method:'POST',body:'{}'});render()});$('#kim370Refresh')?.addEventListener('click',render);root.querySelectorAll('[data-complete]').forEach(b=>b.addEventListener('click',async()=>{await req('/api/kim/v370/missions/'+b.dataset.complete,{method:'POST',body:'{}'});render()}));}catch(e){root.innerHTML=`<div class="kim370-wrap"><h2>Kim Automation Fabric</h2><p>${e.message}</p></div>`}}
 window.SBC_KIM370={render}; document.addEventListener('click',e=>{const b=e.target.closest('[data-view="kim370"]');if(b)render()});
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v37-kim-automation.js", sbcBundleError);
}
/* END v37-kim-automation.js */
;
/* BEGIN v38-kim-growth.js */
try {
/* SBC V38 — Kim Growth Autopilot reliability layer
   Client-side request dedupe/cache prevents render storms and rate-limit churn. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let cache=null,cacheAt=0,inflight=null;
 async function data(force=false){
   const now=Date.now();
   if(!force&&cache&&now-cacheAt<15000)return cache;
   if(inflight)return inflight;
   inflight=fetch('/api/kim/v380/summary',{credentials:'include',cache:'no-store'}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);cache=j;cacheAt=Date.now();return j}).finally(()=>{inflight=null});
   return inflight;
 }
 async function view(){
   try{
    const d=await data(false);
    return `<div class="kim38-wrap"><div class="kim38-hero"><div><h1>🚀 Kim Growth & Outbound Autopilot</h1><p>50 growth automations · safe staging · human review gates for external actions</p></div><div class="kim38-actions"><button class="btn" id="k38Refresh">↻ Refresh</button><button class="btn" id="k38Segment">Segment Current Leads</button></div></div><div class="kim38-grid"><div class="kim38-card"><h3>Automation Library</h3><div class="kim38-big">${d.count}</div><p>Growth automations</p></div><div class="kim38-card"><h3>Safe Internal</h3><div class="kim38-big">${d.automations.filter(x=>x.mode==='AUTO').length}</div><p>Can execute internally</p></div><div class="kim38-card"><h3>Human Review</h3><div class="kim38-big">${d.automations.filter(x=>x.mode==='REVIEW').length}</div><p>External/meaningful actions</p></div><div class="kim38-card"><h3>Mission Queue</h3><div class="kim38-big">${d.missions.filter(x=>x.status!=='COMPLETED').length}</div><p>Active missions</p></div></div><div class="kim38-card"><h3>🎯 Create Growth Mission</h3><div class="kim38-form"><div><label>Automation<select id="k38Auto" class="kim38-select">${d.automations.map(a=>`<option value="${a.id}">${a.id} · ${esc(a.title)} [${a.mode}]</option>`).join('')}</select></label></div><div><label>Business<input id="k38Biz" class="kim38-input" placeholder="Prospect / campaign" /></label></div><button class="btn primary" id="k38Create">Create Mission</button></div></div><div class="kim38-card"><h3>🧠 Automation Library</h3><div class="kim38-list">${d.automations.map(a=>`<div class="kim38-row"><span class="kim38-pill ${a.mode==='AUTO'?'kim38-auto':'kim38-review'}">${a.mode}</span><b>${a.id}. ${esc(a.title)}</b><div class="kim38-small">${esc(a.name)} · ${esc(a.domain)}</div></div>`).join('')}</div></div><div class="kim38-card"><h3>🎯 Active Missions</h3><div class="kim38-list">${d.missions.map(m=>`<div class="kim38-row"><b>${esc(m.title)}</b> <span class="kim38-pill">${esc(m.status)}</span><div class="kim38-small">${esc(m.domain)} · ${esc(m.automation)} · ${esc(m.createdAt)}</div>${m.status==='READY_FOR_EXECUTION'?`<button class="btn small" data-k38-exec="${esc(m.id)}">Execute Safe Step</button>`:''}</div>`).join('')||'<p>No missions yet.</p>'}</div></div><div class="kim38-card"><h3>🛡️ Operating Boundary</h3><p class="kim38-ok">Kim may research, segment, draft, stage sandboxes, prepare assets and run internal quality checks.</p><p class="kim38-warn">External cold sends, provider production writes, pricing changes and other protected actions remain gated.</p></div></div>`
   }catch(e){return `<div class="kim38-wrap"><div class="kim38-card"><h2>Kim Growth & Outbound Autopilot</h2><p>${esc(e.message)}</p><p class="kim38-small">The growth workspace is fail-soft. Your core CRM, Revenue PLAY and production systems remain available.</p><button class="btn" id="k38Retry">↻ Retry once</button></div></div>`}
 }
 window.kimGrowthView=view;
 document.addEventListener('click',async e=>{
  if(e.target.id==='k38Refresh'||e.target.id==='k38Retry'){cache=null;cacheAt=0;window.render?.();return;}
  if(e.target.id==='k38Segment'){const b=e.target;b.disabled=true;try{const r=await fetch('/api/kim/v380/segment-leads',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({criteria:{exactMicroVertical:true}})});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);cache=null;cacheAt=0;window.render?.()}catch(x){alert(x.message)}finally{b.disabled=false}}
  if(e.target.id==='k38Create'){const b=e.target;b.disabled=true;try{const r=await fetch('/api/kim/v380/missions',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({automationId:document.querySelector('#k38Auto').value,input:{businessName:document.querySelector('#k38Biz').value}})});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);cache=null;cacheAt=0;window.render?.()}catch(x){alert(x.message)}finally{b.disabled=false}}
  const b=e.target.closest('[data-k38-exec]');if(b){b.disabled=true;try{const r=await fetch('/api/kim/v380/missions/'+encodeURIComponent(b.dataset.k38Exec)+'/execute',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessName:'Prospect',inputVerified:true,brandAssets:true,pricingSource:true,consent:true,noSecrets:true})});const j=await r.json();if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);cache=null;cacheAt=0;window.render?.()}catch(x){alert(x.message)}finally{b.disabled=false}}
 });
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v38-kim-growth.js", sbcBundleError);
}
/* END v38-kim-growth.js */
;
/* BEGIN v391-commercial-readiness.js */
try {
(function(){
  async function get(path){const r=await fetch(path,{credentials:'include'});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);return j;}
  window.kimCommercialReadinessView=async function(){
    try{const [s,c]=await Promise.all([get('/api/kim391/summary'),get('/api/kim391/capabilities')]);
      const rows=(c.capabilities||[]).map(x=>`<tr><td>${x.id}</td><td>${x.title}</td><td>${x.domain}</td><td><span class="k391-badge">${x.mode}</span></td></tr>`).join('');
      return `<div class="section"><div class="card-body"><div class="k391-grid"><div class="k391-card"><h3>🛡️ Kim Commercial Readiness</h3><p>${s.capabilityCount} readiness capabilities</p><p class="k391-note">External account changes remain gated until credentials, authorization, and human approval are verified.</p></div><div class="k391-card"><h3>🗺️ Local Discovery</h3><p>GBP, citations, reviews, messaging, map and profile readiness.</p></div><div class="k391-card"><h3>💳 KYB & Payments</h3><p>Documents, gateway, webhook, bank and transaction readiness.</p></div><div class="k391-card"><h3>🖨️ Vendors</h3><p>4OVER4, VistaPrint, GoDaddy and webhook readiness.</p></div><div class="k391-card"><h3>🤖 AI & Lead Mesh</h3><p>Lorna ingestion, compliant site audits, sandbox generation and conversion telemetry.</p></div><div class="k391-card"><h3>👥 Workforce & Notary</h3><p>Role fences plus conservative notary readiness preflight.</p></div></div><div class="k391-card" style="margin-top:14px"><div class="k391-actions"><button id="k391Sweep">Run Readiness Check</button><button id="k391KYB">Check KYB Checklist</button><button id="k391GBP">Check GBP Profile Fields</button></div><p id="k391Result" class="k391-note">Ready.</p></div><div class="k391-card" style="margin-top:14px"><table class="k391-table"><thead><tr><th>ID</th><th>Capability</th><th>Domain</th><th>Mode</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
    }catch(e){return `<div class="card section"><div class="card-body"><h3>Kim Commercial Readiness</h3><p>${e.message}</p></div></div>`;}
  };
  document.addEventListener('click',async e=>{const b=e.target.closest('#k391Sweep,#k391KYB,#k391GBP');if(!b)return;const out=document.querySelector('#k391Result');if(!out)return;out.textContent='Checking…';try{let r;if(b.id==='k391KYB')r=await fetch('/api/kim391/kyb/check',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});else if(b.id==='k391GBP')r=await fetch('/api/kim391/business-profile/check',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({businessName:'Successful By Choice LLC',address:'13995 NW 7th Ave',hours:'REVIEW_REQUIRED',phone:'REVIEW_REQUIRED'})});else r=await fetch('/api/kim391/model/readiness',{method:'POST',credentials:'include'});const j=await r.json();if(!r.ok)throw Error(j.error||`HTTP ${r.status}`);out.textContent=JSON.stringify(j.result||j,null,2);}catch(x){out.textContent=x.message;}});
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v391-commercial-readiness.js", sbcBundleError);
}
/* END v391-commercial-readiness.js */
