/* SBC V66.128 · Owner "What Happened While I Was Gone?" · no AI calls */
(function(){
 'use strict';
 var currentHours=24,request=0,last=null;
 var styles='#sbcCatchupSummary{line-height:1.48}#sbcCatchupSummary .sbc-wa-top{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 15px}#sbcCatchupSummary .sbc-wa-top button{padding:7px 13px;border-radius:8px;border:1px solid var(--border,#6b7280);background:transparent;color:inherit;cursor:pointer}#sbcCatchupSummary .sbc-wa-top button[aria-pressed="true"]{border-color:#f59e0b;background:rgba(245,158,11,.15)}#sbcCatchupSummary .sbc-wa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:10px 0 18px}#sbcCatchupSummary .sbc-wa-num{padding:12px;border:1px solid var(--border,#64748b);border-radius:12px}#sbcCatchupSummary .sbc-wa-num strong{display:block;font-size:24px;font-variant-numeric:tabular-nums}#sbcCatchupSummary details{border:1px solid var(--border,#64748b);border-radius:12px;margin:10px 0;padding:12px}#sbcCatchupSummary summary{cursor:pointer;font-weight:600}#sbcCatchupSummary .sbc-wa-log{padding:8px 4px;border-top:1px solid var(--border,#64748b)}#sbcCatchupSummary .sbc-wa-sub{opacity:.85;font-size:12px}#sbcCatchupSummary .sbc-wa-warning{border-left:3px solid #f59e0b;padding:8px 10px;margin:8px 0}#sbcCatchupSummary .sbc-wa-unverified{opacity:.86}';
 function el(){var d=document.getElementById('sbc-wa-style');if(!d){d=document.createElement('style');d.id='sbc-wa-style';d.textContent=styles;document.head.appendChild(d)}return document.getElementById('modalBody')}
 function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function date(v){var d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(d)+' ET':'Time unavailable'}
 function header(){
  var buttons=[24,48,168].map(function(h){return '<button type="button" data-sbc-wa-hours="'+h+'" aria-pressed="'+(currentHours===h)+'">'+(h===168?'Last 7 days':'Last '+h+' hours')+'</button>'}).join('');
  return '<div class="sbc-wa-top">'+buttons+'<span class="sbc-wa-sub">Owner-only · Read-only · No AI credits</span></div>';
 }
 function metric(label,count){return '<div class="sbc-wa-num"><strong>'+esc(count)+'</strong><span>'+esc(label)+'</span></div>'}
 function render(data){
  last=data;
  var body=el();if(!body||!document.getElementById('modal')||document.getElementById('modal').classList.contains('hidden'))return;
  var n=data.totals||{},people=Array.isArray(data.employees)?data.employees:[];
  var cards='<div class="sbc-wa-grid">'+metric('Leads saved',n.leadsSaved||0)+metric('Research-complete at intake',n.researchComplete||0)+metric('Call reports',n.callReports||0)+metric('Logins recorded',n.signIns||0)+metric('Training events',n.trainingEvents||0)+metric('Lead edits',n.leadUpdates||0)+'</div>';
  var employees=people.map(function(p){
   var shift=p.lastShift,shiftText=shift?
    'Latest recorded shift: '+date(shift.clockIn)+(shift.clockOut?' – '+date(shift.clockOut)+' · '+shift.recordedMinutes+' recorded minutes':' · open or missing clock-out'):'No shift clock record in the last 7 days';
   var actionCount=Array.isArray(p.activity)?p.activity.length:0;
   var logs=(p.activity||[]).slice(0,150).map(function(a){
     return '<div class="sbc-wa-log'+(a.verified?'':' sbc-wa-unverified')+'"><strong>'+esc(a.label||'Recorded event')+'</strong> <span class="sbc-wa-sub">'+esc(date(a.at))+'</span>'+(a.businessName?'<div class="sbc-wa-sub">'+esc(a.businessName)+'</div>':'')+'</div>';
    }).join('')||'<p class="sbc-wa-sub">No server-audited actions in the selected window. This does not prove no work occurred.</p>';
   if(actionCount>150)logs+='<p class="sbc-wa-sub">Showing the latest 150 of '+esc(actionCount)+' recorded events for this employee.</p>';
   return '<details><summary>'+esc(p.name)+' · '+esc(p.role)+' · '+esc(p.leadsSaved)+' leads · '+esc(actionCount)+' events</summary>'+
     '<p class="sbc-wa-sub">'+esc(shiftText)+'</p><p>Saved leads: <strong>'+esc(p.leadsSaved)+'</strong> · Research-complete: <strong>'+esc(p.researchComplete)+'</strong> · Call reports: <strong>'+esc(p.callReports)+'</strong> · Training events: <strong>'+esc(p.trainingEvents)+'</strong></p>'+
     (p.unverifiedLeadEvents?'<p class="sbc-wa-warning">'+esc(p.unverifiedLeadEvents)+' lead-save events could not be reconciled to existing CRM records.</p>':'')+
     logs+'</details>';
  }).join('');
  if(!employees)employees='<p>No tenant employee accounts were returned. Please verify the owner account and CRM data source.</p>';
  var warning=(Array.isArray(data.warnings)?data.warnings:[]).map(function(w){return '<div class="sbc-wa-warning">'+esc(w)+'</div>'}).join('');
  body.innerHTML='<div id="sbcCatchupSummary">'+header()+'<p class="sbc-wa-sub">Report from '+esc(date(data.window.since))+' through '+esc(date(data.window.until))+'. Verified CRM-linked events only count toward results. A recorded action is not proof of customer conversion.</p>'+cards+
   '<h3>Employee shifts & activity</h3>'+employees+'<h3>Evidence notes</h3>'+warning+'</div>';
 }
 async function open(hours){
  currentHours=[24,48,168].includes(Number(hours))?Number(hours):24;
  var modal=document.getElementById('modal'),body=el(),title=document.getElementById('modalTitle');
  if(!modal||!body||!title){return}
  modal.classList.remove('hidden');title.textContent='What Happened While I Was Gone?';
  body.innerHTML='<div id="sbcCatchupSummary">'+header()+'<p role="status">Loading recorded employee activity…</p></div>';
  var id=++request;
  try{
   var r=await fetch('/api/owner/while-away?hours='+encodeURIComponent(currentHours),
    {method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
   var payload=await r.json();
   if(!r.ok||payload?.ok!==true)throw Error(r.status===403?'Owner-only access required.':
    r.status===404?'This feature is not yet on GoDaddy Published.':'The authoritative employee audit is currently unavailable. No zero-activity claim was made.');
   if(id===request)render(payload);
  }catch(e){
   if(id===request&&document.getElementById('sbcCatchupSummary')){
    body.innerHTML='<div id="sbcCatchupSummary">'+header()+
     '<p role="alert">'+esc(e.message||'Could not load this report.')+'</p><p class="sbc-wa-sub">No employee activity was counted from unavailable data. Try again after the live deployment is verified.</p></div>';
   }
  }
 }
 document.addEventListener('click',function(e){
  var button=e.target?.closest?.('[data-sbc-wa-hours]');
  if(button&&document.getElementById('sbcCatchupSummary')){e.preventDefault();open(Number(button.getAttribute('data-sbc-wa-hours')))}
 });
 window.sbcOpenWhileAway=open;
})();
