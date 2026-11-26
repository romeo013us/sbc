/* SBC V66 gateway-control-rail · checked-in scripts retain startup order */
/* BEGIN gateway-hub.js */
try {
(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color=s=>s==='READY'?'green':s==='PARTIAL'?'orange':'blue';
  window.sbcRevenueChecksButton=function(){
    if(window.state?.me?.role!=='owner')return '';
    return '<div><button type="button" class="btn" onclick="sbcVerifyRevenueAccounts(this)">Check Square and Twilio</button><div data-check-results role="status" aria-live="polite"></div></div>';
  };
  window.sbcVerifyRevenueAccounts=async function(button){
    if(button.disabled)return;
    const output=button.parentElement.querySelector('[data-check-results]');
    button.disabled=true;output.textContent='Reading provider accounts…';
    try{
      const result=await api('/api/gateways/account-checks');
      if(result?.ok!==true||!Array.isArray(result.checks))throw Error();
      output.textContent=result.checks.map(x=>x.provider+' · '+x.scope+' ('+x.environment+') · '+x.status).join(' | ');
    }catch{output.textContent='Account checks unavailable.';}finally{button.disabled=false;}
  };
  window.gatewayHubView=async function(){
    let data; try{data=await api('/api/gateways/readiness')}catch(e){return `<div class="hero"><div><div class="eyebrow">INTEGRATION GATEWAY HUB</div><h2>Gateway control is temporarily unavailable.</h2><p>${esc(e.message||e)}</p></div></div>`}
    const rows=(data.gateways||[]).map(g=>`<div class="gateway-card"><div class="gateway-icon">${g.category==='Payments'?'💳':g.category==='Communications'?'☎️':g.category==='AI / Kim'?'👑':g.category==='Fulfillment'?'📦':g.category==='Identity'?'🔐':g.category==='Observability'?'📡':'🔌'}</div><div class="gateway-main"><div class="gateway-top"><div><strong>${esc(g.name)}</strong><div class="mini">${esc(g.category)}</div></div><span class="badge ${color(g.status)}">${g.status}</span></div><div class="gateway-url">${esc(g.url)}</div><div class="mini">${esc(g.detail||'Account access requires a provider check.')}${g.status==='PARTIAL'?' '+g.missing.map(esc).join(', '):''}</div></div></div>`).join('');
    return `<div class="hero world-hero"><div><div class="eyebrow">🌎 SBC WORLD-READY CONTROL PLANE</div><h2>One Command Center. Every Gateway.</h2><p>Connect payments, phones, domains, AI, fulfillment, identity, cache, workflows and observability without changing the SBC core.</p></div><div class="hero-actions"><button class="btn primary" onclick="gatewayHubRefresh()">↻ Refresh Status</button><button class="btn ghost" onclick="openSbcAI();askSbcAI('Review the SBC gateway readiness and tell me what is configured, what is missing, and what should be connected next. Do not invent credentials.')">👑 Ask Kim</button></div></div><div class="grid four section"><div class="stat"><div class="label">CONFIGURED</div><div class="value">${data.summary.configured}</div><div class="sub">Complete settings</div></div><div class="stat"><div class="label">PARTIAL</div><div class="value">${data.summary.partial}</div><div class="sub">Needs configuration</div></div><div class="stat"><div class="label">STANDBY</div><div class="value">${data.summary.standby}</div><div class="sub">Available when needed</div></div><div class="stat"><div class="label">GATEWAYS</div><div class="value">${data.gateways.length}</div><div class="sub">Provider-neutral adapters</div></div></div><div class="card section"><div class="card-head"><div><h2>Integration Gateway Hub</h2><div class="mini">No secrets are displayed here. Credentials belong in GoDaddy Secrets / environment configuration.</div></div><span class="badge blue">SAFE BY DEFAULT</span></div><div class="card-body">${window.sbcRevenueChecksButton()}<div class="gateway-grid">${rows}</div></div></div><div class="card section"><div class="card-head"><div><h2>Kim's Operating Rule</h2><div class="mini">Kim can diagnose readiness and propose actions. Protected financial, credential, refund and destructive operations remain owner-controlled.</div></div></div></div>`;
  };
  window.gatewayHubRefresh=function(){if(window.state){state.view='gateways';render();}};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: gateway-hub.js", sbcBundleError);
}
/* END gateway-hub.js */
;
/* BEGIN kim-operations-os.js */
try {
(function(){
  'use strict';
  const q=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function get(u,o){const r=await fetch(u,Object.assign({credentials:'same-origin',headers:{'Content-Type':'application/json'}},o||{}));const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
  function card(t,v,s){return `<div class="card"><div class="card-body"><div class="eyebrow">${esc(t)}</div><div style="font-size:28px;font-weight:800">${esc(v)}</div><div class="mini">${esc(s)}</div></div></div>`}
  const labels={research:'Lead research',sales:'Sales and account management',finance:'Finance',fulfillment:'Fulfillment',owner:'Owner clearance'};
  const decisions={VERIFY_WARM_HOT:'Verify warm and hot prospects',HUMAN_SALES_REVIEW:'Human sales review',CONTACT_RESTRICTION:'Contact restrictions',PAYMENT_RECONCILIATION:'Payment reconciliation',PAID_WITHOUT_JOB:'Paid orders without a job',OWNER_CLEARANCE:'Owner clearance'};
  function nvidiaView(n){
    const names={ACTUAL_SDK_TESTED:'Actual SDK tested',SDK_FIXTURE_PROTOCOL_TESTED:'Actual SDK / fixture protocol',FIXTURE_PROTOCOL_TESTED:'Fixture protocol tested',POLICY_ONLY:'Policy candidate tested',DOCUMENTED_ONLY:'Requirements documented',DRIVER_PROBE_FIXTURE_TESTED:'Driver probe fixture tested'};
    const ids=['relay','guardrails','aiq','nemoclaw','openshell','nemotron','retriever','riva','nim','cuda'];
    const bad='<p role="status">Integration evidence unavailable.</p>';
    if(!n||n.schema!==1||n.scope!=='RECORDED_DEVELOPMENT_EVIDENCE'||n.productionCertified!==false||n.activeProviders!==0||!Array.isArray(n.components)||n.components.length!==ids.length||new Set(n.components.map(c=>c?.id)).size!==ids.length)return bad;
    if(n.components.some(c=>!c||!ids.includes(c.id)||!Object.hasOwn(names,c.evidence)||c.production!=='NOT_VERIFIED'||typeof c.label!=='string'||typeof c.nextGate!=='string'||typeof c.reference!=='string'||!/^https:\/\/github\.com\/romeo013us\/sbc\/(actions\/runs|pull)\/[0-9]+$/.test(c.reference)))return bad;
    const tested=n.components.filter(c=>c.evidence==='ACTUAL_SDK_TESTED').length;
    return '<section class="kim-nvidia" aria-label="NVIDIA integration readiness"><style>.kim-nvidia{margin-top:24px;border-top:1px solid #31435a;padding-top:20px}.kim-nvidia h3{color:#fff;margin:4px 0 10px;font-size:21px}.kim-nvidia-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.kim-nvidia-item{border:1px solid #31435a;border-radius:14px;padding:14px;min-width:0;overflow-wrap:anywhere}.kim-nvidia-item h4{font-size:16px;margin:0 0 6px}.kim-nvidia-item a{display:inline-flex;align-items:center;min-height:44px;color:#f5b86b;text-decoration:underline}.kim-nvidia-item a:focus-visible{outline:3px solid #f5b86b;outline-offset:3px}.kim-nvidia-item p{font-size:13px}.kim-nvidia-item strong{color:#fff;font-size:13px}@media(max-width:700px){.kim-nvidia-grid{grid-template-columns:1fr}}</style><small>INTELLIGENCE FACTORY / DEVELOPMENT EVIDENCE</small><h3>NVIDIA integration readiness</h3><p><strong>No active NVIDIA providers.</strong> Production not verified. '+tested+' actual SDK acceptance milestones recorded. This is a source-controlled evidence register, not live service monitoring.</p><div class="kim-nvidia-grid">'+n.components.map(c=>'<article class="kim-nvidia-item"><h4>'+esc(c.label)+'</h4><strong>'+esc(names[c.evidence])+'</strong><p>'+esc(c.nextGate)+'</p><a href="'+esc(c.reference)+'" target="_blank" rel="noopener noreferrer">View development evidence</a></article>').join('')+'</div></section>';
  }
  function factoryView(f){
    if(!f||f.schema!==1||f.mode!=='DETERMINISTIC_ADVISORY'||!Array.isArray(f.agents)||f.agents.length!==9||f.providerCalls!==0||f.externalActions!==0)return '<p role="status">Intelligence Factory evidence unavailable.</p>';
    const states={EVIDENCE_REQUIRED:'Evidence required',REVIEW_REQUIRED:'Review required',NO_ITEMS_IN_SNAPSHOT:'No items observed'};
    return '<details><summary>SBC Intelligence Factory · 9 departmental roles</summary><p>Local advisory only. External model and speech inference are disabled. No provider calls in this computation.</p>'+f.agents.map(a=>'<article class="kim-plan-row"><div><h3>'+esc(a.label)+'</h3><p>'+esc(states[a.status]||'Evidence required')+'</p></div><strong>'+esc(Number.isSafeInteger(a.reviewCount)&&a.reviewCount>=0?a.reviewCount:'Unknown')+'</strong></article>').join('')+'<p>Recorded computation: '+esc(Number.isFinite(f.profile?.durationMs)?f.profile.durationMs.toFixed(1)+' ms':'Unavailable')+'. This is not an end-to-end agent performance benchmark.</p></details>';
  }
  function verificationView(plan,rows){
    const evidence=plan.leadVerificationReview,decision=rows.find(x=>x.department==='research'&&x.code==='VERIFY_WARM_HOT');
    const fields=[['needsVerification','Needs verification'],['explicitlyUnverified','Explicitly unverified'],['ownerReview','Owner review'],['missingStatus','Missing status'],['otherStatus','Other status']];
    const flags=[['nestedVerifiedConflict','Conflicting nested verification'],['missingContactMethod','Missing contact method']];
    const valid=n=>Number.isSafeInteger(n)&&n>=0;
    if(!evidence||!decision||!valid(evidence.total)||decision.count!==evidence.total||fields.some(([k])=>!valid(evidence[k]))||fields.reduce((n,[k])=>n+evidence[k],0)!==evidence.total||flags.some(([k])=>!valid(evidence[k])||evidence[k]>evidence.total))return '<p role="status">Verification breakdown unavailable. Review the existing Lead Research queue for current evidence.</p>';
    const item=([k,label])=>'<div class="kim-plan-row"><span>'+esc(label)+'</span><strong>'+esc(evidence[k])+'</strong></div>';
    return '<details'+(evidence.total>0?' open':'')+'><summary>Lead verification breakdown · '+esc(evidence.total)+' records</summary><p>Use the existing Lead Research and Account 360 review workflows. Do not mark leads verified without supporting evidence.</p>'+fields.map(item).join('')+'<p>Additional evidence flags may overlap the status groups above.</p>'+flags.map(item).join('')+'</details>';
  }
  function planView(plan){
    if(!plan||plan.schema!==1||plan.execution!=='ADVISORY_ONLY'||plan.scope!=='TENANT_CANONICAL_SNAPSHOT'||!Array.isArray(plan.departments))throw Error('Operating plan unavailable');
    const c=plan.commercial||{};
    if(!Number.isSafeInteger(c.recognizedRevenueCents)||c.recognizedRevenueCents<0||!Number.isSafeInteger(c.recognizedPaidOrders)||c.recognizedPaidOrders<0)throw Error('Operating plan unavailable');
    const rows=plan.departments.flatMap(d=>(Array.isArray(d.decisions)?d.decisions:[]).map(x=>({...x,department:d.id})));
    const review=rows.filter(x=>x.status==='REVIEW_REQUIRED'&&Number.isSafeInteger(x.count)&&x.count>0).sort((a,b)=>a.priority-b.priority);
    const unknown=rows.filter(x=>x.status==='EVIDENCE_REQUIRED'||x.count===null);
    const quiet=rows.filter(x=>x.status==='NO_ITEMS_IN_SNAPSHOT'&&x.count===0);
    const row=x=>'<article class="kim-plan-row"><div><small>'+esc(labels[x.department]||x.department)+'</small><h3>'+esc(decisions[x.code]||x.code)+'</h3><p>'+esc(x.action)+'</p></div><strong>'+esc(x.count===null?'Evidence required':x.count)+'</strong></article>';
    const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c.recognizedRevenueCents/100);
    return '<section class="kim-plan" aria-label="Department operating plan"><style>.kim-plan{border:1px solid #31435a;background:#0c1523;color:#edf3fa;border-radius:20px;padding:24px;margin-bottom:20px;font:14px/1.5 system-ui,sans-serif}.kim-plan *{box-sizing:border-box;min-width:0}.kim-plan h2{font-size:clamp(24px,3vw,34px);letter-spacing:-.035em;margin:4px 0;color:#fff}.kim-plan p{color:#a8b9cc;margin:5px 0}.kim-plan small{color:#f5b86b;font-weight:750;letter-spacing:.3px}.kim-plan-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;border-block:1px solid #31435a;padding:16px 0;margin:18px 0}.kim-plan-metrics div{display:flex;flex-direction:column;gap:5px}.kim-plan-metrics strong{font-size:clamp(19px,3vw,28px);font-variant-numeric:tabular-nums;color:#fff;overflow-wrap:anywhere}.kim-plan-metrics span{font-size:12px;color:#a8b9cc}.kim-plan-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid #31435a}.kim-plan-row h3{font-size:16px;color:#fff;margin:3px 0}.kim-plan-row strong{color:#f5b86b;text-align:right;flex-shrink:0;max-width:40%;overflow-wrap:anywhere}.kim-plan h4{color:#fff;font-size:13px;margin:18px 0 6px}.kim-plan details{margin-top:16px;color:#dbe7f3}.kim-plan summary{cursor:pointer;min-height:44px;padding:10px 0}.kim-plan summary:focus-visible{outline:3px solid #f5b86b;outline-offset:3px}@media(max-width:540px){.kim-plan{padding:14px}.kim-plan-metrics{grid-template-columns:1fr;gap:12px}.kim-plan-row{align-items:flex-start}.kim-plan-row strong{font-size:12px}}</style><small>KIM / EXECUTIVE INTELLIGENCE</small><h2>Department operating plan</h2><p>One tenant-scoped snapshot. Recommendations only; nothing has been executed.</p><div class="kim-plan-metrics"><div><span>Recorded captured revenue</span><strong>'+esc(money)+'</strong></div><div><span>Recorded paid orders</span><strong>'+esc(c.recognizedPaidOrders)+'</strong></div><div><span>Decision categories to review</span><strong>'+esc(review.length+unknown.length)+'</strong></div></div><p>'+esc(c.proof||'Recorded payment evidence, not independent bank settlement.')+'</p><h4>Prioritized departmental decisions</h4>'+(review.map(row).join('')||'<p>No positive review counts in this snapshot.</p>')+(unknown.length?'<h4>Evidence required</h4>'+unknown.map(row).join(''):'')+(quiet.length?'<details><summary>No items observed in '+quiet.length+' decision categories</summary>'+quiet.map(row).join('')+'</details>':'')+verificationView(plan,rows)+'<p>Fulfillment evidence: '+esc(plan.coverage?.fulfillment||'UNAVAILABLE')+'. Counts are snapshot observations, not authorization for outreach or spending.</p>'+factoryView(plan.intelligenceFactory)+nvidiaView(plan.intelligenceFactory?.nvidiaReadiness)+'</section>';
  }
  async function readPlan(){
    try{const j=await get('/api/v56135/kim-mission/operating-plan',{method:'GET',cache:'no-store'});if(j.ok!==true)throw Error('Unavailable');return planView(j.operatingPlan);}
    catch(_){return '<section class="card section" role="status"><div class="card-body"><h2>Operating plan unavailable</h2><p>Owner access or verified snapshot evidence is required. No recommendations or revenue amounts are inferred.</p></div></section>';}
  }
  window.sbcKimOperationsView=async function(){
    const plan=await readPlan();let j;try{j=await get('/api/kim/operations')}catch(_){return plan+'<p role="status">Existing production controls unavailable.</p>';}const p=j.production||{};
    const rows=(p.checklists||[]).slice(0,30).map(x=>`<tr><td><strong>${esc(x.orderId)}</strong></td><td>${esc(x.stage)}</td><td>${(x.checklist||[]).map(c=>`${c.done?'✅':'⬜'} ${esc(c.label)}`).join('<br>')}</td><td>${esc(x.route?.recommended||'internal')}</td></tr>`).join('');
    const ex=(p.exceptions||[]).map(x=>`<div class="list-card"><strong>${esc(x.severity)} · ${esc(x.type)}</strong><div>${esc(x.message)}</div><div class="mini">${esc(x.orderId)}</div></div>`).join('')||'<div class="empty">No production exceptions.</div>';
    return plan+`<details class="card section"><summary style="padding:16px;cursor:pointer;font-weight:700">Existing production controls</summary><div class="grid four">${card('STAGED',p.counts?.Staged||0,'Production intake')}${card('APPROVED',p.counts?.Approved||0,'Kim-approved queue')}${card('PROCESSING',p.counts?.Processing||0,'Active production')}${card('FULFILLED',p.counts?.Fulfilled||0,'Completed')}</div><div class="card section"><div class="card-head"><div><div class="eyebrow">🤖 KIM OPERATIONS CONTROL</div><h2>Production operations</h2><div class="mini">Existing routine production controls. Review verified state and permissions before executing an operation.</div></div><button class="btn primary" onclick="sbcKimRunOps()">▶ Run Kim Operations</button></div><div class="card-body"><div class="grid three">${card('LEADS',j.leadEngine?.total||0,'Active lead records')}${card('NEEDS REVIEW',j.leadEngine?.needsReview||0,'Lead verification queue')}${card('EXCEPTIONS',(p.exceptions||[]).length,'Production attention')}</div></div></div><div class="card section"><div class="card-head"><h2>🏭 Production Command Table</h2></div><div class="card-body"><div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Stage</th><th>Checklist</th><th>Route</th></tr></thead><tbody>${rows||'<tr><td colspan="4">No production records yet.</td></tr>'}</tbody></table></div></div></div><div class="card section"><div class="card-head"><h2>🚨 Kim Exception Queue</h2></div><div class="card-body">${ex}</div></div></details>`;
  };
  window.sbcKimRunOps=async function(){try{await get('/api/kim/operations/run',{method:'POST',body:'{}'});toast('Kim operations cycle completed');if(window.state)state.view='kimops';if(window.render)render();else if(window.sbcKimOperationsView)q('#content').innerHTML=await window.sbcKimOperationsView()}catch(e){toast(e.message)}};
  window.sbcInstallKimOpsNav=function(){const nav=document.querySelector('.sidebar nav');if(!nav||nav.querySelector('[data-kimops]'))return;const b=document.createElement('button');b.className='nav-item';b.dataset.kimops='1';b.textContent='🤖 Kim Operations OS';b.onclick=()=>{state.view='kimops';document.querySelector('#viewEyebrow').textContent='AI OPERATIONS';document.querySelector('#viewTitle').textContent='Kim Operations OS';window.sbcKimOperationsView().then(h=>document.querySelector('#content').innerHTML=h)};nav.appendChild(b)};
  addEventListener('DOMContentLoaded',()=>setTimeout(window.sbcInstallKimOpsNav,80));
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: kim-operations-os.js", sbcBundleError);
}
/* END kim-operations-os.js */
;
/* BEGIN v32-5-control-plane.js */
try {
(function(){'use strict';
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
async function api5(u,o){const r=await fetch(u,Object.assign({credentials:'same-origin',headers:{'Content-Type':'application/json'}},o||{}));const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
window.sbcV325ControlView=async function(){
  const me=window.state?.me||{}; const sec=await api5('/api/kim/security').catch(()=>({capabilities:{}}));
  const canSubmit=['owner','manager','lead_researcher','kim_operator','system'].includes(me.role);
  return `<div class="card section"><div class="card-head"><div><div class="eyebrow">V32.5 CONTROL PLANE</div><h2>🤖 Kim + Workforce Security</h2><div class="mini">Capability-based access. Kim operates the business; workforce accounts receive only the tools required for their role.</div></div></div><div class="card-body"><div class="grid three"><div class="list-card"><strong>Kim Operations</strong><div>Operational capabilities: ${Object.values(sec.capabilities||{}).filter(Boolean).length}</div></div><div class="list-card"><strong>Your Role</strong><div>${esc(me.role||'unknown')}</div></div><div class="list-card"><strong>Protected</strong><div>Secrets · pricing · refunds · destructive infrastructure</div></div></div></div></div><div class="card section"><div class="card-head"><h2>👩🏾‍💻 Lead Research Workspace</h2></div><div class="card-body"><p class="mini">Authorized research staff submit prospect records to Kim. They do not receive financial, security, credential or infrastructure access.</p>${canSubmit?`<form id="sbcLeadSubmit"><div class="grid two"><input class="input" name="businessName" placeholder="Business name" required><input class="input" name="contactName" placeholder="Contact name"><input class="input" name="phone" placeholder="Phone"><input class="input" name="email" placeholder="Email"><input class="input" name="website" placeholder="Website"><input class="input" name="industry" placeholder="Industry"><input class="input" name="city" placeholder="City"><textarea class="input" name="notes" placeholder="Research notes"></textarea></div><button class="btn primary" type="submit">📥 Submit Lead to Kim</button></form>`:'<div class="empty">Lead submission is restricted to authorized research roles.</div>'}</div></div><div class="card section"><div class="card-head"><h2>📥 Recent Leads Sent to Kim</h2></div><div class="card-body" id="sbcKimLeadInbox">Loading…</div></div>`;
};
window.sbcBindV325=function(){const f=document.querySelector('#sbcLeadSubmit');if(f)f.onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(f).entries());try{await api5('/api/kim/lead-submissions',{method:'POST',body:JSON.stringify(body)});f.reset();toast('Lead submitted to Kim');await sbcLoadKimInbox()}catch(x){toast(x.message)}};sbcLoadKimInbox()};
window.sbcLoadKimInbox=async function(){const el=document.querySelector('#sbcKimLeadInbox');if(!el)return;try{const j=await api5('/api/kim/lead-submissions');el.innerHTML=(j.submissions||[]).slice(0,20).map(x=>`<div class="list-card"><strong>${esc(x.payload?.businessName||'Lead')}</strong><div>${esc(x.status)} · ${esc(x.submitted_by_name||x.submittedByName||'')}</div><div class="mini">${esc(x.payload?.phone||'')} ${esc(x.payload?.email||'')}</div></div>`).join('')||'<div class="empty">No submissions yet.</div>'}catch(e){el.innerHTML='<div class="empty">Lead inbox unavailable for this role.</div>'}};
window.sbcInstallV325Nav=function(){const nav=document.querySelector('.sidebar nav');if(!nav||nav.querySelector('[data-v325]'))return;const b=document.createElement('button');b.className='nav-item';b.dataset.v325='1';b.textContent='🔐 Kim Control + Workforce';b.onclick=()=>{state.view='v325control';document.querySelector('#viewEyebrow').textContent='SECURITY / WORKFORCE';document.querySelector('#viewTitle').textContent='Kim Control + Workforce';sbcV325ControlView().then(h=>{document.querySelector('#content').innerHTML=h;sbcBindV325()})};nav.appendChild(b)};
addEventListener('sbc:authenticated',()=>{try{window.sbcLoadKimInbox?.()}catch{}});addEventListener('DOMContentLoaded',()=>setTimeout(window.sbcInstallV325Nav,120));
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v32-5-control-plane.js", sbcBundleError);
}
/* END v32-5-control-plane.js */
;
/* BEGIN v32-9-enterprise.js */
try {
(function(){
  'use strict';
  async function get(path){if(typeof window.api==='function')return window.api(path,{timeoutMs:15000});const r=await fetch(path,{credentials:'include'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);return d;}
  function mount(){
    if(document.getElementById('sbcV329Panel'))return;
    const el=document.createElement('section');el.id='sbcV329Panel';el.style.cssText='margin:18px 0;padding:18px;border:1px solid rgba(11,116,209,.25);border-radius:16px;background:linear-gradient(135deg,rgba(11,116,209,.08),rgba(255,255,255,.92));box-shadow:0 8px 28px rgba(0,0,0,.08)';
    el.innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><div style="font-size:18px;font-weight:800">👑 KIM Enterprise Control Fabric <span style="font-size:12px;opacity:.7">SBC OS V65.1.23 · Capabilities 101–150</span></div><div style="opacity:.75;margin-top:4px">Provider controls • lead mesh • sales continuity • communications • document integrity • worker reliability</div></div><div style="display:flex;gap:8px"><button id="sbcV329Refresh" class="btn">Refresh</button><button id="sbcV329Verify" class="btn primary">Sync CRM Lead Queue</button></div></div><div id="sbcV329Stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-top:14px"></div><div id="sbcV329Msg" style="margin-top:10px;font-size:13px;opacity:.75"></div>';
    const host=document.querySelector('main')||document.querySelector('#app')||document.body;host.appendChild(el);
    async function refresh(){const msg=document.getElementById('sbcV329Msg');try{const x=await get('/api/kim/v329/summary');const cards=[['Capabilities',x.capabilities],['Lead batches',x.leadBatches],['Leads',x.leads],['Verify queue',x.verificationQueue],['Opportunities',x.opportunities],['Audit entries',x.auditEntries]];document.getElementById('sbcV329Stats').innerHTML=cards.map(([k,v])=>`<div style="padding:12px;border-radius:12px;background:#fff;border:1px solid rgba(0,0,0,.08)"><div style="font-size:12px;opacity:.65">${k}</div><strong style="font-size:22px">${v}</strong></div>`).join('');// SBC_V6522_API_STABILIZATION: unknown counts must never be rendered as real zeroes.
      const leadState=x.canonicalLeadMesh||{};
      msg.textContent=leadState.dataStatus==='UNAVAILABLE_TIMEOUT'||x.degraded?'CRM/Lead Mesh status unavailable: the data query timed out. Counts are unknown; no data was changed.':`CRM lead mesh connected: ${Number.isFinite(leadState.activeSalesLeads)?leadState.activeSalesLeads:'unknown'} active sales leads · ${Number.isFinite(leadState.verificationQueue)?leadState.verificationQueue:'unknown'} awaiting verification.`;}catch(e){const detail=String(e?.message||e||'Unknown error');const auth=/authentication required|unauthorized|forbidden|http 401|http 403|session.*(missing|expired)/i.test(detail);const recovery=/recovery|required|423|blocked|read.only/i.test(detail);msg.textContent=auth?'Sign in with an authorized SBC workforce account to load the Enterprise Control Fabric.':recovery?`RECOVERY LOCK ACTIVE: Enterprise status could not be loaded safely. ${detail}`:`Enterprise status request failed: ${detail}`;}}
    document.getElementById('sbcV329Refresh').onclick=refresh;
    document.getElementById('sbcV329Verify').onclick=async()=>{
      const msg=document.getElementById('sbcV329Msg');
      try{
        const summary=typeof window.api==='function'?await window.api('/api/kim/v329/summary'):await (async()=>{const x=await fetch('/api/kim/v329/summary',{credentials:'include'});return x.json()})();
        if(summary?.canonicalLeadMesh?.readOnlyRecoveryProjection){
          const preserved=Number(summary?.canonicalLeadMesh?.preservedLeadMeshCandidates||summary?.canonicalLeadMesh?.records||0);
          msg.textContent=`RECOVERY LOCK ACTIVE: ${preserved} preserved lead-mesh candidates remain read-only. No records were promoted. Reconcile the authoritative pre-corruption backup before any CRM restore.`;
          return;
        }
        if(summary?.recoveryRequired){
          msg.textContent='RECOVERY LOCK ACTIVE: lead-queue synchronization is disabled until authoritative MySQL recovery is verified. No records were changed.';
          return;
        }
        const j=typeof window.api==='function'?await window.api('/api/kim/v329/leads/verify',{method:'POST',body:JSON.stringify({limit:50}),timeoutMs:30000}):await (async()=>{const x=await fetch('/api/kim/v329/leads/verify',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({limit:50})});const raw=await x.text();let d=null;try{d=JSON.parse(raw)}catch{}if(!x.ok)throw new Error(d?.message||d?.error||`HTTP ${x.status}`);if(!d)throw new Error('Lead verification returned non-JSON content.');return d;})();
        msg.textContent=j.ok?`CRM lead queue synced: ${j.synced||0} active sales leads · ${j.alreadyVerified||0} verified/Sales Ready · ${j.requiresReview||0} still need verification.`:(j.error||'Lead queue sync failed.');
        await refresh();
      }catch(e){msg.textContent=e.message||String(e);}
    };
    if(window.state?.me)refresh();
    else window.addEventListener('sbc:authenticated',()=>setTimeout(refresh,80),{once:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v32-9-enterprise.js", sbcBundleError);
}
/* END v32-9-enterprise.js */
;
/* BEGIN v33-0-launch-acquisition.js */
try {
(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  async function j(url,opt={}){if(typeof window.api==='function')return window.api(url,{...opt,timeoutMs:opt.timeoutMs||15000});const r=await fetch(url,{credentials:'include',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d}
  function mount(){if(document.getElementById('sbcV330Panel'))return;const el=document.createElement('section');el.id='sbcV330Panel';el.className='sbc-v330-panel';el.innerHTML=`<div class="sbc-v330-head"><div><div class="sbc-v330-kicker">LAUNCH & CUSTOMER ACQUISITION OS · SBC OS V65.1.23</div><h2>🚀 Build the customer experience before the customer buys</h2><p>Kim prepares isolated demos and setup; Authorized sales staff handle reviewed outreach; Lorna builds focused target segments.</p></div><button id="sbcV330Refresh">Refresh</button></div><div id="sbcV330Setup"></div><div class="sbc-v330-grid"><div class="sbc-v330-card"><h3>🎯 Target Accounts</h3><div id="sbcV330Accounts">Loading…</div></div><div class="sbc-v330-card"><h3>🏗️ Concierge Demos</h3><div id="sbcV330Demos">Loading…</div></div><div class="sbc-v330-card"><h3>🧪 Trials & Migration</h3><div id="sbcV330Trials">Loading…</div></div></div>`;const root=document.querySelector('main')||document.body;root.appendChild(el);document.getElementById('sbcV330Refresh').onclick=load;load()}
  async function load(){if(!window.state?.me){return;}try{const d=await j('/api/kim/v330/summary');const s=d.setup;document.getElementById('sbcV330Setup').innerHTML=(d.recoveryRequired?'<div class="sbc-v330-error"><strong>RECOVERY LOCK ACTIVE · READ ONLY</strong><div>Setup status and existing acquisition records can be viewed. MySQL-backed mutations and background work remain paused until authoritative recovery is verified.</div></div>':'')+`<div class="sbc-v330-progress"><strong>⚙️ Customer Acquisition Setup Checklist</strong><span>${s.complete}/${s.total} confirmed in this module</span><div class="bar"><i style="width:${s.percent}%"></i></div><small>${s.pending} pending review · ${s.blocked} blocked · Not an overall production-health score</small></div>`;document.getElementById('sbcV330Accounts').innerHTML=d.accounts.length?d.accounts.slice(-8).reverse().map(a=>`<div class="row"><b>${esc(a.businessName)}</b><span>${esc(a.status)}</span></div>`).join(''):'No target accounts yet.';document.getElementById('sbcV330Demos').innerHTML=d.demos.length?d.demos.slice(-8).reverse().map(x=>`<div class="row"><b>${esc(x.businessName)}</b><span>${esc(x.status)}</span></div>`).join(''):'No demos yet.';document.getElementById('sbcV330Trials').innerHTML=`<div class="metric"><b>${d.metrics.trials}</b> active/created trials</div><div class="metric"><b>${d.metrics.migrations}</b> migrations</div><div class="metric"><b>${d.metrics.customers}</b> converted customers</div>`}catch(e){const el=document.getElementById('sbcV330Panel');if(el){const m=String(e?.message||e);const auth=/Authentication required|session|expired|missing/i.test(m);el.innerHTML+=`<div class="sbc-v330-error"><strong>${auth?'🔐 Sign-in required':'⚠️ Acquisition service unavailable'}</strong><div>${esc(auth?'Your SBC session is missing or expired. Sign in again, then press Refresh.':m)}</div>${auth?'<button id="sbcV330Login" class="btn primary" type="button">Sign In</button>':''}</div>`;document.getElementById('sbcV330Login')?.addEventListener('click',()=>{if(typeof sbcShowLogin==='function')sbcShowLogin('Sign in to load Customer Acquisition.');});}}}
  window.addEventListener('sbc:authenticated',()=>setTimeout(load,80));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();window.SBC_V330={refresh:load};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v33-0-launch-acquisition.js", sbcBundleError);
}
/* END v33-0-launch-acquisition.js */
