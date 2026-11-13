/* SBC V66 experience-rail · checked-in scripts retain startup order */
/* BEGIN v562-experience.js */
try {
(function(){
'use strict';
const V='56.2.0';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function nav(view){document.querySelector(`[data-view="${view}"]`)?.click();}
function enhance(){
 document.body.dataset.sbcExperience=V;
 const shell=document.querySelector('.v56-shell'); if(!shell||shell.dataset.v562) return;
 shell.dataset.v562='1';
 const strip=document.createElement('div'); strip.className='v562-command-strip';
 const d=window.state?.data||{}; const leads=(d.customers||[]).filter(x=>!['Customer','Lost','Do Not Call','Closed','Duplicate','Not Qualified'].includes(String(x.status||''))).length;
 const orders=(d.orders||[]).filter(x=>!['Delivered','Cancelled'].includes(String(x.status||''))).length;
 strip.innerHTML=`<span class="v562-pill">SBC <strong>V56.2</strong></span><span class="v562-pill">Pipeline <strong>${leads}</strong></span><span class="v562-pill">Delivery <strong>${orders}</strong></span><span class="v562-pill">Control <strong>Human-governed</strong></span>`;
 shell.prepend(strip);
 const auto=document.querySelector('#v56AutonomyRail');
 if(auto && !document.querySelector('.v562-office')){
   const box=document.createElement('section'); box.className='v562-office';
   box.innerHTML=`<div><div class="v56-kicker">OFFICE BOX · CUSTOMER OPERATING SYSTEM</div><h3>Turn completed sales into a customer workspace.</h3><p>The Command Center owns the relationship and fulfillment. Office Box gives the customer their own tenant-scoped business workspace.</p></div><div class="v562-office-actions"><button class="v56-btn primary" data-v562="office">Open Office Box</button><button class="v56-btn" data-v562="plan">Plan workspace</button></div>`;
   auto.parentNode.insertBefore(box,auto);
 }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-v562]');if(!b)return; if(b.dataset.v562==='office'){const u=window.__SBC_OFFICE_BOX_URL||'/office-box';window.open(u,'_blank','noopener');}else if(b.dataset.v562==='plan'){nav('settings');}});
window.addEventListener('DOMContentLoaded',()=>setTimeout(enhance,900));
const oldPush=history.pushState; history.pushState=function(){const r=oldPush.apply(this,arguments);setTimeout(enhance,150);return r};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v562-experience.js", sbcBundleError);
}
/* END v562-experience.js */
;
/* BEGIN v562-next.js */
try {
/* SBC V56.2 Next Experience Layer — additive, no page reloads required. */
(function(){
  'use strict';
  const views={home:()=>window.V56Templates?.homeContent?.(),sales:()=>window.V56Templates?.salesContentRails?.(),growth:()=>window.V56Templates?.growthEngineSuite?.(),delivery:()=>window.V56Templates?.deliveryFulfillmentCenter?.(),reports:()=>window.V56Templates?.reportsContent?.()};
  function shell(){return document.getElementById('sbc-viewport')||document.getElementById('content');}
  function loadView(key){const target=shell();const fn=views[String(key||'')];if(!target||!fn)return false;const html=fn();if(typeof html!=='string')return false;target.innerHTML=html;document.dispatchEvent(new CustomEvent('sbc:view-mounted',{detail:{view:key}}));return true;}
  async function optimisticRailTransition(cardId,destinationRailState){
    const card=document.querySelector(`[data-lead-id="${CSS.escape(String(cardId))}"]`);
    const target=document.querySelector(`[data-rail-state="${CSS.escape(String(destinationRailState))}"]`);
    if(!card||!target)return {ok:false,error:'Lead card or destination rail not found.'};
    const parent=card.parentNode,next=card.nextSibling;target.appendChild(card);
    try{
      const response=await fetch('/api/crm/leads/transition-pipeline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:String(cardId),target_state:String(destinationRailState)})});
      if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Pipeline state commit rejected.');
      return {ok:true,...await response.json()};
    }catch(error){if(next&&next.parentNode===parent)parent.insertBefore(card,next);else parent.appendChild(card);return {ok:false,error:error.message};}
  }
  window.SBCV562Shell={version:'56.2.0',views:Object.keys(views),loadView,optimisticRailTransition};
  window.addEventListener('DOMContentLoaded',()=>{document.body.dataset.sbcShellVersion='56.2.0';});
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v562-next.js", sbcBundleError);
}
/* END v562-next.js */
;
/* BEGIN v562-executive.js */
try {
/* SBC V56.2 Executive Operating Experience — additive presentation layer. */
(function(){'use strict';window.SBCV562Executive={version:'56.2.0',purpose:'executive-operating-experience',sections:['money','next-action','capacity','delivery','kim']};})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v562-executive.js", sbcBundleError);
}
/* END v562-executive.js */
;
/* BEGIN v563-maturity.js */
try {
/* SBC V56.3 — Maturity Experience Layer
   Adds Customer 360, learned Growth planning, and operational score without replacing V56 FLOW. */
(() => {
  'use strict';
  const VERSION='56.3.0';
  const qs=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>'$'+Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

  async function api(path,options={}){
    const res=await fetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    let body={}; try{body=await res.json();}catch{}
    if(!res.ok) throw new Error(body.error||`Request failed (${res.status})`);
    return body;
  }

  function toast(msg){
    const n=qs('#toast');
    if(n){n.textContent=msg;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),2600);}
    else console.log('[V56.3]',msg);
  }

  function ensureDrawer(){
    if(qs('#v563Customer360Drawer')) return;
    const wrap=document.createElement('div');
    wrap.innerHTML=`<div id="v563Customer360Drawer" class="v563-drawer" aria-hidden="true">
      <div class="v563-drawer-backdrop" data-v563-close></div>
      <aside class="v563-drawer-panel" role="dialog" aria-modal="true" aria-label="Customer 360">
        <div class="v563-drawer-head"><div><span class="v563-kicker">CUSTOMER 360</span><h2 id="v563Customer360Title">Account</h2></div><button type="button" class="v563-close" data-v563-close>×</button></div>
        <div id="v563Customer360Body" class="v563-drawer-body"><div class="v563-loading">Loading customer intelligence…</div></div>
      </aside>
    </div>`;
    document.body.appendChild(wrap.firstElementChild);
    document.addEventListener('click',e=>{if(e.target.closest('[data-v563-close]'))close360();});
  }

  function close360(){const d=qs('#v563Customer360Drawer');if(d){d.classList.remove('open');d.setAttribute('aria-hidden','true');}}
  function render360(d){
    const timeline=(d.timeline||[]).slice(0,12).map(x=>`<li><span>${esc(x.channel)}</span><div><strong>${esc(x.summary)}</strong><small>${x.epoch?new Date(x.epoch).toLocaleString():''}</small></div></li>`).join('')||'<li class="empty">No recorded touchpoints yet.</li>';
    return `<div class="v563-profile-hero"><div><span class="v563-score">${Number(d.score||0)}</span></div><div><h3>${esc(d.companyName)}</h3><p>${esc(d.industry||'Business account')} · ${esc(d.status)}</p></div></div>
      <div class="v563-nba"><span>NEXT BEST ACTION</span><strong>${esc(d.nextBestAction)}</strong></div>
      <div class="v563-grid">
        <div><small>LIFETIME VALUE</small><strong>${money(d.financials?.lifetimeValue)}</strong></div>
        <div><small>OPEN PIPELINE</small><strong>${money(d.financials?.openPipeline)}</strong></div>
        <div><small>ORDERS</small><strong>${Number(d.financials?.completedOrders||0)}</strong></div>
        <div><small>TOUCHPOINTS</small><strong>${Number(d.counts?.touchpoints||0)}</strong></div>
      </div>
      <div class="v563-contact"><b>${esc(d.contactName||'Primary contact not set')}</b><span>${esc(d.phone||'')} ${d.email?'· '+esc(d.email):''}</span></div>
      <h4>RELATIONSHIP TIMELINE</h4><ul class="v563-timeline">${timeline}</ul>`;
  }

  async function open360(id){
    ensureDrawer();
    const drawer=qs('#v563Customer360Drawer'), body=qs('#v563Customer360Body'), title=qs('#v563Customer360Title');
    drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');body.innerHTML='<div class="v563-loading">Compiling Customer 360…</div>';
    try{const r=await api('/api/v56/intel/customer-360/'+encodeURIComponent(id));title.textContent=r.data?.companyName||'Customer';body.innerHTML=render360(r.data||{});}
    catch(e){body.innerHTML=`<div class="v563-error">${esc(e.message)}</div>`;}
  }


  function showCampaignPreview(campaign){
    const old=qs('#v563CampaignPreview');if(old)old.remove();
    const m=document.createElement('div');m.id='v563CampaignPreview';m.className='v563-modal';
    const assets=campaign.assets||{};
    m.innerHTML=`<div class="v563-modal-backdrop" data-v563-campaign-close></div><div class="v563-modal-card">
      <div class="v563-modal-head"><div><span class="v563-kicker">GROWTH ENGINE · CAMPAIGN KIT</span><h2>Review before deployment</h2></div><button class="v563-close" data-v563-campaign-close>×</button></div>
      <div class="v563-campaign-body">
        <div class="v563-campaign-hero"><span>CAMPAIGN ID</span><strong>${esc(campaign.campaignId)}</strong><p>${esc(campaign.objective)}</p></div>
        <div class="v563-plan-kpis"><div><small>SALES GOAL</small><b>${Number(campaign.funnel?.salesGoal||0)}</b></div><div><small>LANDING</small><b>${esc(assets.landing?.status||'DRAFT')}</b></div><div><small>EMAIL</small><b>${esc(assets.email?.status||'DRAFT')}</b></div><div><small>SMS</small><b>${esc(assets.sms?.status||'DRAFT')}</b></div></div>
        <div class="v563-campaign-offer"><small>OFFER</small><strong>${esc(campaign.offer)}</strong><span>Deployment is owner-approved and provider-gated.</span></div>
        <div class="v563-campaign-actions"><button id="v563DeployCampaign" class="v56-btn primary">✓ Approve & Queue</button><button class="v56-btn" data-v563-campaign-close>Keep Draft</button></div>
        <div id="v563DeployStatus"></div>
      </div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target.closest('[data-v563-campaign-close]'))m.remove();});
    qs('#v563DeployCampaign').onclick=async()=>{
      const b=qs('#v563DeployCampaign'),out=qs('#v563DeployStatus');b.disabled=true;b.textContent='Queueing…';
      try{
        const r=await api('/api/v56/growth/deploy',{method:'POST',body:JSON.stringify({campaign})});
        out.innerHTML=`<p class="v563-success">✓ Campaign ${esc(r.data?.campaignId||campaign.campaignId)} queued for controlled deployment.</p>`;
        b.textContent='Queued';toast('Campaign queued. External sending remains provider/policy gated.');
      }catch(e){out.innerHTML=`<div class="v563-error">${esc(e.message)}</div>`;b.disabled=false;b.textContent='✓ Approve & Queue';}
    };
  }

  function addSmartGrowthControls(){
    if(String(window.state?.view||'')!=='marketing') return;
    const hero=document.querySelector('.v56-hero-actions');
    if(hero && !qs('#v563SmartCampaign')){
      const b=document.createElement('button');
      b.id='v563SmartCampaign';b.className='v56-btn';b.type='button';b.textContent='🧠 Smart Campaign';
      b.onclick=showStrategy;
      hero.appendChild(b);
    }
  }

  async function showStrategy(){
    let goal=10,niche='local businesses',location='Miami, FL';
    const existing=qs('#v563StrategyModal');if(existing)existing.remove();
    const modal=document.createElement('div');modal.id='v563StrategyModal';modal.className='v563-modal';
    modal.innerHTML=`<div class="v563-modal-backdrop" data-v563-strategy-close></div><div class="v563-modal-card">
      <div class="v563-modal-head"><div><span class="v563-kicker">KIM-READY GROWTH PLANNING</span><h2>Build the next revenue play</h2></div><button class="v563-close" data-v563-strategy-close>×</button></div>
      <div class="v563-form"><label>Sales goal<input id="v563Goal" type="number" min="1" max="10000" value="10"></label><label>Industry / niche<input id="v563Niche" value="local businesses"></label><label>Territory<input id="v563Location" value="Miami, FL"></label></div>
      <button id="v563PlanBtn" class="v56-btn primary">Calculate from SBC data</button><div id="v563PlanResult"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target.closest('[data-v563-strategy-close]'))modal.remove();});
    qs('#v563PlanBtn').onclick=async()=>{
      const btn=qs('#v563PlanBtn'),out=qs('#v563PlanResult');btn.disabled=true;btn.textContent='Calculating…';
      try{
        const r=await api('/api/v56/intel/strategy',{method:'POST',body:JSON.stringify({salesGoal:Number(qs('#v563Goal').value),niche:qs('#v563Niche').value,targetRevenue:0})});
        const d=r.data||{},p=d.projection||{},t=d.telemetry||{};
        out.innerHTML=`<div class="v563-plan"><div class="v563-plan-kpis"><div><small>LEADS</small><b>${p.leadsNeeded||0}</b></div><div><small>CONVERSATIONS</small><b>${p.conversationsNeeded||0}</b></div><div><small>VERIFIED</small><b>${p.verifiedNeeded||0}</b></div><div><small>WINS</small><b>${p.winsNeeded||0}</b></div></div><p class="v563-confidence">Data confidence: <b>${esc(t.confidence||'baseline')}</b></p><h4>RECOMMENDED MOVES</h4><ol>${(d.nextBestActions||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol><button id="v563BuildKit" class="v56-btn primary">Build Campaign Kit</button></div>`;
        qs('#v563BuildKit').onclick=async()=>{try{const kit=await api('/api/v56/growth/toolkit',{method:'POST',body:JSON.stringify({salesGoal:Number(qs('#v563Goal').value),niche:qs('#v563Niche').value,location:qs('#v563Location').value,offer:'SBC Business Launch'})});window.SBCV563GrowthKit=kit.data;toast('Campaign kit built. Review before deployment.');out.insertAdjacentHTML('beforeend','<p class="v563-success">✓ Campaign kit ready for owner review.</p>');}catch(e){toast(e.message);}};
      }catch(e){out.innerHTML=`<div class="v563-error">${esc(e.message)}</div>`;}
      finally{btn.disabled=false;btn.textContent='Recalculate';}
    };
  }

  function bindCustomerRows(){
    document.querySelectorAll('[data-flow-customer]').forEach(el=>{
      if(el.dataset.v563Bound) return;
      el.dataset.v563Bound='1';
      el.addEventListener('click',e=>{
        e.preventDefault();e.stopImmediatePropagation();
        open360(el.dataset.flowCustomer);
      });
    });
  }

  function injectOpsBadge(){
    if(qs('#v563OpsBadge')) return;
    const target=document.querySelector('.top-actions');
    if(!target) return;
    const b=document.createElement('button');b.id='v563OpsBadge';b.className='v563-ops-badge';b.type='button';b.title='Open SBC operating health';b.textContent='SBC HEALTH';
    b.onclick=async()=>{try{const r=await api('/api/v56/ops/score');const d=r.data||{};toast(`SBC operational score ${d.score}/100 · ${d.grade}`);}catch(e){toast(e.message);}};
    target.prepend(b);
  }

  function tick(){bindCustomerRows();addSmartGrowthControls();injectOpsBadge();}
  window.SBCV563={version:VERSION,openCustomer360:open360,showStrategy,showCampaignPreview};
  document.addEventListener('DOMContentLoaded',()=>{ensureDrawer();tick();setTimeout(tick,800);setTimeout(tick,1800);});
  const observer=new MutationObserver(()=>{tick();});
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v563-maturity.js", sbcBundleError);
}
/* END v563-maturity.js */
;
/* BEGIN v564-guardian.js */
try {
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
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v564-guardian.js", sbcBundleError);
}
/* END v564-guardian.js */
;
/* BEGIN v565-operational.js */
try {
(()=>{
  'use strict';
  const V='56.5.0';
  async function get(path){const r=await fetch(path,{credentials:'include'});return r.json();}
  function badge(){
    const host=document.querySelector('[data-v565-operational-badge]');
    if(!host)return;
    host.textContent='V'+V+' HARDENED';
    host.title='Public facade, tenant boundary, 90-day telemetry, guarded recovery and provider policy layer';
  }
  async function show(){
    try{
      const [f,g]=await Promise.all([get('/api/v56/facade/v565-manifest'),get('/api/v56/guardian/summary')]);
      const body=`<div style="padding:18px"><h2>SBC V56.5 Operational Hardening</h2><p>Public facade: <b>${f.publicPrefix||'/api/v56'}</b></p><p>Guardian files scanned: <b>${g.summary?.filesScanned??'—'}</b></p><p>Routes inventoried: <b>${g.summary?.routeCount??'—'}</b></p><p>Policy: <b>Owner-governed / no automatic deletion</b></p></div>`;
      if(window.openModal)window.openModal('V56.5 HARDENING',body);else alert('V56.5 Hardened: '+(g.summary?.routeCount??0)+' routes inventoried.');
    }catch(e){console.warn('[V565]',e.message);}
  }
  window.SBCV565={version:V,show};
  document.addEventListener('DOMContentLoaded',badge);
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v565-operational.js", sbcBundleError);
}
/* END v565-operational.js */
;
/* BEGIN v566-customer360.js */
try {
/* SBC V56.6.0 — Customer 360 drawer controller. Browser-only. */
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const Sbc360Drawer={
    async renderCustomerSnapshot(customerId){
      const drawer=document.getElementById('detail-drawer');
      const target=document.getElementById('drawer-render-target');
      if(!drawer||!target) return false;
      target.innerHTML='<div class="v56-360-drawer-container"><p>Loading customer intelligence…</p></div>';
      drawer.classList.add('open');
      try{
        const r=await fetch('/api/v566/crm/customer-360/'+encodeURIComponent(customerId),{credentials:'include',headers:{Accept:'application/json'}});
        if(!r.ok) throw new Error('Customer 360 request failed ('+r.status+').');
        const body=await r.json(); const p=body.data||{}; const c=p.customer||{};
        const timeline=Array.isArray(p.timeline)?p.timeline:[];
        target.innerHTML=`<div class="v56-360-drawer-container animate-fade-in">
          <h3>${esc(c.businessName||c.business_name||c.company_name||'Customer')}</h3>
          <span class="badge state-tag">${esc(c.status||'Unknown')}</span>
          <hr class="divider"/>
          <div class="metrics-block"><p><strong>Lifetime Value:</strong> $${money(p.lifetimeValue)}</p><p><strong>Source:</strong> ${esc(p.sourceOrigin||c.source||'—')}</p></div>
          <hr class="divider"/><h4>CUSTOMER TIMELINE</h4>
          <ul class="timeline-log-list">${timeline.slice(0,100).map(a=>`<li>[${esc(a.at?new Date(a.at).toLocaleDateString():'—')}] ${esc(a.type||'activity')} — ${esc(a.message||a.status||a.title||a.id||'')}</li>`).join('')||'<li>No recorded activity.</li>'}</ul>
        </div>`;
        return true;
      }catch(e){ target.innerHTML=`<div class="v56-360-drawer-container"><p>Customer intelligence unavailable.</p><small>${esc(e.message)}</small></div>`; return false; }
    }
  };
  window.Sbc360Drawer=Sbc360Drawer;
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v566-customer360.js", sbcBundleError);
}
/* END v566-customer360.js */
