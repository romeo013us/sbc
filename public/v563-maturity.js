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
