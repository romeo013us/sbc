/* Super SBC: zero-AI CRM next actions, progressive enhancement only.
 * Never sends messages, charges cards, triggers APIs beyond an authenticated GET,
 * stores customer data in browser storage or opens an unverified account.
 */
(function(){
 'use strict';
 if(window.SBC_FREE_ACTIONS_V1)return;
 var PATH='/api/sbc/free-actions/today?limit=12',board=null,items=null,status=null,count=null,dialog=null,loading=false,refreshPending=false,lastFetchAt=0,laneBar=null,summary=null,coverage=null,activeLane=null,current=null;
 function node(tag,className,text){var el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;}
 function newButton(label,className,click){var b=node('button',className,label);b.type='button';b.addEventListener('click',click);return b;}
 var laneMeta=[
  {id:'commitments',label:'Due now',description:'Overdue and today’s commitments',mark:'01'},
  {id:'review',label:'Needs review',description:'Data quality and contact restrictions',mark:'02'},
  {id:'upcoming',label:'Next 7 days',description:'Prepare for upcoming follow-ups',mark:'03'},
  {id:'pipeline',label:'Grow the pipeline',description:'Assignment, qualification and planning',mark:'04'}
 ];
 function setup(){
  if(board)return true;
  var am=document.getElementById('view-accounts'),focus=document.getElementById('sbcFocusNav');
  if(!am&&!focus)return false;
  var owner=!am;
  board=node('section','sbc-actions-board'+(owner?' sbc-actions-owner':''));
  board.id='sbcFreeActionsBoard';
  board.setAttribute('aria-label','Verified CRM next actions');
  var header=node('div','sbc-actions-header');
  header.appendChild(node('div','sbc-actions-kicker','SBC / DAILY OPERATIONS'));
  var title=node('h2','sbc-actions-title','Your priority workspace');header.appendChild(title);
  status=node('p','sbc-actions-status','Checking assigned CRM actions…');status.setAttribute('role','status');
  count=node('span','sbc-actions-count','');
  var refresh=newButton('↻ Refresh','sbc-actions-refresh',load);
  refresh.setAttribute('aria-label','Refresh verified CRM next actions');
  var controls=node('div','sbc-actions-controls');controls.append(count,refresh);header.appendChild(controls);
  items=node('div','sbc-actions-items');items.setAttribute('aria-live','polite');
  summary=node('div','sbc-actions-summary');summary.setAttribute('aria-label','CRM sample coverage');
  laneBar=node('div','sbc-actions-lanes');laneBar.setAttribute('role','group');laneBar.setAttribute('aria-label','Filter work priorities');
  coverage=node('p','sbc-actions-coverage');
  board.append(header,status,summary,laneBar,coverage,items,node('p','sbc-actions-safety','Review and act in the authorized CRM. No automated outreach or paid AI.'));
  if(am){
   var search=am.querySelector('.sbc-account-search');
   if(search)am.insertBefore(board,search);else am.prepend(board);
   load();
  }else{
   var opener=newButton('Today’s priorities','sbc-actions-open',function(){
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    load();
   });
   focus.appendChild(opener);
   dialog=document.createElement('dialog');dialog.className='sbc-actions-dialog';
   dialog.setAttribute('aria-label','Verified owner CRM next actions');
   var close=newButton('✕ Close','sbc-actions-close',function(){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');});
   dialog.append(close,board);
   document.body.appendChild(dialog);
  }
  return true;
 }
 function clear(){while(items&&items.firstChild)items.removeChild(items.firstChild);}
 function showError(){
  count.textContent='Unavailable';
  status.textContent='CRM actions cannot be verified right now. Nothing was changed.';
  current=null;summary.replaceChildren();laneBar.replaceChildren();coverage.textContent='';clear();
  items.appendChild(node('p','sbc-actions-empty','Check the Command Center connection or retry after signing in.'));
 }
 function one(row){
  var card=node('article','sbc-actions-item');
  var tag=node('span','sbc-actions-tag',String(row.title||'Review account'));
  var content=node('div','sbc-actions-row-content');content.appendChild(tag);
  content.appendChild(node('strong','sbc-actions-business',String(row.businessName||'Business account')));
  content.appendChild(node('p','sbc-actions-detail',String(row.detail||'Review this account.')));
  var grouped=Number.isSafeInteger(row.batchCount)&&row.batchCount>0;
  if(grouped)content.appendChild(node('small','sbc-actions-due',row.batchCount+' CRM records in this review queue.'));
  if(row.dueDate)content.appendChild(node('small','sbc-actions-due','Follow-up date: '+String(row.dueDate)));
  var owner=!document.getElementById('view-accounts');
  var open=newButton(grouped?(owner?'Open CRM assignment list':'Review assigned accounts'):(owner?'Open CRM list':'Open assigned account'),'sbc-actions-go',function(){
    if(owner){
     if(dialog?.open)dialog.close();
     if(typeof window.sbcNavigate==='function')window.sbcNavigate('customers');
     else document.querySelector('.nav-item[data-view="customers"]')?.click();
    }else{
     if(grouped){
      document.querySelector('.tab[data-view="accounts"]')?.click();
      document.getElementById('sbcAccountSearch')?.focus();
      return;
     }
     // The existing Account Manager handler enforces the assigned-portfolio
     // check again before opening the selected business.
     var b=node('button');b.type='button'; // reuse existing authorized action handler
     b.dataset.action='open-account';b.dataset.id=String(row.accountId||'');
     document.body.appendChild(b);b.click();b.remove();
    }
  });
  if(!owner)open.setAttribute('aria-label','Open '+String(row.businessName||'assigned account'));
  card.append(content,open);return card;
 }
 function renderLane(){
  if(!current)return;
  var lane=current.lanes.find(function(x){return x.id===activeLane;});
  var meta=laneMeta.find(function(x){return x.id===activeLane;});
  if(!lane||!meta)return;
  laneBar.querySelectorAll('button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.lane===activeLane));});
  clear();
  coverage.textContent=meta.description+' · Showing '+lane.actions.length+' of '+lane.decisionCount+' decisions'+(lane.moreDecisions?' in this lane. Open CRM for the remaining work.':'.');
  lane.actions.forEach(function(row){items.appendChild(one(row));});
  if(!lane.actions.length)items.appendChild(node('p','sbc-actions-empty','No decisions in this lane within the current CRM sample.'));
 }
 function render(data){
  // Fail closed on a stale or incompatible server response. Do not invent counts.
  if(!Array.isArray(data.lanes)||data.lanes.length!==laneMeta.length||!laneMeta.every(function(m){return data.lanes.filter(function(l){return l.id===m.id&&Number.isSafeInteger(l.decisionCount)&&l.decisionCount>=0&&Number.isSafeInteger(l.recordCount)&&l.recordCount>=l.decisionCount&&Array.isArray(l.actions)&&l.actions.length<=l.decisionCount;}).length===1;}))throw Error('WORKSPACE_LANES_UNAVAILABLE');
  current=data;
  if(!activeLane||!data.lanes.some(function(l){return l.id===activeLane;}))activeLane=(data.lanes.find(function(l){return l.decisionCount>0;})||data.lanes[0]).id;
  summary.replaceChildren();
  function metric(label,value){var m=node('div','sbc-actions-metric');m.append(node('span','',label),node('strong','',String(value)));summary.appendChild(m);}
  metric('CRM records sampled',data.sampledRecords);
  metric('Decisions identified',data.total);
  metric('Records needing verification',data.dataQualityCount||0);
  laneBar.replaceChildren();
  laneMeta.forEach(function(m){
   var l=data.lanes.find(function(x){return x.id===m.id;});
   var b=newButton('', 'sbc-actions-lane',function(){activeLane=m.id;renderLane();});
   b.dataset.lane=m.id;b.setAttribute('aria-pressed',String(m.id===activeLane));
   b.append(node('span','sbc-actions-lane-mark',m.mark),node('span','sbc-actions-lane-label',m.label),node('strong','sbc-actions-lane-count',l.decisionCount),node('small','sbc-actions-lane-records',l.recordCount+' affected records'));
   laneBar.appendChild(b);
  });
  renderLane();
 }
 function refreshAfterCommit(force){
  if(!board||document.visibilityState==='hidden')return;
  // Owner drawer refreshes when opened; don't query while the drawer is closed.
  if(dialog&&!dialog.open)return;
  if(loading){refreshPending=true;return;}
  if(!force&&Date.now()-lastFetchAt<60000)return;
  void load();
 }
 document.addEventListener('sbc:crm-committed',function(){refreshAfterCommit(true);});
 document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible')refreshAfterCommit(false);
 });
 async function load(){
  if(!board||loading){if(loading)refreshPending=true;return;}
  loading=true;status.textContent='Checking live authorized CRM records…';
  clear();count.textContent='';
  try{
   var response=await fetch(PATH,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   var data=await response.json().catch(function(){return null;});
   if(!response.ok||!data||data.ok!==true||data.readOnly!==true||data.source!=='AUTHORITATIVE_CRM_MYSQL'||!Array.isArray(data.actions))
    throw Error('VERIFIED_CRM_ACTIONS_UNAVAILABLE');
   count.textContent=data.businessDay?'ET · '+data.businessDay:'Verified sample';
   status.textContent=data.moreRecordsPossible?'Due-first sample of 500 CRM records; additional records exist outside this workspace.':'Authorized CRM sample · Priorities are organized by the next business decision.';
   render(data);
  }catch(_){showError();}
  finally{
   loading=false;lastFetchAt=Date.now();
   // A durable CRM commit during an in-flight read must not be lost.
   if(refreshPending){refreshPending=false;refreshAfterCommit(true);}
  }
 }
 function boot(){
  if(setup())return;
  var tries=0,watch=new MutationObserver(function(){
   if(setup()||++tries>60)watch.disconnect();
  });
  watch.observe(document.body,{childList:true,subtree:true});
  window.setTimeout(function(){watch.disconnect();},15000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 window.SBC_FREE_ACTIONS_V1=Object.freeze({refresh:function(){if(board)return load();return false;}});
})();
