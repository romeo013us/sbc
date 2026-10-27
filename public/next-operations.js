(function(){
  function e(v){return window.esc?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function api2(url,opt={}){return window.api(url,opt)}
  function card(title,body,badge='READY'){return `<div class="card"><div class="card-head"><div><h2>${title}</h2></div><span class="badge blue">${badge}</span></div><div class="card-body">${body}</div></div>`}
  async function loadReadiness(){try{return await api2('/api/next-operations/readiness')}catch{return null}}
  async function healthCheck(){try{const x=await api2('/api/health/vendors?refresh=1');const rows=(x.results||[]).map(v=>`<div class="list-card"><div><strong>${e(v.name)}</strong><div class="meta">HTTP ${v.status||'ERR'} · ${v.latencyMs} ms</div></div><span class="badge ${v.ok?'green':'red'}">${v.ok?'HEALTHY':'CHECK'}</span></div>`).join('')||'<div class="empty">No vendor endpoints configured. Core SBC does not depend on external probes.</div>';const el=document.getElementById('kimHealthResult');if(el)el.innerHTML=rows;return x}catch(err){toast(err.message||'Health check failed.')}}
  async function sandboxTest(){try{const x=await api2('/api/next-operations/sandbox',{method:'POST',body:JSON.stringify({name:'SBC Next Operations Smoke Test',payload:{quote:true,fulfillment:true,realtime:true}})});toast('Sandbox test created — production vendors blocked');return x}catch(err){toast(err.message)}}
  async function whatIf(){
    const base={quantity:Number(document.getElementById('whatQty')?.value||100),unitPrice:Number(document.getElementById('whatUnit')?.value||0.20),materialMultiplier:Number(document.getElementById('whatMaterial')?.value||1),setupFee:Number(document.getElementById('whatSetup')?.value||0),discount:Number(document.getElementById('whatDiscount')?.value||0)};
    try{const x=await api2('/api/next-operations/what-if-quote',{method:'POST',body:JSON.stringify({base,adjustments:[]})});const el=document.getElementById('whatTotal');if(el)el.textContent='$'+Number(x.session.quote.total||0).toFixed(2);const note=document.getElementById('whatNotice');if(note)note.textContent='Interaction recorded in the quote session.';}catch(err){toast(err.message)}
  }
  window.nextOperationsView=async function(){
    const r=await loadReadiness();
    const st=r?.readiness?.status||{};
    const features=[
      ['☎️','Voice-to-UI Sync','Live call context can drive CRM screen actions when a consented voice/context provider is configured.','telephonyVisualSync'],
      ['🧮','What-If Quotes','Interactive pricing sessions recalculate instantly and log interactions.','whatIfQuotes'],
      ['📍','Geofenced Prospecting','ZIP-scoped ingestion is provider-gated; no external scraping runs without a configured provider.','geofencedProspects'],
      ['🎨','Brand Discovery','Brand metadata can be attached to Customer 360 through a provider adapter.','brandScraper'],
      ['🌐','Dynamic Demo Domains','Demo routing supports tenant/subdomain mapping; DNS/reverse-proxy activation remains external.','subdomainDemos'],
      ['🔄','Template Swapping','Sales can create a fresh demo variant without rebuilding the CRM.','templateSwap'],
      ['📦','Multi-Vendor Split','Orders can split into parallel vendor jobs by product category.','payloadSplitter'],
      ['🖨️','Print Preflight','DPI, profile, bleed and format diagnostics run before vendor submission.','printPreflight'],
      ['🚚','Tracking Reconciliation','Tracking provider hooks are ready and provider-gated.','trackingReconciliation'],
      ['☎️','Autonomous Dial Queue','Lead ranking produces a next-best-call queue from engagement and value signals.','autonomousDialing'],
      ['🏆','Employee Metrics','Call, touchpoint and demo metrics can be recorded per employee.','performanceMetrics'],
      ['📝','Transcript Summaries','Consent-aware transcript summaries turn conversation text into notes/action items.','transcriptSummarizer'],
      ['🔐','Tenant Isolation','Every next-operations request resolves a tenant context at the application boundary.','tenantIsolation'],
      ['👁️','Visibility Controls','Architecture is ready for role/attribute-based field visibility policies.','visibilityControls'],
      ['🧾','Idempotency Gates','External-write operations can be bound to deterministic idempotency keys.','idempotency'],
      ['🧩','Fulfillment Adapters','Vendor integrations use a common validate/submit/tracking contract.','fulfillmentAdapters'],
      ['🗄️','Schema Isolation','Logical tenant/shard boundaries are represented without forcing a migration today.','schemaIsolation'],
      ['🧪','Sandbox Mode','Simulated transactions never contact production vendors.','sandbox'],
      ['⚡','Realtime Broadcasting','Dashboard event broadcasting is ready for WebSocket activation.','realtimeBroadcast'],
      ['⏳','Long-Running Workflows','Durable state machines can resume after restarts; Temporal activates when configured.','workflows']
    ];
    const ready=features.filter(x=>st[x[3]]===true).length;
    return `<div class="crm-toolbar"><div><strong>⚡ SBC Next Operations Fabric</strong><span>Twenty capabilities added underneath the existing SBC Command Center.</span></div><div class="actions" style="margin:0"><button class="btn" onclick="healthCheck()">🩺 Vendor Health</button><button class="btn" onclick="nextOpsSandbox()">🧪 Sandbox Smoke Test</button><button class="btn primary" onclick="state.view='operations';render()">🧠 Kim Operations</button></div></div>
      <div class="grid stats section"><div class="stat"><div class="label">CAPABILITIES</div><div class="value">20</div><div class="sub">Architecture tracks installed</div></div><div class="stat"><div class="label">READY NOW</div><div class="value">${ready}</div><div class="sub">No external provider required</div></div><div class="stat"><div class="label">PROVIDER-GATED</div><div class="value">${20-ready}</div><div class="sub">Can activate when needed</div></div><div class="stat"><div class="label">TENANT</div><div class="value" style="font-size:18px">${e(r?.tenantId||'sbc-default')}</div><div class="sub">Current request context</div></div></div>
      ${card('🩺 Live Vendor Health','<div id="kimHealthResult"><div class="mini">Click Vendor Health to test configured endpoints and view latency. No external provider is required for core SBC operation.</div></div>','OPTIONAL')}
      ${card('🧮 Interactive What-If Quote','<div class="form-grid"><label>Quantity<input id="whatQty" type="number" value="100" min="1" oninput="nextOpsQuote()"></label><label>Unit Price<input id="whatUnit" type="number" step="0.01" value="0.20" oninput="nextOpsQuote()"></label><label>Material Multiplier<input id="whatMaterial" type="number" step="0.05" value="1" oninput="nextOpsQuote()"></label><label>Setup Fee<input id="whatSetup" type="number" step="0.01" value="0" oninput="nextOpsQuote()"></label><label>Discount<input id="whatDiscount" type="number" step="0.01" value="0" oninput="nextOpsQuote()"></label></div><div class="list-card" style="margin-top:14px"><div><strong>Live total</strong><div class="meta" id="whatNotice">Move a value to record a quote interaction.</div></div><strong id="whatTotal">$20.00</strong></div>','LIVE')}
      <div class="grid two section">${features.slice(0,10).map(x=>card(`${x[0]} ${x[1]}`,`<p>${x[2]}</p><span class="badge ${st[x[3]]?'green':'orange'}">${st[x[3]]?'READY':'PROVIDER GATED'}</span>`)).join('')}</div>
      <div class="grid two section">${features.slice(10).map(x=>card(`${x[0]} ${x[1]}`,`<p>${x[2]}</p><span class="badge ${st[x[3]]?'green':'orange'}">${st[x[3]]?'READY':'PROVIDER GATED'}</span>`)).join('')}</div>
      <div class="card section" style="border:1px solid var(--line)">
        <div class="card-head"><div><h2>🤖 Kim AI Operations Fabric</h2><div class="mini">Bounded autonomous intelligence underneath SBC — with Romeo's owner boundary intact.</div></div><span class="badge blue">20 AI CAPABILITIES</span></div>
        <div class="card-body">
          <div class="grid stats">
            <div class="stat"><div class="label">TRUST LAYER</div><div class="value">ON</div><div class="sub">PII masking before model context</div></div>
            <div class="stat"><div class="label">AUTONOMY</div><div class="value">BOUNDED</div><div class="sub">Protected actions require owner authority</div></div>
            <div class="stat"><div class="label">AI PROVIDER</div><div class="value">${r?.readiness?.providerConfigured?'CONNECTED':'READY'}</div><div class="sub">${r?.readiness?.providerConfigured?'Provider configured':'Provider can be activated later'}</div></div>
          </div>
          <div class="actions" style="margin-top:16px">
            <button class="btn" onclick="kimFabricCheck()">🧠 Check Kim Fabric</button>
            <button class="btn" onclick="kimFabricPlan()">⚙️ Run Safe Agent Plan</button>
            <button class="btn primary" onclick="openSbcAI()">🤖 Open Kim</button>
          </div>
          <div id="kimFabricResult" class="mini" style="margin-top:12px">Kim is ready to inspect, reason, summarize, route, forecast, detect anomalies, prepare handoffs and coordinate approved workflows.</div>
        </div>
      </div>`;
  };
  window.nextOpsQuote=whatIf;
  window.nextOpsHealth=healthCheck;
  window.nextOpsSandbox=sandboxTest;
  window.kimFabricCheck=async function(){
    try{
      const x=await api2('/api/kim/fabric/readiness');
      const el=document.getElementById('kimFabricResult');
      if(el)el.innerHTML=`<strong>Kim Fabric:</strong> ${e(x.readiness.featureCount)} capabilities ready · Trust Layer ${x.readiness.trustLayer?'ON':'OFF'} · Provider ${x.readiness.providerConfigured?'CONNECTED':'NOT CONFIGURED (safe)'}.`;
    }catch(err){toast(err.message||'Kim fabric check failed.')}
  };
  window.kimFabricPlan=async function(){
    const request=prompt('What should Kim safely inspect or prepare?','Check the next best sales action for the current team.');
    if(!request)return;
    try{
      const x=await api2('/api/kim/fabric/agent-plan',{method:'POST',body:JSON.stringify({request})});
      const el=document.getElementById('kimFabricResult');
      if(el)el.innerHTML=`<strong>Safe plan:</strong> ${e(x.intent.intent)} · ${x.requiresHuman?'Human approval required':'No protected action proposed'}<br><span class="mini">${x.proposedActions.map(a=>e(a.action)).join(' · ')}</span>`;
    }catch(err){toast(err.message||'Kim could not prepare the plan.')}
  };

})();
