(function(){
'use strict';
var KEY='sbc-nav-rail-v6574',COLLAPSED=64,DEFAULT=260;
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}}
function save(state){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}}
function findSidebar(){return document.querySelector('.sidebar')||document.querySelector('aside[data-sidebar]')||document.querySelector('[data-sidebar]')||document.querySelector('aside[aria-label]')}
function init(){
 var sidebar=findSidebar();if(!sidebar)return false;
 if(sidebar.dataset.sbcNavRailReady==='true')return true;
 sidebar.dataset.sbcNavRailReady='true';sidebar.setAttribute('data-sbc-nav-rail','true');
 var state=read(),collapsed=state.collapsed===true,width=DEFAULT;
 function apply(){
  document.documentElement.style.setProperty('--sbc-sidebar-width',width+'px');
  document.documentElement.style.setProperty('--sbc-nav-width',collapsed?COLLAPSED+'px':width+'px');
  document.documentElement.classList.toggle('sbc-nav-collapsed',collapsed);
  document.body.classList.add('sbc-nav-rail-ready');
  toggle.setAttribute('aria-expanded',String(!collapsed));
  toggle.setAttribute('aria-label',collapsed?'Expand navigation':'Collapse navigation');
  toggle.title=collapsed?'Expand navigation':'Collapse navigation';
  toggle.textContent=collapsed?'»':'«';
  controls.classList.toggle('is-collapsed',collapsed);
  save({collapsed:collapsed});
 }
 var controls=document.createElement('div');controls.className='sbc-nav-rail-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Navigation panel controls');
 var title=document.createElement('span');title.className='sbc-nav-rail-title';title.textContent='NAVIGATION';
 var toggle=document.createElement('button');toggle.type='button';toggle.className='sbc-nav-rail-toggle';toggle.textContent='«';toggle.addEventListener('click',function(){collapsed=!collapsed;apply()});
 controls.appendChild(title);controls.appendChild(toggle);sidebar.insertBefore(controls,sidebar.firstChild);
 apply();
 return true;
}
function boot(){if(init())return;var tries=0;var timer=setInterval(function(){if(init()||++tries>=30)clearInterval(timer)},200);if(window.MutationObserver){var obs=new MutationObserver(function(){if(init())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true})}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();