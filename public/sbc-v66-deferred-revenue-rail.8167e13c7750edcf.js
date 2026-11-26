/* SBC V66 deferred-revenue-rail · checked-in scripts retain startup order */
/* BEGIN god-tier-broadcast-v56-13-4.js */
try {
/* SBC V56.13.4 — broadcast revenue surface */
(()=>{'use strict';
if(window.SBC_V6603_BROADCAST_SINGLETON)return;window.SBC_V6603_BROADCAST_SINGLETON=true;
let sbcBroadcastInFlight=false;let sbcBroadcastTimer=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function load(){if(sbcBroadcastInFlight||!window.state||window.state.view!=='dashboard')return;sbcBroadcastInFlight=true;const mount=document.querySelector('#sbcGodTierBroadcastMount');if(!mount)return;try{const [r,b]=await Promise.all([fetch('/api/v56134/god-tier/broadcast',{credentials:'include',headers:{Accept:'application/json'}}),fetch('/api/v56134/ten-brain/overview',{credentials:'include',headers:{Accept:'application/json'}})]);if(!r.ok)return;const j=await r.json();const bj=b.ok?await b.json():{};const m=j.broadcast?.metrics||{};const brains=(bj.brains||[]).map(x=>`<span class="sbc-brain-chip"><i></i>${esc(x.brain.replace('_BRAIN',''))}</span>`).join('');mount.innerHTML=`<section class="sbc-godtier-broadcast" aria-label="SBC live revenue broadcast"><div class="sbc-godtier-broadcast-head"><div><div class="sbc-godtier-broadcast-kicker">GOD-TIER REVENUE AUTOPILOT · 10-BRAIN LIVE</div><div class="sbc-godtier-broadcast-title">Kim Revenue Closer · seconds, not minutes</div></div><div class="sbc-godtier-broadcast-status">${j.broadcast?.ready?'FLOW CLEAR':'ATTENTION REQUIRED'}</div></div><div class="sbc-godtier-broadcast-grid"><div class="sbc-godtier-broadcast-metric profit"><small>SQUARE-BACKED VALUE</small><strong>$${Number(m.recognizedPaidRevenue||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div><div class="sbc-godtier-broadcast-metric"><small>PAID ORDERS</small><strong>${Number(m.paidOrders||0)}</strong></div><div class="sbc-godtier-broadcast-metric"><small>FULFILLMENT JOBS</small><strong>${Number(m.fulfillmentJobs||0)}</strong></div><div class="sbc-godtier-broadcast-metric"><small>RECONCILE QUEUE</small><strong>${Number(m.reconciliationCandidates||0)}</strong></div><div class="sbc-godtier-broadcast-metric"><small>REVENUE / 1,000</small><strong>$${Number(bj.metrics?.revenuePer1000||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div></div><div class="sbc-brain-strip">${brains}</div></section>`; }catch{}finally{sbcBroadcastInFlight=false;}}
function mount(){if(!window.state)return;let el=document.querySelector('#sbcGodTierBroadcastMount');if(!el){el=document.createElement('div');el.id='sbcGodTierBroadcastMount';const app=document.querySelector('#app.app')||document.querySelector('#app');const target=app?.querySelector(':scope > .main .content')||app?.querySelector('.main .content')||app?.querySelector(':scope > .main')||document.querySelector('main .content')||document.querySelector('main')||document.body;target.appendChild(el)}load()}
function start(){mount();if(!sbcBroadcastTimer)sbcBroadcastTimer=setInterval(()=>{if(document.visibilityState==='visible')load()},90000)}
addEventListener('DOMContentLoaded',start,{once:true});const oldRender=window.render; if(typeof oldRender==='function'){window.render=function(){const r=oldRender.apply(this,arguments);setTimeout(()=>{if(window.state?.view==='dashboard')mount();else document.querySelector('#sbcGodTierBroadcastMount')?.remove()},0);return r}};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: god-tier-broadcast-v56-13-4.js", sbcBundleError);
}
/* END god-tier-broadcast-v56-13-4.js */
;
/* BEGIN consultative-revenue-v56-13-5.js */
try {
/* SBC V56.13.5 — Consultative Revenue Cockpit */
(()=>{'use strict';
if(window.SBC_V6603_CONSULTATIVE_SINGLETON)return;window.SBC_V6603_CONSULTATIVE_SINGLETON=true;
let sbcConsultativeInFlight=false;let sbcConsultativeTimer=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>Number(v||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
async function load(){if(sbcConsultativeInFlight||!window.state||window.state.view!=='dashboard')return;sbcConsultativeInFlight=true;const mount=document.querySelector('#sbcConsultativeRevenueMount');if(!mount)return;try{const r=await fetch('/api/v56135/consultative/overview',{credentials:'include',headers:{Accept:'application/json'}});if(!r.ok)return;const j=await r.json();const m=j.metrics||{},cat=j.catalog||{},recent=j.recentSolutions||[];const needs=Object.entries(j.needCounts||{}).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>`<span class="sbc-consult-chip"><i></i>${esc(k)} <b>${v}</b></span>`).join('');const recentHtml=recent.length?recent.map(x=>`<div class="sbc-consult-row"><div><strong>${esc(x.company)}</strong><small>${(x.items||[]).map(i=>esc(i.name)).join(' · ')}</small></div><div><b>$${money(x.upfrontSetup)}</b><small>$${money(x.monthlyRecurring)}/mo</small></div></div>`).join(''):`<div class="sbc-consult-empty">No consultative solutions composed yet. This panel will populate from observed SBC state.</div>`;mount.innerHTML=`<section class="sbc-consultative-cockpit" aria-label="SBC consultative revenue engine"><header><div><span class="sbc-consult-kicker">V56.13.5 · CONSULTATIVE REVENUE ENGINE</span><h2>Kim diagnoses the business. SBC assembles the solution.</h2><p>Dynamic solution mapping across the canonical SBC catalog. No synthetic revenue.</p></div><span class="sbc-consult-live">${cat.count||0} CATALOG OFFERINGS</span></header><div class="sbc-consult-grid"><article><small>PROSPECTS</small><strong>${Number(m.prospects||0).toLocaleString()}</strong><span>CRM state</span></article><article><small>SOLUTIONS COMPOSED</small><strong>${Number(m.solutionsComposed||0).toLocaleString()}</strong><span>needs → bundle</span></article><article><small>SQUARE-BACKED ORDERS</small><strong>${Number(m.paidOrders||0).toLocaleString()}</strong><span>includes protected QA; not all customer sales</span></article><article class="profit"><small>REVENUE / 1,000</small><strong>$${money(m.revenuePer1000)}</strong><span>SBC-stored Square evidence, not bank deposits</span></article></div><div class="sbc-consult-body"><div class="sbc-consult-flow"><div class="sbc-consult-flow-title">DISCOVERY → SOLUTION GRAPH → CHECKOUT</div><div class="sbc-consult-nodes"><span>PROSPECT</span><b>→</b><span>CONTEXT</span><b>→</b><span>DISCOVERY</span><b>→</b><span class="active">SOLUTION</span><b>→</b><span>CHECKOUT</span><b>→</b><span>FULFILLMENT</span></div><div class="sbc-consult-needs">${needs||'<span class="sbc-consult-chip">Awaiting discovery signals</span>'}</div></div><div class="sbc-consult-recent"><div class="sbc-consult-flow-title">RECENT SOLUTION MAPS</div>${recentHtml}</div></div></section>` }catch{}finally{sbcConsultativeInFlight=false;}}
function mount(){if(!window.state)return;let el=document.querySelector('#sbcConsultativeRevenueMount');if(!el){el=document.createElement('div');el.id='sbcConsultativeRevenueMount';const app=document.querySelector('#app.app')||document.querySelector('#app');const target=app?.querySelector(':scope > .main .content')||app?.querySelector('.main .content')||app?.querySelector(':scope > .main')||document.querySelector('main .content')||document.querySelector('main')||document.body;target.appendChild(el)}load()}
function start(){mount();if(!sbcConsultativeTimer)sbcConsultativeTimer=setInterval(()=>{if(document.visibilityState==='visible')load()},60000)}
addEventListener('DOMContentLoaded',start,{once:true});const oldRender=window.render;if(typeof oldRender==='function'){window.render=function(){const r=oldRender.apply(this,arguments);setTimeout(()=>{if(window.state?.view==='dashboard')mount();else document.querySelector('#sbcConsultativeRevenueMount')?.remove()},0);return r}};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: consultative-revenue-v56-13-5.js", sbcBundleError);
}
/* END consultative-revenue-v56-13-5.js */
;
/* BEGIN v56140-90day-revenue-command.js */
try {
(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function getData(){if(typeof window.api==='function')return window.api('/api/v56140/revenue-command/overview',{timeoutMs:20000});const r=await fetch('/api/v56140/revenue-command/overview',{credentials:'same-origin',headers:{Accept:'application/json'}});const raw=await r.text();let j=null;try{j=JSON.parse(raw)}catch{}if(!r.ok)throw new Error(j?.message||j?.error||`Revenue Command could not load (${r.status}).`);if(!j)throw new Error(/<html|<!doctype/i.test(raw)?'The server returned a sign-in page instead of revenue data. Sign in again, then refresh.':'Revenue Command returned invalid JSON.');return j;}
async function post(path,body){if(typeof window.api==='function')return window.api(path,{method:'POST',body:JSON.stringify(body||{}),timeoutMs:30000});const r=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body||{})});const raw=await r.text();let j=null;try{j=JSON.parse(raw)}catch{}if(!r.ok)throw new Error(j?.message||j?.error||`Command failed (${r.status}).`);if(!j)throw new Error('Command endpoint returned non-JSON content.');return j;}
function pct(v){return `${Number(v||0).toFixed(1)}%`;}
function money(v){return Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});}
function stat(label,value,sub,cls=''){return `<div class="rc90-stat ${cls}"><div class="rc90-label">${esc(label)}</div><div class="rc90-value">${esc(value)}</div><div class="rc90-sub">${esc(sub)}</div></div>`;}
function render(data){
 window.__sbc90LastData=data||{};
 const recovery=Boolean(data.recoveryRequired);
 const s=data.scorecard||{},a=data.acquisition||{},f=a.funnel||{},ai=data.aiSales||{},sm=data.salesMath||{};
 const offers=(data.offers||[]).map(x=>`<div class="rc90-offer"><div><strong>${esc(x.name)}</strong><span>${esc(x.sku)}</span></div><b>${money(x.price)}${x.unit==='month'?'/mo':''}</b></div>`).join('')||'<div class="rc90-empty">No canonical offers were found.</div>';
 const next=(data.nextActions||[]).map((x,i)=>`<div class="rc90-action"><span>${i+1}</span><div>${esc(x)}</div></div>`).join('');
 const aiBadge=ai.mode==='READY'?'READY':'STANDBY';
 const aiText=ai.autonomousOutbound?'Autonomous outbound is enabled by the existing owner-controlled policy.':'AI is prepared for consultative selling; outbound remains owner-controlled unless the existing policy is intentionally enabled.';
 document.getElementById('rc90-body').innerHTML=`
 <div class="rc90-hero">
   <div><div class="eyebrow">SBC 90-DAY REVENUE COMMAND</div><h2>🎯 $100K Revenue Campaign</h2><p>One target. One funnel. One operating cadence. Built on the existing Revenue PLAY, 10-Brain, Consultative Engine, Kim Mission and Square rails.</p></div>
   <div class="rc90-hero-badge"><strong>${esc(s.status||'IN_PROGRESS')}</strong><span>${pct(s.revenuePct)} of revenue target</span></div>
 </div>
 <div class="rc90-grid rc90-grid-5">
   ${stat('90-DAY TARGET',money(s.targetRevenue),'Collected revenue target')}
   ${stat('COLLECTED',money(s.collectedRevenue),`${pct(s.revenuePct)} complete`)}
   ${stat('REVENUE GAP',money(s.revenueGap),`${money(s.requiredRevenuePerRemainingDay)}/remaining day`)}
   ${stat('NEW MRR TARGET',money(s.targetNewMrr),'Recurring revenue added')}
   ${stat('OBSERVED MRR',money(s.observedNewMrr),`${pct(s.mrrPct)} complete`)}
 </div>
 <div class="rc90-grid rc90-grid-3 rc90-space">
   ${stat('LORNA / DAY',a.lornaDailyTarget,'Current lead research target')}
   ${stat('90-DAY LEAD CAPACITY',a.projected90DayLeads,'15/day × 5 days/week')}
   ${stat('CURRENT LEAD POOL',a.currentLeadPool,`${a.warmHot||0} Warm/Hot · ${a.salesReady||0} Sales Ready`)}
 </div>
 <div class="rc90-panel rc90-space">
   <div class="rc90-panel-head"><div><h3>Sales Funnel</h3><span>Observed Command Center state</span></div><span class="rc90-chip">REVENUE FIRST</span></div>
   <div class="rc90-funnel">
     ${[['Prospects',f.totalProspects],['Verified',f.verified],['Warm / Hot',f.warmHot],['Sales Ready',f.salesReady],['Conversations',f.conversationsObserved],['Offers',f.offersObserved],['Sales',f.salesObserved]].map(x=>`<div><b>${Number(x[1]||0)}</b><span>${esc(x[0])}</span></div>`).join('')}
   </div>
 </div>
 <div class="rc90-grid rc90-grid-2 rc90-space">
   <div class="rc90-panel">
    <div class="rc90-panel-head"><div><h3>🤖 AI Sales Agent</h3><span>AI-first / human escalation model</span></div><span class="rc90-chip ${aiBadge==='READY'?'good':''}">${aiBadge}</span></div>
    <div class="rc90-ai-list">
      <div><span>OpenAI</span><b>${ai.openaiConfigured?'CONNECTED':'NOT CONFIGURED'}</b></div>
      <div><span>Twilio</span><b>${ai.twilioConfigured?'CONNECTED':'NOT CONFIGURED'}</b></div>
      <div><span>Consultative Engine</span><b>ONLINE</b></div>
      <div><span>10-Brain</span><b>ONLINE</b></div>
      <div><span>Kim Mission</span><b>ONLINE</b></div>
      <div><span>Outbound Policy</span><b>${esc(ai.recommendation||'OWNER CONTROLLED')}</b></div>
    </div>
    <p class="rc90-note">${esc(aiText)}</p>
    ${recovery?`<div class="rc90-error">RECOVERY LOCK ACTIVE. AI preparation and Revenue PLAY are disabled. ${Number(data.recoveryCensus?.mysqlCustomers||0)} current MySQL customer rows and ${Number(data.recoveryCensus?.preservedLeadMesh||0)} preserved lead-mesh rows are visible for reconciliation; neither count clears the recovery gate.</div>`:''}
    <div class="rc90-buttons"><button class="btn primary" ${recovery?'disabled title="Recovery lock active"':''} onclick="window.sbc90AiPrep()">🤖 PREP AI SALES — 10</button><button class="btn" ${recovery?'disabled title="Recovery lock active"':''} onclick="window.sbc90Play()">▶ PLAY — 10</button><button class="btn" onclick="window.sbc90Refresh()">↻ Refresh</button></div>
   </div>
   <div class="rc90-panel">
    <div class="rc90-panel-head"><div><h3>Sales Math</h3><span>Planning model, not fabricated results</span></div><span class="rc90-chip">$${Number(sm.assumedAverageSale||699).toFixed(0)} AVG ASSUMPTION</span></div>
    <div class="rc90-math"><div><b>${Number(sm.requiredAdditionalCustomers||0)}</b><span>additional customers at assumed average sale</span></div><div><b>${money(sm.projectedInitialRevenueAtTargetCustomers)}</b><span>initial revenue represented</span></div></div>
    <p class="rc90-note">The $699 assumption is a planning benchmark. Actual average sale, conversion rate and recurring revenue must come from observed SBC telemetry.</p>
   </div>
 </div>
 <div class="rc90-grid rc90-grid-2 rc90-space">
   <div class="rc90-panel"><div class="rc90-panel-head"><div><h3>👥 90-Day Team Model</h3><span>Revenue-first staffing sequence</span></div><span class="rc90-chip">LEAN SCALE</span></div><div class="rc90-offers">
     <div class="rc90-offer"><div><strong>Lorna</strong><span>15 qualified leads / workday · keep</span></div><b>LEAD RESEARCH</b></div>
     <div class="rc90-offer"><div><strong>AI Sales Agent</strong><span>Discovery, qualification, follow-up, solution mapping</span></div><b>NOW</b></div>
     <div class="rc90-offer"><div><strong>Human Closer #1</strong><span>Add when AI produces more hot appointments than Romeo can handle</span></div><b>TRIGGER</b></div>
     <div class="rc90-offer"><div><strong>Fulfillment Specialist</strong><span>Protect sales capacity by separating delivery from closing</span></div><b>TRIGGER</b></div>
   </div></div>
   <div class="rc90-panel"><div class="rc90-panel-head"><div><h3>Offer Ladder</h3><span>Canonical SBC catalog only</span></div><span class="rc90-chip">NO SYNTHETIC PRICING</span></div><div class="rc90-offers">${offers}</div></div>
   <div class="rc90-panel"><div class="rc90-panel-head"><div><h3>Next 90-Day Actions</h3><span>Operating priorities</span></div><span class="rc90-chip">EXECUTION</span></div><div>${next}</div></div>
 </div>
 <div class="rc90-footer">Days elapsed: <b>${Number(s.daysElapsed||0)}</b> · Days remaining: <b>${Number(s.daysRemaining||0)}</b> · Revenue PLAY cap: <b>${Number(data.existingRails?.revenuePlayCap||20)}</b> · No new GoDaddy secret required.</div>`;
}
async function refresh(){try{const d=await getData();render(d);}catch(e){const b=document.getElementById('rc90-body');if(b)b.innerHTML=`<div class="rc90-error">${esc(e.message)}</div>`;}}
async function aiPrep(){if(window.__sbc90LastData?.recoveryRequired){window.toast?.('Recovery lock active: AI sales preparation remains suspended until authoritative MySQL recovery is verified.');return}try{const r=await post('/api/v56140/revenue-command/ai-prep',{limit:10});window.toast?.(`AI sales preparation completed for ${Number(r.prospects||r.missions||0)} prospects.`);render(r.command||await getData());}catch(e){window.toast?.(e.message);}}
async function play(){if(window.__sbc90LastData?.recoveryRequired){window.toast?.('Recovery lock active: Revenue PLAY remains suspended until authoritative MySQL recovery is verified.');return}try{const r=await post('/api/v56140/revenue-command/revenue-play',{limit:10});window.toast?.('Revenue PLAY completed. Review the observed results.');render(r.command||await getData());}catch(e){window.toast?.(e.message);}}
window.sbc90RevenueCommandView=function(){
 setTimeout(refresh,20);
 return `<section class="rc90-wrap"><div id="rc90-body"><div class="rc90-loading">Loading the 90-day revenue command…</div></div></section>`;
};
window.sbc90Refresh=refresh;window.sbc90AiPrep=aiPrep;window.sbc90Play=play;
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v56140-90day-revenue-command.js", sbcBundleError);
}
/* END v56140-90day-revenue-command.js */
