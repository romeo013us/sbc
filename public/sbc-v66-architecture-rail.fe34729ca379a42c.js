/* SBC V66 architecture-rail · checked-in scripts retain startup order */
/* BEGIN adaptive-business-builder.js */
try {
(()=>{const T={notary:{label:'Mobile Notary',modules:['Customers','Appointments','Documents','Services','Quotes','Payments','Referral Partners','Service Areas'],fields:['Signer / client','Document type','Number of signers','Appointment location','ID verified','Notarization status','Apostille status','Payment status'],flow:['Inquiry','Qualification','Quote','Appointment','Document Review','Notarization','Payment','Completion','Follow-Up'],automations:['Appointment confirmation','Appointment reminder','Quote follow-up','Post-service follow-up','Payment reminder'],integrations:['Square','Calendar','SMS','Email','Document storage']},field:{label:'Field Service',modules:['Leads','Customers','Estimates','Jobs','Routes','Teams','Invoices','Follow-Ups'],fields:['Property type','Service package','Site address','Crew','Job status','Estimate','Access notes'],flow:['Lead','Estimate','Schedule','Dispatch','Service','Quality Check','Invoice','Collect','Review'],automations:['Estimate follow-up','Appointment reminder','Dispatch notice','Invoice reminder','Review request'],integrations:['Payments','Calendar','SMS','Maps','Email']},professional:{label:'Professional Services',modules:['Leads','Contacts','Proposals','Projects','Tasks','Documents','Invoices','Renewals'],fields:['Service type','Decision maker','Proposal status','Project status','Due date','Billing status'],flow:['Lead','Discovery','Proposal','Approval','Project','Deliver','Invoice','Collect','Renew'],automations:['Proposal follow-up','Task reminders','Invoice reminders','Renewal reminders'],integrations:['Payments','Calendar','Email','Documents','E-sign']},general:{label:'General Business',modules:['Leads','Customers','Deals','Tasks','Services','Invoices','Documents','Reports'],fields:['Lead source','Customer type','Service','Owner','Status','Next action'],flow:['Lead','Qualify','Sell','Fulfill','Collect','Follow-Up','Renew'],automations:['Lead follow-up','Task reminders','Payment reminders','Customer follow-up'],integrations:['Payments','Calendar','Email','SMS']}};const esc=x=>String(x??'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));function blueprint(v){const t=String(v.type||'').toLowerCase();let k=t.includes('notar')||t.includes('apost')?'notary':t.includes('clean')||t.includes('pressure')||t.includes('landscap')||t.includes('field')?'field':t.includes('law')||t.includes('account')||t.includes('consult')||t.includes('agency')?'professional':'general';const x=T[k];return {name:v.name||x.label,type:x.label,url:v.url||'',area:v.area||'',modules:x.modules,fields:x.fields,flow:x.flow,automations:x.automations,integrations:x.integrations,approval:['Financial changes','Credential changes','External sending','Destructive actions']};}function render(d){return '<div class="abb-grid">'+[['CRM OBJECTS',d.modules],['CUSTOM FIELDS',d.fields],['WORKFLOW',d.flow],['AUTOMATIONS',d.automations],['INTEGRATIONS',d.integrations],['OWNER APPROVAL',d.approval]].map(([h,a])=>'<div class="abb-card"><h3>'+h+'</h3><ul>'+a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>').join('')+'</div><div class="abb-note"><strong>Blueprint ready.</strong> '+esc(d.name)+' would run on the same Office Box core. The blueprint changes the workspace configuration; it does not create a separate CRM codebase or expose provider secrets.</div>';}window.adaptiveBusinessBuilderView=()=>{return '<div class="abb-wrap"><section class="abb-hero"><div><div class="eyebrow">OFFICE BOX • ADAPTIVE BUSINESS ENGINE</div><h2>Build the customer’s Office Box around their business.</h2><p class="mini">Enter the business and website. The Builder proposes the CRM objects, fields, workflow, automations and integrations. Owner approval is required before applying configuration.</p></div><span class="abb-badge">SELF-CONFIGURING</span></section><section class="card section"><div class="card-body"><div class="abb-form"><label>Business name<input id="abbName" placeholder="Mid City Mobile Notary"></label><label>Business type<input id="abbType" placeholder="Mobile Notary"></label><label>Website URL<input id="abbUrl" placeholder="https://example.com"></label><label>Service area<input id="abbArea" placeholder="Los Angeles County"></label></div><div class="actions" style="margin-top:14px"><button class="btn primary" id="abbBuild">Analyze & Build Blueprint</button><button class="btn" id="abbMid">Load Mid City Demo</button></div><div class="abb-status" id="abbStatus">Ready. Demo generation is local and deterministic.</div><div id="abbOut" style="margin-top:14px"></div></div></section></div>'};document.addEventListener('click',e=>{if(e.target.id==='abbMid'){document.getElementById('abbName').value='Mid City Mobile Notary';document.getElementById('abbType').value='Mobile Notary';document.getElementById('abbUrl').value='https://midcitymobilenotary.com/';document.getElementById('abbArea').value='Los Angeles County';}if(e.target.id==='abbBuild'){const d=blueprint({name:document.getElementById('abbName').value,type:document.getElementById('abbType').value,url:document.getElementById('abbUrl').value,area:document.getElementById('abbArea').value});document.getElementById('abbStatus').textContent='Blueprint generated. Review it before any owner-approved apply step.';document.getElementById('abbOut').innerHTML=render(d);}});})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: adaptive-business-builder.js", sbcBundleError);
}
/* END adaptive-business-builder.js */
;
/* BEGIN supernova.js */
try {
/* V56.13.5: canonical Supernova renderer owns navigation/content. */
(()=>{ window.SBC_SUPERNOVA={load:()=>window.sbcNavigate?.('supernova'),bind:()=>{}}; })();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: supernova.js", sbcBundleError);
}
/* END supernova.js */
;
/* BEGIN kim-control-center.js */
try {
(()=>{
 const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 const modules=[
  ['kim370','🤖','Kim Automation Fabric','kim370'],['kim380','🚀','Kim Growth Autopilot','kim380'],['kim391','🛡️','Kim Commercial Readiness','kim391'],['kim400','📦','Kim Fulfillment Control','kim400'],['kim410','🧠','Kim Operations Backbone','kim410'],['kim420','🏢','Kim Enterprise 80','kim420'],['godtier','👑','SBC God Tier','kimgodtier'],['fantastic4','🚦','Production Control','fantastic4'],['marketing','📣','Marketing','marketing']
 ];
 window.kimControlCenterView=async function(){
  try{
   const d=await api('/api/system/module-health');
   const voiceCard=`<div class="card section kim-voice-card"><div class="card-head"><div><div class="eyebrow">NATURAL VOICE</div><h2>🎙️ Talk to Kim</h2><div class="mini">Real-time, full-duplex conversation. Talk normally, pause, interrupt her, and keep the conversation going.</div></div><span class="badge green">VOICE READY</span></div><div class="card-body"><div class="kim-voice-actions"><button id="kimVoiceToggle" class="kim-voice-button" type="button" onclick="window.startKimVoice()">🎙️ Talk to Kim</button><span id="kimVoiceStatus" class="kim-voice-status">Ready when you are.</span><span class="kim-voice-wave" aria-hidden="true"><i></i><i></i><i></i></span></div><div id="kimVoiceTranscript" class="kim-voice-transcript" aria-live="polite"></div></div></div>`;
   const rows=(d.checks||[]).map(x=>`<div class="list-card"><div><strong>${esc(x.label)}</strong><div class="mini">${esc(x.detail)}</div></div><span class="badge ${x.status==='READY'?'green':'red'}">${esc(x.status)}</span></div>`).join('');
   const buttons=modules.map(([id,icon,label,view])=>`<button class="btn" type="button" onclick="state.view='${view}';render()">${icon} ${esc(label)}</button>`).join('');
   return voiceCard+`<div class="card section"><div class="card-head"><div><div class="eyebrow">SBC AI OPERATIONS</div><h2>👑 Kim Control Center</h2><div class="mini">One place for the Kim operating systems. The underlying modules stay intact; the sidebar no longer needs to expose every historical version.</div></div><span class="badge ${d.ok?'green':'red'}">${d.ok?'SYSTEMS READY':'CHECK SYSTEMS'}</span></div><div class="card-body"><div class="grid three"><div class="stat"><div class="label">PRODUCTION</div><div class="value">${d.production?.enabled?'ON':'OFF'}</div><div class="sub">Autonomous routine work</div></div><div class="stat"><div class="label">AI MODE</div><div class="value" style="font-size:20px">${esc(d.production?.mode||'GUARDED')}</div><div class="sub">Protected controls remain owner-gated</div></div><div class="stat"><div class="label">MODULES</div><div class="value">${(d.checks||[]).filter(x=>x.status==='READY').length}/${(d.checks||[]).length}</div><div class="sub">Core operating modules</div></div></div><div class="actions" style="flex-wrap:wrap">${buttons}</div></div></div><div class="card section"><div class="card-head"><h2>System Health</h2><button class="btn small" onclick="state.view='kimcenter';render()">↻ Refresh</button></div><div class="card-body">${rows}</div></div>`;
  }catch(e){return `<div class="card section"><div class="card-body"><h2>Kim Control Center</h2><div class="install-tip">${esc(e.message||e)}</div><button class="btn" onclick="state.view='kimcenter';render()">Retry</button></div></div>`}
 };
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: kim-control-center.js", sbcBundleError);
}
/* END kim-control-center.js */
;
/* BEGIN platform-architecture.js */
try {
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
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: platform-architecture.js", sbcBundleError);
}
/* END platform-architecture.js */
