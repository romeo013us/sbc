(()=>{
async function readJson(url,opt={}){
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json',...(opt.headers||{})},...opt});
  const text=await r.text();
  let d=null;
  try{d=JSON.parse(text)}catch(_){
    const ct=String(r.headers.get('content-type')||'');
    const preview=text.replace(/\s+/g,' ').slice(0,180);
    throw new Error(r.status===200 && /html/i.test(ct)?'Kim API returned the SBC page instead of JSON. The API route is not reaching the backend.':`Kim API returned invalid JSON (HTTP ${r.status}). ${preview}`);
  }
  if(!r.ok)throw new Error(d?.error||`Kim API request failed (HTTP ${r.status})`);
  return d;
}
async function load(){
  const el=document.getElementById('kimAutomation43');if(!el)return;
  try{
    const d=await readJson('/api/kim430/summary?_v=47.0.0');
    el.innerHTML=`<div class="h"><strong>🧠 KIM AUTOMATION OS</strong><button class="kim43btn" onclick="this.closest('#kimAutomation43').remove()">×</button></div><div class="b"><div class="grid"><div class="k43"><small>Automations</small><b>${d.automationCount}</b></div><div class="k43"><small>Completed</small><b class="kim43ok">${d.metrics.completed}</b></div><div class="k43"><small>Queued</small><b>${d.metrics.jobs-d.metrics.completed}</b></div><div class="k43"><small>Escalated</small><b class="kim43warn">${d.metrics.escalated}</b></div></div><div>Mode: <strong>${d.mode}</strong></div><div style="margin-top:8px">Protected actions remain Romeo-controlled.</div><button class="kim43btn" style="margin-top:12px" id="kim43Run">▶ Run Kim Cycle</button></div>`;
    document.getElementById('kim43Run')?.addEventListener('click',async()=>{
      const b=document.getElementById('kim43Run');b.disabled=true;b.textContent='⏳ Running…';
      try{await readJson('/api/kim430/tick?_v=47.0.0',{method:'POST',body:'{}'});await load()}
      catch(e){b.disabled=false;b.textContent='▶ Run Kim Cycle';const msg=document.createElement('div');msg.style='margin-top:10px;color:#fca5a5';msg.textContent=e.message;el.querySelector('.b')?.appendChild(msg)}
    });
  }catch(e){
    el.innerHTML=`<div class="h"><strong>🧠 KIM AUTOMATION OS</strong><button class="kim43btn" onclick="this.closest('#kimAutomation43').remove()">×</button></div><div class="b" style="color:#fca5a5">${String(e.message).replace(/[<>]/g,'')}</div><button class="kim43btn" style="margin-top:10px" onclick="window.openKimAutomation43()">↻ Retry</button>`;
  }
}
function mount(){if(document.getElementById('kimAutomation43'))return;const e=document.createElement('div');e.id='kimAutomation43';document.body.appendChild(e);load()}
window.openKimAutomation43=mount;setTimeout(mount,1800);
})();
