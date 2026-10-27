/* SBC V56.13.3 — Owner Workspace / Navigation / Reliability Fix
   Additive presentation layer. Does not replace production engines or credentials. */
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const nav=()=>document.querySelector('.sidebar nav');
  const go=view=>{ if(view==='production-control'){ if(typeof window.sbcNavigate==='function') return window.sbcNavigate('fantastic4'); window.state.view='fantastic4'; window.render(); return; }
    if(view==='supernova'){ if(typeof window.sbcNavigate==='function') return window.sbcNavigate('supernova'); window.state.view='supernova'; window.render(); return; }
    if(typeof window.sbcNavigate==='function' && document.querySelector(`.nav-item[data-view="${view}"]`)) return window.sbcNavigate(view);
    window.state.view=view; window.render(); };

  function ensureTopNav(){
    const n=nav(); if(!n)return;
    const home=n.querySelector('[data-view="dashboard"]');
    if(!home)return;
    const defs=[
      ['training','🎓','Training Center']
    ];
    // Production Control is an owner Tier-1 control and must remain directly accessible.
    // Supernova remains an internal surface. Do not remove either destination here.

    defs.forEach(([v,icon,label])=>{
      let b=n.querySelector(`[data-view="${v}"]`);
      if(!b){b=document.createElement('button');b.type='button';b.className='nav-item sbc-tier1-nav';b.dataset.view=v;b.innerHTML=`<span>${icon}</span> ${label}`;}
      else {b.classList.add('sbc-tier1-nav');}
      if(v==='production-control') b.onclick=()=>go(v);
      if(v==='training') b.onclick=()=>go('training');
      if(v==='supernova') b.onclick=()=>go('supernova');
      if(b.parentElement!==n || b.previousElementSibling!==home) n.insertBefore(b,home.nextSibling);
    });
    // Remove duplicate/low-value owner-only destinations from the primary rail.
    ['signature','settings'].forEach(v=>{const b=n.querySelector(`[data-view="${v}"]`);if(b)b.classList.add('sbc-secondary-hidden');});
    const mega=['automation','commissions','policies'];
    mega.forEach(v=>{const b=n.querySelector(`[data-view="${v}"]`);if(b)b.classList.add('sbc-secondary-hidden');});
    // Commission ledger only becomes relevant once a caller exists; keep it out of the main rail for now.
    const commission=n.querySelector('[data-view="commissions"]');
    if(commission)commission.classList.add('sbc-secondary-hidden');
  }

  function injectDashboardQuickRail(){
    if(window.state?.view!=='dashboard')return;
    const content=document.querySelector('#content'); if(!content)return;
    if(content.querySelector('#sbcOwnerQuickRail'))return;
    const rail=document.createElement('section');rail.id='sbcOwnerQuickRail';rail.className='sbc-owner-quick-rail';
    rail.innerHTML=`<div class="sbc-owner-quick-head"><div><div class="eyebrow">OWNER SHORTCUTS</div><h3>Critical controls, one click away</h3><p>Production, training, policies and Supernova should never be buried.</p></div></div><div class="sbc-owner-quick-grid">
      <button type="button" class="sbc-owner-quick primary" data-owner-go="production-control"><span>🚦</span><div><strong>Production Control</strong><small>Start/stop routine autonomous production.</small></div></button>
      <button type="button" class="sbc-owner-quick" data-owner-go="training"><span>🎓</span><div><strong>Training Center</strong><small>Courses, lessons, assessments and completion.</small></div></button>
      <button type="button" class="sbc-owner-quick" data-owner-go="policies"><span>📋</span><div><strong>Policies & Standards</strong><small>Owner review and people standards.</small></div></button>
      <button type="button" class="sbc-owner-quick" data-owner-go="supernova"><span>🧬</span><div><strong>Supernova</strong><small>Platform fabric, telemetry and architecture.</small></div></button>
    </div>`;
    const first=content.firstElementChild; if(first)content.insertBefore(rail,first.nextSibling); else content.appendChild(rail);
    rail.querySelectorAll('[data-owner-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.ownerGo)));
  }

  function fixVisualPipeline(){
    if(window.state?.view!=='crm')return;
    const cards=[...document.querySelectorAll('.card.section')];
    const card=cards.find(x=>/Visual Sales Pipeline/i.test(x.textContent||''));
    if(!card)return;
    card.classList.add('sbc-visual-pipeline-card');
    const head=card.querySelector('.card-head');
    if(head){
      const h=head.querySelector('h2'); if(h)h.innerHTML='📊 Visual Sales Pipeline';
      const badge=head.querySelector('.badge'); if(badge){badge.className='badge sbc-pipeline-badge';badge.textContent='LIVE · DRAG TO MOVE';}
    }
  }

  function bind(){
    ensureTopNav();
    injectDashboardQuickRail();
    fixVisualPipeline();
    document.body.classList.add('sbc-owner-workspace-v563');
  }
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(bind,80);setTimeout(bind,500);});
  const mo=new MutationObserver(()=>{clearTimeout(window.__sbcOwnerUiTimer);window.__sbcOwnerUiTimer=setTimeout(bind,30);});
  mo.observe(document.body,{childList:true,subtree:true});
  window.SBC_OWNER_WORKSPACE_FIX={bind,go};
})();
