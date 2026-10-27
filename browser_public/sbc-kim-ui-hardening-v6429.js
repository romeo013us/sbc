/* SBC V65.1.23 — canonical Kim UI ownership guard. Loaded after all legacy UI modules. */
(function(){'use strict';
const RELEASE='65.1.23',DOCK='sbcAiDock',LAUNCH='ckLauncher';
let timer=null,observer=null;
const legacy=['#sbcKimLauncher','.akx-launcher','.sbc-kim-bottom-launcher'];
function q(s){return document.querySelector(s)}
function clean(){legacy.forEach(s=>document.querySelectorAll(s).forEach(el=>{if(el.id!==LAUNCH)el.remove()}));document.querySelectorAll('#'+DOCK).forEach((el,i)=>{if(i>0)el.remove()});}
function wire(){
  const d=q('#'+DOCK), b=q('#'+LAUNCH); if(!d||!b)return;
  b.classList.remove('hidden'); b.hidden=false; b.style.display='flex';
  b.onclick=(e)=>{e.preventDefault();e.stopPropagation();window.sbcKimCanonical?.open?.();};
  d.dataset.release=RELEASE;
  const input=q('#sbcAiInput'),send=q('#sbcAiSend');
  if(input)input.style.pointerEvents='auto'; if(send)send.style.pointerEvents='auto';
}
function enforce(){clean();wire();}
function boot(){
  enforce();
  if(observer)observer.disconnect();
  observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(enforce,30)});
  observer.observe(document.body,{childList:true,subtree:true});
  window.__SBC_KIM_UI_RELEASE__=RELEASE;
  window.__SBC_KIM_UI_LOCKED__=true;
  window.__SBC_UI_RELEASE__=RELEASE;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
