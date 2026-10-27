/* SBC_V6612_NAV_GEOMETRY: independent fixed/collapsible rail, no drag. */
(function(){
 'use strict';
 if(window.SBC_V6612_NAV_GEOMETRY)return;
 window.SBC_V6612_NAV_GEOMETRY=true;
 var STORAGE='sbc-nav-collapse-v6612',sidebar=null,openMenu=null,collapsed=false;
 function storageRead(){
  try{return localStorage.getItem(STORAGE)==='collapsed'}catch(_){return false}
 }
 function storageSave(){
  try{localStorage.setItem(STORAGE,collapsed?'collapsed':'expanded')}catch(_){}
 }
 function render(){
  if(!sidebar)return;
  document.documentElement.classList.toggle('sbc-nav-collapsed',collapsed);
  document.documentElement.style.setProperty('--sbc-nav-width',collapsed?'64px':'260px');
  document.body.classList.add('sbc-nav-rail-ready');
  sidebar.dataset.sbcNavRailReady='true';
  sidebar.dataset.sbcNavRail='true';
  if(openMenu){
   openMenu.setAttribute('aria-expanded',String(!collapsed));
   openMenu.setAttribute('aria-label',collapsed?'Expand navigation':'Collapse navigation');
   openMenu.title=collapsed?'Expand navigation':'Collapse navigation';
   openMenu.textContent=collapsed?'»':'«';
  }
 }
 function labelNav(){
  if(!sidebar)return;
  sidebar.querySelectorAll('nav button[data-view]').forEach(function(btn){
   var name=String(btn.textContent||'').replace(/\s+/g,' ').trim();
   if(name&&!btn.getAttribute('aria-label'))btn.setAttribute('aria-label',name);
   if(name&&!btn.getAttribute('title'))btn.setAttribute('title',name);
  });
 }
 function closeIfOutside(ev){
  if(window.matchMedia('(min-width:851px)').matches)return;
  if(!sidebar||!sidebar.classList.contains('open'))return;
  if(ev.target.closest?.('#mobileMenu'))return;
  if(ev.target.closest?.('#app.app > aside.sidebar'))return;
  sidebar.classList.remove('open');
 }
 function escapeClose(ev){
  if(ev.key!=='Escape'||!sidebar?.classList.contains('open'))return;
  sidebar.classList.remove('open');
  document.querySelector('#mobileMenu')?.focus();
 }
 function init(){
  sidebar=document.querySelector('#app.app > aside.sidebar');
  if(!sidebar)return;
  if(sidebar.dataset.sbcNavGeometryReady==='true')return;
  sidebar.dataset.sbcNavGeometryReady='true';
  collapsed=storageRead();
  var controls=document.createElement('div');controls.className='sbc-nav-rail-controls';
  controls.setAttribute('role','group');controls.setAttribute('aria-label','Navigation panel controls');
  var title=document.createElement('span');title.className='sbc-nav-rail-title';title.textContent='NAVIGATION';
  openMenu=document.createElement('button');openMenu.type='button';openMenu.className='sbc-nav-rail-toggle';
  openMenu.addEventListener('click',function(){collapsed=!collapsed;storageSave();render()});
  controls.appendChild(title);controls.appendChild(openMenu);
  sidebar.insertBefore(controls,sidebar.firstChild);
  var nav=sidebar.querySelector('nav');
  if(nav&&!nav.id)nav.id='sbc-navigation';
  var menu=document.querySelector('#mobileMenu');
  if(menu&&!menu.hasAttribute('aria-label'))menu.setAttribute('aria-label','Toggle navigation menu');
  if(menu&&!menu.hasAttribute('aria-controls'))menu.setAttribute('aria-controls','sbc-navigation');
  labelNav();render();
  document.addEventListener('click',closeIfOutside);
  document.addEventListener('keydown',escapeClose);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
