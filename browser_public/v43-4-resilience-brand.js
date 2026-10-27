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