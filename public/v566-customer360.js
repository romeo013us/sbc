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
