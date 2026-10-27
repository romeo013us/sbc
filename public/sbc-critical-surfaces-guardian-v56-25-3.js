// SBC_V6647_MASTER_INTERACTION_AUDIT guardian fallback buttons report unavailable actions instead of doing nothing.
/* SBC V56.25.3 — Critical Surface Guardian
 * Production Control + Supernova are hard-routed to stable local surfaces.
 * API failures must degrade the telemetry, never remove the controls.
 */
(function(){
  'use strict';
  const VERSION='56.25.3-critical-surfaces';
  const content=()=>document.getElementById('content');
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function supernovaSurface(){return `<section id="sbcSupernovaCriticalSurface" class="card section supernova-wrap"><div class="supernova-hero"><div><p class="eyebrow">SBC SUPERNOVA · SUPERCORE</p><h2>🧬 Supernova</h2><p>Core infrastructure fabric for the Command Center, Office Box and customer systems.</p><span class="supernova-status">● CONTROL SURFACE ONLINE</span></div><div class="supernova-orb">SN</div></div><div class="supernova-grid"><div class="supernova-card"><strong>⚡ Event Fabric</strong><span>Durable, auditable events.</span></div><div class="supernova-card"><strong>🧠 State Fabric</strong><span>Durable state boundaries.</span></div><div class="supernova-card"><strong>🔌 Adapter Fabric</strong><span>Vendor-neutral integrations.</span></div><div class="supernova-card"><strong>🛡️ Security Fabric</strong><span>Tenant boundaries and audit controls.</span></div><div class="supernova-card"><strong>🏗️ Provisioning Fabric</strong><span>Repeatable provisioning requests.</span></div><div class="supernova-card"><strong>📡 Telemetry Fabric</strong><span>Runtime health and recovery visibility.</span></div></div><div class="actions" style="margin-top:16px"><button class="btn primary" type="button" onclick="window.sbcSupernovaHealth?.()">🔎 Check Supernova</button><button class="btn" type="button" onclick="window.sbcSupernovaArchitecture?.()">🏗️ Architecture</button><button class="btn" type="button" onclick="window.sbcSupernovaAudit?.()">🛡️ Verify Audit</button><button class="btn" type="button" onclick="window.sbcNavigate?.('fantastic4')">🚦 Production Control</button></div><div id="sbcSupernovaResult" class="install-tip" style="margin-top:12px">Controls remain available even if a telemetry endpoint returns an error.</div></section>`}
  function productionFallback(){return `<section id="sbcProductionCriticalSurface" class="card section"><div class="card-head"><div><div class="eyebrow">LAUNCH CONTROL</div><h2>🚦 Production Control</h2><div class="mini">Owner-controlled autonomous production and Revenue PLAY.</div></div><span class="badge blue">CONTROL SURFACE ONLINE</span></div><div class="card-body"><div class="grid three"><div class="stat"><div class="label">PRODUCTION</div><div class="value" id="sbcGuardianProductionState">READY</div><div class="sub">Authoritative state checked on demand</div></div><div class="stat"><div class="label">REVENUE PLAY</div><div class="value">READY</div><div class="sub">Bounded owner-controlled execution</div></div><div class="stat"><div class="label">PLAY BATCH</div><div class="value">10</div><div class="sub">Hard cap: 20</div></div></div><div class="actions" style="margin-top:16px"><button class="btn primary" type="button" onclick="window.f4ProductionToggle ? window.f4ProductionToggle() : alert('Production controls are unavailable. Reload this page before retrying.')">🚦 Start / Stop Production</button><button class="btn primary" type="button" onclick="window.f4RevenuePlay ? window.f4RevenuePlay() : alert('Revenue Play is unavailable. Reload this page before retrying.')">▶️ PLAY — WORK 10 REAL LEADS</button><button class="btn" type="button" onclick="window.f4RevenueVerify ? window.f4RevenueVerify() : alert('Lead verification controls are unavailable. Reload this page before retrying.')">🔎 VERIFY WARM/HOT LEADS</button><button class="btn" type="button" onclick="window.f4RevenueRefresh ? window.f4RevenueRefresh() : alert('Revenue status controls are unavailable. Reload this page before retrying.')">↻ CHECK REVENUE STATUS</button></div><div id="sbcGuardianProductionStatus" class="install-tip" style="margin-top:12px">Control buttons are local and remain available while status APIs recover.</div></div></section>`}
  function setView(v){
    if(!window.state||!content())return false;
    const renderEpoch=++sbcCriticalNavigationEpoch;
    window.state.view=v;
    document.querySelectorAll('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
    if(v==='supernova'){content().innerHTML=supernovaSurface();return true;}
    if(v==='production-control'||v==='fantastic4'){
      const renderHost=content();renderHost.innerHTML=productionFallback();
      Promise.resolve().then(async()=>{
        try{
          if(typeof window.fantastic4LaunchView==='function'){
            const html=await window.fantastic4LaunchView();
            if(renderEpoch===sbcCriticalNavigationEpoch && window.state?.view===v && content()===renderHost && renderHost.querySelector('#sbcProductionCriticalSurface') && html && typeof html==='string' && /<section|<div/i.test(html) && !/Unexpected token|<!doctype|Section temporarily unavailable|RENDER ERROR/i.test(html)){ renderHost.innerHTML=html; }
          }
        }catch(e){ console.warn('[SBC Guardian] F4 render degraded:',e); }
        try{if(renderEpoch===sbcCriticalNavigationEpoch && window.state?.view===v && content()===renderHost)window.f4RevenueRefresh?.();}catch(e){}
      });
      return true;
    }
    return false;
  }
  let sbcCriticalNavigationEpoch=0;
  const originalNavigate=window.sbcNavigate;
  window.sbcNavigate=function(v){
    if(v==='production-control'||v==='fantastic4'||v==='supernova') return setView(v);
    sbcCriticalNavigationEpoch++;
    return typeof originalNavigate==='function'?originalNavigate(v):false;
  };
  window.sbcCriticalSurfaceGuardian={version:VERSION,setView};
  window.sbcSupernovaHealth=async()=>{const out=document.getElementById('sbcSupernovaResult');try{const r=await safe('/api/supernova/health');if(out)out.textContent=r.ok?'Supernova health endpoint responded successfully.':'Supernova returned a non-ready response.';}catch(e){if(out)out.textContent='Supernova health check: '+e.message;}};
  window.sbcSupernovaArchitecture=async()=>{const out=document.getElementById('sbcSupernovaResult');try{const r=await safe('/api/supernova/architecture');if(out)out.textContent='Architecture endpoint responded: '+(r.version||'Supercore')+'.';}catch(e){if(out)out.textContent='Architecture check: '+e.message;}};
  window.sbcSupernovaAudit=async()=>{const out=document.getElementById('sbcSupernovaResult');try{const r=await safe('/api/supernova/audit/verify');if(out)out.textContent='Audit verification response received: '+(r.ok===false?'NOT VERIFIED':'VERIFIED/RESPONDED')+'.';}catch(e){if(out)out.textContent='Audit verification: '+e.message;}};
  async function safe(url,opts){const r=await fetch(url,opts);const t=await r.text();let j;try{j=JSON.parse(t)}catch(e){throw new Error('Non-JSON response from '+url+' (HTTP '+r.status+')')};if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j}
  function repair(){const v=window.state?.view;if(v==='production-control'||v==='fantastic4'){const c=content();if(!c||!c.querySelector('.f4-production-control,.f4-revenue-control,#sbcProductionCriticalSurface'))setView(v);}if(v==='supernova'){const c=content();if(!c||!c.querySelector('#sbcSupernovaCriticalSurface,.supernova-wrap'))setView(v);}}
  window.addEventListener('error',e=>{const m=String(e?.message||'');if(/Unexpected token ['<]|doctype|render error/i.test(m))setTimeout(repair,0)});
  window.addEventListener('unhandledrejection',e=>{const m=String(e?.reason?.message||e?.reason||'');if(/Unexpected token ['<]|doctype|render error|non-json/i.test(m))setTimeout(repair,0)});
  setInterval(repair,5000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(repair,100),{once:true});else setTimeout(repair,100);
  function removeCriticalLeftRailItems(){
    document.querySelectorAll('.sidebar .nav-item[data-view="production-control"], .sidebar .nav-item[data-view="supernova"]').forEach(el=>el.remove());
  }
  removeCriticalLeftRailItems();
  const railObserver = new MutationObserver(()=>removeCriticalLeftRailItems());
  const rail = document.querySelector('.sidebar nav');
  if(rail) railObserver.observe(rail,{childList:true,subtree:true});

})();
