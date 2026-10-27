/* SBC V56.10 — Whitelabel Commerce Fabric executive cockpit. */
(function(){
  'use strict';
  const VERSION='56.10.2';
  const q=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
  const api=(...a)=>window.api?window.api(...a):Promise.reject(new Error('SBC API bridge unavailable'));
  let commerce=null, mission=null, revenueCloser=null;

  const SBC_EngineUI={
    grid:null,
    kimBox:null,
    init(){
      this.grid=document.querySelector('.v5610-shell');
      this.kimBox=document.querySelector('.v5610-shell .v5610-panel:last-of-type');
      this.decorateModules();
    },
    decorateModules(){
      if(!this.grid)return;
      const modules=[...this.grid.querySelectorAll(':scope > section')];
      modules.forEach((el,i)=>{
        el.classList.add('dashboard-module-card');
        if(!el.dataset.moduleId)el.dataset.moduleId=['hero','kpis','money-radar','owner-control','commerce-fabric','storefront-factory','wholesale-fulfillment','kim-read'][i]||`module-${i}`;
      });
    },
    reorderModules(orderedIds){
      if(!this.grid)return;
      const modules=[...this.grid.querySelectorAll(':scope > section[data-module-id]')];
      const first=new Map(modules.map(el=>[el,el.getBoundingClientRect()]));
      modules.forEach(el=>{const rank=orderedIds.indexOf(el.dataset.moduleId);el.style.order=rank<0?99:rank;});
      requestAnimationFrame(()=>modules.forEach(el=>{
        const a=first.get(el),b=el.getBoundingClientRect();if(!a)return;const dy=a.top-b.top;
        if(!dy)return;el.style.transform=`translateY(${dy}px)`;el.style.transition='transform 0s';requestAnimationFrame(()=>{el.style.transform='';el.style.transition='transform .6s cubic-bezier(.16,1,.3,1)';});
      }));
    },
    triggerKimState(state){
      const box=this.kimBox;if(!box)return;
      box.classList.remove('v5610-kim-analyzing','v5610-kim-alert');
      if(state==='ANALYZING')box.classList.add('v5610-kim-analyzing');
      if(state==='ALERT')box.classList.add('v5610-kim-alert');
    },
    pulseIngestion(active=true){
      const lane=document.querySelector('#v56Dropzone,.v56-drop,.leads-lane-ingesting');if(!lane)return;
      lane.classList.toggle('lane-shimmer-active',Boolean(active));
    }
  };
  window.SBC_EngineUI=SBC_EngineUI;

  const nav=v=>{if(typeof window.sbcNavigate==='function')window.sbcNavigate(v);else if(typeof window.nav==='function')window.nav(v);else{window.state.view=v;window.render();}};
  function compute(){
    const d=window.state?.data||{}, c=Array.isArray(d.customers)?d.customers:[], q0=Array.isArray(d.quotes)?d.quotes:[], o=Array.isArray(d.orders)?d.orders:[];
    const active=c.filter(x=>!['Customer','Lost','Do Not Call','Closed','Duplicate','Not Qualified'].includes(String(x.status||'')));
    const hot=active.filter(x=>String(x.leadTemperature||'').toLowerCase()==='hot');
    const warm=active.filter(x=>String(x.leadTemperature||'').toLowerCase()==='warm');
    const openQuotes=q0.filter(x=>!['Won','Paid','Lost','Cancelled'].includes(String(x.status||'')));
    const openOrders=o.filter(x=>!['Delivered','Cancelled'].includes(String(x.status||'')));
    const revenue=q0.filter(x=>['Won','Paid'].includes(x.status)).reduce((n,x)=>n+Number(x.total||0),0);
    return {c,active,hot,warm,openQuotes,openOrders,revenue};
  }
  async function loadData(){
    const [co,mi,rc]=await Promise.allSettled([api('/api/v5610/commerce/overview',{timeoutMs:12000}),api('/api/mission-control',{timeoutMs:12000}),api('/api/v5611/closer/metrics',{timeoutMs:12000})]);
    commerce=co.status==='fulfilled'?co.value:null; mission=mi.status==='fulfilled'?mi.value:null; revenueCloser=rc.status==='fulfilled'?rc.value:null;
    refreshDynamic();
  }
  function issueTitle(i){return String(i?.title||i?.type||'Owner-control item');}
  function issueDetail(i){return String(i?.description||i?.message||'Owner review required.');}
  function openOwnerReview(i){
    const title=issueTitle(i), detail=issueDetail(i);
    let suggested='Review the underlying control and decide whether action is required.';
    let target='';
    if(/smtp|email|mail/i.test(title+' '+detail)){suggested='SMTP is a configuration dependency for outbound email. Open Communications/Settings to review the current mail configuration.';target='communications';}
    else if(/training/i.test(title+' '+detail)){suggested='Open the Training Center to review the affected training source or content state.';target='training';}
    else if(/fulfillment|delivery|vendor/i.test(title+' '+detail)){suggested='Open Delivery to inspect the affected fulfillment work before taking action.';target='orders';}
    const host=q('#v5610OwnerDialog'); if(!host)return;
    host.classList.add('open'); host.setAttribute('aria-hidden','false');
    q('#v5610OwnerDialogTitle').textContent=title;
    q('#v5610OwnerDialogBody').innerHTML=`<p style="color:#aab6c7;line-height:1.6">${esc(detail)}</p><div class="v5610-row"><div class="v5610-row-main"><strong>Owner decision</strong><small>${esc(suggested)}</small></div><span class="v5610-badge warn">OWNER ONLY</span></div><div class="v5610-actions" style="margin-top:14px"><button class="v5610-btn primary" data-v5610-review-target="${esc(target)}">${target?'Open '+(target==='communications'?'Communications':target==='orders'?'Delivery':'Training'):'Review in place'}</button><button class="v5610-btn" id="v5610RunSweep">↻ Re-check</button></div><details style="margin-top:14px"><summary style="cursor:pointer;color:#8994a6">Raw mission item</summary><pre>${esc(JSON.stringify(i,null,2))}</pre></details>`;
    const b=q('[data-v5610-review-target]');if(b)b.onclick=()=>{closeOwnerReview();if(target)nav(target);else nav('missioncontrol');};
    const s=q('#v5610RunSweep');if(s)s.onclick=async()=>{s.disabled=true;s.textContent='Checking…';try{await api('/api/mission-control/sweep',{method:'POST',body:'{}',timeoutMs:15000});toast('Owner controls re-checked.');closeOwnerReview();await loadData();}catch(e){toast(e.message||'Mission sweep failed.');s.disabled=false;s.textContent='↻ Re-check';}};
  }
  function closeOwnerReview(){const x=q('#v5610OwnerDialog');if(x){x.classList.remove('open');x.setAttribute('aria-hidden','true');}}
  function ownerItems(){const arr=Array.isArray(mission?.issues)?mission.issues:[];return arr.slice(0,6).map((i,idx)=>`<button type="button" class="v5610-row v5610-owner-row" data-owner-index="${idx}"><div class="v5610-row-main"><strong>${esc(issueTitle(i))}</strong><small>${esc(issueDetail(i))}</small></div><span class="review">Review →</span></button>`).join('')||'<div class="v5610-row"><div class="v5610-row-main"><strong>Owner controls clear</strong><small>No mission-control exceptions are currently surfaced.</small></div><span class="v5610-badge good">CLEAR</span></div>';
  }
  function render(){
    document.body.classList.add('v56-flow-mode','v56-nav-only');
    const x=compute(), m=commerce?.metrics||{};
    const spotlight=x.hot[0]||x.warm[0]||x.active[0];
    const actionable=x.hot.reduce((n,c)=>n+Number(c.dealValue||0),0)+x.openQuotes.reduce((n,c)=>n+Number(c.total||0),0);
    const providerReady=(commerce?.providers||[]).filter(p=>p.status==='READY').length;
    const recovery=window.state?.data?.recovery||{};
    const restoredVerifiedLeads=Number(recovery.restoredVerifiedLeads||0);
    const recoveryBanner=recovery.required?`<section class="v5610-recovery-banner" style="margin-bottom:14px;padding:14px 16px;border:1px solid rgba(245,158,11,.35);border-radius:14px;background:rgba(245,158,11,.07)"><strong>🛡 SAFE RECOVERY MODE</strong><div style="margin-top:5px;color:#c8d1df">Runtime V65.1.23 is healthy. <b>${restoredVerifiedLeads}</b> verified leads are in the authoritative CRM. Full CRM recovery remains protected; Revenue PLAY, Kim missions and financial mutations remain suspended until the authoritative core is complete.</div></section>`:'';
    return `<div class="v5610-shell">
      ${recoveryBanner}<section class="v5610-hero"><div class="v5610-hero-grid"><div><div class="v5610-kicker">SBC REVENUE AUTOPILOT · SBC OS V65.1.23</div><h1>Make the money. Move the work. See the exceptions.</h1><p>${spotlight?`Work <strong>${esc(spotlight.businessName||spotlight.contactName||'the highest-confidence opportunity')}</strong> first. `:''}The new cockpit keeps revenue decisions, customer storefronts, fulfillment and owner exceptions in one operating surface while the proven production engines remain underneath.</p><div class="v5610-actions"><button class="v5610-btn primary" data-v5610-nav="salesworkbench">💰 Work Revenue PLAY</button><button class="v5610-btn" data-v5610-nav="leadimport">📥 Drop Leads</button><button class="v5610-btn ghost" data-v5610-kim>✦ Ask Kim</button></div></div><div class="v5610-hero-metric"><span>ACTIONABLE MONEY</span><strong>${money(actionable)}</strong><small>${x.hot.length} hot · ${x.openQuotes.length} open quotes · ${x.openOrders.length} delivery items</small></div></div></section>
      <section class="v5610-kpis"><article class="v5610-kpi"><label>WON REVENUE</label><strong>${money(x.revenue)}</strong><small>Recorded won / paid</small></article><article class="v5610-kpi"><label>ACTIVE PIPELINE</label><strong>${x.active.length}</strong><small>${x.hot.length} hot · ${x.warm.length} warm</small></article><article class="v5610-kpi"><label>STOREFRONTS</label><strong>${Number(m.storefronts||0)}</strong><small>Branded tenant stores</small></article><article class="v5610-kpi"><label>PROVIDER RAIL</label><strong>${providerReady}/${(commerce?.providers||[]).length||3}</strong><small>Verified internal readiness</small></article></section>
      <section class="v5610-panel v5611-revenue-panel"><div class="v5610-head"><div><h2>🧠 AI Revenue Closer</h2><p>Measure conversations and money — not vanity call volume.</p></div><span class="v5610-badge blue">SBC OS V65.1.23</span></div><div class="v5610-body"><div class="v5611-revenue-grid"><div><span>REVENUE CONTACTS</span><strong>${Number(revenueCloser?.metrics?.contacts||0)}</strong></div><div><span>CONVERSATIONS</span><strong>${Number(revenueCloser?.metrics?.conversations||0)}</strong></div><div><span>OFFERS</span><strong>${Number(revenueCloser?.metrics?.offers||0)}</strong></div><div><span>CLOSED REVENUE</span><strong>${money(revenueCloser?.metrics?.revenue||0)}</strong></div></div><div class="v5610-actions"><button class="v5610-btn primary" data-v5611-kim-sales>✦ Ask Kim to Find the Next Sale</button><button class="v5610-btn" data-v5610-nav="salesworkbench">Open Revenue PLAY</button></div></div></section>
      <section class="v5610-grid"><article class="v5610-panel"><div class="v5610-head"><div><h2>🔥 Money Radar</h2><p>Highest-confidence opportunities first.</p></div><button class="v5610-btn" data-v5610-nav="salesworkbench">Open Sales</button></div><div class="v5610-body"><div class="v5610-rail">${(x.hot.length?x.hot:x.active).slice(0,8).map(c=>`<article class="v5610-card" data-v5610-customer="${esc(c.id)}"><span class="v5610-badge ${String(c.leadTemperature||'').toLowerCase()==='hot'?'red':'warn'}">${String(c.leadTemperature||'PROSPECT').toUpperCase()}</span><h3>${esc(c.businessName||c.contactName||'Unnamed prospect')}</h3><p>${esc(c.industry||'Business prospect')} · ${esc(c.status||'Lead')}</p><div class="value">${Number(c.dealValue||0)?money(c.dealValue):'Opportunity'}</div></article>`).join('')||'<div class="v5610-row"><div class="v5610-row-main"><strong>No active opportunities</strong><small>Revenue PLAY has nothing ready to surface.</small></div></div>'}</div></div></article>
      <article class="v5610-panel"><div class="v5610-head"><div><h2>🛡 Owner Control</h2><p>Protected actions stay with you.</p></div><span class="v5610-badge ${mission?.issues?.length?'warn':'good'}">${mission?.issues?.length?mission.issues.length+' REVIEW':'CLEAR'}</span></div><div class="v5610-body"><div class="v5610-list">${ownerItems()}</div></div></article></section>
      <section class="v5610-panel"><div class="v5610-head"><div><h2>🛒 Commerce Fabric</h2><p>Storefront → order → financial policy → fulfillment → provider.</p></div><div class="v5610-actions" style="margin:0"><button class="v5610-btn" data-v5610-refresh>↻ Refresh</button><button class="v5610-btn primary" data-v5610-nav="orders">Open Delivery</button></div></div><div class="v5610-body"><div class="v5610-flow"><div class="v5610-node"><strong>${Number(m.storefronts||0)}</strong><span>STOREFRONTS</span></div><div class="v5610-node"><strong>${Number(m.orders||x.c.length||0)}</strong><span>ORDERS</span></div><div class="v5610-node"><strong>${Number(m.ownerLocks||0)}</strong><span>VAULT HOLDS</span></div><div class="v5610-node"><strong>${Number(m.stagedProviderJobs||0)}</strong><span>PROVIDER STAGED</span></div><div class="v5610-node"><strong>${Number(m.activeOrders||x.openOrders.length)}</strong><span>ACTIVE DELIVERY</span></div></div></div></section>
      <section class="v5610-grid"><article class="v5610-panel"><div class="v5610-head"><div><h2>🏷️ Tenant Storefront Factory</h2><p>Branded storefronts are provisioned from controlled templates.</p></div><span class="v5610-badge blue">NO ARBITRARY HTML</span></div><div class="v5610-body"><div class="v5610-list"><div class="v5610-row"><div class="v5610-row-main"><strong>Dynamic brand injection</strong><small>Business name, colors, logo and support details are escaped and template-bound.</small></div><button class="v5610-btn" data-v5610-nav="orders">Open Orders</button></div><div class="v5610-row"><div class="v5610-row-main"><strong>Payment → provisioning</strong><small>Paid order events can trigger storefront provisioning without replacing the existing website.</small></div><span class="v5610-badge good">READY</span></div></div></div></article><article class="v5610-panel"><div class="v5610-head"><div><h2>🏭 Wholesale Fulfillment</h2><p>Provider adapters remain fail-closed until the official contract is verified.</p></div><span class="v5610-badge ${providerReady?'good':'warn'}">${providerReady?'INTERNAL READY':'STAGED ONLY'}</span></div><div class="v5610-body"><div class="v5610-list">${(commerce?.providers||[]).map(p=>`<div class="v5610-row"><div class="v5610-row-main"><strong>${esc(p.provider)}</strong><small>${esc(p.note||'')}</small></div><span class="v5610-badge ${p.status==='READY'?'good':p.status==='UNSUPPORTED'?'red':'warn'}">${esc(p.status)}</span></div>`).join('')}</div></div></article></section>
      <section class="v5610-panel"><div class="v5610-head"><div><h2>✦ Kim · Executive Operating Read</h2><p>Use Kim for diagnosis and prioritization; owner authority remains explicit.</p></div><button class="v5610-btn primary" data-v5610-kim>Find Money</button></div><div class="v5610-body"><p style="margin:0;color:#aab6c7;line-height:1.6">${spotlight?`Kim's focus is <strong>${esc(spotlight.businessName||spotlight.contactName||'the top opportunity')}</strong>. Work the highest-confidence opportunity before increasing lead volume.`:'Ask Kim for the highest-value next move and the exceptions that require owner attention.'}</p></div></section>
      <div class="v5610-footer"><span>SBC OS V65.1.23 · Revenue Autopilot / Commerce Fabric</span><span>Ctrl/Cmd + K · Command Palette</span></div>
    </div>${dialog()}`;
  }
  function dialog(){return `<div id="v5610OwnerDialog" class="v5610-overlay" aria-hidden="true"><div class="v5610-dialog"><div class="v5610-dialog-head"><h2 id="v5610OwnerDialogTitle">Owner Review</h2><button class="v5610-btn" id="v5610OwnerClose">×</button></div><div class="v5610-dialog-body" id="v5610OwnerDialogBody"></div></div></div>`;}
  function bind(){
    SBC_EngineUI.init();
    document.querySelectorAll('[data-v5610-nav]').forEach(b=>b.onclick=()=>nav(b.dataset.v5610Nav));
    document.querySelectorAll('[data-v5610-customer]').forEach(b=>b.onclick=()=>{if(typeof window.editCustomer==='function')window.editCustomer(b.dataset.v5610Customer);else nav('customers');});
    document.querySelectorAll('[data-owner-index]').forEach(b=>b.onclick=()=>openOwnerReview((mission?.issues||[])[Number(b.dataset.ownerIndex)]||{}));
    document.querySelectorAll('[data-v5610-kim]').forEach(b=>b.onclick=()=>{if(typeof window.openSbcAI==='function')window.openSbcAI();});
    document.querySelectorAll('[data-v5611-kim-sales]').forEach(b=>b.onclick=()=>{window.dispatchEvent(new CustomEvent('sbc:kim-state',{detail:{state:'ANALYZING'}}));if(typeof window.openSbcAI==='function')window.openSbcAI();});
    const r=q('[data-v5610-refresh]');if(r)r.onclick=async()=>{r.disabled=true;r.textContent='Refreshing…';try{await loadData();toast('Commerce cockpit refreshed.');}finally{r.disabled=false;r.textContent='↻ Refresh';}};
    const c=q('#v5610OwnerClose');if(c)c.onclick=closeOwnerReview;
    const o=q('#v5610OwnerDialog');if(o)o.onclick=e=>{if(e.target===o)closeOwnerReview();};
  }
  function refreshDynamic(){const c=q('#content');if(!c||window.state?.view!=='dashboard')return;c.innerHTML=render();bind();}
  function view(){document.body.classList.add('v56-flow-mode','v56-nav-only');const html=render();setTimeout(loadData,0);return html;}
  window.sbcFlowView=view;
  window.SBCV5610={version:VERSION,refresh:loadData,ownerReview:openOwnerReview,engine:SBC_EngineUI};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeOwnerReview();});
  window.addEventListener('DOMContentLoaded',()=>{if(window.state?.view==='dashboard'){setTimeout(()=>{const c=q('#content');if(c&&c.querySelector('.v5610-shell'))bind();},50);}});
})();


/* V56.10 Cinematic V2 event bridge: existing engines may emit these events. */
window.addEventListener('sbc:ingestion-start',()=>window.SBC_EngineUI?.pulseIngestion(true));
window.addEventListener('sbc:ingestion-complete',()=>{window.SBC_EngineUI?.pulseIngestion(false);});
window.addEventListener('sbc:kim-state',e=>window.SBC_EngineUI?.triggerKimState(String(e.detail?.state||'IDLE').toUpperCase()));


/* V56.10.2 — ambient conversion-velocity reaction. It reacts only to explicit
   SBC events; it does not poll, spam, or invent conversion activity. */
(function(){
  const root=document.documentElement;
  let timer=null;
  function pulse(level='success'){
    root.classList.remove('sbc-kim-velocity-pulse','sbc-kim-velocity-alert');
    root.classList.add(level==='alert'?'sbc-kim-velocity-alert':'sbc-kim-velocity-pulse');
    clearTimeout(timer); timer=setTimeout(()=>root.classList.remove('sbc-kim-velocity-pulse','sbc-kim-velocity-alert'),1400);
  }
  window.addEventListener('sbc:conversion-velocity',e=>{
    const detail=e.detail||{};
    if(Number(detail.delta||0)>0)pulse(Number(detail.delta||0)>=3?'alert':'success');
  });
  window.SBC_CommerceReaction={pulse};
})();
