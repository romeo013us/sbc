/* SBC FOCUS WORKSPACE: reversible, non-destructive navigation for daily work. */
(function(){
'use strict';
if(window.SBC_COMMAND_FOCUS)return;
var KEY='sbc-focus-workspace-v1',OWNER_KEY='sbc-owner-clean-workspace-v2',initialized=false,settleLateNav=null;
function owner(){return window.state?.me?.role==='owner';}
function preferenceKey(){return owner()?OWNER_KEY:KEY;}
function compact(){try{return localStorage.getItem(preferenceKey())!=='all';}catch(_){return true;}}
function syncDisplay(){
 var on=compact(),isOwner=owner();
 document.documentElement.dataset.sbcOwnerClean=isOwner&&on?'true':'false';
 document.documentElement.dataset.sbcOwnerRoutine=isOwner&&on&&window.state?.data?.readOnly!==true&&window.state?.data?.recovery?.required===false?'true':'false';
 document.documentElement.dataset.sbcFocusMode=on?'focus':'all';
 var advancedSummary=document.querySelector('#sbcAdvancedNav > summary');if(advancedSummary)advancedSummary.textContent=isOwner?'＋ Administration & System Tools':'＋ More tools';
 var toggle=document.getElementById('sbcFocusToggle');
 if(toggle){toggle.textContent=on?'◫ Show all tools':'✦ Focus view';toggle.setAttribute('aria-pressed',String(on));}
}
var topSlots=new Map();
function reconcileTopShortcuts(){
 var top=document.querySelector('#app .top-actions');if(!top)return;
 var group=document.getElementById('sbcOwnerExtraShortcuts');
 if(!owner()||!compact()){
  topSlots.forEach(function(anchor,node){
   if(anchor.parentNode){if(node.isConnected)anchor.parentNode.insertBefore(node,anchor);anchor.remove();}
  });
  topSlots.clear();if(group)group.remove();return;
 }
 topSlots.forEach(function(anchor,node){if(!node.isConnected){anchor.remove();topSlots.delete(node);}});
 var ids=['sbc-website-call-desk-topbar','sbc-website-sales-pipeline-topbar','sbc-connected-journey-owner'];
 ids.forEach(function(id){
  var node=document.getElementById(id);
  if(!node||node.parentElement!==top)return;
  if(!group){
   group=document.createElement('details');group.id='sbcOwnerExtraShortcuts';
   var title=document.createElement('summary');title.textContent='More shortcuts';
   var items=document.createElement('div');items.className='sbc-owner-shortcut-items';
   group.append(title,items);top.appendChild(group);
  }
  var anchor=document.createComment('SBC original shortcut position '+id);
  top.insertBefore(anchor,node);topSlots.set(node,anchor);
  group.querySelector('.sbc-owner-shortcut-items').appendChild(node);
 });
}
function wrapDashboardDetails(root){
 // Only exact, reviewed dashboard cards. Do not fold alerts, sales actions,
 // recovery notices, production work, statistics, or employee workstations.
 var active=owner()&&compact()&&window.state?.view==='dashboard'&&window.state?.data?.readOnly!==true&&window.state?.data?.recovery?.required===false;
 if(!active){
  root.querySelectorAll('details[data-sbc-owner-dashboard-detail]').forEach(function(group){
   var parent=group.parentElement,body=group.querySelector('.sbc-owner-detail-body');
   if(parent&&body)Array.from(body.children).forEach(function(node){parent.insertBefore(node,group);});
   group.remove();
  });
  return;
 }
 function wrap(node,key,label){
  if(!node||node.closest('details[data-sbc-owner-dashboard-detail]')||!node.parentElement)return;
  var group=document.createElement('details');group.className='card section sbc-owner-dashboard-detail';group.dataset.sbcOwnerDashboardDetail=key;
  var summary=document.createElement('summary');summary.textContent=label;
  var body=document.createElement('div');body.className='sbc-owner-detail-body';
  group.append(summary,body);node.parentElement.insertBefore(group,node);body.appendChild(node);
 }
 var briefing=root.querySelector('.ai-role-briefing');
 wrap(briefing,'briefing','AI briefing');
 var cards=Array.from(root.querySelectorAll('.card'));
 var named=function(title){return cards.find(function(card){return card.querySelector('.card-head h2')?.textContent.trim()===title;});};
 var catalog=named('Internal package catalog · includes legacy offers'),recent=named('Recent activity');
 // Their original shared grid remains intact; the full view restores the exact same nodes.
 if(catalog&&recent&&catalog.parentElement===recent.parentElement&&catalog.parentElement.classList.contains('grid')){
  wrap(catalog.parentElement,'reference','Recent activity and reference pricing');
 }
}

function setCompact(on){
 try{localStorage.setItem(preferenceKey(),on?'focus':'all');}catch(_){}
 syncDisplay();
 var advanced=document.getElementById('sbcAdvancedNav');
 if(advanced&&on)advanced.open=false;
 if(advanced&&!on)advanced.open=true;
 if(settleLateNav)settleLateNav();
 simplifyPageActions();
}
function simplifyPageActions(){
 var root=document.getElementById('content');if(!root)return;
 syncDisplay();
 reconcileTopShortcuts();
 wrapDashboardDetails(root);
 // Owner actions have a curated existing primary/secondary split. Do not
 // arbitrarily bury the third action (e.g. checkout or a call control).
 if(!compact()||owner()){
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
function watchLateNavigation(nav,main,advanced,groups){
 var pending=false;
 function settle(){
  pending=false;
  // Late-injected legacy controls must not escape the existing More tools group.
  // Keep the original DOM nodes and event listeners, including role-hidden nodes.
  if(!owner()||!compact())return;
  Array.from(nav.children).forEach(function(child){if(child!==main&&child!==advanced)groups.appendChild(child);});
 }
 settleLateNav=settle;
 new MutationObserver(function(){if(!pending){pending=true;queueMicrotask(settle);}}).observe(nav,{childList:true});
 window.addEventListener('sbc:authenticated',settle);
 window.addEventListener('sbc:view-rendered',settle);
 settle();
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
  {view:'crm',label:'Sales Pipeline'},
  {view:'callcenter',label:'Call Center'},
  {id:'sbc-website-production-nav'},
  {view:'orders',label:'Orders & Delivery'},
  {view:'acquisition',label:'Find Customers'},
  {view:'workforce',label:'Team'}
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
 if(legacy){legacy.insertBefore(groups,legacy.firstChild);if(typeof MutationObserver==='function')watchLateNavigation(nav,main,advanced,groups);}
 var summary=advanced.querySelector('summary');if(summary)summary.textContent=owner()?'＋ Administration & System Tools':'＋ More tools';
 advanced.classList.add('sbc-focus-more');
 var bottom=document.querySelector('#app .sidebar-bottom');
 if(bottom){
  var toggle=document.createElement('button');toggle.id='sbcFocusToggle';toggle.type='button';toggle.className='nav-item sbc-focus-toggle';
  toggle.addEventListener('click',function(){setCompact(!compact());});
  bottom.insertBefore(toggle,bottom.firstChild);
 }
 syncDisplay();
 if(compact())advanced.open=false;
 watchPage();
 var top=document.querySelector('#app .top-actions');
 if(top&&typeof MutationObserver==='function'){
  var topPending=false;
  new MutationObserver(function(){if(topPending)return;topPending=true;queueMicrotask(function(){topPending=false;reconcileTopShortcuts();});}).observe(top,{childList:true});
 }
 window.addEventListener('sbc:authenticated',simplifyPageActions);
 window.addEventListener('sbc:view-rendered',simplifyPageActions);
 // Additive owner assistant bootstrap: reuse the existing JS/CSS bundle count of
 // index.html. The assistant has its own server-side owner and tenant guards.
 if(!document.getElementById('sbc-chatgpt-os-script-loader')){
  var style=document.createElement('link');style.id='sbc-chatgpt-os-css-loader';
  style.rel='stylesheet';style.href='/sbc-chatgpt-os-v1.css?v=66.0.132-resume';
  document.head.appendChild(style);
  var script=document.createElement('script');script.id='sbc-chatgpt-os-script-loader';
  script.src='/sbc-chatgpt-os-v1.js?v=66.0.132-resume';script.async=true;
  document.body.appendChild(script);
 }

 // Keep the content-addressed owner shell intact: load optional free-action
 // UI through its existing focus bootstrap, not as new index.html tags.
 if(!document.getElementById('sbc-free-actions-script-loader')){
  var actionStyle=document.createElement('link');actionStyle.id='sbc-free-actions-css-loader';
  actionStyle.rel='stylesheet';actionStyle.href='/sbc-free-actions-v1.css?v=1';
  document.head.appendChild(actionStyle);
  var actionScript=document.createElement('script');actionScript.id='sbc-free-actions-script-loader';
  actionScript.src='/sbc-free-actions-v1.js?v=1';actionScript.async=true;
  document.body.appendChild(actionScript);
 }

}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.SBC_COMMAND_FOCUS=Object.freeze({enable:function(){setCompact(true);},showAll:function(){setCompact(false);}});
})();