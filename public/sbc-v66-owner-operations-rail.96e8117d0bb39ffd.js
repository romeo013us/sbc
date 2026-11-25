/* SBC V66 owner-operations-rail · checked-in scripts retain startup order */
/* BEGIN sbc-policies.js */
try {
/* SBC V48.6 — Policies & Standards Center */
(function(){
  const E=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const R=()=>state.me?.role||'employee';
  const canEdit=()=>['owner','manager'].includes(R());
  const policy={
    version:'V48.6.0', status:'OWNER REVIEW DRAFT', effectiveDate:'',
    attendance:{
      title:'Attendance & Timekeeping Policy',
      purpose:'Set clear expectations for scheduled attendance, accurate timekeeping, breaks, call-outs and dependable coverage.',
      rules:[
        'Employees are expected to report for scheduled work on time, ready to work.',
        'Clock in and clock out using the approved SBC timekeeping method. Never work off the clock.',
        'Record breaks accurately and return from breaks on time. Do not extend breaks without approval.',
        'If you will be late, absent, or unable to complete a scheduled shift, notify the owner/manager as soon as reasonably possible and before the shift when practical.',
        'A no-call/no-show is an attendance issue and may result in discipline based on the circumstances and applicable law.',
        'Employees must never clock in/out for another person, ask another person to do so, falsify hours, alter records without authorization, or misrepresent time worked.',
        'Attendance records must reflect actual attendance status. A clocked-in record does not by itself prove continuous work activity.',
        'Approved leave, disability accommodations, protected absences, and other legally protected time are handled according to applicable law and company procedures.',
        'Repeated lateness, unapproved absences, missed shifts, early departures, or inaccurate time records may lead to corrective action after review.'
      ],
      dos:['Be on time and ready to work.','Communicate early when attendance changes.','Use the time clock honestly.','Ask before changing a schedule or extending a break.','Keep contact information current so the company can reach you about schedule changes.'],
      donts:['Do not buddy-punch or share time-clock credentials.','Do not work off the clock.','Do not falsify hours or attendance records.','Do not disappear from a scheduled shift without communication.','Do not assume a missed shift is approved because you sent a message. Wait for acknowledgement when approval is required.']
    },
    discipline:{
      title:'Employee Conduct & Progressive Discipline Policy',
      purpose:'Define workplace standards, a fair documentation process, and the range of corrective actions SBC may use when standards are not met.',
      standards:[
        'Treat coworkers, customers, vendors and the public professionally and respectfully.',
        'Follow lawful instructions, assigned procedures, approved workflows and role permissions.',
        'Protect customer information, company information, credentials, payment information and system access.',
        'Be accurate. Do not fabricate leads, customer facts, sales activity, work performed, time records, approvals, prices, guarantees or system results.',
        'Use SBC systems only for authorized business purposes and within the employee’s role.',
        'Do not harass, threaten, discriminate against, retaliate against, or intentionally intimidate another person.',
        'Report suspected security issues, customer-impacting errors, safety concerns or policy violations promptly.',
        'Maintain professional communication in person, by phone, SMS, email, social media used for work, and inside SBC systems.'
      ],
      process:[
        {step:'1',name:'Coaching / Verbal Guidance',desc:'Clarify the expectation, explain the concern, document the conversation when appropriate, and establish the expected correction.'},
        {step:'2',name:'Written Warning',desc:'Document the policy or performance issue, the required correction, and a reasonable follow-up point.'},
        {step:'3',name:'Final Warning / Last-Chance Direction',desc:'For continued or significant issues, document the seriousness, required correction and consequences of further violations.'},
        {step:'4',name:'Separation',desc:'Employment may end when performance or conduct does not meet requirements or when the circumstances warrant separation.'}
      ],
      serious:[
        'Some conduct may warrant skipping progressive steps after review, including serious misconduct, theft or fraud, violence or threats, harassment or retaliation, intentional falsification, unauthorized access to protected systems or data, deliberate customer deception, or other conduct requiring immediate action.',
        'Before discipline is finalized, SBC should review the facts, preserve relevant records, allow the employee an opportunity to provide relevant information when appropriate, and document the decision.',
        'Nothing in this draft is intended to limit any employee right or protection provided by applicable law, regulation, contract, or an approved leave/accommodation process.'
      ],
      dos:['Ask when you are unsure instead of guessing.','Document important customer and work activity.','Escalate errors early.','Use only the permissions assigned to your role.','Accept coaching professionally and correct the issue.'],
      donts:['Do not lie to management or customers.','Do not bypass security or owner controls.','Do not use another employee’s account.','Do not retaliate against someone who raises a concern.','Do not alter records to make performance, attendance, sales, or fulfillment appear better than it is.']
    }
  };
  function list(arr){return '<ul class="sbc-policy-list">'+arr.map(x=>`<li>${E(x)}</li>`).join('')+'</ul>'}
  function section(title,body){return `<section class="card section sbc-policy-card"><div class="card-head"><h2>${E(title)}</h2><span class="badge blue">POLICY</span></div><div class="card-body">${body}</div></section>`}
  function renderPolicy(){
    const edit=canEdit();
    const a=policy.attendance,d=policy.discipline;
    $('#viewEyebrow').textContent='PEOPLE & STANDARDS'; $('#viewTitle').textContent='Policies & Standards';
    $('#content').innerHTML=`<div class="sbc-policy-hero"><div><div class="eyebrow">SBC PEOPLE OPERATIONS · ${E(policy.status)}</div><h2>How SBC expects us to work.</h2><p>This is the central home for attendance, conduct, discipline and future company policies. Policies can be expanded as SBC grows.</p></div><div class="sbc-policy-meta"><strong>${E(policy.version)}</strong><span>Owner review required before final adoption</span></div></div>
    ${section(a.title,`<p><strong>Purpose:</strong> ${E(a.purpose)}</p><h3>Core Rules</h3>${list(a.rules)}<div class="grid two"><div><h3>DO</h3>${list(a.dos)}</div><div><h3>DON'T</h3>${list(a.donts)}</div></div>`)}
    ${section(d.title,`<p><strong>Purpose:</strong> ${E(d.purpose)}</p><h3>Workplace Standards</h3>${list(d.standards)}<h3>Progressive Discipline Process</h3><div class="sbc-discipline-grid">${d.process.map(x=>`<article><span class="sbc-step">${E(x.step)}</span><strong>${E(x.name)}</strong><p>${E(x.desc)}</p></article>`).join('')}</div><div class="install-tip"><strong>Serious Misconduct & Legal Protections</strong>${list(d.serious)}</div><div class="grid two"><div><h3>DO</h3>${list(d.dos)}</div><div><h3>DON'T</h3>${list(d.donts)}</div></div>`)}
    ${section('Policy Administration',`<div class="grid three"><div><strong>Status</strong><p>${E(policy.status)}</p></div><div><strong>Version</strong><p>${E(policy.version)}</p></div><div><strong>Effective Date</strong><p>${policy.effectiveDate?E(policy.effectiveDate):'To be set after owner review'}</p></div></div><p class="mini">Owner/management should review each policy before it is issued as an official employee policy. Future policy categories can be added here without hiding or replacing prior policies.</p>${edit?'<div class="actions"><button class="btn primary" onclick="sbcPolicyOwnerReview()">Review / Prepare for Approval</button></div>':''}`)}
    ${section('Policy Roadmap',`<div class="grid three"><div class="list-card"><strong>Scheduling & Attendance</strong><div class="mini">Attendance, punctuality, breaks, call-outs, timekeeping.</div></div><div class="list-card"><strong>Conduct & Discipline</strong><div class="mini">Standards, investigations, corrective action and documentation.</div></div><div class="list-card"><strong>Technology & Security</strong><div class="mini">Credentials, systems, customer data, devices and acceptable use.</div></div><div class="list-card"><strong>Customer Service</strong><div class="mini">Professional communication, promises, escalation and complaints.</div></div><div class="list-card"><strong>Sales Ethics</strong><div class="mini">Accurate pricing, approved packages, no fabricated claims.</div></div><div class="list-card"><strong>Workplace Safety</strong><div class="mini">Safety reporting, emergencies and safe work practices.</div></div></div>`)} `;
  }
  window.sbcPolicyOwnerReview=()=>{openModal('Policy Review Checklist',`<div class="install-tip"><strong>Before adoption</strong><p>Review the attendance and discipline language for SBC's actual staffing model, confirm any required legal/HR review, set the effective date, and then publish the approved version to employees.</p><label>Owner review notes<textarea id="sbcPolicyNotes" rows="6" placeholder="What should change before approval?"></textarea></label><div class="actions"><button class="btn" onclick="closeModal()">Close</button><button class="btn primary" onclick="closeModal();toast('Review notes captured for this session. Final policy approval remains an owner action.')">Save Review Note</button></div></div>`)};
  window.renderSbcPolicies=renderPolicy;
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: sbc-policies.js", sbcBundleError);
}
/* END sbc-policies.js */
;
/* BEGIN next-operations.js */
try {
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
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: next-operations.js", sbcBundleError);
}
/* END next-operations.js */
;
/* BEGIN v32-3-expansion.js */
try {
/* SBC V32.3 — Business Automation & AI Expansion */
(function(){
  const q=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));
  let cache=null;
  async function get(path){return await api(path,{timeoutMs:6000});}
  function safeSection(title,kicker,message,action){return shell(title,kicker,`<div class="card section"><div class="card-body"><span class="badge orange">DEGRADED DATA LINK</span><h3 style="margin-top:10px">The section is still available.</h3><p class="mini">${esc(message||'The live telemetry request did not return in time. No workspace navigation was blocked.')}</p><div class="actions"><button class="btn primary" onclick="sbcV23View('${action||'home'}')">Continue</button><button class="btn" onclick="sbcV23View('${title==='Lead Intelligence'?'leads':title==='Integration Health'?'integrations':'home'}')">Retry</button></div></div></div>`);}
  function shell(title,kicker,body,actions=''){return `<div class="v23-hero"><div><div class="eyebrow">${esc(kicker)}</div><h2>${esc(title)}</h2><p>SBC Business Automation & AI — built around the first real SBC customer lifecycle.</p></div><div class="hero-actions">${actions}</div></div>${body}`}
  function stat(label,value,sub,cls=''){return `<div class="stat v23-stat ${cls}"><div class="label">${esc(label)}</div><div class="value">${esc(String(value))}</div><div class="sub">${esc(sub||'')}</div></div>`}
  function badgeText(status){return `<span class="badge ${status==='CONNECTED'?'green':status==='NOT CONFIGURED'?'orange':'blue'}">${esc(status)}</span>`}

  // SBC_V6691_ACTIONABLE_EXCEPTION_UI: bind actions by dataset, never construct
  // inline JavaScript from an order/customer ID or perform a provider action.
  function exceptionAction(a){
    const kinds=[['orderId','order','Order'],['customerId','customer','Customer'],['taskId','task','Task'],['quoteId','quote','Quote']];
    const x=kinds.find(k=>a[k[0]]);
    return x?'<button type="button" class="btn small" data-v23-open="'+x[1]+'" data-v23-id="'+esc(a[x[0]])+'">Open '+x[2]+'</button>':'<span class="mini">Review in workspace</span>';
  }
  function exceptionRow(a){
    const level=String(a.level||'info').toLowerCase();
    return '<div class="list-card v23-alert '+esc(level)+'"><div><strong>'+esc(a.icon||'⚠️')+' '+esc(a.title)+'</strong><div class="meta">'+esc(a.detail)+'</div></div><div class="actions" style="margin:0;align-items:center;gap:8px"><span class="badge '+(level==='critical'?'red':level==='warning'?'orange':'blue')+'">'+esc(level.toUpperCase())+'</span>'+exceptionAction(a)+'</div></div>';
  }
  function bindExceptionActions(){
    const content=q('#content');if(!content)return;
    content.querySelectorAll('[data-v23-open]').forEach(el=>el.addEventListener('click',()=>{
      window.sbcV23OpenException(el.dataset.v23Open,el.dataset.v23Id);
    }));
  }
  window.sbcV23OpenException=function(kind,id){
    const bucket={order:'orders',customer:'customers',task:'tasks',quote:'quotes'}[kind];
    if(!bucket||!id){toast('This warning has no linked record.');return;}
    const record=(window.state?.data?.[bucket]||[]).find(x=>String(x.id)===String(id));
    if(!record){toast('Record not currently loaded. Open '+bucket+' to review.');state.view=bucket;render();return;}
    const name=record.customerName||record.businessName||record.title||record.quoteNumber||record.product||'Record';
    const detail='<div class="detail-box"><strong>'+esc(name)+'</strong><p class="mini">Record ID: '+esc(id)+'</p><p class="mini">Status: '+esc(record.status||record.paymentStatus||'Pending review')+'</p>'+(kind==='order'?'<p class="mini">Payment: '+esc(record.paymentStatus||'Check Square evidence')+'</p><p class="mini">Fulfillment: '+esc(record.fulfillmentStatus||'Not started')+'</p>':'')+'<p class="mini">This is a read-only review. Nothing is charged, deleted, marked paid or sent to a vendor.</p></div><div class="actions"><button type="button" class="btn primary" id="v23-exception-open-workspace">Open '+esc(kind)+' workspace</button><button type="button" class="btn" onclick="closeModal()">Close</button></div>';
    openModal('Exception review · '+kind,detail);
    const b=q('#v23-exception-open-workspace');if(b)b.onclick=()=>{
      closeModal();state.view=bucket;render();
      if(kind==='order'&&typeof editOrder==='function'&&state.me?.role==='owner')editOrder(id);
      if(kind==='customer'&&typeof editCustomer==='function')editCustomer(id);
    };
  };
  async function expansionHome(){let j;try{j=await get('/api/v23/overview');cache=j;}catch(e){const d=window.state?.data||{};j={metrics:{revenue:(d.quotes||[]).filter(q=>['Won','Paid'].includes(q.status)).reduce((n,q)=>n+Number(q.total||0),0),paidOrders:(d.orders||[]).filter(o=>['Paid','Delivered'].includes(o.status)||o.paymentStatus==='Paid').length,openFulfillment:(d.orders||[]).filter(o=>!['Delivered','Cancelled'].includes(o.status)).length,followups:(d.customers||[]).filter(c=>c.followUp&&c.followUp<=new Date().toISOString().slice(0,10)).length,leads:(d.customers||[]).filter(c=>!['Customer','Lost'].includes(c.status)).length,outstanding:(d.orders||[]).filter(o=>o.paymentStatus!=='Paid'&&o.status!=='Cancelled').reduce((n,o)=>n+Number(o.price||0),0),overdueTasks:0,customers:(d.customers||[]).length},alerts:[],integrations:[]};}const m=j.metrics||{};const alerts=j.alerts||[];return shell('SBC Business Automation Hub','SBC · OPERATING SYSTEM',`<div class="grid four section">${stat('REVENUE',money(m.revenue),'Paid orders / paid quotes','green')}${stat('PAID ORDERS',m.paidOrders,'Real paid order records')}${stat('FULFILLMENT',m.openFulfillment,'Open jobs')}${stat('FOLLOW-UPS',m.followups,'Due today')}${stat('LEADS',m.leads,'Active leads')}${stat('OUTSTANDING',money(m.outstanding),'Unpaid order value','orange')}${stat('OVERDUE TASKS',m.overdueTasks,'Needs attention',m.overdueTasks?'red':'')}${stat('CUSTOMERS',m.customers,'Total customer records')}</div><div class="grid two section"><div class="card"><div class="card-head"><div><h2>🚨 Attention Center</h2><div class="mini">System-generated exceptions, not a generic activity feed.</div></div><button class="btn small" onclick="sbcV23View('alerts')">Open All</button></div><div class="card-body">${alerts.slice(0,6).map(exceptionRow).join('')||'<div class="empty">No active exceptions. Protected internal QA orders remain on no-vendor hold.</div>'}</div></div><div class="card"><div class="card-head"><div><h2>🔌 Integration Health</h2><div class="mini">Real configuration state only. No fake provider connections.</div></div><button class="btn small" onclick="sbcV23View('integrations')">Manage</button></div><div class="card-body">${(j.integrations||[]).slice(0,6).map(x=>`<div class="list-card"><div><strong>${esc(x.name)}</strong><div class="meta">${esc(x.detail)}</div></div>${badgeText(x.status)}</div>`).join('')}</div></div></div><div class="grid three section"><button class="stat v23-launch" onclick="sbcV23View('automation')"><div class="label">⚡ AUTOMATION</div><div class="value" style="font-size:20px">WORKFLOW BUILDER</div><div class="sub">When → If → Then</div></button><button class="stat v23-launch" onclick="sbcV23View('leads')"><div class="label">📊 LEAD INTELLIGENCE</div><div class="value" style="font-size:20px">QUALITY ANALYTICS</div><div class="sub">Verified → Sales Ready → Won</div></button><button class="stat v23-launch" onclick="sbcV23View('kim')"><div class="label">🤖 KIM CONTROL</div><div class="value" style="font-size:20px">AI OPERATING MODES</div><div class="sub">Standard → Professional → Master Mechanic</div></button></div>`,'<button class="btn primary" onclick="openSbcAI()">🤖 Ask Kim</button> <button class="btn" onclick="sbcV23View(\'workforce\')">👥 Workforce</button>');}
  async function integrations(){try{const j=await get('/api/v23/integrations');return shell('Integration Health','SBC · EXTERNAL SYSTEMS',`<div class="card section"><div class="card-head"><div><h2>Provider configuration</h2><div class="mini">Settings and provider account checks are reported separately.</div></div></div><div class="card-body">${window.sbcRevenueChecksButton?.()||''}<div class="v23-integration-grid">${j.integrations.map(x=>`<div class="v23-integration"><div class="v23-integration-head"><strong>${esc(x.name)}</strong>${badgeText(x.status)}</div><p>${esc(x.detail)}</p><div class="mini">Credentials remain server-side.</div></div>`).join('')}</div></div></div><div class="card section"><div class="card-head"><h2>Provisioning roadmap</h2><span class="badge blue">SAFE BY DEFAULT</span></div><div class="card-body"><div class="grid three"><div class="detail-box"><strong>🌐 GoDaddy</strong><p>Domain/DNS hooks can be enabled only after official API credentials and scoped authorization are configured.</p></div><div class="detail-box"><strong>🖨️ 4over4</strong><p>Print automation remains disabled until the official account API capability and credentials are verified.</p></div><div class="detail-box"><strong>🖨️ Vistaprint / ProShop</strong><p>Alternate print automation remains disabled until official reseller API access is verified.</p></div></div></div></div>`,'<button class="btn" onclick="sbcV23View(\'automation\')">Automation</button>');}catch(e){return safeSection('Integration Health','SBC · EXTERNAL SYSTEMS',e?.message||e,'automation')}}
  async function alerts(){const j=await get('/api/v23/alerts');const rows=Array.isArray(j.alerts)?j.alerts:[];return shell('Exception Center','SBC · SYSTEM HEALTH',`<div class="card section"><div class="card-head"><div><h2>What needs attention</h2><div class="mini">Open the linked record to investigate. The queue only shows unresolved real exceptions. Protected internal QA and system tests are excluded from fulfillment.</div></div><span class="badge blue">${rows.length} ACTIVE</span></div><div class="card-body">${rows.map(exceptionRow).join('')||'<div class="empty">No active payment or operational exceptions. Protected QA tests remain on no-vendor hold.</div>'}</div></div>`,'<button class="btn" onclick="sbcV23View(\'home\')">← Overview</button>');}
  async function leads(){try{const j=await get('/api/v23/leads/analytics');const q=j.quality||{};return shell('Lead Intelligence','SBC · REVENUE PIPELINE ANALYTICS',`<div class="grid four section">${stat('TOTAL',j.total,'Visible leads')}${stat('VERIFIED',q.verified,'Verification state','green')}${stat('HOT',q.hot,'High-priority quality')}${stat('WARM',q.warm,'Potential opportunity','orange')}</div><div class="grid two section"><div class="card"><div class="card-head"><h2>Pipeline</h2><span class="badge blue">LIVE DATA</span></div><div class="card-body">${Object.entries(j.stages||{}).map(([k,v])=>`<div class="v23-bar-row"><span>${esc(k)}</span><strong>${v}</strong><div class="v23-bar"><i style="width:${j.total?Math.min(100,v/j.total*100):0}%"></i></div></div>`).join('')}</div></div><div class="card"><div class="card-head"><h2>Data Quality</h2></div><div class="card-body"><div class="grid two">${stat('MISSING PHONE',q.missingPhone,'Needs verification')}${stat('MISSING EMAIL',q.missingEmail,'Needs verification')}${stat('MISSING WEBSITE',q.missingWebsite,'Potential website opportunity')}${stat('CUSTOMER RATE',`${j.conversion?.customerRate||0}%`,'Current customer share')}</div></div></div></div>`,'<button class="btn" onclick="state.view=\'customers\';render()">Open CRM</button>');}catch(e){return safeSection('Lead Intelligence','SBC · REVENUE PIPELINE ANALYTICS',e?.message||e,'home')}}
  async function production(){const j=await get('/api/v24/production/pipeline');const stages=j.stages||[];const by=Object.fromEntries(stages.map(st=>[st,(j.rows||[]).filter(x=>x.stage===st)]));return shell('Living Order Pipeline','V32.4 · FULFILLMENT CONTROL',`<div class="grid four section">${stages.map(st=>stat(st.toUpperCase(),j.counts?.[st]||0,st==='Staged'?'Awaiting production approval':st==='Approved'?'Ready for production':st==='Processing'?'Currently in production':'Completed work',st==='Fulfilled'?'green':st==='Processing'?'orange':'' )).join('')}</div><div class="v24-board section">${stages.map(st=>`<section class="v24-column" data-stage="${esc(st)}"><div class="v24-column-head"><div><strong>${esc(st)}</strong><span>${by[st].length}</span></div><div class="mini">${st==='Staged'?'Stage artwork + review':st==='Approved'?'Release to production':st==='Processing'?'Work in progress':'Completed'}</div></div><div class="v24-column-body">${by[st].map(card).join('')||'<div class="v24-empty">No orders here.</div>'}</div></section>`).join('')}</div><div class="card section"><div class="card-head"><div><h2>🎨 Artwork staging</h2><div class="mini">Stage print-ready artwork or DTF layout sheets against a paid order. Files remain behind authenticated production access.</div></div></div><div class="card-body"><div id="v24Drop" class="v24-drop"><div class="v24-drop-icon">⬆️</div><strong>Drop artwork here</strong><span>PNG · JPG · WEBP · GIF · SVG · PDF · up to 7 MB</span><input id="v24File" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf" hidden><button class="btn primary" onclick="document.getElementById('v24File').click()">Choose File</button></div><div id="v24StageTarget" class="mini v24-target">Select a production card to stage artwork.</div></div></div>`,`<button class="btn" onclick="sbcV23View('home')">← Automation Hub</button>`);function card(p){return `<article class="v24-order-card" draggable="false"><div class="v24-order-top"><strong>${esc(p.customerName||'Customer')}</strong><span class="badge blue">${esc(p.orderNumber||p.orderId)}</span></div><div class="v24-order-product">${(p.items||[]).map(i=>`${esc(i.name)} × ${i.qty}`).join(' · ')||'SBC Service'}</div><div class="v24-meta"><span>🎨 ${(p.artwork||[]).length} files</span><span>👤 ${esc(p.assignedToName||'Unassigned')}</span></div>${p.blockedReason?`<div class="v24-blocked">⚠️ ${esc(p.blockedReason)}</div>`:''}<div class="v24-actions"><button class="btn small" onclick="v24Select('${esc(p.id)}','${esc(p.orderId)}')">Stage Artwork</button>${p.stage==='Staged'?`<button class="btn small primary" onclick="v24Move('${esc(p.id)}','Approved')">Approve</button>`:''}${p.stage==='Approved'?`<button class="btn small primary" onclick="v24Move('${esc(p.id)}','Processing')">Start</button>`:''}${p.stage==='Processing'?`<button class="btn small primary" onclick="v24Move('${esc(p.id)}','Fulfilled')">Fulfill</button>`:''}</div>${(p.artwork||[]).length?`<div class="v24-files">${p.artwork.map(a=>`<a href="/api/v24/production/artwork/${encodeURIComponent(a.id)}/content" target="_blank" rel="noopener">📎 ${esc(a.name)}</a>`).join('')}</div>`:''}</article>`}
  }
  window.v24Select=function(productionId,orderId){window.__v24Target={productionId,orderId};const t=document.getElementById('v24StageTarget');if(t)t.innerHTML=`Selected order <strong>${esc(orderId)}</strong> — drop a file above or choose one.`};
  window.v24Move=async function(id,stage){try{await get('/api/v24/production/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({stage})});toast('Production moved to '+stage);sbcV23View('production')}catch(e){toast(e.message)}};
  window.v24Upload=async function(file){const target=window.__v24Target;if(!target){toast('Select a production order first.');return}if(file.size>7*1024*1024){toast('File is over the 7 MB staging limit.');return}const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});try{await get('/api/v24/production/artwork',{method:'POST',body:JSON.stringify({orderId:target.orderId,name:file.name,mime:file.type,dataBase64:data,kind:'artwork'})});toast('Artwork staged');sbcV23View('production')}catch(e){toast(e.message)}};
  async function workforce(){const j=await get('/api/v23/workforce/activity');return shell('Workforce Monitor','SBC · TEAM OPERATIONS',`<div class="card section"><div class="card-head"><div><h2>Active team visibility</h2><div class="mini">Business-system activity only — no screen surveillance.</div></div></div><div class="card-body"><div class="table-wrap"><table class="table"><thead><tr><th>Team member</th><th>Role</th><th>Last activity</th><th>Last action</th></tr></thead><tbody>${j.rows.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.role)}</td><td>${x.lastActivity?new Date(x.lastActivity).toLocaleString():'No recent activity'}</td><td>${esc(x.lastAction)}</td></tr>`).join('')}</tbody></table></div></div></div>`,'<button class="btn" onclick="sbcV23View(\'home\')">← Overview</button>');}
  async function kim(){const j=cache||await get('/api/v23/overview');const k=j.kim||{};return shell('Kim AI Control','SBC · AI OPERATING MODES',`<div class="grid three section"><div class="card v23-mode"><div class="eyebrow">🟢 ROUTINE</div><h2>Standard</h2><p>Customer lookups, task creation, routine operations and simple diagnostics.</p><span class="badge green">COST CONTROLLED</span></div><div class="card v23-mode"><div class="eyebrow">🟡 ADVANCED</div><h2>Professional</h2><p>Deeper troubleshooting, workflow analysis and code investigation.</p><span class="badge orange">ESCALATION</span></div><div class="card v23-mode"><div class="eyebrow">🔴 DEEP SYSTEM</div><h2>Master Mechanic</h2><p>Reserved for difficult system problems and architecture-level work.</p><span class="badge red">PROTECTED</span></div></div><div class="card section"><div class="card-head"><div><h2>Provider status</h2><div class="mini">Kim must never invent a balance or expose credentials.</div></div></div><div class="card-body"><div class="grid three">${stat('PROVIDER',k.provider,'Configured source')}${stat('MASTER MODEL',k.masterModel,'Configured model name')}${stat('MASTER ACCESS',k.masterConfigured?'AVAILABLE':'NOT CONFIGURED','Server-side credential')}</div><div class="install-tip">💰 Billing access: ${esc(k.billingAccess)}. Automatic credit purchases remain disabled.</div></div></div>`,'<button class="btn primary" onclick="openSbcAI()">Ask Kim</button>');}
  async function automation(){const j=await get('/api/v23/workflows');return shell('Automation Builder','SBC · WHEN → IF → THEN',`<div class="card section"><div class="card-head"><div><h2>Workflow recipes</h2><div class="mini">Create reusable operational recipes. Execution remains gated until the underlying provider/event is actually configured.</div></div><button class="btn primary" onclick="sbcV23NewWorkflow()">+ New Workflow</button></div><div class="card-body">${(j.workflows||[]).map(w=>`<div class="list-card"><div><strong>${esc(w.name)}</strong><div class="meta">WHEN ${esc(w.trigger||'—')} → ${esc((w.actions||[]).join(' → ')||'No actions')}</div></div><span class="badge ${w.enabled?'green':'orange'}">${w.enabled?'ON':'OFF'}</span></div>`).join('')||'<div class="empty">No workflows yet. Create your first recipe.</div>'}</div></div><div class="grid three section"><div class="detail-box"><strong>💳 Payment automation</strong><p>Square payment success → order → fulfillment → customer onboarding.</p></div><div class="detail-box"><strong>📦 Fulfillment automation</strong><p>Approval → provider queue → status → tracking → customer notice.</p></div><div class="detail-box"><strong>🌐 Provisioning automation</strong><p>Approved demo → DNS staging → verification → live demo.</p></div></div>`,'<button class="btn" onclick="sbcV23View(\'integrations\')">Integration Health</button>');}
  window.sbcV23NewWorkflow=function(){openModal('New Automation Workflow',`<form id="v23WorkflowForm"><label>Workflow name<input name="name" required placeholder="Square payment → fulfillment"></label><label>Trigger<input name="trigger" required placeholder="payment.succeeded"></label><label>Actions<textarea name="actions" placeholder="Create order\nCreate fulfillment\nSend customer onboarding"></textarea></label><div class="actions"><button type="button" class="btn" onclick="closeModal()">Cancel</button><button class="btn primary">Save Workflow</button></div></form>`);q('#v23WorkflowForm').onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.target).entries());p.actions=String(p.actions||'').split('\n').map(x=>x.trim()).filter(Boolean);try{await get('/api/v23/workflows',{method:'POST',body:JSON.stringify(p)});closeModal();toast('Workflow saved');sbcV23View('automation')}catch(err){toast(err.message)}}};
  const views={home:expansionHome,production,integrations,alerts,leads,workforce,kim,automation};
  window.sbcV23View=async function(name){const fn=views[name]||expansionHome;state.view='v23-'+name;document.body.classList.remove('customer-mode');q('#viewEyebrow').textContent='SBC BUSINESS AUTOMATION';q('#viewTitle').textContent=name==='home'?'Automation Hub':name==='kim'?'Kim AI Control':name[0].toUpperCase()+name.slice(1);q('#content').innerHTML='<div class="card section"><div class="card-body">Loading SBC…</div></div>';try{q('#content').innerHTML=await fn();bindExceptionActions();if(name==='production'){const d=q('#v24Drop'),inp=q('#v24File');if(d){['dragenter','dragover'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.add('over')}));['dragleave','drop'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.remove('over')}));d.addEventListener('drop',e=>{const file=e.dataTransfer?.files?.[0];if(file)window.v24Upload(file)});}if(inp)inp.onchange=e=>{const file=e.target.files?.[0];if(file)window.v24Upload(file)}}}catch(e){q('#content').innerHTML=`<div class="card section"><div class="card-body">Unable to load SBC section: ${esc(e.message||e)}</div></div>`}};
  window.sbcV23InstallNav=function(){
    const nav=document.querySelector('.sidebar nav'); if(!nav||nav.querySelector('[data-v23nav]'))return;
    const group=document.createElement('div');group.className='v23-nav-group';group.innerHTML='<div class="v23-nav-label">SBC BUSINESS AUTOMATION</div>'+[['home','🚀 Automation Hub'],['production','🛠️ Order Pipeline'],['integrations','🔌 Integration Health'],['alerts','🚨 Exception Center'],['automation','⚡ Workflow Builder'],['leads','📊 Lead Intelligence'],['workforce','👥 Workforce Monitor'],['kim','🤖 Kim AI Control']].map(([id,label])=>`<button class="nav-item" data-v23nav="${id}">${label}</button>`).join('');nav.appendChild(group);group.querySelectorAll('[data-v23nav]').forEach(b=>b.onclick=()=>sbcV23View(b.dataset.v23nav));
  };
  window.addEventListener('DOMContentLoaded',()=>setTimeout(window.sbcV23InstallNav,50));
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v32-3-expansion.js", sbcBundleError);
}
/* END v32-3-expansion.js */
;
/* BEGIN v56-13-3-owner-workspace-fix.js */
try {
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
      // A grouped Dashboard button is not a direct nav child: use its direct-child ancestor.
      let anchor=home;while(anchor&&anchor.parentElement!==n)anchor=anchor.parentElement;
      if(!anchor)return;
      if(b.parentElement!==n || b.previousElementSibling!==anchor)n.insertBefore(b,anchor.nextSibling);
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
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v56-13-3-owner-workspace-fix.js", sbcBundleError);
}
/* END v56-13-3-owner-workspace-fix.js */
;
/* BEGIN architecture-cockpit.js */
try {
(function(){
const groups=[
['Protection & Ownership',['codeProtection','privateExecution','ipContracts','copyrightReadiness']],
['Intelligent Sales',['voiceUi','whatIfQuotes','semanticIngestion','brandExtraction','dynamicDomains']],
['Fulfillment Fabric',['parallelFulfillment','preflight','trackingSync','idempotency','eventPipelines']],
['SaaS Partitioning',['tenantIsolation','adapterFramework','tenantSharding','tenantProvisioning','zeroDowntime']],
['Resilience & Scale',['cqrs','statelessIdentity','encryptedProcessing','apm','backpressure']],
['Global Infrastructure',['anycast','microvms','shadowTraffic','ebpf','consensus']]
];
const labels={codeProtection:'Production code protection',privateExecution:'Private execution boundary',ipContracts:'IP assignment / NDA readiness',copyrightReadiness:'Copyright readiness',voiceUi:'Voice → UI context sync',whatIfQuotes:'Interactive What-If quotes',semanticIngestion:'Semantic lead ingestion',brandExtraction:'Visual brand extraction',dynamicDomains:'Dynamic domain routing',parallelFulfillment:'Parallel vendor fulfillment',preflight:'Print pre-flight diagnostics',trackingSync:'Shipping & tracking sync',idempotency:'Idempotent integration gates',eventPipelines:'Async event pipelines',tenantIsolation:'Tenant row isolation',adapterFramework:'Integration adapter framework',tenantSharding:'Tenant schema sharding',tenantProvisioning:'Tenant provisioning',zeroDowntime:'Zero-downtime schema upgrades',cqrs:'CQRS read/write separation',statelessIdentity:'JWT/JWKS identity',encryptedProcessing:'Encrypted processing readiness',apm:'Performance telemetry / APM',backpressure:'Reactive backpressure',anycast:'Global Anycast readiness',microvms:'Ephemeral worker micro-VMs',shadowTraffic:'Shadow traffic regression',ebpf:'eBPF observability readiness',consensus:'Distributed consensus readiness'};
window.architectureCockpit=async function(){let d;try{d=await fetch('/api/fortress/readiness').then(r=>r.json())}catch(e){d={status:{}}}
let ready=Object.values(d.status||{}).filter(Boolean).length,total=d.featureCount||30;
return `<div class="arch-cockpit"><div class="arch-hero"><div><div class="eyebrow">SBC INTELLIGENCE + FORTRESS</div><h2>Architecture Command Deck</h2><p>Advanced capabilities are organized by business function so the Command Center stays powerful without becoming cluttered.</p></div><div class="arch-score"><strong>${ready}/${total}</strong><span>ready / activated</span></div></div><div class="arch-toolbar"><span class="badge green">● Core protected</span><span class="badge orange">● Provider-gated</span><span class="mini">Unavailable external services stay dormant instead of crashing SBC.</span></div><div class="arch-grid">${groups.map(([title,keys])=>`<section class="arch-panel"><div class="arch-panel-head"><h3>${title}</h3><span>${keys.length}</span></div>${keys.map(k=>`<div class="arch-row"><div><strong>${labels[k]}</strong><small>${k}</small></div><span class="arch-status ${d.status?.[k]?'ready':'standby'}">${d.status?.[k]?'READY':'STANDBY'}</span></div>`).join('')}</section>`).join('')}</div><div class="arch-note"><strong>Kim's rule:</strong> diagnose automatically, prepare reversible actions automatically, and stop for Romeo on protected or irreversible operations.</div></div>`};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: architecture-cockpit.js", sbcBundleError);
}
/* END architecture-cockpit.js */
