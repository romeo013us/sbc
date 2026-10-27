(function(){
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  async function safeJsonResponse(r,u){const t=await r.text();let j;try{j=JSON.parse(t)}catch(e){throw new Error('Non-JSON response from '+u+' (HTTP '+r.status+')')};if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j} async function get(u){return window.api?window.api(u):fetch(u).then(r=>safeJsonResponse(r,u))}
  async function post(u,b){return window.api?window.api(u,{method:'POST',body:JSON.stringify(b||{})}):fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})}).then(r=>safeJsonResponse(r,u))}
  function stat(label,value,sub){return `<div class="stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div><div class="sub">${esc(sub||'')}</div></div>`}
  // SBC_V6647_MASTER_INTERACTION_AUDIT: never leave an owner-facing revenue action silent.
  let sbcRevenueVerifyInFlight=false, sbcRevenueRefreshSequence=0;
  function sbcRevenueActionStatus(message,kind){
    const el=document.getElementById('f4RevenueActionStatus')||document.getElementById('sbcGuardianProductionStatus');
    if(el){el.textContent=message;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.dataset.actionState=kind||'info';}
    return message;
  }
  // Alert only when a simple inline onclick points to a missing global function.
  // The capture listener does not issue requests or change valid handlers.
  if(!window.__sbcV6647InlineClickGuard){
    window.__sbcV6647InlineClickGuard=true;
    document.addEventListener('click',function(event){
      const target=event.target&&event.target.closest&&event.target.closest('button[onclick],a[onclick],[role=button][onclick]');
      if(!target)return;
      const expression=String(target.getAttribute('onclick')||'').trim();
      const simple=expression.match(/^(?:return\s+)?(?:window\.)?([A-Za-z_$][\w$]*)\s*(?:\?\.)?\s*\(/);
      if(!simple)return;
      const name=simple[1];
      if(['alert','confirm','prompt','setTimeout','setInterval'].includes(name))return;
      if(typeof window[name]==='function')return;
      event.preventDefault();event.stopImmediatePropagation();
      const title=String(target.textContent||target.getAttribute('aria-label')||'This control').trim().slice(0,100);
      alert(title+' is unavailable (missing controller: '+name+'). No action was performed. Reload the workspace.');
    },true);
  }
  function sbcRevenueVerificationButton(disabled){
    const b=document.querySelector('[data-sbc-action="revenue-verify"]');
    if(b){b.disabled=Boolean(disabled);b.setAttribute('aria-busy',disabled?'true':'false');}
  }
  async function render(){
    const results=await Promise.allSettled([get('/api/fantastic4/summary'),get('/api/fantastic4/alerts'),get('/api/fantastic4/blueprints'),get('/api/fantastic4/dry-runs'),get('/api/fantastic4/architecture'),get('/api/fantastic4/autonomous/summary')]); const val=(i,f)=>results[i]?.status==='fulfilled'?results[i].value:f; const s=val(0,{providerGates:{},counts:{}}),a=val(1,{alerts:[]}),b=val(2,{blueprints:[]}),d=val(3,{dryRuns:[]}),c=val(4,{architecture:{}}),ao=val(5,{paused:true,mode:'GUARDED',metrics:{},exceptions:[]});
    const p=s.providerGates||{};
    const am=ao.metrics||{};
    const autoOn=!ao.paused; const productionControl=`<section class="card f4-production-control" style="border:2px solid ${autoOn?'#16a34a':'#f59e0b'};margin-bottom:18px;"><div class="card-head"><h2>🚦 PRODUCTION CONTROL</h2><span class="badge ${autoOn?'green':'orange'}">${autoOn?'🟢 PRODUCTION RUNNING':'🟠 PRODUCTION PAUSED'}</span></div><div class="card-body"><p><strong>This is your owner Start/Stop switch for routine autonomous production operations.</strong> Turning production OFF pauses autonomous jobs. Payments, inbound webhooks, and protected owner controls remain independently available.</p><div class="f4-actions"><button class="btn ${autoOn?'danger':'primary'}" onclick="f4ProductionToggle()">${autoOn?'🛑 STOP PRODUCTION':'🚀 START PRODUCTION'}</button><button class="btn primary" onclick="f4AutoSweep()" ${autoOn?'':'disabled'}>▶️ PLAY — WORK REAL LEADS</button><button class="btn" onclick="f4AutoMode()">⚙️ AI MODE</button></div></div></section>`; const revenueControl=`<section class="card f4-revenue-control" style="border:2px solid #2563eb;margin-bottom:18px;"><div class="card-head"><div><h2>💰 REVENUE PLAY</h2><div class="mini">Owner-controlled sales execution. Leads are automatically checked before they enter the revenue queue.</div></div><span id="f4RevenueStatusBadge" class="badge blue">CHECKING…</span></div><div class="card-body"><div id="f4RevenueStatus" class="grid stats"><div class="stat"><div class="label">ELIGIBLE LEADS</div><div class="value">—</div><div class="sub">Sales Ready + Warm/Hot</div></div><div class="stat"><div class="label">NEEDS VERIFICATION</div><div class="value">—</div><div class="sub">Warm/Hot records awaiting checks</div></div><div class="stat"><div class="label">PLAY BATCH</div><div class="value">10</div><div class="sub">Hard cap: 20</div></div></div><div class="f4-actions" style="margin-top:14px;"><button class="btn" data-sbc-action="revenue-verify" onclick="f4RevenueVerify()">🔎 VERIFY WARM/HOT LEADS</button><button class="btn primary" onclick="f4RevenuePlay()" ${autoOn?'':'disabled'}>▶️ PLAY — WORK 10 REAL LEADS</button><button class="btn" onclick="f4RevenueRefresh()">↻ CHECK REVENUE STATUS</button></div><div class="mini" style="margin-top:10px;">Verification checks the CRM record and contact infrastructure. It does not claim mailbox or identity ownership. Revenue PLAY never bypasses verification.</div><div id="f4RevenueActionStatus" role="status" aria-live="polite" class="install-tip" style="margin-top:10px">Use Verify or Check Revenue Status to see an action result.</div></div></section>`; const autonomousBanner=productionControl+revenueControl+`<section class="card f4-autonomous"><div class="card-head"><h2>🤖 Autonomous Operations Engine</h2><span class="badge ${autoOn?'green':'orange'}">${autoOn?'🟢 ON':'🔴 OFF'} · ${esc(ao.mode||'GUARDED')}</span></div><div class="card-body"><p><strong>Automation master switch:</strong> controls autonomous work only. Payments/webhooks, owner controls and protected actions remain independently gated.</p><div class="grid stats">${stat('Completed',am.completed||0,'Autonomous actions')}${stat('Escalated',am.escalated||0,'Human attention')}${stat('Queued',am.queued||0,'Pending automation')}${stat('Exceptions',(ao.exceptions||[]).length,'Open exceptions')}</div><div class="f4-actions"><button class="btn ${autoOn?'danger':'primary'}" onclick="f4AutoToggle()">${autoOn?'🛑 TURN AUTOMATION OFF':'🚀 TURN AUTOMATION ON'}</button><button class="btn primary" onclick="f4AutoSweep()" ${autoOn?'':'disabled'}>▶️ PLAY — WORK REAL LEADS</button><button class="btn" onclick="f4AutoMode()">⚙️ Change AI Mode</button></div></div></section>`;
    return autonomousBanner+`<div class="f4-hero"><div><div class="eyebrow">FANTASTIC 4 · CUSTOMER #1 PRODUCTION</div><h2>🚀 Build it. Run it. Grow it. Fulfill it.</h2><p>One control surface for demo provisioning, secure handoffs, WordPress fulfillment, QA, asset sync, panic alerts and customer approval.</p></div><div class="f4-actions"><button class="btn primary" onclick="f4DryRun()">🧪 Run Full Dry Run</button><button class="btn orange" onclick="f4Demo()">⚡ One-Click Demo</button><button class="btn" onclick="f4Architecture()">🧬 Architecture</button></div></div>
    <div class="grid stats">${stat('Provider Gates',Object.values(p).filter(Boolean).length+'/4',Object.entries(p).map(([k,v])=>`${k}: ${v?'READY':'WAITING'}`).join(' · '))}${stat('Dry Runs',d.dryRuns?.length||0,'Simulation history')}${stat('Open Alerts',a.alerts?.filter(x=>x.status==='OPEN').length||0,'Panic Mode queue')}${stat('Demo Builds',s.counts?.demoRuns||0,'Local demo artifacts')}</div>
    <div class="f4-grid">
      <section class="card"><div class="card-head"><h2>🛠️ Live Launch Controls</h2><span class="badge blue">SAFE UNTIL CONFIGURED</span></div><div class="card-body"><div class="f4-control"><strong>One-Click Demo Provisioner</strong><span>Creates a branded demo/staging manifest in seconds. Live WordPress creation stays provider-gated.</span><button class="btn small" onclick="f4Demo()">Create Demo</button></div><div class="f4-control"><strong>Ephemeral Admin Handoff</strong><span>One-use, 15-minute cryptographic handoff token. Never stores plaintext passwords.</span><button class="btn small" onclick="f4Handoff()">Generate Handoff</button></div><div class="f4-control"><strong>Day-Zero Asset Sync</strong><span>Attach logo, brand colors and copy brief to the fulfillment record.</span><button class="btn small" onclick="f4Assets()">Sync Assets</button></div><div class="f4-control"><strong>Panic Mode</strong><span>Creates an auditable high-priority delivery alert for Kim/team intervention.</span><button class="btn small danger" onclick="f4Panic()">Raise Alert</button></div></div></section>
      <section class="card"><div class="card-head"><h2>✅ Customer QA Gate</h2><span class="badge green">PORTAL READY</span></div><div class="card-body"><p>Interactive QA is generated per order: layout, forms, links, assets, SSL, SEO, accessibility, performance and customer approval.</p><button class="btn primary" onclick="f4QA()">Create QA Checklist</button><button class="btn" onclick="f4Approval()">Capture Approval</button></div></section>
    </div>
    <div class="f4-grid"><section class="card"><div class="card-head"><h2>🧩 WordPress Blueprints</h2><span class="badge orange">REUSABLE</span></div><div class="card-body"><div class="f4-blueprints">${(b.blueprints||[]).map(x=>`<div class="f4-blueprint"><strong>${esc(x.name)}</strong><div>${(x.pages||[]).map(esc).join(' · ')}</div><small>${(x.features||[]).map(esc).join(' · ')}</small></div>`).join('')}</div><button class="btn small" onclick="f4Blueprint()">Add Blueprint</button></div></section>
      <section class="card"><div class="card-head"><h2>⚡ Edge / Cache Preset</h2><span class="badge blue">SAFE PRESET</span></div><div class="card-body"><p>Application-safe caching headers and asset policy are prepared. CDN/reverse-proxy activation remains provider-gated.</p><button class="btn" onclick="f4Cache()">Install Safe Cache Profile</button></div></section></div>
    <section class="card"><div class="card-head"><h2>🚨 Panic Mode / Kim Queue</h2><span class="badge ${a.alerts?.some(x=>x.status==='OPEN')?'orange':'green'}">${a.alerts?.filter(x=>x.status==='OPEN').length||0} OPEN</span></div><div class="card-body"><div class="table-wrap"><table class="table"><thead><tr><th>Severity</th><th>Type</th><th>Message</th><th>Order</th><th>Status</th></tr></thead><tbody>${(a.alerts||[]).slice(0,12).map(x=>`<tr><td>${esc(x.severity)}</td><td>${esc(x.type)}</td><td>${esc(x.message)}</td><td>${esc(x.orderId||'—')}</td><td>${esc(x.status)}</td></tr>`).join('')||'<tr><td colspan="5">No alerts.</td></tr>'}</tbody></table></div></div></section>
    <section class="card"><div class="card-head"><h2>🧪 Dry Run Results</h2><span class="badge green">SIMULATION ONLY</span></div><div class="card-body">${(d.dryRuns||[]).slice(0,5).map(x=>`<div class="f4-run"><strong>${esc(x.id)}</strong><span>${esc(x.status)}</span><small>${(x.steps||[]).length} steps · ${esc(x.note)}</small></div>`).join('')||'<div class="mini">No dry runs yet.</div>'}</div></section>`;
  }
  window.fantastic4LaunchView=render;
  setTimeout(()=>f4RevenueRefresh(),0);
  window.f4DryRun=async()=>{try{const r=await post('/api/fantastic4/dry-run',{orderId:'CUSTOMER-1-DRY-RUN'});alert('Dry run '+r.dryRun.status+' — '+r.dryRun.steps.length+' steps.');if(window.render)window.render()}catch(e){alert(e.message)}};
  window.f4Demo=async()=>{const name=prompt('Demo business name','Customer 1 Demo');if(!name)return;try{const r=await post('/api/fantastic4/demo-provision',{businessName:name,blueprint:'local_service'});alert('Demo ready: '+r.demo.stagingUrl+'\n\n'+r.demo.note);if(window.render)window.render()}catch(e){alert(e.message)}};
  window.f4Handoff=async()=>{const order=prompt('Order ID','CUSTOMER-1');if(!order)return;try{const r=await post('/api/fantastic4/handoff',{orderId:order});alert('Ephemeral handoff created. Expires: '+r.handoff.expiresAt+'\nToken is available only in this response.');}catch(e){alert(e.message)}};
  window.f4Assets=async()=>{const order=prompt('Order ID','CUSTOMER-1');if(!order)return;const business=prompt('Business name','Customer 1 Business')||'';try{await post('/api/fantastic4/assets/sync',{orderId:order,businessName:business,brandColors:['#0066cc','#f59e0b'],copyBrief:'Customer #1 brand/website intake'});alert('Day-Zero asset sync record created.')}catch(e){alert(e.message)}};
  window.f4Panic=async()=>{const msg=prompt('Describe the delivery problem','Provider delivery failure requires review');if(!msg)return;try{await post('/api/fantastic4/panic',{severity:'HIGH',type:'delivery',message:msg});alert('Panic Mode alert created for Kim/team.');if(window.render)window.render()}catch(e){alert(e.message)}};
  window.f4QA=async()=>{const order=prompt('Order ID','CUSTOMER-1');if(!order)return;try{const r=await post('/api/fantastic4/qa',{orderId:order});alert('QA checklist created with '+r.qa.items.length+' checks.');}catch(e){alert(e.message)}};
  window.f4Approval=async()=>{const order=prompt('Order ID','CUSTOMER-1');if(!order)return;try{const r=await post('/api/fantastic4/approval',{orderId:order,approved:true,approvedBy:'Owner',notes:'Customer approval captured'});alert('Approval recorded: '+r.approval.status);}catch(e){alert(e.message)}};
  window.f4Blueprint=async()=>{const key=prompt('Blueprint key','medical_local');if(!key)return;try{const r=await post('/api/fantastic4/blueprints',{key,name:'Custom '+key,pages:['Home','Services','About','Contact'],features:['Lead form','Booking CTA','Reviews','FAQ']});alert('Blueprint added: '+r.blueprint.name);if(window.render)window.render()}catch(e){alert(e.message)}};
  window.f4Cache=async()=>{try{const r=await post('/api/fantastic4/cache',{name:'WordPress Launch Safe Default'});alert('Safe cache profile installed: '+r.profile.id);}catch(e){alert(e.message)}};
  window.f4ProductionToggle=async()=>{try{const s=await get('/api/fantastic4/autonomous/toggle');const next=!s.enabled;const action=next?'START PRODUCTION':'STOP PRODUCTION';const warning=next?'Start routine autonomous production operations now? This does not bypass payment, credential, refund, security, destructive, or other protected owner controls.':'Stop routine autonomous production operations now? Inbound payments and webhooks remain available, but autonomous jobs will pause.';if(!confirm('🚦 '+action+'?\n\n'+warning))return;const r=await post('/api/fantastic4/autonomous/toggle',{enabled:next});alert(r.enabled?'🚀 PRODUCTION IS RUNNING.':'🛑 PRODUCTION IS PAUSED.');if(window.render)window.render()}catch(e){alert('Production control failed: '+e.message)}};
  async function f4RevenueRefresh(options){
    const automatic=options&&options.automatic===true;
    const seq=++sbcRevenueRefreshSequence;
    if(!automatic)sbcRevenueActionStatus('Checking current revenue eligibility…','busy');
    try{
      const r=await get('/api/fantastic4/revenue/status');
      if(!r||r.ok===false)throw Error(r?.error||'Revenue status was not available.');
      if(seq!==sbcRevenueRefreshSequence)return r;
      const breakdown=r.eligibilityBreakdown||{};
      const el=document.getElementById('f4RevenueStatus');
      const badge=document.getElementById('f4RevenueStatusBadge');
      if(el)el.innerHTML=`<div class="stat"><div class="label">ACTIONABLE LEADS</div><div class="value">${esc(breakdown.actionable??r.eligibleLeads??0)}</div><div class="sub">Email + consented SMS + human call</div></div><div class="stat"><div class="label">EMAIL READY</div><div class="value">${esc(breakdown.emailReady??0)}</div><div class="sub">Automated email path</div></div><div class="stat"><div class="label">SMS READY</div><div class="value">${esc(breakdown.smsReady??0)}</div><div class="sub">Recorded consent required</div></div><div class="stat"><div class="label">HUMAN CALL READY</div><div class="value">${esc(breakdown.humanCallReady??0)}</div><div class="sub">Creates caller task; no auto-call</div></div><div class="stat"><div class="label">NEEDS VERIFICATION</div><div class="value">${esc(breakdown.needsVerification??0)}</div><div class="sub">Warm/Hot records awaiting checks</div></div><div class="stat"><div class="label">UNROUTABLE</div><div class="value">${esc(breakdown.unroutable??0)}</div><div class="sub">Target: 0</div></div>`;
      if(badge){badge.textContent=r.productionOn?'🟢 PRODUCTION ON':'🟠 PRODUCTION OFF';badge.className='badge '+(r.productionOn?'green':'orange');}
      if(!automatic)sbcRevenueActionStatus('Revenue status checked. Actionable: '+String(breakdown.actionable??r.eligibleLeads??0)+'; needs verification: '+String(breakdown.needsVerification??0)+'.','success');
      return r;
    }catch(e){
      if(seq!==sbcRevenueRefreshSequence)return {ok:false,error:String(e.message||e)};
      const badge=document.getElementById('f4RevenueStatusBadge');
      if(badge){badge.textContent='🔴 STATUS ERROR';badge.className='badge red';}
      const el=document.getElementById('f4RevenueStatus');
      if(el)el.innerHTML=`<div class="install-tip">${esc(e.message||e)}</div>`;
      sbcRevenueActionStatus('Revenue status could not be checked: '+String(e.message||e),'error');
      return {ok:false,error:String(e.message||e)};
    }
  }
  async function f4RevenueVerify(){
    if(sbcRevenueVerifyInFlight){sbcRevenueActionStatus('Verification is already running. No second request was started.','busy');return {ok:false,alreadyRunning:true};}
    sbcRevenueVerifyInFlight=true;
    sbcRevenueVerificationButton(true);
    sbcRevenueActionStatus('Verifying up to 250 warm/hot leads. This may take a little time…','busy');
    try{
      const r=await post('/api/fantastic4/revenue/verify',{limit:250});
      if(!r||r.ok===false)throw Error(r?.error||'Verification did not finish.');
      // Refresh the visible counts, but do not replace the page and erase feedback.
      await f4RevenueRefresh({automatic:true});
      const message='Lead verification complete. Checked: '+String(r.checked??0)+', sales ready: '+String(r.passed??0)+', need review: '+String(r.needsReview??0)+'.';
      sbcRevenueActionStatus(message,'success');
      alert('🔎 '+message);
      return r;
    }catch(e){
      const message='Lead verification failed: '+String(e.message||e)+'. No success was recorded.';
      sbcRevenueActionStatus(message,'error');
      alert(message);
      return {ok:false,error:String(e.message||e)};
    }finally{sbcRevenueVerifyInFlight=false;sbcRevenueVerificationButton(false);}
  }
  async function f4RevenuePlay(){if(!confirm('▶️ Run Revenue PLAY on up to 10 eligible real leads?\n\nThis will execute the bounded sales workflow. It will not require a WordPress site.'))return;try{const r=await post('/api/fantastic4/revenue/play',{limit:10});if(r.locked){alert('⏳ Revenue PLAY is already running in another worker.\n\nNo new leads were processed by this request. Wait a few seconds and check Revenue Status before retrying.');return;}alert(`▶️ Revenue PLAY complete.\n\nLeads processed: ${r.processed}\nEmails sent: ${r.sent}\nLive call tasks queued: ${r.queuedCalls}\nFailed: ${r.failed}`);await f4RevenueRefresh();if(window.render)window.render()}catch(e){alert('Revenue PLAY: '+e.message)}}
  window.f4RevenueRefresh=f4RevenueRefresh; window.f4RevenueVerify=f4RevenueVerify; window.f4RevenuePlay=f4RevenuePlay; window.f4AutoSweep=f4RevenuePlay;
  window.f4AutoMode=async()=>{const mode=prompt('AI operating mode: SHADOW, GUARDED, or AUTONOMOUS','AUTONOMOUS');if(!mode)return;try{const r=await post('/api/fantastic4/autonomous/mode',{mode:mode.toUpperCase()});alert('Fantastic 4 AI mode: '+r.mode);if(window.render)window.render()}catch(e){alert(e.message)}};
  window.f4AutoPause=async()=>{if(!confirm('Pause autonomous operations?'))return;try{await post('/api/fantastic4/autonomous/toggle',{enabled:false});alert('Autonomous operations OFF.');if(window.render)window.render()}catch(e){alert(e.message)}};
  window.f4AutoToggle=async()=>{try{const s=await get('/api/fantastic4/autonomous/toggle');const next=!s.enabled;if(next&&!confirm('Turn autonomous operations ON? This enables routine autonomous workflows; protected/high-risk actions remain human-gated.'))return;if(!next&&!confirm('Turn autonomous operations OFF? Payments and inbound webhooks remain available, but autonomous jobs will pause.'))return;const r=await post('/api/fantastic4/autonomous/toggle',{enabled:next});alert(r.enabled?'🚀 SBC autonomous operations are ON.':'🛑 SBC autonomous operations are OFF.');if(window.render)window.render()}catch(e){alert(e.message)}};
  window.f4Architecture=async()=>{try{const r=await get('/api/fantastic4/architecture');alert(r.architecture.website+' → '+r.architecture.commandCenter+' → '+r.architecture.officeBox+' + '+r.architecture.wordpress+'\n\nFlow: '+r.flow.join(' → '));}catch(e){alert(e.message)}};
})();
