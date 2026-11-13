/* SBC V66 legacy-enterprise-controls · checked-in scripts retain startup order */
/* BEGIN v43-edge-suite.js */
try {
(function(){
  const smooth = [
    'One-Click Daily Command Brief','Auto-Repair Queue Triage','Slow-Request Heatmap','Broken-Button Sentinel','Login Journey Guard','Session Continuity Monitor','Lead Aging Radar','Duplicate Lead Preview','Stale Task Sweep','Follow-Up Gap Detector','Quote Expiration Radar','Renewal Risk Radar','Payment Reconciliation Queue','Order Handoff Checklist','Fulfillment Bottleneck Radar','Vendor Latency Watch','Customer Escalation Radar','Communication Promise Tracker','SLA Countdown Board','Meeting Prep Brief','Employee Readiness Meter','Training Gap Detector','New-Hire Day Plan','Role Permission Drift Check','Team Workload Balancer','Unassigned Work Radar','Daily Data Hygiene Sweep','Missing Field Detector','Contactability Score','Lead Source Integrity Check','Pipeline Stuck Detector','Opportunity Next-Step Guard','Customer Record Completeness','Order Data Completeness','Price Book Consistency Check','Catalog Change Diff','Webhook Health Board','Integration Credential Readiness','Background Worker Watch','Database Write Queue Watch','Cache Freshness Monitor','Frontend Version Sentinel','Search Quality Monitor','Notification Delivery Watch','Task Dependency Map','Calendar Conflict Radar','End-of-Day Closeout','Morning Launch Checklist','Kim Handoff Queue','Owner Exception Queue'
  ];
  const connected = [
    'Lead-to-Customer Handoff Graph','Quote-to-Payment Bridge','Payment-to-Fulfillment Bridge','Customer-to-Website Context Link','CRM-to-Communications Timeline','CRM-to-Calendar Context','CRM-to-Training Context','Lead-to-Marketing Attribution','Order-to-Vendor Trace','Vendor-to-Customer Tracking','Website-Demo-to-CRM Capture','Form-to-Lead Qualification','Call-to-CRM Auto-Note','SMS-to-Account Timeline','Email-to-Account Timeline','Task-to-Opportunity Link','Renewal-to-Original-Order Link','Support-to-Account Health','Refund-to-Audit Trail','Commission-to-Cash Ledger','Employee-to-Workload Map','Employee-to-Training Map','Employee-to-Lead Ownership','Kim-to-Exception Escalation','Kim-to-Fulfillment Queue','Kim-to-Sales Queue','Kim-to-Customer Health','Kim-to-Website Health','Kim-to-Marketing Queue','Kim-to-Payment Readiness','Vendor Failover Decision Graph','Integration Dependency Map','Cross-Module Event Timeline','Unified Customer 360 Snapshot','Unified Business 360 Snapshot','Opportunity Journey Replay','Customer Journey Replay','Order Journey Replay','Revenue Journey Replay','Lead Source-to-Revenue Chain','Campaign-to-Deal Chain','Deal-to-Service Chain','Service-to-Renewal Chain','Issue-to-Resolution Chain','Training-to-Production Clearance','Onboarding-to-First-Deal Chain','Office-to-Team Capacity Map','SBC-to-Partner Service Router','Payment Processing Partner Handoff','Executive Exception Escalation Bus'
  ];
  const standout = [
    'Kim Mission Control','Business Digital Twin','Customer Memory Capsule','Deal War Room','Lead Autopsy Studio','Revenue Leak Detector','Invisible Work Detector','Promise Ledger','Trust Recovery Planner','Customer Momentum Score','Relationship Temperature Map','Opportunity Gravity Map','Decision Replay Engine','What-Changed-While-You-Were-Gone','Next-Morning CEO Brief','Zero-Surprise Fulfillment Mode','Silent Failure Detector','Counterfactual Deal Simulator','Margin Protection Copilot','Service Bundle Composer','Business Launch Blueprint','One-Conversation Account Builder','Instant Client Health Report','Customer Churn Storyline','Revenue Concentration Radar','Referral Opportunity Miner','Expansion Moment Detector','Dormant Customer Revival Map','Lost-Deal Learning Loop','Sales Rep Coaching Mirror','Call Quality Fingerprint','Lead Research Confidence Meter','Human-vs-AI Work Router','Kim Confidence Gate','Safe Action Preview','Recovery Point Planner','Reversible Change Journal','Operational Time Machine','Process Bottleneck Storyboard','Business Promise Scorecard','Executive Risk Constellation','SBC Opportunity Genome','Customer Value Trajectory','Partner Fit Matrix','Payment Processing Readiness Map','Offer Collision Detector','Service Profitability Lens','Workflow Friction Score','Competitive Differentiation Vault','SBC Signature Operating Blueprint'
  ];
  const descriptions={
    'Kim Mission Control':'One command surface for Kim to see priorities, blocked work, safe actions, exceptions and verification status.',
    'Business Digital Twin':'Creates a live operational map of customers, leads, revenue objects, work queues and dependencies without copying secrets.',
    'Customer Memory Capsule':'Condenses durable account context, promises, preferences, open loops and recent outcomes into one recoverable snapshot.',
    'Deal War Room':'Puts the opportunity, stakeholders, objections, next actions, quote/payment state and fulfillment implications on one screen.',
    'Revenue Leak Detector':'Scans operational records for stalled quotes, missed follow-ups, renewal gaps and unassigned revenue work.',
    'Promise Ledger':'Tracks explicit commitments made to customers and surfaces overdue or unverified promises.',
    'What-Changed-While-You-Were-Gone':'Produces a concise delta report of meaningful system, customer, sales and fulfillment changes since the last owner session.',
    'Zero-Surprise Fulfillment Mode':'Blocks preventable handoff gaps by requiring a verified customer, paid state, production data and delivery context before dispatch.',
    'Counterfactual Deal Simulator':'Shows how a deal changes if price, package, follow-up timing or fulfillment constraints change before committing anything.',
    'Human-vs-AI Work Router':'Routes work to Kim, an employee or Romeo based on permissions, reversibility, urgency and required human judgment.',
    'Safe Action Preview':'Shows the exact intended operational change and affected records before Kim executes a reversible action.',
    'Operational Time Machine':'Reconstructs the sequence of events around a customer, order or workflow from the audit trail.',
    'SBC Opportunity Genome':'Combines customer behavior, service history, lead source, engagement and operational signals into an explainable opportunity profile.',
    'Payment Processing Readiness Map':'Prepares a business profile for the payment-processing workflow without pretending an external processor is connected.',
    'SBC Signature Operating Blueprint':'Packages the unique SBC operating model into a reusable workflow blueprint for new teams, partners and locations.'
  };
  const desc=(x)=>descriptions[x]||`Operational capability for ${x.toLowerCase()}, designed to reduce manual handoffs, expose exceptions and keep the SBC workflow connected.`;
  const items=[...smooth.map((name,i)=>({id:`smooth-${i+1}`,name,group:'smooth',label:'Smoother',priority:i<10?'Core':'Operational'})),...connected.map((name,i)=>({id:`connect-${i+1}`,name,group:'connected',label:'Connected',priority:i<10?'Core':'Integration'})),...standout.map((name,i)=>({id:`edge-${i+1}`,name,group:'standout',label:'Signature',priority:i<20?'Signature':'Differentiator'}))];
  window.sbcEdgeSuite={items};
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function run(id){const out=document.querySelector('#edgeOutput');if(out)out.textContent='Running safe capability check…';try{const r=await fetch('/api/edge-suite/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({featureId:id})});const j=await r.json();if(out)out.textContent=JSON.stringify(j,null,2);}catch(e){if(out)out.textContent='Edge Suite request failed: '+e.message;}}
  function card(x){return `<article class="edge-card ${x.group==='standout'?'edge-signature':''}"><div><span class="edge-badge ${x.group==='standout'?'gold':x.group==='connected'?'green':''}">${esc(x.label)}</span><h4>${esc(x.name)}</h4><p>${esc(desc(x.name))}</p></div><div class="edge-meta"><span class="edge-badge">${esc(x.priority)}</span><span class="edge-badge">Guarded</span></div><button class="btn small" data-edge-run="${esc(x.id)}">Run safe check</button></article>`;}
  function render(filter='all',query=''){const q=query.toLowerCase().trim();const list=items.filter(x=>(filter==='all'||x.group===filter)&&(!q||x.name.toLowerCase().includes(q)||desc(x.name).toLowerCase().includes(q)));return `<div class="edge-suite"><section class="edge-hero"><span class="badge">V43.3 EDGE INTELLIGENCE SUITE</span><h2>150 upgrades. One connected operating layer.</h2><p>Built around the SBC workflow you already have. The suite favors safe, reversible operations and exposes infrastructure-dependent integrations instead of pretending unsupported services are live.</p><div class="edge-kpis"><div class="edge-kpi"><strong>50</strong><span>Smoother operations</span></div><div class="edge-kpi"><strong>50</strong><span>Connected workflows</span></div><div class="edge-kpi"><strong>50</strong><span>Signature differentiators</span></div><div class="edge-kpi"><strong>${items.length}</strong><span>Total upgrade catalog</span></div></div></section><section class="card section"><div class="card-body"><div class="edge-toolbar"><div class="edge-tabs"><button class="edge-tab ${filter==='all'?'active':''}" data-edge-filter="all">All 150</button><button class="edge-tab ${filter==='smooth'?'active':''}" data-edge-filter="smooth">Smoother 50</button><button class="edge-tab ${filter==='connected'?'active':''}" data-edge-filter="connected">Connected 50</button><button class="edge-tab ${filter==='standout'?'active':''}" data-edge-filter="standout">Signature 50</button></div><input class="edge-search" id="edgeSearch" placeholder="Search the upgrade catalog…" value="${esc(query)}"></div><div class="edge-note" style="margin:12px 0">Every card has a safe server-side check. Vendor-dependent capabilities are marked as integration-ready until the required provider is actually configured.</div><div class="edge-grid" id="edgeGrid">${list.map(card).join('')}</div></div></section><section class="card section"><div class="card-body"><h3>Safe capability result</h3><div id="edgeOutput" class="edge-output">Choose any upgrade above to run its non-destructive system check.</div></div></section><div class="edge-footer">Signature features are intentionally designed around SBC's connected workflow rather than copying a generic CRM checklist.</div></div>`;}
  let filter='all',query='';
  window.sbcEdgeView=()=>render(filter,query);
  document.addEventListener('click',e=>{const f=e.target.closest('[data-edge-filter]');if(f){filter=f.dataset.edgeFilter;const c=document.querySelector('#content');if(c)c.innerHTML=render(filter,document.querySelector('#edgeSearch')?.value||'');}const b=e.target.closest('[data-edge-run]');if(b)run(b.dataset.edgeRun);});
  document.addEventListener('input',e=>{if(e.target.id==='edgeSearch'){query=e.target.value;const c=document.querySelector('#content');if(c)c.innerHTML=render(filter,query);}});
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v43-edge-suite.js", sbcBundleError);
}
/* END v43-edge-suite.js */
;
/* BEGIN v43-4-resilience-brand.js */
try {
(function(){
  const state={catalog:{resilience:[],brand:[],kimControl:[]},group:'all',query:'',output:''};
  const groups=[
    ['all','All 270'],['resilience','Resilience 88'],['brand','Brand Intelligence 50'],['kim','Kim Control 132']
  ];
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function load(){
    const [cat,ready]=await Promise.all([
      fetch('/api/v434/catalog').then(r=>r.json()),
      fetch('/api/v434/readiness').then(r=>r.json())
    ]);
    if(!cat.ok) throw new Error(cat.error||'Unable to load V43.4 catalog.');
    state.catalog=cat;
    state.ready=ready;
  }
  function flat(){
    const r=(state.catalog.resilience||[]).map(x=>({...x,group:'resilience'}));
    const b=(state.catalog.brand||[]).map(x=>({...x,group:'brand'}));
    const k=(state.catalog.kimControl||[]).map(x=>({...x,group:'kim'}));
    return [...r,...b,...k];
  }
  function statusBadge(x){
    const map={'READY':'ready','CONFIGURED':'ready','INTEGRATION-READY':'ready','PROVIDER-GATED':'gate','HOST-GATED':'gate','OWNER-GATED':'owner'};
    return `<span class="v434-badge ${map[x]||'gate'}">${esc(x)}</span>`;
  }
  async function run(id){
    const out=document.querySelector('#v434Output');
    if(out) out.textContent='Running safe check…';
    try{
      const r=await fetch('/api/v434/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({featureId:id})});
      const j=await r.json();
      if(out) out.textContent=JSON.stringify(j,null,2);
    }catch(e){if(out)out.textContent='V43.4 check failed: '+e.message;}
  }
  function render(){
    const q=state.query.toLowerCase().trim();
    const all=flat();
    const list=all.filter(x=>(state.group==='all'||x.group===state.group)&&(!q||x.name.toLowerCase().includes(q)||x.description.toLowerCase().includes(q)||String(x.section||'').toLowerCase().includes(q)));
    const ready=state.ready?.statuses||{};
    return `<div class="v434-suite">
      <section class="v434-hero">
        <div class="v434-kicker">SBC V43.4.1 · RESILIENCE + BRAND + KIM CONTROL</div>
        <h2>Protect the machine. Amplify the brand. 🚀</h2>
        <p>270 guarded capabilities layered onto the existing Command Center. Local-safe controls are active now; provider, multi-region, and owner-sensitive functions remain explicitly gated until the required authority or infrastructure exists.</p>
        <div class="v434-kpis">
          <div><strong>88</strong><span>Resilience capabilities</span></div>
          <div><strong>50</strong><span>Brand intelligence capabilities</span></div>
          <div><strong>132</strong><span>Kim resilience controls</span></div>
          <div><strong>${esc(ready.READY||0)}</strong><span>Ready locally</span></div>
          <div><strong>${esc((ready['PROVIDER-GATED']||0)+(ready['HOST-GATED']||0))}</strong><span>Gated until configured</span></div>
        </div>
      </section>
      <section class="v434-toolbar card">
        <div class="v434-tabs">${groups.map(g=>`<button class="v434-tab ${state.group===g[0]?'active':''}" data-v434-group="${g[0]}">${g[1]}</button>`).join('')}</div>
        <input id="v434Search" value="${esc(state.query)}" placeholder="Search capabilities, security, brand, founder, API…" aria-label="Search V43.4 capabilities">
      </section>
      <section class="v434-grid">
        ${list.map(x=>`<article class="v434-card ${x.group==='brand'?'brand':x.group==='kim'?'kim':''}">
          <div class="v434-card-top"><span class="v434-badge">${x.group==='brand'?'BRAND':x.group==='kim'?'KIM CONTROL':'RESILIENCE'}</span>${statusBadge(x.mode==='local-safe'?'READY':x.mode==='provider-gated'?'PROVIDER-GATED':'HOST-GATED')}</div>
          <h3>${esc(x.name)}</h3>
          <p>${esc(x.description)}</p>
          <div class="v434-meta">${esc(x.section||x.group)} · ${esc(x.mode)}</div>
          <button class="btn small" data-v434-run="${esc(x.id)}">Run safe check</button>
        </article>`).join('') || '<div class="card"><div class="card-body">No capabilities match that search.</div></div>'}
      </section>
      <section class="card section"><div class="card-head"><h2>System result</h2></div><div class="card-body"><pre id="v434Output" class="v434-output">${esc(state.output||'Choose a capability to run a non-destructive check.')}</pre></div></section>
      <section class="card section"><div class="card-body"><h3>Operating rule</h3><p class="muted">V43.4 does not fake infrastructure. Multi-region routing, external queues, Redis, external telemetry, containers and other host-dependent capabilities remain staged until their required service is deliberately configured. Kim can operate the safe/reversible layer; owner-only security, credentials and irreversible controls remain locked to the owner. Brand tools are approval-gated and use verified SBC/customer facts.</p></div></section>
    </div>`;
  }
  async function view(){
    await load();
    return render();
  }
  window.sbcV434View=view;
  document.addEventListener('click',e=>{
    const g=e.target.closest('[data-v434-group]');
    if(g){state.group=g.dataset.v434Group;const c=document.querySelector('#content');if(c)c.innerHTML=render();return;}
    const b=e.target.closest('[data-v434-run]');
    if(b)run(b.dataset.v434Run);
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='v434Search'){state.query=e.target.value;const c=document.querySelector('#content');if(c)c.innerHTML=render();}
  });
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v43-4-resilience-brand.js", sbcBundleError);
}
/* END v43-4-resilience-brand.js */
;
/* BEGIN v43-7-sales-velocity.js */
try {
(function(){'use strict';
  const VERSION='43.7.1';
  const shortcuts=[
    ['n','Next lead','next'],['p','Previous lead','previous'],['s','Save profile','save'],['c','Add call note','call-note'],['t','Add follow-up task','task'],['d','Mark research complete','research-complete'],['e','Edit profile','edit']
  ];
  function dispatch(action){
    window.dispatchEvent(new CustomEvent('sbc:lead-workbench-action',{detail:{action,version:VERSION}}));
    if(typeof window.SBCLeadWorkbenchAction==='function'){try{window.SBCLeadWorkbenchAction(action)}catch(e){console.warn('[SBC V43.7] workbench action',e)}}
    const el=document.querySelector(`[data-sbc-action="${action}"]`); if(el && typeof el.click==='function') el.click();
  }
  function close(){const x=document.getElementById('sbc437Palette');if(x)x.remove()}
  function open(){close();const wrap=document.createElement('div');wrap.id='sbc437Palette';wrap.innerHTML='<div class="sbc437-backdrop"></div><div class="sbc437-palette" role="dialog" aria-label="SBC Lead Workbench Command Palette"><div class="sbc437-head"><strong>⚡ SBC Lead Workbench</strong><button id="sbc437Close">×</button></div><input id="sbc437Search" autocomplete="off" placeholder="Type an action…"><div id="sbc437List"></div><small>Enter runs • Esc closes • shortcuts never bypass server authorization</small></div>';document.body.appendChild(wrap);
    const input=wrap.querySelector('#sbc437Search'),list=wrap.querySelector('#sbc437List');
    function render(q){const rows=shortcuts.filter(x=>(x[1]+' '+x[2]).toLowerCase().includes(q.toLowerCase()));list.innerHTML=rows.map((x,i)=>`<button class="sbc437-row" data-action="${x[2]}"><span>${x[1]}</span><kbd>${i<2?'N/P':''}</kbd></button>`).join('');list.querySelectorAll('button').forEach(b=>b.onclick=()=>{dispatch(b.dataset.action);close()})}
    input.oninput=()=>render(input.value);input.onkeydown=e=>{if(e.key==='Escape'){close()}if(e.key==='Enter'){const b=list.querySelector('button');if(b){dispatch(b.dataset.action);close()}}};wrap.querySelector('#sbc437Close').onclick=close;wrap.querySelector('.sbc437-backdrop').onclick=close;render('');input.focus();
  }
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open();return}if(e.key==='Escape'){close();return}if(e.target && /input|textarea|select/i.test(e.target.tagName))return;if(e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();const row=shortcuts.find(x=>x[0]===k);if(row){e.preventDefault();dispatch(row[2])}});
  window.SBC437={version:VERSION,shortcuts,openPalette:open,closePalette:close};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v43-7-sales-velocity.js", sbcBundleError);
}
/* END v43-7-sales-velocity.js */
;
/* BEGIN kim-deep-ops.js */
try {
(function(){
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  window.kimDeepOpsView=async function(){
    try{
      const r=await api('/api/kim/deep-ops/summary');
      const caps=r.exclusiveCapabilities||[];
      return `<div class="card section"><div class="card-body"><div class="eyebrow">KIM DEEP OPERATIONS</div><h2>👑 Kim Deep Operations Fabric</h2><p class="mini">15 uncommon control-plane capabilities layered onto Kim's existing operating system. External vendor execution remains fail-closed until credentials, contracts and explicit live flags are verified.</p><div class="kim-deep-note"><strong>Truth rule:</strong> database transactions cannot magically undo an external card charge or vendor submission. Kim uses idempotency, compensation workflows and owner/review gates instead.</div><div class="actions" style="margin-top:14px"><button class="btn primary" id="kimDeepSandbox">Run 30-capability sandbox</button><span class="badge green">Catalog ${esc(r.catalogCount)} capabilities</span></div></div></div><div class="kim-deep-grid">${caps.map(x=>`<div class="kim-deep-card"><span class="kim-deep-pill">${esc(x[0])}</span><h3>${esc(x[1])}</h3><p><strong>${esc(x[2])}</strong></p><p>${esc(x[3])}</p></div>`).join('')}</div><div id="kimDeepResult"></div>`;
    }catch(e){return `<div class="card section"><div class="card-body"><h2>Kim Deep Operations</h2><p>Unable to load: ${esc(e.message||e)}</p></div></div>`}
  };
  document.addEventListener('click',async e=>{if(e.target.id!=='kimDeepSandbox')return;const out=document.getElementById('kimDeepResult');if(out)out.innerHTML='<div class="card section"><div class="card-body">Running deterministic sandbox…</div></div>';try{const r=await api('/api/kim/deep-ops/sandbox',{method:'POST',body:{}});if(out)out.innerHTML=`<div class="card section"><div class="card-body"><h3>✅ Sandbox complete</h3><p class="mini">Mutations: ${r.mutations} · Live vendors touched: ${r.liveVendorsTouched} · Live payments touched: ${r.livePaymentsTouched}</p><pre style="white-space:pre-wrap;max-height:420px;overflow:auto">${esc(JSON.stringify(r.results,null,2))}</pre></div></div>`;}catch(err){if(out)out.innerHTML=`<div class="card section"><div class="card-body">Sandbox failed: ${esc(err.message||err)}</div></div>`;}});
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: kim-deep-ops.js", sbcBundleError);
}
/* END kim-deep-ops.js */
;
/* BEGIN kim-founder-fortress.js */
try {
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.kimFounderFortressView=async function(){
    try{const r=await api('/api/kim/fortress/summary');return `<div class="card section"><div class="card-body"><div class="eyebrow">FOUNDER FORTRESS + WOW FABRIC</div><h2>🛡️ Kim Founder Fortress</h2><p class="mini">A security and operator-experience layer built for SBC. Stable API routes are retained for compatibility; sensitive actions use ephemeral challenges and replay protection.</p><div class="kim-deep-grid">${r.capabilities.map(x=>`<div class="kim-deep-card"><span class="kim-deep-pill">${esc(x[0])}</span><h3>${esc(x[1])}</h3><p>${esc(x[2])}</p></div>`).join('')}</div><div class="actions" style="margin-top:16px"><button class="btn primary" id="kimFortressChallenge">Generate command challenge</button><button class="btn" id="kimFortressWar">Enter War Room</button><button class="btn" id="kimFortressPhoenix">Build Phoenix recovery plan</button></div><div id="kimFortressOut" class="card section" style="margin-top:16px"><div class="card-body"><strong>Canary:</strong> ${r.canary?'INTACT':'ALERT'} · <strong>Challenge:</strong> ephemeral 30-second window</div></div></div></div>`}catch(e){return `<div class="card section"><div class="card-body">Unable to load Fortress: ${esc(e.message||e)}</div></div>`}}
  document.addEventListener('click',async e=>{
    const out=document.getElementById('kimFortressOut');
    if(e.target.id==='kimFortressChallenge'){const r=await api('/api/kim/fortress/challenge');if(out)out.innerHTML=`<div class="card-body"><strong>Challenge:</strong><code style="word-break:break-all">${esc(r.challenge)}</code><div class="mini">Valid for approximately ${r.expiresInMs/1000}s. It is not a permanent secret.</div></div>`;}
    if(e.target.id==='kimFortressWar'){const r=await api('/api/kim/fortress/war-room');if(out)out.innerHTML=`<div class="card-body"><h3>⚡ WAR ROOM</h3><p>Uptime ${Math.round(r.live.uptimeSeconds)}s · collaborators ${r.live.activeCollaborators}</p><pre>${esc(JSON.stringify(r.live.memory,null,2))}</pre></div>`;}
    if(e.target.id==='kimFortressPhoenix'){const c=await api('/api/kim/fortress/challenge');const r=await api('/api/kim/fortress/phoenix-plan',{method:'POST',headers:{'X-SBC-Command-Challenge':c.challenge,'X-SBC-Request-Nonce':cryptoRandom()},body:{state:{view:'kimfortress',createdAt:new Date().toISOString()}}});if(out)out.innerHTML=`<div class="card-body"><h3>🔥 Phoenix plan ready</h3><p class="mini">Reversible recovery plan generated. No production process was terminated.</p><pre>${esc(JSON.stringify(r.plan,null,2))}</pre></div>`;}
  });
  function cryptoRandom(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: kim-founder-fortress.js", sbcBundleError);
}
/* END kim-founder-fortress.js */
