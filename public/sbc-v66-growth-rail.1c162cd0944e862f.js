/* SBC V66 growth-rail · checked-in scripts retain startup order */
/* BEGIN v56221-revenue-command.js */
try {
/* SBC V56.22.1 — Kim Revenue & Marketing Command cockpit surface */
(function(){'use strict';
 const ID='sbcV56221Command'; const api=(...a)=>window.api?window.api(...a):Promise.reject(new Error('SBC API unavailable'));
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
 const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 async function load(){try{const r=await api('/api/v56221/revenue-marketing/status',{timeoutMs:12000});render(r);}catch(e){render({ok:false,error:e.message});}}
 function render(r){const root=document.getElementById(ID);if(!root)return; if(!r?.ok){root.innerHTML='<div class="sbc-v56221-note">Kim Revenue Command is waiting for durable marketing telemetry.</div>';return;}const m=r.metrics||{},e=r.economics||{},a=r.actions||[];root.innerHTML=`<div class="sbc-v56221-head"><div><div class="sbc-v56221-kicker">KIM · REVENUE & MARKETING COMMAND · ${esc(r.version||'56.22.1')}</div><h3>Acquire customers. Measure money. Act on the bottleneck.</h3><p>Kim reads acquisition, conversion, activation and economic telemetry before recommending the next move.</p></div><div class="sbc-v56221-actions"><button class="sbc-v56221-command-btn" data-v56221-refresh>↻ Refresh</button><button class="sbc-v56221-command-btn" data-v56221-kim>✦ Ask Kim</button></div></div><div class="sbc-v56221-grid"><div class="sbc-v56221-kpi"><span>Ingested</span><strong>${m.events?.INGESTED?.count||0}</strong></div><div class="sbc-v56221-kpi"><span>Demos</span><strong>${m.events?.DEMO_VIEWED?.count||0}</strong></div><div class="sbc-v56221-kpi"><span>Checkouts</span><strong>${m.events?.CHECKOUT_STARTED?.count||0}</strong></div><div class="sbc-v56221-kpi"><span>Paid</span><strong>${m.events?.PAYMENT_CLEARED?.count||0}</strong></div><div class="sbc-v56221-kpi"><span>Gross MRR</span><strong>${money(e.grossMrr)}</strong></div><div class="sbc-v56221-kpi"><span>Net Cash Flow</span><strong>${money(e.netCashFlow)}</strong></div><div class="sbc-v56221-kpi"><span>Published SEO</span><strong>${m.seoAssets?.PUBLISHED||0}</strong></div></div><div class="sbc-v56221-bottom"><div class="sbc-v56221-panel"><h4>Kim's next-best actions</h4>${a.slice(0,4).map(x=>`<div class="sbc-v56221-action"><span>${esc(x.action)}</span><span class="sbc-v56221-priority">${esc(x.priority)}</span></div>`).join('')||'<div class="sbc-v56221-note">No new actions. Run a controlled acquisition batch and collect real funnel evidence.</div>'}</div><div class="sbc-v56221-panel"><h4>Discovery network</h4><div class="sbc-v56221-note">SFTP watcher: <strong>${r.acquisition?.watcher?.watcher?'RUNNING':'READY'}</strong><br>Published SEO assets: <strong>${m.seoAssets?.PUBLISHED||0}</strong><br>Draft assets: <strong>${m.seoAssets?.DRAFT||0}</strong><br><br>Inbound surface: <strong>/growth/*</strong> · Free checkup: <strong>/api/public/v56221/business-checkup</strong></div></div><div class="sbc-v56221-panel"><h4>Acquisition economics</h4><div class="sbc-v56221-note">Acquisition spend: <strong>${money(e.acquisitionSpend)}</strong><br>Operating costs: <strong>${money(e.operatingCosts)}</strong><br>CAC: <strong>${e.paidCustomers?money(e.acquisitionSpend/e.paidCustomers):'Pending first paid customer'}</strong><br>Paid customers: <strong>${e.paidCustomers||0}</strong><br><br>Advertising remains approval-gated and provider-neutral until an approved provider connection exists.</div></div></div>`;}
 function mount(){if(document.getElementById(ID))return;const content=document.getElementById('content');if(!content)return;const marker=[...content.querySelectorAll('h2,h3')].find(x=>/SBC GROWTH ENGINE/i.test(x.textContent||''));if(!marker)return;const host=marker.closest('section')?.parentElement||content;const el=document.createElement('section');el.id=ID;el.className='sbc-v56221-command';host.appendChild(el);load();}
 document.addEventListener('click',e=>{if(e.target.closest('[data-v56221-refresh]'))load();if(e.target.closest('[data-v56221-kim]')){const p='Act as SBC Revenue & Marketing Commander. Review acquisition, conversion, activation, CAC, MRR and cash flow. Give me the single highest-value next move and why.';if(window.sbcFlowOpenKim)window.sbcFlowOpenKim(p);else if(window.openSbcAI)window.openSbcAI();}});
 const mo=new MutationObserver(()=>{if(document.body?.classList.contains('v56-flow-mode'))mount();});mo.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('DOMContentLoaded',mount);
 window.SBCV56221RevenueCommand={version:'56.22.1',refresh:load,mount};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v56221-revenue-command.js", sbcBundleError);
}
/* END v56221-revenue-command.js */
;
/* BEGIN v56230-destination-autopilot.js */
try {
/* SBC V56.23.0 — Kim Destination Autopilot cockpit */
(function(){'use strict';
 const ID='sbcV56230Destination';
 const api=(...a)=>window.api?window.api(...a):fetch(a[0],{method:a[1]?.method||'GET',headers:{'Content-Type':'application/json'},body:a[1]?.body?JSON.stringify(a[1].body):undefined}).then(r=>r.json());
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
 const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 async function load(){try{const r=await api('/api/v56230/destination/status');render(r);}catch(e){render({ok:false,error:e.message});}}
 function render(r){const root=document.getElementById(ID);if(!root)return;if(!r?.ok){root.innerHTML='<div class="note">Destination Autopilot is waiting for durable mission storage.</div>';return;}const m=r.activeMission,s=m?.snapshot||{};const pct=m?Math.min(100,Math.round(((m.destination_type==='revenue'?s.revenue:s.paidCustomers)/Math.max(1,Number(m.target_value)))*100)):0;root.innerHTML=`<div class="top"><div><div class="kicker">KIM · DESTINATION AUTOPILOT · ${esc(r.version||'56.23.0')}</div><h3>${m?esc(m.name):'No destination set'}</h3><p>${m?'Kim is driving the existing acquisition → mission → conversion rails toward a measurable destination.':'Set one measurable destination. Kim will use the existing revenue system to drive toward it.'}</p></div><div class="actions">${m?`<button data-dest-refresh>↻ Refresh</button><button data-dest-cycle class="primary">▶ Drive Now</button>`:`<button data-dest-create class="primary">＋ Set Destination</button>`}</div></div>${m?`<div class="mission"><div class="row"><span class="badge">${esc(m.status)}</span><strong>${m.destination_type==='revenue'?money(s.revenue)+' / '+money(m.target_value):s.paidCustomers+' / '+Number(m.target_value)+' paid customers'}</strong></div><div class="progress"><i style="width:${pct}%"></i></div><div class="grid"><div class="kpi"><span>Progress</span><strong>${pct}%</strong></div><div class="kpi"><span>Eligible</span><strong>${s.eligible||0}</strong></div><div class="kpi"><span>Assigned</span><strong>${s.assigned||0}</strong></div><div class="kpi"><span>Paid</span><strong>${s.paidCustomers||0}</strong></div><div class="kpi"><span>Revenue</span><strong>${money(s.revenue)}</strong></div></div><div class="note"><strong>Strategy:</strong> ${esc(m.current_strategy||'—')}<br><strong>Bottleneck:</strong> ${esc(m.bottleneck||'—')}<br><strong>Next move:</strong> ${esc(m.next_action||'—')}</div></div>`:'<div class="mission"><strong>Cyber Truck rule:</strong> destination first; Kim chooses the next permitted move from the existing rails, subject to owner, consent, spend, payment, and fulfillment controls.</div>'}`;}
 document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-dest-refresh'))return load();if(b.hasAttribute('data-dest-cycle')){b.disabled=true;try{await api('/api/v56230/destination/cycle',{method:'POST',body:{tenantId:1}});}finally{b.disabled=false;await load();}}if(b.hasAttribute('data-dest-create')){const target=prompt('Destination target — enter number of paid customers (example: 10):','10');if(!target)return;const market=prompt('Target market:','Miami service businesses')||'Miami service businesses';const r=await api('/api/v56230/destination/missions',{method:'POST',body:{name:`Acquire ${target} new SBC customers`,destinationType:'paid_customers',targetValue:Number(target),market,maxAcquisitionSpend:0,maxBatch:10}});if(r?.mission){await api('/api/v56230/destination/missions/'+encodeURIComponent(r.mission.id)+'/arm',{method:'POST',body:{}});await api('/api/v56230/destination/missions/'+encodeURIComponent(r.mission.id)+'/drive',{method:'POST',body:{}});}await load();}});
 function mount(){if(document.getElementById(ID))return;const content=document.getElementById('content');if(!content)return;const marker=[...content.querySelectorAll('h2,h3')].find(x=>/SBC GROWTH ENGINE|REVENUE.*MARKETING/i.test(x.textContent||''));if(!marker)return;const host=marker.closest('section')?.parentElement||content;const el=document.createElement('section');el.id=ID;el.className='sbc-v56230-destination';host.appendChild(el);load();}
 const mo=new MutationObserver(()=>{if(document.body?.classList.contains('v56-flow-mode'))mount();});mo.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('DOMContentLoaded',mount);window.SBCV56230Destination={mount,refresh:load};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v56230-destination-autopilot.js", sbcBundleError);
}
/* END v56230-destination-autopilot.js */
;
/* BEGIN v56240-growth-hardening.js */
try {
(function () {
  'use strict';
  // SBC_V6529_OPEN_READINESS: communicate Preview read-only status and disable actions.
  const ID = 'sbcV56240GrowthHardening';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(url, options = {}) {
    if (typeof window.api === 'function') return window.api(url, {...options, timeoutMs: options.timeoutMs || 20000});
    const response = await fetch(url, {credentials:'include', headers:{'Content-Type':'application/json','Accept':'application/json'}, ...options});
    const raw = await response.text(); let data = null; try { data = JSON.parse(raw); } catch {}
    if (!response.ok) throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    if (!data) throw new Error(/<html|<!doctype/i.test(raw) ? 'The server returned a sign-in page. Sign in again and refresh.' : 'Growth endpoint returned invalid JSON.');
    return data;
  }
  async function load() {
    const root = document.getElementById(ID); if (!root) return;
    try {
      const data = await api('/api/v56240/growth/status');
      const locked = Boolean(data.recoveryRequired);
      const readOnlyPreview = Boolean(data.readOnly) && !locked;
      root.innerHTML = `<div class="head"><div><h3>Kim · Autonomous Growth Hardening</h3><div class="sub">20 operational upgrades around the Destination Autopilot · SBC OS V65.1.31.</div></div><button type="button" class="primary" id="v56240Run" ${locked || readOnlyPreview ? 'disabled title="Read-only runtime"' : ''}>${locked ? 'Recovery Lock Active' : readOnlyPreview ? 'Preview Is Read-Only' : 'Run Growth Cycle'}</button></div>${locked ? '<div class="install-tip"><strong>RECOVERY LOCK ACTIVE.</strong> Growth staging, schema creation, queue writes, and background cycles are suspended. No growth data will be written until authoritative MySQL recovery is verified.</div>' : readOnlyPreview ? '<div class="install-tip"><strong>READ-ONLY PREVIEW.</strong> Existing growth data may be viewed, but this runtime cannot create tables, save settings, or run growth cycles. Use the Published writer runtime for approved changes.</div>' : ''}<div class="grid"><div class="kpi"><span>GBP gaps</span><strong>${data.gapSweep?.count == null ? 'Unavailable' : Number(data.gapSweep.count)}</strong></div><div class="kpi"><span>Usage alerts</span><strong>${data.usageAlerts?.alerts == null ? 'Unavailable' : data.usageAlerts.alerts.length}</strong></div><div class="kpi"><span>Recovery tasks</span><strong>${data.dunning?.recoveryTasks == null ? 'Unavailable' : Number(data.dunning.recoveryTasks)}</strong></div><div class="kpi"><span>Tracked costs</span><strong>${data.profit?.trackedCosts == null ? 'Not queried during recovery' : '$' + Number(data.profit.trackedCosts).toFixed(2)}</strong></div></div><div id="v56240RunMessage" class="sub" role="status"></div>`;
      const button = document.getElementById('v56240Run');
      button?.addEventListener('click', async event => {
        const b = event.currentTarget, status = document.getElementById('v56240RunMessage');
        if (data.recoveryRequired || data.readOnly) { if (status) status.textContent = data.recoveryRequired ? 'Recovery lock active. No growth cycle was started.' : 'Preview is read-only. No growth cycle was started.'; return; }
        b.disabled = true; b.textContent = 'Running…';
        try { const result = await api('/api/v56240/growth/run', {method:'POST', body:JSON.stringify({})}); if (status) status.textContent = result?.message || 'Growth cycle completed. Review its returned status.'; await load(); }
        catch (error) { if (status) status.textContent = error?.message || String(error); b.disabled = false; b.textContent = 'Run Growth Cycle'; }
      });
    } catch (error) {
      root.innerHTML = `<div class="head"><div><h3>Kim · Autonomous Growth Hardening</h3><div class="sub">Growth status is temporarily unavailable.</div></div><button type="button" id="v56240Retry">Retry</button></div><div class="install-tip" role="status">${esc(error?.message || error)}</div>`;
      document.getElementById('v56240Retry')?.addEventListener('click', load);
    }
  }
  function mount() { if (document.getElementById(ID)) return; const content = document.getElementById('content'); if (!content) return; const el = document.createElement('section'); el.id = ID; el.className = 'sbc-v56240-hardening'; content.appendChild(el); load(); }
  window.sbcV56240GrowthRefresh = load;
  window.addEventListener('DOMContentLoaded', mount);
  const observer = new MutationObserver(mount); observer.observe(document.documentElement, {childList:true, subtree:true});
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v56240-growth-hardening.js", sbcBundleError);
}
/* END v56240-growth-hardening.js */
;
/* BEGIN v56-autonomous.js */
try {
/* SBC V56.1 — human-governed autonomous operations UI */
(function(){
  'use strict';
  const api=(...a)=>window.api?window.api(...a):Promise.reject(new Error('SBC API bridge unavailable'));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
  async function scan(){
    const rail=document.getElementById('v56AutonomyRail'); if(!rail)return;
    rail.classList.add('v56-auto-loading');
    try{
      const r=await api('/api/v56/autonomy/summary',{timeoutMs:15000});
      const c=r.capacity||{},m=r.money||{};
      const set=(id,v)=>{const x=document.getElementById(id);if(x)x.textContent=v;};
      set('v56AutoCapacity',c.overloaded?'OVER CAPACITY':c.underloaded?'UNDER LOADED':'ON TRACK');
      set('v56AutoCapacityText',`${c.ready||0} ready · ${c.dailyCapacity||0}/day capacity · ~${c.estimatedDays||0} days backlog`);
      set('v56AutoMoney',money((m.opportunities||[]).reduce((n,x)=>n+Number(x.estimatedValue||0),0)));
      set('v56AutoMoneyText',`${m.staleHot||0} stale hot · ${m.unworkedHot||0} unworked warm/hot · ${m.openQuotes||0} open quotes`);
      set('v56AutoPaid',String(m.paidWaiting||0));
      set('v56AutoPaidText',m.paidWaiting?'Paid orders need fulfillment movement.':'No paid fulfillment blockers detected.');
      set('v56AutoHealth',r.health==='ACTION_REQUIRED'?'ACTION REQUIRED':'ON TRACK');
      set('v56AutoHealthText',r.friction?.length?`${r.friction.length} operating signal${r.friction.length===1?'':'s'} found.`:'No material friction detected.');
      const alerts=document.getElementById('v56AutoAlerts');
      if(alerts)alerts.innerHTML=(r.friction||[]).slice(0,5).map(x=>`<div class="v56-auto-alert ${String(x.priority).toLowerCase()}"><strong>${esc(x.priority||'INFO')}</strong><span>${esc(x.message||x.action||'Operational signal')}</span><button type="button" data-auto-kim="${esc(x.action||x.message||'Review this operational signal.')}">Ask Kim</button></div>`).join('')||'<div class="v56-auto-clear">✓ No material revenue friction detected.</div>';
      if(typeof window.toast==='function')window.toast('Money Radar refreshed.');
    }catch(e){const a=document.getElementById('v56AutoAlerts');if(a)a.innerHTML=`<div class="v56-auto-alert high"><strong>CHECK FAILED</strong><span>${esc(e.message)}</span></div>`;}
    finally{rail.classList.remove('v56-auto-loading');}
  }
  document.addEventListener('click',e=>{
    const scanBtn=e.target.closest('[data-v56-auto="scan"]'); if(scanBtn){e.preventDefault();scan();return;}
    const kim=e.target.closest('[data-auto-kim]'); if(kim){e.preventDefault();const p=kim.dataset.autoKim;if(typeof window.openSbcAI==='function')window.openSbcAI(p);else if(typeof window.askSbcAI==='function')window.askSbcAI(p);}
  });
  window.sbcV56AutonomyScan=scan;
  setTimeout(scan,700);
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v56-autonomous.js", sbcBundleError);
}
/* END v56-autonomous.js */
