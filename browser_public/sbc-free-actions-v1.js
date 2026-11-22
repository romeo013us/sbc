/* Super SBC: zero-AI CRM next actions, progressive enhancement only.
 * Never sends messages, charges cards, triggers APIs beyond an authenticated GET,
 * stores customer data in browser storage or opens an unverified account.
 */
(function(){
 'use strict';
 if(window.SBC_FREE_ACTIONS_V1)return;
 var PATH='/api/sbc/free-actions/today?limit=12',board=null,items=null,status=null,count=null,dialog=null,loading=false,refreshPending=false,lastFetchAt=0;
 function node(tag,className,text){var el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;}
 function newButton(label,className,click){var b=node('button',className,label);b.type='button';b.addEventListener('click',click);return b;}
 function setup(){
  if(board)return true;
  var am=document.getElementById('view-accounts'),focus=document.getElementById('sbcFocusNav');
  if(!am&&!focus)return false;
  var owner=!am;
  board=node('section','sbc-actions-board'+(owner?' sbc-actions-owner':''));
  board.id='sbcFreeActionsBoard';
  board.setAttribute('aria-label','Verified CRM next actions');
  var header=node('div','sbc-actions-header');
  header.appendChild(node('div','sbc-actions-kicker','⚡ SUPER SBC · NO PAID AI'));
  var title=node('h2','sbc-actions-title','What needs me now?');header.appendChild(title);
  status=node('p','sbc-actions-status','Checking assigned CRM actions…');status.setAttribute('role','status');
  count=node('span','sbc-actions-count','');
  var refresh=newButton('↻ Refresh','sbc-actions-refresh',load);
  refresh.setAttribute('aria-label','Refresh verified CRM next actions');
  var controls=node('div','sbc-actions-controls');controls.append(count,refresh);header.appendChild(controls);
  items=node('div','sbc-actions-items');items.setAttribute('aria-live','polite');
  board.append(header,status,items,node('p','sbc-actions-safety','Read-only recommendations · No automatic outreach · $0 AI API usage.'));
  if(am){
   var search=am.querySelector('.sbc-account-search');
   if(search)am.insertBefore(board,search);else am.prepend(board);
   load();
  }else{
   var opener=newButton('⚡ Today’s next actions','sbc-actions-open',function(){
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
  clear();
  items.appendChild(node('p','sbc-actions-empty','Check the Command Center connection or retry after signing in.'));
 }
 function one(row){
  var card=node('article','sbc-actions-item');
  var tag=node('span','sbc-actions-tag',String(row.title||'Review account'));
  card.appendChild(tag);
  card.appendChild(node('strong','sbc-actions-business',String(row.businessName||'Business account')));
  card.appendChild(node('p','sbc-actions-detail',String(row.detail||'Review this account.')));
  var grouped=Number.isSafeInteger(row.batchCount)&&row.batchCount>0;
  if(grouped)card.appendChild(node('small','sbc-actions-due',row.batchCount+' CRM records in this review queue.'));
  if(row.dueDate)card.appendChild(node('small','sbc-actions-due','Follow-up date: '+String(row.dueDate)));
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
  card.appendChild(open);return card;
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
   count.textContent=String(data.total||0)+' prioritized decision'+(data.total===1?'':'s');
   status.textContent=data.total?'Highest-priority decisions from recent authorized CRM records. No automatic outreach.':
     'No prioritized decisions in this CRM sample. This does not mean all account work is complete.';
   if(data.dataQualityCount){
    items.appendChild(node('p','sbc-actions-note',data.dataQualityCount+' CRM business names need source verification; source records were not changed.'));
   }
   data.actions.forEach(function(row){items.appendChild(one(row));});
   if(!data.actions.length)items.appendChild(node('p','sbc-actions-empty','No next actions in the current account sample.'));
   if(data.moreRecordsPossible)items.appendChild(node('p','sbc-actions-note','Showing a prioritized sample of the latest 500 CRM records. More accounts may exist.'));
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
