/* SBC_V6612_NAV_GEOMETRY: accessible rail labels and mobile drawer close. */
(function(){
 'use strict';
 if(window.SBC_V6612_NAV_GEOMETRY)return;
 window.SBC_V6612_NAV_GEOMETRY=true;
 function labelNav(){
  var sidebar=document.querySelector('#app.app > aside.sidebar');
  if(!sidebar)return;
  sidebar.querySelectorAll('nav button[data-view]').forEach(function(btn){
   var name=String(btn.textContent||'').replace(/\s+/g,' ').trim();
   if(name&&!btn.getAttribute('aria-label'))btn.setAttribute('aria-label',name);
   if(name&&!btn.getAttribute('title'))btn.setAttribute('title',name);
  });
 }
 function closeIfOutside(ev){
  if(window.matchMedia('(min-width:851px)').matches)return;
  var sidebar=document.querySelector('#app.app > aside.sidebar');
  if(!sidebar||!sidebar.classList.contains('open'))return;
  if(ev.target.closest?.('#mobileMenu'))return;
  if(ev.target.closest?.('#app.app > aside.sidebar'))return;
  sidebar.classList.remove('open');
 }
 function escapeClose(ev){
  if(ev.key!=='Escape')return;
  var sidebar=document.querySelector('#app.app > aside.sidebar');
  if(sidebar?.classList.contains('open')){
   sidebar.classList.remove('open');
   document.querySelector('#mobileMenu')?.focus();
  }
 }
 function init(){
  labelNav();
  var menu=document.querySelector('#mobileMenu');
  if(menu&&!menu.hasAttribute('aria-label'))menu.setAttribute('aria-label','Toggle navigation menu');
  if(menu&&!menu.hasAttribute('aria-controls'))menu.setAttribute('aria-controls','sbc-navigation');
  var nav=document.querySelector('#app.app > aside.sidebar nav');
  if(nav&&!nav.id)nav.id='sbc-navigation';
  document.addEventListener('click',closeIfOutside);
  document.addEventListener('keydown',escapeClose);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
