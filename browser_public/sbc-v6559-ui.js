(function(){
'use strict';
var ORDER_KEY='sbc-office-box-section-order-v6559',FIRST_RUN_KEY='sbc-office-box-first-section-bottom-v6559';
function norm(s){return String(s||'').replace(/\s+/g,' ').trim().toLowerCase()}
function removeAcquisition(){
 var phrase='launch & customer acquisition os';
 var blocks=Array.from(document.querySelectorAll('section,article,.card,.panel,.workspace,.module,.dashboard-section'));
 var target=blocks.filter(function(el){var t=norm(el.innerText||el.textContent);return t.indexOf(phrase)>=0&&t.length<6000}).sort(function(a,b){return (a.innerText||'').length-(b.innerText||'').length})[0];
 if(!target){var els=Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,strong,b,div'));var h=els.find(function(el){var t=norm(el.innerText||el.textContent);return t.indexOf(phrase)>=0&&t.length<180});if(h){target=h;for(var i=0;i<8&&target.parentElement&&target!==document.body;i++){var p=target.parentElement;if(p.matches('section,article,.card,.panel,.workspace,.module,.dashboard-section')){target=p;break}target=p}}}
 if(target&&target!==document.body&&target!==document.documentElement)target.remove();
}
function titleOf(el,i){var h=el.querySelector('h1,h2,h3,h4,.card-head,strong');var t=norm(el.getAttribute('aria-label')||(h&&h.textContent)||el.textContent).slice(0,70);return el.id||t||('section-'+i)}
function initReorder(){ /* SBC_V6565_DASHBOARD_LAYOUT_STABILITY: disable global drag-reordering of dashboard/grid children. */ }
function run(){removeAcquisition();initReorder()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
// SBC_V6565_DASHBOARD_LAYOUT_STABILITY: no post-hydration observer may reorder or remove live dashboard sections.
// SBC_V6613_PROFILE_STABILITY: legacy cross-tab layout storage changes must not reload
// an authenticated workspace. The obsolete dashboard drag order is disabled.
})();