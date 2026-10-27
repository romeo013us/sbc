(function(){
  'use strict';
  const KEY='sbc-theme';
  const qs=(s)=>document.querySelector(s);
  function theme(){try{return localStorage.getItem(KEY)||'light'}catch{return 'light'}}
  function applyTheme(t){
    t=t==='dark'?'dark':'light';
    document.body.dataset.theme=t;
    try{localStorage.setItem(KEY,t)}catch{};
    const b=qs('#sbcThemeToggle'); if(b)b.textContent=t==='dark'?'☀️ Light':'🌙 Dark';
    const sel=qs('#sbcThemeSelect'); if(sel)sel.value=t;
  }
  window.applySbcTheme=applyTheme;
  window.toggleSbcTheme=function(){applyTheme(theme()==='dark'?'light':'dark')};

  async function getSettings(){
    const r=await fetch('/api/settings',{credentials:'same-origin',cache:'no-store'});
    const text=await r.text();
    let j; try{j=JSON.parse(text)}catch(e){throw new Error('Settings endpoint returned non-JSON (HTTP '+r.status+')')}
    if(!r.ok)throw new Error(j.error||('Settings request failed (HTTP '+r.status+')'));
    return j.settings||{};
  }
  function setMasterUI(on,recoveryOverride){
    const recovery=typeof recoveryOverride==='boolean'?recoveryOverride:Boolean(window.state?.data?.recovery?.required);
    if(recovery) on=false;
    const b=qs('#sbcSystemMasterButton');
    if(b){b.dataset.power=on?'on':'off';b.dataset.locked=recovery?'true':'false';b.setAttribute('aria-pressed',String(on));b.title=recovery?'Recovery lock active: restore and verify authoritative MySQL before enabling routine automation.':'Master automation on/off';b.innerHTML='<span class="sbc-power-dot"></span><span class="sbc-power-label">'+(recovery?'RECOVERY LOCK':on?'SYSTEM ON':'SYSTEM OFF')+'</span>'}
    const sw=qs('#sbcSystemMasterSwitch'); if(sw){sw.dataset.on=String(on);sw.dataset.locked=String(recovery);sw.setAttribute('aria-checked',String(on));sw.disabled=recovery;sw.title=recovery?'Disabled until authoritative database recovery is verified.':'Toggle SBC automation';}
    const status=qs('#sbcSystemMasterStatus'); if(status)status.textContent=recovery?'Routine automation is intentionally blocked until authoritative MySQL recovery is verified. Notifications and read-only diagnostics remain available.':on?'Automation is enabled.':'Automation is paused.';
  }
  async function authoritativeRecoveryRequired(){
    const r=await fetch('/api/owner/recovery/status',{credentials:'same-origin',cache:'no-store'});
    const t=await r.text();let j;try{j=JSON.parse(t)}catch{throw new Error('Recovery status returned non-JSON. Automation stays OFF.')}
    if(!r.ok||j.ok===false)throw new Error(j.message||j.error||'Recovery status unavailable. Automation stays OFF.');
    return Boolean(j.recoveryRequired);
  }
  window.sbcRefreshMasterControl=async function(){
    try{const [s,recovery]=await Promise.all([getSettings(),authoritativeRecoveryRequired()]);const effective=!recovery && s.automationEnabled!==false;setMasterUI(effective,recovery);return effective}catch(e){setMasterUI(false,true);const status=qs('#sbcSystemMasterStatus');if(status)status.textContent='Recovery status unavailable; routine automation stays OFF until status can be verified.';return false}
  };
  window.sbcToggleAutomationMaster=async function(){
    try{if(await authoritativeRecoveryRequired()){setMasterUI(false,true);if(window.toast)window.toast('Recovery lock active: routine automation cannot start until the authoritative MySQL restore is verified. Use Notifications to review the blocker.');return;}}catch(e){setMasterUI(false,true);if(window.toast)window.toast(e.message||'Recovery status unavailable. Automation stays OFF.');return;}
    const current=qs('#sbcSystemMasterButton')?.dataset.power==='on';
    const next=!current;
    const message=next
      ? 'Turn SBC automation ON? Routine automated follow-up and background automation will resume. Payments and inbound webhooks are not disabled by this switch.'
      : 'Turn SBC automation OFF? Routine automated follow-up/background automation will pause. Payments and inbound webhooks remain available.';
    if(!confirm(message))return;
    try{
      const r=await fetch('/api/settings',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({automationEnabled:next})});
      const text=await r.text();let j;try{j=JSON.parse(text)}catch(e){throw new Error('Settings update returned non-JSON (HTTP '+r.status+')')}
      if(!r.ok)throw new Error(j.error||('Settings update failed (HTTP '+r.status+')'));
      setMasterUI(Boolean(j.automationEnabled),false);
      if(window.toast)window.toast(Boolean(j.automationEnabled)?'⚡ SBC automation is ON.':'⏸️ SBC automation is OFF.');
      if(window.state?.data?.settings)window.state.data.settings.automationEnabled=Boolean(j.automationEnabled);
    }catch(e){
      if(window.toast)window.toast('System switch failed: '+e.message); else alert('System switch failed: '+e.message);
    }
  };
  function mountTopButton(){
    const top=qs('.top-actions'); if(!top||qs('#sbcSystemMasterButton'))return;
    const b=document.createElement('button');b.id='sbcSystemMasterButton';b.type='button';b.className='icon-btn sbc-system-master-control';b.title='Master automation on/off';b.setAttribute('aria-label','Master SBC automation on or off');b.onclick=window.sbcToggleAutomationMaster;top.insertBefore(b,qs('#sbcThemeToggle')||null);
    window.sbcRefreshMasterControl();
  }
  function injectDashboardPanel(){
    if(!window.state||window.state.view!=='dashboard')return;
    const content=qs('#content'); if(!content||qs('#sbcSystemMasterPanel'))return;
    const panel=document.createElement('section');panel.id='sbcSystemMasterPanel';panel.className='sbc-system-panel';
    panel.innerHTML='<div class="sbc-system-copy"><div class="sbc-system-icon">⚡</div><div><div class="sbc-system-title">SBC Automation Master Control</div><div id="sbcSystemMasterStatus" class="sbc-system-note">Checking authoritative recovery state…</div><button type="button" class="sbc-recovery-link" onclick="window.sbcNavigate?.(\'notifications\')">Open Notifications & Recovery Actions →</button></div></div><button id="sbcSystemMasterSwitch" class="sbc-switch" type="button" role="switch" aria-label="Toggle SBC automation" aria-checked="false" data-on="false" onclick="sbcToggleAutomationMaster()"></button>';
    content.prepend(panel);window.sbcRefreshMasterControl();
  }
  function boot(){applyTheme(theme());mountTopButton();setTimeout(injectDashboardPanel,500);setInterval(function(){mountTopButton();injectDashboardPanel()},2000)}
  document.addEventListener('DOMContentLoaded',boot);
  window.addEventListener('sbc:view-rendered',function(){setTimeout(injectDashboardPanel,50)});
})();
