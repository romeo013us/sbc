(function(){
'use strict';
const V='56.2.0';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function nav(view){document.querySelector(`[data-view="${view}"]`)?.click();}
function enhance(){
 document.body.dataset.sbcExperience=V;
 const shell=document.querySelector('.v56-shell'); if(!shell||shell.dataset.v562) return;
 shell.dataset.v562='1';
 const strip=document.createElement('div'); strip.className='v562-command-strip';
 const d=window.state?.data||{}; const leads=(d.customers||[]).filter(x=>!['Customer','Lost','Do Not Call','Closed','Duplicate','Not Qualified'].includes(String(x.status||''))).length;
 const orders=(d.orders||[]).filter(x=>!['Delivered','Cancelled'].includes(String(x.status||''))).length;
 strip.innerHTML=`<span class="v562-pill">SBC <strong>V56.2</strong></span><span class="v562-pill">Pipeline <strong>${leads}</strong></span><span class="v562-pill">Delivery <strong>${orders}</strong></span><span class="v562-pill">Control <strong>Human-governed</strong></span>`;
 shell.prepend(strip);
 const auto=document.querySelector('#v56AutonomyRail');
 if(auto && !document.querySelector('.v562-office')){
   const box=document.createElement('section'); box.className='v562-office';
   box.innerHTML=`<div><div class="v56-kicker">OFFICE BOX · CUSTOMER OPERATING SYSTEM</div><h3>Turn completed sales into a customer workspace.</h3><p>The Command Center owns the relationship and fulfillment. Office Box gives the customer their own tenant-scoped business workspace.</p></div><div class="v562-office-actions"><button class="v56-btn primary" data-v562="office">Open Office Box</button><button class="v56-btn" data-v562="plan">Plan workspace</button></div>`;
   auto.parentNode.insertBefore(box,auto);
 }
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-v562]');if(!b)return; if(b.dataset.v562==='office'){const u=window.__SBC_OFFICE_BOX_URL||'/office-box';window.open(u,'_blank','noopener');}else if(b.dataset.v562==='plan'){nav('settings');}});
window.addEventListener('DOMContentLoaded',()=>setTimeout(enhance,900));
const oldPush=history.pushState; history.pushState=function(){const r=oldPush.apply(this,arguments);setTimeout(enhance,150);return r};
})();
