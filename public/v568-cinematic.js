/* SBC V56.8 — Cinematic Operations Layer. Existing endpoints only; no new secrets. */
(function(){'use strict';
  const VERSION='56.8.0';
  let observer=null, poll=null, lastEventId=null, automationPollInFlight=false;
  const q=s=>document.querySelector(s);
  function authFetch(url,opts={}){return fetch(url,Object.assign({credentials:'same-origin',cache:'no-store'},opts));}
  function addBeacon(){
    const top=q('.top-actions'); if(!top||q('#sbcAutomationBeacon')) return;
    const b=document.createElement('button'); b.id='sbcAutomationBeacon'; b.type='button'; b.className='sbc-cinematic-beacon';
    b.dataset.state='idle'; b.title='Live automation activity';
    b.innerHTML='<span class="dot" aria-hidden="true"></span><span class="label">AUTOMATION</span><span class="event" id="sbcAutomationEvent">STANDING BY</span>';
    top.insertBefore(b,q('#sbcThemeToggle')||null);
    b.addEventListener('click',()=>{ if(window.sbcOpenKimControl){window.sbcOpenKimControl('Give me the latest automation activity, revenue movement, exceptions, and the single best next action.');} });
  }
  function motionize(root=document){
    root.querySelectorAll('#content .card,#content .section,#content .v56-section,#content .stat').forEach(el=>{
      if(el.dataset.sbcMotion==='1')return; el.dataset.sbcMotion='1'; el.classList.add('sbc-cinematic-motion');
    });
  }
  function updateBeacon(events){
    const b=q('#sbcAutomationBeacon'); if(!b)return;
    const e=(events||[])[0]; if(!e){b.dataset.state='idle'; q('#sbcAutomationEvent').textContent='STANDING BY'; return;}
    const label=String(e.event||e.type||'automation').replace(/_/g,' ').toUpperCase();
    q('#sbcAutomationEvent').textContent=label.slice(0,42); b.dataset.state=/error|fail|blocked|exception/i.test(label)?'attention':'live';
    const id=String(e.id||e.ts||e.createdAt||label);
    if(lastEventId&&id!==lastEventId&&/revenue|fulfillment|dunning|dropzone|kim|sequence/i.test(label)){
      const toast=q('#toast'); if(toast){toast.textContent='⚡ '+label; toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),3200);}
    }
    lastEventId=id;
  }
  async function pollAutomation(){
    if(automationPollInFlight||document.visibilityState==='hidden'||!window.state?.me)return;
    automationPollInFlight=true;const c=new AbortController();const timer=setTimeout(()=>c.abort(),8000);
    try{const r=await authFetch('/api/v567/observability/automation',{signal:c.signal}); if(!r.ok)return; const d=await r.json(); updateBeacon(d.events||[]);}
    catch(e){if(e.name!=='AbortError')console.warn('[SBC POLL] automation status unavailable');}
    finally{clearTimeout(timer);automationPollInFlight=false;}
  }
  function boot(){
    document.body.classList.add('sbc-cinematic-active'); addBeacon(); motionize();
    if(observer)observer.disconnect(); observer=new MutationObserver(()=>{addBeacon();motionize();});
    const c=q('#content'); if(c)observer.observe(c,{childList:true,subtree:true});
    pollAutomation(); clearInterval(poll); poll=setInterval(pollAutomation,20000);
    window.addEventListener('sbc:authenticated',pollAutomation,{once:true});
    window.SBC_CINEMATIC={version:VERSION,refresh:pollAutomation};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

// SBC_V6639_PUBLISHED_READ_POLL_GUARD
