'use strict';
(function(){
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  async function load(){
    const root=document.getElementById('sbcGrowthOpsBody'); if(!root)return;
    try{
      const [live,ledger]=await Promise.all([
        fetch('/api/v56140/growth/live?days=30',{credentials:'include'}).then(r=>r.json()),
        fetch('/api/v56140/growth/ledger',{credentials:'include'}).then(r=>r.json())
      ]);
      if(!live.ok)throw new Error(live.error||'Growth telemetry unavailable');
      const m=live;
      const rate=n=>Number(n||0).toFixed(1)+'%';
      const cards=[['LEADS',m.leads],['QUALIFIED',m.qualified],['CUSTOMERS',m.customers],['PAID ORDERS',m.orders],['REVENUE','$'+Number(m.revenue||0).toLocaleString()],['OUTBOUND CALLS',m.calls],['CALL CONNECT',rate(m.callConnectRate)],['CONVERSION',rate(m.conversionRate)]];
      const rows=(m.sourceBreakdown||[]).slice(0,8).map(x=>`<tr><td>${esc(x.source)}</td><td>${x.leads}</td><td>${x.qualified}</td><td>${x.customers}</td><td>$${Number(x.revenue||0).toLocaleString()}</td></tr>`).join('');
      const days=(ledger.rows||[]).slice(0,14).map(x=>`<tr><td>${esc(x.ledger_date)}</td><td>${x.leads}</td><td>${x.qualified}</td><td>${x.customers}</td><td>${x.orders}</td><td>$${Number(x.revenue||0).toLocaleString()}</td><td>${rate(x.conversion_rate)}</td></tr>`).join('');
      root.innerHTML=`<div class="card" style="margin-bottom:16px"><div class="card-head"><div><h3>📈 Live Conversion Command</h3><div class="mini">Rolling 30-day CRM + Twilio + revenue telemetry. Acquisition execution remains consent/policy gated.</div></div><span class="badge green">LIVE</span></div><div class="card-body"><div class="grid four">${cards.map(([k,v])=>`<div class="stat"><div class="label">${k}</div><div class="value">${esc(v)}</div><div class="sub">last 30 days</div></div>`).join('')}</div></div></div><div class="grid two"><div class="card"><div class="card-head"><div><h3>Channel / Source Performance</h3><div class="mini">Revenue attribution currently available to SBC.</div></div></div><div class="card-body"><div style="overflow:auto"><table class="sbc-table"><thead><tr><th>Source</th><th>Leads</th><th>Qualified</th><th>Customers</th><th>Revenue</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No attributed source activity yet.</td></tr>'}</tbody></table></div></div></div><div class="card"><div class="card-head"><div><h3>Nightly Revenue Ledger</h3><div class="mini">Durable daily snapshots for owner review.</div></div><button class="btn" onclick="window.sbcGrowthLedgerRun?.()">Run Yesterday</button></div><div class="card-body"><div style="overflow:auto"><table class="sbc-table"><thead><tr><th>Date</th><th>Leads</th><th>Qualified</th><th>Customers</th><th>Orders</th><th>Revenue</th><th>Conv.</th></tr></thead><tbody>${days||'<tr><td colspan="7">No nightly snapshots yet.</td></tr>'}</tbody></table></div></div></div></div>`;
    }catch(e){root.innerHTML=`<div class="install-tip">Growth telemetry unavailable: ${esc(e.message||e)}</div>`;}
  }
  window.sbcGrowthOpsRefresh=load;
  window.sbcGrowthLedgerRun=async function(){try{const r=await fetch('/api/v56140/growth/ledger/run',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:'{}'}).then(x=>x.json());if(!r.ok)throw new Error(r.error||'Ledger failed');window.sbcGrowthOpsRefresh();if(window.toast)toast(`Nightly ledger recorded for ${r.ledgerDate}.`);}catch(e){if(window.toast)toast(e.message||'Ledger run failed.');}};
})();
