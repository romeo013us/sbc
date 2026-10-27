'use strict';
(function(){
  const esc=(s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  async function get(path,opts){const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts&&opts.headers||{})},...(opts||{})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j;}
  function card(title,body,cls=''){return `<section class="v47-card ${cls}"><div class="v47-card-head"><div><div class="v47-kicker">SBC V47</div><h3>${title}</h3></div></div><div class="v47-card-body">${body}</div></section>`}
  function badge(ok,label){return `<span class="v47-badge ${ok?'ok':'bad'}">${ok?'●':'●'} ${label}</span>`}
  window.sbcV47FinalView=function(){
    return `<div class="v47-wrap">
      <section class="v47-hero"><div><div class="v47-kicker">FINAL BIG DOGG CONTROL</div><h2>V47 · SBC Operating Backbone</h2><p>One owner-only control surface for readiness, war testing, live event streaming, deployment inventory and the final production handoff.</p></div><div class="v47-hero-actions"><button class="btn primary" id="v47Readiness">⚡ Run Readiness</button><button class="btn orange" id="v47War">💥 Break It — War Test</button></div></section>
      <div id="v47Status" class="v47-status">Ready to test the final build.</div>
      <div class="v47-grid v47-grid-4" id="v47Metrics">
        <div class="v47-metric"><span>Build</span><strong>47.0.0</strong><small>Final fabric</small></div>
        <div class="v47-metric"><span>Streaming</span><strong>LIVE</strong><small>Bounded callbacks</small></div>
        <div class="v47-metric"><span>State</span><strong>ENCRYPTED</strong><small>V46.3/V46.4 retained</small></div>
        <div class="v47-metric"><span>Security</span><strong>FAIL-CLOSED</strong><small>Owner controls protected</small></div>
      </div>
      <div class="v47-grid v47-grid-2">
        ${card('🧨 Production War Room',`<p class="mini">Synthetic only. No real customer, payment, print or vendor mutation is performed by this test.</p><div class="v47-actions"><button class="btn orange" id="v47War2">Run Full Stress Simulation</button><button class="btn" id="v47Inventory">Open System Inventory</button></div><pre id="v47WarOut" class="v47-output"></pre>`,'danger-edge')}
        ${card('📡 Real-Time Event Fabric',`<p class="mini">Subscribe to internal events without polling the database. Print fulfillment callbacks are routed through the same guarded fabric.</p><div class="v47-actions"><select id="v47Topic"><option value="*">All events</option><option value="fulfillment.print.4over4">4OVER4</option><option value="fulfillment.print.vistaprint">VistaPrint</option></select><button class="btn primary" id="v47Stream">Start Live Stream</button><button class="btn" id="v47Stop">Stop</button></div><div id="v47StreamState" class="v47-stream-state">Stream idle.</div><div id="v47Events" class="v47-events"></div>`)}
      </div>
      <div class="v47-grid v47-grid-3">
        ${card('🛠 Demo Router',`<div id="v47Router">Loading…</div><button class="btn" id="v47RouterRefresh">Refresh Router</button>`)}
        ${card('🌐 Public Site Checks',`<p class="mini">Checks are live only when run from the deployed Command Center host.</p><button class="btn" id="v47Sites">Check SBC Websites</button><pre id="v47SitesOut" class="v47-output"></pre>`)}
        ${card('🏢 Office Box',`<p><strong>Separate deployable product.</strong></p><p class="mini">V47 keeps the Office Box boundary intact instead of merging two application roots into one risky package.</p><a class="btn" href="/office-box" target="_blank" rel="noopener">Open Office Box</a>`)}
      </div>
      <div class="v47-grid v47-grid-2">
        ${card('🔐 Final Security Boundary',`<div class="v47-checks"><div>${badge(true,'HMAC admission')}<span>Unsigned inbound events are rejected.</span></div><div>${badge(true,'Idempotency')}<span>Duplicate event replay is contained.</span></div><div>${badge(true,'Encrypted state')}<span>Snapshots are compressed and authenticated.</span></div><div>${badge(true,'RBAC')}<span>Owner-only infrastructure actions remain protected.</span></div><div>${badge(true,'Sandbox')}<span>Demo workers stay inside bounded resource policy.</span></div><div>${badge(true,'Durable fallback')}<span>Disk spool remains available when Redis/MySQL is unavailable.</span></div></div>`)}
        ${card('📦 Final Deployment Checklist',`<ol class="v47-list"><li>Upload <strong>SBC-Business-Command-Center-V48.0.0-BIG3.zip</strong>.</li><li>Set production secrets in GoDaddy/cPanel — never inside source files.</li><li>Run the V48 readiness test.</li><li>Run the war test.</li><li>Verify <code>/api/health</code> and the owner dashboard.</li><li>Deploy Office Box separately using its audited package.</li><li>Only then connect live GoDaddy/print/payment providers.</li></ol>`)}
      </div>
    </div>`;
  };
  async function readiness(){const j=await get('/api/v47/readiness');const r=j.stats||{};document.querySelector('#v47Status').innerHTML=`<strong>${j.ok?'🟢 V47 READY':'🔴 V47 NEEDS ATTENTION'}</strong> · ${esc(j.architecture)} · ${r.subscribers||0} stream subscribers · ${r.emitted||0} events emitted`;
    document.querySelector('#v47Router').innerHTML=r.demoRouter?.ok?`<div class="v47-route-count">${r.demoRouter.routes.length} routes</div><div class="mini">${r.demoRouter.routes.map(x=>esc(x.id)).join(' · ')}</div>`:`<span class="v47-badge bad">Router unavailable</span>`;}
  function wire(){
    document.querySelector('#v47Readiness')?.addEventListener('click',()=>readiness().catch(e=>toast(e.message)));
    const run=async()=>{const out=document.querySelector('#v47WarOut');out.textContent='Running…';try{const j=await get('/api/v47/war-test',{method:'POST',body:'{}'});out.textContent=j.stdout||JSON.stringify(j,null,2);document.querySelector('#v47Status').innerHTML=j.ok?'🟢 <strong>WAR TEST PASSED</strong>':'🔴 <strong>WAR TEST FAILED</strong>'; }catch(e){out.textContent=e.message;}};
    document.querySelector('#v47War')?.addEventListener('click',run);document.querySelector('#v47War2')?.addEventListener('click',run);
    document.querySelector('#v47Inventory')?.addEventListener('click',async()=>{try{const j=await get('/api/v47/system-inventory');const out=document.querySelector('#v47WarOut');out.textContent=Object.entries(j.inventory).map(([k,v])=>`[${k}]\n${v.join('\n')}`).join('\n\n');}catch(e){toast(e.message)}});
    document.querySelector('#v47RouterRefresh')?.addEventListener('click',()=>readiness().catch(e=>toast(e.message)));
    document.querySelector('#v47Sites')?.addEventListener('click',async()=>{const o=document.querySelector('#v47SitesOut');o.textContent='Checking…';try{o.textContent=JSON.stringify(await get('/api/v47/site-check'),null,2)}catch(e){o.textContent=e.message}});
    let es=null;
    document.querySelector('#v47Stream')?.addEventListener('click',()=>{if(es)es.close();const topic=encodeURIComponent(document.querySelector('#v47Topic').value);es=new EventSource(`/api/v47/stream?topic=${topic}`);document.querySelector('#v47StreamState').textContent='🟢 Live stream connected';es.addEventListener('sbc',e=>{const box=document.querySelector('#v47Events');const row=document.createElement('div');row.className='v47-event';row.textContent=e.data;box.prepend(row);while(box.children.length>25)box.lastChild.remove();});es.onerror=()=>{document.querySelector('#v47StreamState').textContent='🟠 Stream disconnected / re-authentication may be required';}});
    document.querySelector('#v47Stop')?.addEventListener('click',()=>{if(es)es.close();es=null;document.querySelector('#v47StreamState').textContent='Stream stopped.';});
    readiness().catch(()=>{});
  }
  const oldRender=window.render;
  document.addEventListener('click',e=>{if(e.target.closest('[data-view="v47"]'))setTimeout(wire,0)});
  window.addEventListener('v47:view-ready',wire);
  const toast=(m)=>window.toast?window.toast(m):alert(m);
  const observer=new MutationObserver(()=>{if(document.querySelector('#v47Readiness')&&!document.querySelector('#v47Readiness').dataset.bound){document.querySelector('#v47Readiness').dataset.bound='1';wire()}});
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();
