/* SBC V64.3.0 — CANONICAL KIM UI
   Single owner for the Kim surface. Uses existing app.js askSbcAI bridge.
*/
(function(){'use strict';
const ID='sbcAiDock', KEY='sbc.kim.canonical.v64.3.0';
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
let drag=null,resize=null,booted=false;
function dock(){return document.getElementById(ID)}
function saved(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function save(d){try{const r=d.getBoundingClientRect();localStorage.setItem(KEY,JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height}))}catch{}}
function ensure(){let d=dock();if(!d){d=document.createElement('div');d.id=ID;document.body.appendChild(d)}
  // Remove every known legacy Kim surface. The page must have ONE interactive Kim owner.
  document.querySelectorAll(
    '#ckLauncher,.ck-launcher,#kimGreatnessFab,#sbcKimLauncher,#v56KimDrawer,.akx-launcher,.sbc-kim-bottom-launcher,' +
    '.v56-kim-drawer,.v56-kim-launcher,[data-v56-kim],[data-kim-legacy]'
  ).forEach(x=>x.remove());
  d.className='sbc-kim-canonical hidden';d.hidden=true;d.setAttribute('aria-hidden','true');
  if(d.dataset.ckMarkup==='1')return d;
  d.dataset.ckMarkup='1';
  d.innerHTML=`<header class="ck-head" id="ckDrag"><div class="ck-brand"><div class="ck-avatar"><img src="/assets/kim-avatar.png" alt="Kim"></div><div class="ck-title"><strong>Kim · AI Chief of Staff</strong><small>SBC OPERATIONS · CANONICAL CONTROL SURFACE</small><span class="ck-status" id="sbcAiStatus">● READY</span></div></div><div class="ck-actions"><button class="ck-icon" id="ckMin" type="button" title="Minimize">−</button><button class="ck-icon" id="ckClose" type="button" title="Close">×</button></div></header><div class="ck-body"><div class="ck-context"><b>LIVE CONTEXT:</b> <span id="ckPage">Dashboard</span> · <span id="sbcAiContextState">Connecting…</span></div><div class="ck-messages" id="sbcAiMessages" aria-live="polite"><div class="ck-empty">Kim is ready. Ask about leads, customers, operations, revenue, the Command Center, or a problem that needs diagnosis.</div></div><div class="ck-quick"><button data-ck-prompt="Give me a quick executive read of what matters right now.">Executive read</button><button data-ck-prompt="Review the current Command Center and give me the next three useful actions.">Next 3 moves</button><button data-ck-prompt="Troubleshoot the thing currently not working and tell me exactly what to do.">Troubleshoot</button></div><div class="ck-compose"><textarea id="sbcAiInput" rows="1" placeholder="Message Kim…" aria-label="Message Kim"></textarea><button class="ck-send" id="sbcAiSend" type="button">➤</button></div><div class="ck-hint">ENTER to send · SHIFT+ENTER for a new line</div></div><div class="ck-resize" id="ckResize" title="Resize Kim"></div>`;
  return d;
}
function restore(d){const s=saved(),mobile=innerWidth<=650;if(mobile)return;const w=clamp(Number(s.width)||560,360,Math.max(360,innerWidth-16)),h=clamp(Number(s.height)||720,520,Math.max(520,innerHeight-16));d.style.width=w+'px';d.style.height=h+'px';place(d,Number.isFinite(+s.left)?+s.left:innerWidth-w-24,Number.isFinite(+s.top)?+s.top:innerHeight-h-24)}
function place(d,l,t){const r=d.getBoundingClientRect();d.style.right='auto';d.style.bottom='auto';d.style.left=clamp(l,6,Math.max(6,innerWidth-r.width-6))+'px';d.style.top=clamp(t,6,Math.max(6,innerHeight-r.height-6))+'px'}
function normalizeFields(){
  document.querySelectorAll('input[id],input[name],textarea[id],textarea[name]').forEach(el=>{
    if(el.hasAttribute('autocomplete')) return;
    const key=((el.getAttribute('name')||'')+' '+(el.id||'')).toLowerCase();
    let ac='off';
    if(/user(name)?|login/.test(key)) ac='username';
    else if(/password|passcode/.test(key)) ac='current-password';
    else if(/email/.test(key)) ac='email';
    else if(/phone|tel/.test(key)) ac='tel';
    else if(/website|url/.test(key)) ac='url';
    else if(/search/.test(key)) ac='off';
    el.setAttribute('autocomplete',ac);
  });
}
function killLegacyKim(){
  document.querySelectorAll('#ckLauncher,.ck-launcher,#kimGreatnessFab,.akx-launcher,#sbcKimLauncher,.sbc-kim-bottom-launcher,#v56KimDrawer,.v56-kim-drawer,[data-v56-kim],[data-kim-legacy]').forEach(x=>x.remove());
}
// SBC_V6550_REMOVE_FLOATING_ASK_KIM: no global floating launcher; use the in-page Ask Kim actions.
function context(){const p=$('#ckPage');if(p)p.textContent=$('#viewTitle')?.textContent||window.state?.view||'Dashboard';try{window.loadSbcKimLiveContext?.()}catch{}}
function open(prefill){const d=ensure();restore(d);d.classList.remove('hidden');d.hidden=false;d.style.display='flex';d.setAttribute('aria-hidden','false');context();const i=$('#sbcAiInput');if(prefill&&i){i.value=String(prefill);i.focus()}else setTimeout(()=>i?.focus(),50);return true}
function close(){const d=dock();if(!d)return;d.classList.add('hidden');d.hidden=true;d.style.display='none';d.setAttribute('aria-hidden','true')}
function send(text){const i=$('#sbcAiInput'),t=String(text||i?.value||'').trim();if(!t)return;i.value='';if(typeof window.askSbcAI==='function'){window.askSbcAI(t)}else{const s=$('#sbcAiStatus');if(s)s.textContent='● AI BRIDGE OFFLINE'}}
function bind(){if(booted)return;booted=true;const d=ensure();normalizeFields();killLegacyKim();
  const mo=new MutationObserver(()=>{killLegacyKim();normalizeFields();});
  mo.observe(document.body,{childList:true,subtree:true});
  restore(d);document.querySelectorAll('#ckLauncher,.ck-launcher,#kimGreatnessFab,.akx-launcher,#sbcKimLauncher,.sbc-kim-bottom-launcher').forEach(x=>x.remove())
  $('#ckClose').onclick=e=>{e.preventDefault();close()};$('#ckMin').onclick=e=>{e.preventDefault();close()};$('#sbcAiSend').onclick=e=>{e.preventDefault();send()};$('#sbcAiInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};$('#sbcAiInput').oninput=e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'};document.querySelectorAll('[data-ck-prompt]').forEach(b=>b.onclick=()=>send(b.dataset.ckPrompt));
  const h=$('#ckDrag'),g=$('#ckResize');h.onpointerdown=e=>{if(e.button!==0||e.target.closest('button'))return;const r=d.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,l:r.left,t:r.top};try{h.setPointerCapture(e.pointerId)}catch{}e.preventDefault()};h.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;place(d,drag.l+e.clientX-drag.x,drag.t+e.clientY-drag.y);e.preventDefault()};h.onpointerup=e=>{if(drag&&e.pointerId===drag.id){save(d);drag=null}};g.onpointerdown=e=>{if(e.button!==0)return;const r=d.getBoundingClientRect();resize={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height};try{g.setPointerCapture(e.pointerId)}catch{}e.preventDefault()};g.onpointermove=e=>{if(!resize||e.pointerId!==resize.id)return;d.style.width=clamp(resize.w+e.clientX-resize.x,360,Math.max(360,innerWidth-12))+'px';d.style.height=clamp(resize.h+e.clientY-resize.y,520,Math.max(520,innerHeight-12))+'px';e.preventDefault()};g.onpointerup=e=>{if(resize&&e.pointerId===resize.id){save(d);resize=null}};addEventListener('resize',()=>{if(!d.classList.contains('hidden')){if(innerWidth<=650){d.style.left='6px';d.style.top='6px';d.style.width='calc(100vw - 12px)';d.style.height='calc(100vh - 12px)'}else{place(d,d.getBoundingClientRect().left,d.getBoundingClientRect().top)}save(d)}},{passive:true});
  const oldOpen=window.openSbcAI;window.__SBC_LEGACY_OPEN_KIM__=oldOpen;window.openSbcAI=open;window.closeSbcAI=close;window.sbcKimCanonical={open,close,ensure};context();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
