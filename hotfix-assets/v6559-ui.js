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
function initReorder(){
 var roots=Array.from(document.querySelectorAll('.content,#content,.main-content,[data-office-box],.grid,.stats')).filter(function(el){return el.children.length>1});
 roots.forEach(function(root,ri){
  if(root.dataset.sbcV6559Init)return;root.dataset.sbcV6559Init='1';
  function items(){return Array.from(root.children).filter(function(el){if(/^(SCRIPT|STYLE|LINK)$/i.test(el.tagName))return false;if(root.matches('.grid,.stats'))return true;var c=String(el.className||'').toLowerCase();return el.matches('section,article')||/(^|\s)(hero|card|stat|list-card|detail-box|table-wrap|dashboard-section|workspace-panel|office-box-section|grid|stats|section)(\s|$)/.test(c)||el.hasAttribute('data-dashboard-section')||el.hasAttribute('data-office-box-section')})}
  var list=items();if(list.length<2)return;
  list.forEach(function(el,i){el.classList.add('sbc-v6559-reorderable');el.draggable=true;el.tabIndex=el.tabIndex>=0?el.tabIndex:0;el.dataset.sbcSectionKey=titleOf(el,i)});
  var key=ORDER_KEY+':'+ri,saved=null;try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
  if(Array.isArray(saved)){var map=new Map(items().map(function(el,i){return [el.dataset.sbcSectionKey||titleOf(el,i),el]}));saved.forEach(function(k){if(map.has(k))root.appendChild(map.get(k))})}
  else{try{if(!localStorage.getItem(FIRST_RUN_KEY)){var first=items();if(first.length>1)root.appendChild(first[0]);localStorage.setItem(FIRST_RUN_KEY,'1')}}catch(e){}}
  function persist(){try{localStorage.setItem(key,JSON.stringify(items().map(function(el,i){return el.dataset.sbcSectionKey||titleOf(el,i)})))}catch(e){}}
  var dragged=null;
  root.addEventListener('dragstart',function(e){var el=e.target.closest('.sbc-v6559-reorderable');if(!el||!root.contains(el))return;dragged=el;el.classList.add('sbc-v6559-dragging');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',el.dataset.sbcSectionKey||'')}},true);
  root.addEventListener('dragover',function(e){if(!dragged)return;var el=e.target.closest('.sbc-v6559-reorderable');if(!el||el===dragged||!root.contains(el))return;e.preventDefault();el.classList.add('sbc-v6559-drop-target');var r=el.getBoundingClientRect();if(e.clientY>r.top+r.height/2)el.after(dragged);else el.before(dragged)},true);
  root.addEventListener('drop',function(e){if(dragged){e.preventDefault();persist()}},true);
  root.addEventListener('dragend',function(){if(dragged)dragged.classList.remove('sbc-v6559-dragging');root.querySelectorAll('.sbc-v6559-drop-target').forEach(function(el){el.classList.remove('sbc-v6559-drop-target')});dragged=null;persist()},true);
 });
}
function run(){removeAcquisition();initReorder()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
if(document.body)new MutationObserver(function(){run()}).observe(document.body,{childList:true,subtree:true});
window.addEventListener('storage',function(e){if(e.key&&e.key.indexOf(ORDER_KEY)===0)location.reload()});
})();