(function(){
  window.sbcPlatformArchitectureView=async function(){
    let d={architecture:{},officeBox:{}};
    try{d.architecture=await fetch('/api/platform/architecture').then(r=>r.json());}catch(e){}
    try{d.officeBox=await fetch('/api/office-box/capabilities').then(r=>r.json());}catch(e){}
    const a=d.architecture.architecture||{};
    const cc=a.commandCenter?.owns||[], ob=a.officeBox?.owns||[], shared=a.sharedServices||[];
    return `<div class="card section"><div class="card-body">
      <div class="eyebrow">SBC PLATFORM ARCHITECTURE V1</div><h2>One Control Plane. Tenant-Scoped Office Box.</h2>
      <p class="mini">The Command Center owns SBC operations and Kim. Office Box receives only customer-operating capabilities.</p>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px">
        <div class="card"><div class="card-body"><h3>🧠 Command Center</h3><div class="mini">${cc.length} control-plane capabilities</div><p>${cc.map(x=>`<span class="badge green" style="margin:3px">${x}</span>`).join('')}</p></div></div>
        <div class="card"><div class="card-body"><h3>🧩 Office Box</h3><div class="mini">${ob.length} customer capabilities</div><p>${ob.map(x=>`<span class="badge" style="margin:3px">${x}</span>`).join('')}</p></div></div>
        <div class="card"><div class="card-body"><h3>🔗 Shared Services</h3><div class="mini">${shared.length} shared contracts</div><p>${shared.map(x=>`<span class="badge orange" style="margin:3px">${x}</span>`).join('')}</p></div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-body"><h3>Protected Boundaries</h3><p class="mini">${(a.protectedBoundaries||[]).map(x=>`<span class="badge red" style="margin:3px">🔒 ${x}</span>`).join('')}</p><div class="mini">${a.rule||'Platform boundary policy active.'}</div></div></div>
      <div class="card" style="margin-top:16px"><div class="card-body"><h3>Office Box Contract</h3><p class="mini">Tenant: ${d.officeBox.tenantId||'current'} · Scope: ${d.officeBox.tenantScoped?'tenant-scoped':'unknown'} · Version: ${d.officeBox.version||'—'}</p><p class="mini">Global CRM, Steward editing, migrations, deployment controls, owner security, and cross-tenant data remain outside Office Box.</p></div></div>
    </div></div>`;
  };
})();
