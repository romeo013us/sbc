(function(){'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opts={}){const c=new AbortController();const timer=setTimeout(()=>c.abort(),8000);try{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts,signal:opts.signal||c.signal});const text=await r.text();let j;try{j=JSON.parse(text)}catch{j={ok:false,error:`HTTP ${r.status}`}}if(!r.ok){const e=new Error(j.error||`HTTP ${r.status}`);e.status=r.status;e.agentOs=true;throw e}return j}finally{clearTimeout(timer)}}
  function render(data){
    const target=document.querySelector('#dashboard')||document.querySelector('.dashboard')||document.querySelector('main'); if(!target)return;
    let panel=document.getElementById('sbcAgentOSPanel');
    if(!panel){panel=document.createElement('section');panel.id='sbcAgentOSPanel';panel.className='sbc-agent-os-panel';target.prepend(panel)}
    const m=data.metrics||{}; const gov=data.governor||{}; const readinessNote=(data.readOnly||data.schemaReady===false)?'<div class="sbc-agent-os-foot"><span>READ-ONLY PREVIEW · schema is not initialized in this environment; writes are disabled here.</span></div>':'';
    const brainHtml=(data.brains||[]).map(b=>`<div class="sbc-agent-brain"><b>${esc(b.name)}</b><span>${esc(b.domain)}</span><i>READY</i></div>`).join('');
    panel.innerHTML=`<div class="sbc-agent-os-head"><div><div class="sbc-agent-kicker">SBC AGENT OPERATING SYSTEM</div><h2>10-Brain Intelligence + Agent Control Plane</h2><p>Unified Command Center. Durable MySQL state. Scoped agents. Owner-governed economics.</p></div><div class="sbc-agent-governor"><strong>$${Number(gov.threshold||10000).toLocaleString()}</strong><span>HARD OWNER FIREWALL</span></div></div>
      <div class="sbc-agent-metrics"><div><b>${m.events?.pending||0}</b><span>Queued Events</span></div><div><b>${m.jobs?.queued||0}</b><span>Queued Jobs</span></div><div><b>${m.governorHolds?.frozen||0}</b><span>Frozen Holds</span></div><div><b>${m.agents?.ready||0}</b><span>Ready Nodes</span></div></div>
      ${readinessNote}<div class="sbc-agent-brains-grid">${brainHtml}</div>
      <div class="sbc-agent-os-foot"><span>SBC_V6529_OPEN_READINESS · Release identity ${esc(data.releaseVersion||'65.1.31')}</span><button type="button" id="sbcAgentOSRefresh">Refresh Intelligence</button><button type="button" id="sbcAgentOSHolds">Owner Holds</button></div>`;
    document.getElementById('sbcAgentOSRefresh')?.addEventListener('click',load);
    document.getElementById('sbcAgentOSHolds')?.addEventListener('click',async()=>{try{const x=await api('/api/agent-os/holds');alert(x.holds?.length?`${x.holds.length} frozen economic hold(s) require owner approval.`:'No frozen economic holds.');}catch(e){alert(e.message)}});
  }
  let sbcAgentOSInFlight=false;
  async function load(){if(!window.state?.me||window.state.me.role!=='owner')return false;if(sbcAgentOSInFlight)return false;sbcAgentOSInFlight=true;try{const d=await api('/api/agent-os/status');render(d);return true}catch(e){
    const target=document.querySelector('#dashboard')||document.querySelector('.dashboard')||document.querySelector('main');
    if(target){let panel=document.getElementById('sbcAgentOSPanel');if(!panel){panel=document.createElement('section');panel.id='sbcAgentOSPanel';panel.className='sbc-agent-os-panel';target.prepend(panel)}
      panel.innerHTML='<div class="sbc-agent-os-head"><div><div class="sbc-agent-kicker">SBC AGENT OPERATING SYSTEM</div><h2>Agent Control Plane</h2><p>Intelligence service is temporarily unavailable. Command Center UI remains operational.</p></div><div class="sbc-agent-governor"><strong>OWNER</strong><span>CONTROLLED</span></div></div><div class="sbc-agent-os-foot"><span>SBC_V6529_OPEN_READINESS · UI release 65.1.31</span><button type="button" id="sbcAgentOSRetry">Retry</button></div>';
      document.getElementById('sbcAgentOSRetry')?.addEventListener('click',load);
    }
    return false;
  }finally{sbcAgentOSInFlight=false}}
  window.sbcAgentOSRefresh=load;
  window.addEventListener('sbc:authenticated',()=>setTimeout(load,150));document.addEventListener('DOMContentLoaded',()=>setTimeout(load,1200));
  setInterval(()=>{if(document.visibilityState==='visible'&&window.state?.me)load()},60000);
})();

// SBC_V6639_PUBLISHED_READ_POLL_GUARD
