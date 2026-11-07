/* SBC V66.103 — read-only callback accountability for the assigned sales workspace.
   No automatic dialing, data writes, payment actions, or owner-data access. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCFollowupPriority=api;
})(typeof window==='undefined'?{}:window,function(){
 'use strict';
 const REQUESTED=/follow[ -]?up|call[ -]?back|appointment/i;
 const CLOSED=/^(do not call|not interested|bad number|wrong number|opt out|unsubscribe)$/i;
 const RANK={overdue:0,needs_time:1,due_soon:2,scheduled:3};
 function time(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>0?value:null;
  if(typeof value!=='string')return null;
  const text=value.trim();
  // A date without an offset or clock is not an exact appointment time.
  if(!text||!/(Z|[+-]\d\d:\d\d)$/i.test(text))return null;
  const n=Date.parse(text);return Number.isFinite(n)?n:null;
 }
 function buildQueue(leads,calls,at=Date.now()){
  const now=Number.isFinite(Number(at))?Number(at):Date.now();
  const assigned=new Map();
  for(const lead of Array.isArray(leads)?leads:[]){
   const id=String(lead?.id||'');
   if(!id||lead.canCall!==true||lead.doNotContact===true||lead.salesSuppressed===true||lead.isSuppressed===true)continue;
   assigned.set(id,lead);
  }
  const latest=new Map();
  for(const [index,report] of (Array.isArray(calls)?calls:[]).entries()){
   const id=String(report?.customerId||'');
   if(!assigned.has(id))continue;
   const created=time(report?.createdAt)||0;
   const previous=latest.get(id);
   if(!previous||created>previous.created||(created===previous.created&&index>previous.index))
    latest.set(id,{report,created,index});
  }
  const rows=[];
  for(const [id,lead] of assigned){
   const report=latest.get(id)?.report||null;
   const outcome=String(report?.outcome||'').trim();
   if(CLOSED.test(outcome))continue;
   const due=time(report?.callbackAt)||time(lead.followUpAt);
   const requested=REQUESTED.test(outcome);
   if(!due&&!requested&&!String(lead.followUpAt||'').trim())continue;
   const status=due===null?'needs_time':due<now?'overdue':due<=now+86400000?'due_soon':'scheduled';
   const label=status==='overdue'?'Overdue callback':status==='needs_time'?'Callback time needs confirmation':status==='due_soon'?'Due within 24 hours':'Scheduled callback';
   rows.push({customerId:id,businessName:String(lead.businessName||'Assigned prospect').slice(0,220),
    dueAt:due===null?'':new Date(due).toISOString(),status,label,outcome:outcome||'Follow-up scheduled',
    nextAction:String(lead.nextAction||'').slice(0,160)});
  }
  return rows.sort((a,b)=>RANK[a.status]-RANK[b.status]||
   (a.dueAt&&b.dueAt?Date.parse(a.dueAt)-Date.parse(b.dueAt):0)||
   a.businessName.localeCompare(b.businessName)||a.customerId.localeCompare(b.customerId));
 }
 return {time,buildQueue};
});
