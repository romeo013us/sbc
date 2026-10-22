(function(){
'use strict';
var KEY='sbc-nav-rail-v6574';
var MIN=190,MAX=360,COLLAPSED=64,DEFAULT=260;
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}}
function save(state){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}}
function findSidebar(){return document.querySelector('.sidebar')||document.querySelector('aside[data-sidebar]')||document.querySelector('[data-sidebar]')||document.querySelector('aside[aria-label]')}
function findMain(sidebar){var main=document.querySelector('#main-content,.main-content,#content,.content-area,.dashboard-content,main');if(main&&main!==sidebar)return main;return null}
function init(){
 var sidebar=findSidebar();if(!sidebar){return false}
 if(sidebar.dataset.sbcNavRailReady==='true')return true;
 sidebar.dataset.sbcNavRailReady='true';sidebar.setAttribute('data-sbc-nav-rail','true');
 var state=read(),width=Number(state.width);if(!Number.isFinite(width))width=DEFAULT;width=Math.max(MIN,Math.min(MAX,width));
 var collapsed=state.collapsed===true;
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
  resizeHandle.hidden=collapsed;
  save({width:width,collapsed:collapsed});
  window.dispatchEvent(new CustomEvent('sbc:navigation-resized',{detail:{width:collapsed?COLLAPSED:width,collapsed:collapsed}}));
 }
 var controls=document.createElement('div');controls.className='sbc-nav-rail-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','Navigation panel controls');
 var title=document.createElement('span');title.className='sbc-nav-rail-title';title.textContent='NAVIGATION';
 var toggle=document.createElement('button');toggle.type='button';toggle.className='sbc-nav-rail-toggle';toggle.textContent='«';toggle.addEventListener('click',function(){collapsed=!collapsed;apply()});
 controls.appendChild(title);controls.appendChild(toggle);sidebar.insertBefore(controls,sidebar.firstChild);
 var resizeHandle=document.createElement('button');resizeHandle.type='button';resizeHandle.className='sbc-nav-rail-resize';resizeHandle.setAttribute('aria-label','Resize navigation panel');resizeHandle.title='Drag to resize navigation';resizeHandle.textContent='';sidebar.appendChild(resizeHandle);
 var dragging=false,startX=0,startWidth=width;
 function move(ev){if(!dragging)return;var delta=ev.clientX-startX;var next=Math.max(MIN,Math.min(MAX,startWidth+delta));width=next;apply()}
 function stop(){if(!dragging)return;dragging=false;document.body.style.cursor='';document.body.style.userSelect='';window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop)}
 resizeHandle.addEventListener('pointerdown',function(ev){if(collapsed)return;ev.preventDefault();dragging=true;startX=ev.clientX;startWidth=width;document.body.style.cursor='col-resize';document.body.style.userSelect='none';window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop)});
 resizeHandle.addEventListener('keydown',function(ev){if(ev.key!=='ArrowLeft'&&ev.key!=='ArrowRight')return;ev.preventDefault();width=Math.max(MIN,Math.min(MAX,width+(ev.key==='ArrowRight'?10:-10)));apply()});
 apply();
 return true;
}
function boot(){if(init())return;var tries=0;var timer=setInterval(function(){if(init()||++tries>=30)clearInterval(timer)},200);if(window.MutationObserver){var obs=new MutationObserver(function(){if(init())obs.disconnect()});obs.observe(document.documentElement,{childList:true,subtree:true})}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
