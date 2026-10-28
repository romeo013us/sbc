(function(){
  'use strict';
  async function get(path){if(typeof window.api==='function')return window.api(path,{timeoutMs:15000});const r=await fetch(path,{credentials:'include'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;}
  function mount(){if(!window.state?.me||window.state.me.role!=='owner')return;
    if(document.getElementById('sbcV329Panel'))return;
    const el=document.createElement('section');el.id='sbcV329Panel';el.style.cssText='margin:18px 0;padding:18px;border:1px solid rgba(11,116,209,.25);border-radius:16px;background:linear-gradient(135deg,rgba(11,116,209,.08),rgba(255,255,255,.92));box-shadow:0 8px 28px rgba(0,0,0,.08)';
    el.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><div style="font-size:18px;font-weight:800">👑 KIM Enterprise Control Fabric <span style="font-size:12px;opacity:.7">SBC OS V65.1.23 · Capabilities 101–150</span></div><div style="opacity:.75;margin-top:4px">Provider controls • lead mesh • sales continuity • communications • document integrity • worker reliability</div></div><div style="display:flex;gap:8px"><button id="sbcV329Refresh" class="btn">Refresh</button><button id="sbcV329Verify" class="btn primary">Sync CRM Lead Queue</button></div></div><div id="sbcV329Stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-top:14px"></div><div id="sbcV329Msg" style="margin-top:10px;font-size:13px;opacity:.75"></div>';
    const host=document.querySelector('main')||document.querySelector('#app')||document.body;host.appendChild(el);
    async function refresh(){const msg=document.getElementById('sbcV329Msg');try{const x=await get('/api/kim/v329/summary');const cards=[['Capabilities',x.capabilities],['Lead batches',x.leadBatches],['Leads',x.leads],['Verify queue',x.verificationQueue],['Opportunities',x.opportunities],['Audit entries',x.auditEntries]];document.getElementById('sbcV329Stats').innerHTML=cards.map(([k,v])=>`<div style="padding:12px;border-radius:12px;background:#fff;border:1px solid rgba(0,0,0,.08)"><div style="font-size:12px;opacity:.65">${k}</div><strong style="font-size:22px">${v}</strong></div>`).join('');// SBC_V6522_API_STABILIZATION: unknown counts must never be rendered as real zeroes.
      const leadState=x.canonicalLeadMesh||{};
      msg.textContent=leadState.dataStatus==='UNAVAILABLE_TIMEOUT'||x.degraded?'CRM/Lead Mesh status unavailable: the data query timed out. Counts are unknown; no data was changed.':`CRM lead mesh connected: ${Number.isFinite(leadState.activeSalesLeads)?leadState.activeSalesLeads:'unknown'} active sales leads · ${Number.isFinite(leadState.verificationQueue)?leadState.verificationQueue:'unknown'} awaiting verification.`;}catch(e){const detail=String(e?.message||e||'Unknown error');const auth=/authentication required|unauthorized|forbidden|http 401|http 403|session.*(missing|expired)/i.test(detail);const recovery=/recovery|required|423|blocked|read.only/i.test(detail);msg.textContent=auth?'Sign in with an authorized SBC workforce account to load the Enterprise Control Fabric.':recovery?`RECOVERY LOCK ACTIVE: Enterprise status could not be loaded safely. ${detail}`:`Enterprise status request failed: ${detail}`;}}
    document.getElementById('sbcV329Refresh').onclick=refresh;
    document.getElementById('sbcV329Verify').onclick=async()=>{
      const msg=document.getElementById('sbcV329Msg');
      try{
        const summary=typeof window.api==='function'?await window.api('/api/kim/v329/summary'):await (async()=>{const x=await fetch('/api/kim/v329/summary',{credentials:'include'});return x.json()})();
        if(summary?.canonicalLeadMesh?.readOnlyRecoveryProjection){
          const preserved=Number(summary?.canonicalLeadMesh?.preservedLeadMeshCandidates||summary?.canonicalLeadMesh?.records||0);
          msg.textContent=`RECOVERY LOCK ACTIVE: ${preserved} preserved lead-mesh candidates remain read-only. No records were promoted. Reconcile the authoritative pre-corruption backup before any CRM restore.`;
          return;
        }
        if(summary?.recoveryRequired){
          msg.textContent='RECOVERY LOCK ACTIVE: lead-queue synchronization is disabled until authoritative MySQL recovery is verified. No records were changed.';
          return;
        }
        const j=typeof window.api==='function'?await window.api('/api/kim/v329/leads/verify',{method:'POST',body:JSON.stringify({limit:50}),timeoutMs:30000}):await (async()=>{const x=await fetch('/api/kim/v329/leads/verify',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:50})});const raw=await x.text();let d=null;try{d=JSON.parse(raw)}catch{}if(!x.ok)throw new Error(d?.message||d?.error||`HTTP ${x.status}`);if(!d)throw new Error('Lead verification returned non-JSON content.');return d;})();
        msg.textContent=j.ok?`CRM lead queue synced: ${j.synced||0} active sales leads · ${j.alreadyVerified||0} verified/Sales Ready · ${j.requiresReview||0} still need verification.`:(j.error||'Lead queue sync failed.');
        await refresh();
      }catch(e){msg.textContent=e.message||String(e);}
    };
    if(window.state?.me)refresh();
    else window.addEventListener('sbc:authenticated',()=>setTimeout(refresh,80),{once:true});
  }
  window.addEventListener('sbc:authenticated',mount);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
