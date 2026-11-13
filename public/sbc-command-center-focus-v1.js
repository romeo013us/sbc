/* SBC FOCUS WORKSPACE: reversible, non-destructive navigation for daily work. */
(function(){
'use strict';
if(window.SBC_COMMAND_FOCUS)return;
var KEY='sbc-focus-workspace-v1',initialized=false;
function compact(){try{return localStorage.getItem(KEY)!=='all';}catch(_){return true;}}
function setCompact(on){
 try{localStorage.setItem(KEY,on?'focus':'all');}catch(_){}
 document.documentElement.dataset.sbcFocusMode=on?'focus':'all';
 var toggle=document.getElementById('sbcFocusToggle');
 if(toggle){toggle.textContent=on?'◫ Show all tools':'✦ Focus view';toggle.setAttribute('aria-pressed',String(on));}
 var advanced=document.getElementById('sbcAdvancedNav');
 if(advanced&&on)advanced.open=false;
 if(advanced&&!on)advanced.open=true;
 simplifyPageActions();
}
function simplifyPageActions(){
 var root=document.getElementById('content');if(!root)return;
 if(!compact()){
  root.querySelectorAll('details.sbc-page-more-actions').forEach(function(group){
   var parent=group.parentElement,extras=group.querySelector('.sbc-page-extra-buttons');
   if(parent&&extras){Array.from(extras.children).forEach(function(node){parent.insertBefore(node,group);});delete parent.dataset.sbcFocusFolded;}
   group.remove();
  });
  return;
 }
 root.querySelectorAll('.hero-actions,.crm-toolbar > .actions,.card-head > .actions').forEach(function(row){
  if(row.dataset.sbcFocusFolded==='1')return;
  var actions=Array.from(row.children).filter(function(el){return el.matches('button,a,[role="button"]');});
  if(actions.length<4)return;
  row.dataset.sbcFocusFolded='1';
  var more=document.createElement('details');more.className='sbc-page-more-actions';
  var title=document.createElement('summary');title.textContent='More actions';
  var items=document.createElement('div');items.className='sbc-page-extra-buttons';
  actions.slice(2).forEach(function(action){items.appendChild(action);});
  more.append(title,items);row.appendChild(more);
 });
}
function watchPage(){
 var root=document.getElementById('content');
 if(!root||typeof MutationObserver!=='function')return;
 var scheduled=false;
 new MutationObserver(function(){
  if(scheduled)return;scheduled=true;
  queueMicrotask(function(){scheduled=false;simplifyPageActions();});
 }).observe(root,{childList:true,subtree:true});
 simplifyPageActions();
}
function navLink(view,icon,label){
 var b=document.createElement('button');b.type='button';b.className='nav-item v56-nav-item';
 b.dataset.view=view;b.textContent=icon+' '+label;
 b.addEventListener('click',function(){if(typeof window.sbcNavigate==='function')window.sbcNavigate(view);});
 return b;
}
function install(){
 if(initialized)return;
 var nav=document.querySelector('#app .sidebar nav.v56-primary-nav'),advanced=document.getElementById('sbcAdvancedNav');
 if(!nav||!advanced)return;
 initialized=true;
 var main=document.createElement('div');main.id='sbcFocusNav';main.setAttribute('aria-label','Daily work');
 var label=document.createElement('p');label.className='sbc-focus-caption';label.textContent='YOUR WORKSPACE';main.appendChild(label);
 var quick=[
  {view:'dashboard',label:'Home'},
  {view:'customers',label:'Leads & Accounts'},
  {view:'callcenter',label:'Call Center'},
  {id:'sbc-website-production-nav'},
  {view:'orders',label:'Orders & Delivery'},
  {view:'acquisition',label:'Find Customers'},
  {view:'workforce',label:'Team'},
  {view:'metrics',label:'Performance'}
 ];
 quick.forEach(function(item){
  var node=item.id?document.getElementById(item.id):nav.querySelector('.nav-item[data-view="'+item.view+'"]');
  if(!node&&item.view==='callcenter')node=navLink('callcenter','☎','Call Center');
  if(!node)return;
  if(!item.id){
   var original=node.querySelector('span');
   if(original){node.replaceChildren(original,document.createTextNode(' '+item.label));}
   else node.textContent=item.label;
  }
  node.classList.add('sbc-focus-link');
  main.appendChild(node);
 });
 nav.insertBefore(main,nav.firstChild);
 var groups=document.createElement('div');groups.className='sbc-focus-secondary';
 // Keep all existing modules and event handlers. Reorganize navigation; never delete a tool.
 Array.from(nav.children).forEach(function(child){if(child!==main&&child!==advanced)groups.appendChild(child);});
 var legacy=advanced.querySelector('.v56-legacy-tools');
 if(legacy)legacy.insertBefore(groups,legacy.firstChild);
 var summary=advanced.querySelector('summary');if(summary)summary.textContent='＋ More tools';
 advanced.classList.add('sbc-focus-more');
 var bottom=document.querySelector('#app .sidebar-bottom');
 if(bottom){
  var toggle=document.createElement('button');toggle.id='sbcFocusToggle';toggle.type='button';toggle.className='nav-item sbc-focus-toggle';
  toggle.addEventListener('click',function(){setCompact(!compact());});
  bottom.insertBefore(toggle,bottom.firstChild);
 }
 setCompact(compact());
 watchPage();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.SBC_COMMAND_FOCUS=Object.freeze({enable:function(){setCompact(true);},showAll:function(){setCompact(false);}});
})();