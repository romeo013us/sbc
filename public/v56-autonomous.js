/* SBC V56.1 — human-governed autonomous operations UI */
(function(){
  'use strict';
  const api=(...a)=>window.api?window.api(...a):Promise.reject(new Error('SBC API bridge unavailable'));
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n||0));
  async function scan(){
    const rail=document.getElementById('v56AutonomyRail'); if(!rail)return;
    rail.classList.add('v56-auto-loading');
    try{
      const r=await api('/api/v56/autonomy/summary',{timeoutMs:15000});
      const c=r.capacity||{},m=r.money||{};
      const set=(id,v)=>{const x=document.getElementById(id);if(x)x.textContent=v;};
      set('v56AutoCapacity',c.overloaded?'OVER CAPACITY':c.underloaded?'UNDER LOADED':'ON TRACK');
      set('v56AutoCapacityText',`${c.ready||0} ready · ${c.dailyCapacity||0}/day capacity · ~${c.estimatedDays||0} days backlog`);
      set('v56AutoMoney',money((m.opportunities||[]).reduce((n,x)=>n+Number(x.estimatedValue||0),0)));
      set('v56AutoMoneyText',`${m.staleHot||0} stale hot · ${m.unworkedHot||0} unworked warm/hot · ${m.openQuotes||0} open quotes`);
      set('v56AutoPaid',String(m.paidWaiting||0));
      set('v56AutoPaidText',m.paidWaiting?'Paid orders need fulfillment movement.':'No paid fulfillment blockers detected.');
      set('v56AutoHealth',r.health==='ACTION_REQUIRED'?'ACTION REQUIRED':'ON TRACK');
      set('v56AutoHealthText',r.friction?.length?`${r.friction.length} operating signal${r.friction.length===1?'':'s'} found.`:'No material friction detected.');
      const alerts=document.getElementById('v56AutoAlerts');
      if(alerts)alerts.innerHTML=(r.friction||[]).slice(0,5).map(x=>`<div class="v56-auto-alert ${String(x.priority).toLowerCase()}"><strong>${esc(x.priority||'INFO')}</strong><span>${esc(x.message||x.action||'Operational signal')}</span><button type="button" data-auto-kim="${esc(x.action||x.message||'Review this operational signal.')}">Ask Kim</button></div>`).join('')||'<div class="v56-auto-clear">✓ No material revenue friction detected.</div>';
      if(typeof window.toast==='function')window.toast('Money Radar refreshed.');
    }catch(e){const a=document.getElementById('v56AutoAlerts');if(a)a.innerHTML=`<div class="v56-auto-alert high"><strong>CHECK FAILED</strong><span>${esc(e.message)}</span></div>`;}
    finally{rail.classList.remove('v56-auto-loading');}
  }
  document.addEventListener('click',e=>{
    const scanBtn=e.target.closest('[data-v56-auto="scan"]'); if(scanBtn){e.preventDefault();scan();return;}
    const kim=e.target.closest('[data-auto-kim]'); if(kim){e.preventDefault();const p=kim.dataset.autoKim;if(typeof window.openSbcAI==='function')window.openSbcAI(p);else if(typeof window.askSbcAI==='function')window.askSbcAI(p);}
  });
  window.sbcV56AutonomyScan=scan;
  setTimeout(scan,700);
})();
