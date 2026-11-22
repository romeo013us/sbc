'use strict';
/* Owner Sales Command: no provider credentials, no unapproved transfers, no HTML injection. */
(()=>{
 const $=id=>document.getElementById(id);
 const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(c||0)/100);
 const monthNow=()=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  return parts.find(x=>x.type==='year').value+'-'+parts.find(x=>x.type==='month').value;
 };
 const api=async(path,method='GET',body)=>{
  const resp=await fetch(path,{method,credentials:'same-origin',cache:'no-store',
   headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await resp.json().catch(()=>({}));
  if(!resp.ok||payload.ok!==true)throw Error(String(payload.code||'SERVER_REQUEST_FAILED')+' · HTTP '+resp.status);
  return payload;
 };
 const notice=(value,bad=false)=>{$('notice').textContent=value;$('notice').classList.toggle('error',bad)};
 const make=(tag,value,className)=>{
  const e=document.createElement(tag);
  if(value!==undefined)e.textContent=String(value);
  if(className)e.className=className;
  return e;
 };
 const cents=(id)=>{
  const raw=$ (id).value.trim();
  if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(raw))throw Error('ENTER_VALID_DOLLAR_COST_'+id.toUpperCase());
  return Math.round(Number(raw)*100);
 };
 let managers=[],candidates=[];
 // Sales Command writes remain locked until server-side readiness verifies
 // all required tables and confirms the primary MySQL writer is available.
 function setActionButtons(enabled){
  for(const id of ['termsForm','creditForm']){
   const form=$(id);if(!form)continue;
   for(const button of form.querySelectorAll('button[type="submit"]'))button.disabled=!enabled;
  }
  for(const id of ['closeMonth','approveMonth','paidMonth']){
   const button=$(id);if(button)button.disabled=!enabled;
  }
 }

 function options(id,rows,format){
  const el=$(id),prev=el.value;
  el.replaceChildren();
  for(const row of rows){
   const opt=make('option',format(row));opt.value=String(row.managerId??row.orderId??'');el.append(opt);
  }
  if([...el.options].some(o=>o.value===prev))el.value=prev;
 }
 function cards(rows){
  $('kpis').replaceChildren();
  for(const [label,amount,note] of rows){
   const box=make('article',undefined,'kpi');
   box.append(make('span',label),make('strong',money(amount)),make('small',note));
   $('kpis').append(box);
  }
 }
 function table(data){
  $('managers').replaceChildren();
  if(!data.length){
   const tr=make('tr'),td=make('td','No account managers configured in this tenant.');
   td.colSpan=7;tr.append(td);$('managers').append(tr);return;
  }
  for(const r of data){
   const tr=make('tr');
   const cells=[
    r.name+(r.active?'':' · inactive'),
    r.termsTier||'Agreement needed',
    money(r.revenueCents),
    money(r.quotaCents),
    money(r.profitCents),
    money(r.lockedStatement?.commissionCents??r.commissionCents),
    r.lockedStatement?.status||r.commissionStatus
   ];
   for(const c of cells)tr.append(make('td',c));
   $('managers').append(tr);
  }
 }
 async function refresh(){
  const month=$('month').value;
  if(!/^\d{4}-\d{2}$/.test(month))throw Error('SELECT_A_REPORTING_MONTH');
  setActionButtons(false);
  notice('Checking Sales Command database readiness…');
  const readiness=await api('/api/owner/sales-command/readiness');
  if(!readiness.ready){
   $('kpis').replaceChildren();$('managers').replaceChildren();
   managers=[];candidates=[];
   const reason=readiness.nextAction==='REVIEW_AND_APPLY_STAGING_MIGRATION'
    ?'REVIEW_AND_APPLY_STAGING_MIGRATION: required tables are missing ('+
      (readiness.missingTables||[]).join(', ')+'). Apply only to backed-up writable staging MySQL first.'
    :'RESOLVE_MYSQL_RECOVERY_HOLD: staging writer unavailable; no commission actions are enabled.';
   throw Error(reason);
  }
  notice('Loading tenant-scoped financial records…');
  const [summary,paid]=await Promise.all([
   api('/api/owner/sales-command/overview?month='+encodeURIComponent(month)),
   api('/api/owner/sales-command/eligible-orders')
  ]);
  managers=summary.managers||[];candidates=paid.candidates||[];
  cards([
   ['Credited collected sales',summary.teamRevenueCents,'Owner-reconciled captured payments'],
   ['Monthly team target',summary.teamMonthlyTargetCents,'$600 per selling day · team'],
   ['Owner-attested gross profit',summary.teamGrossProfitCents,'Before base payroll and overhead'],
   ['Calculated commission liability',summary.commissionLiabilityCents,'Not a payment confirmation']
  ]);
  table(managers);
  for(const id of ['termsManager','creditManager','actionManager'])
   options(id,managers,r=>r.name+' · '+r.managerId);
  options('creditOrder',candidates,r=>r.orderId+' · '+money(r.grossCents));
  setActionButtons(true);
  notice('Loaded '+managers.length+' manager(s), '+candidates.length+
   ' eligible uncategorized paid order(s). No changes made. All figures remain subject to evidence review.');
 }
 const safeRun=async(action,message)=>{
  try{await action();notice(message);await refresh()}catch(e){notice('Action not completed: '+e.message,true)}
 };
 const ask=message=>window.confirm(message);
 $('month').value=monthNow();
 setActionButtons(false);
 $('refresh').addEventListener('click',()=>safeRun(refresh,'Report loaded.'));
 $('termsForm').addEventListener('submit',event=>{
  event.preventDefault();
  safeRun(async()=>{
   if(!ask('Confirm you have a signed compensation agreement for this contractor and month?'))return;
   await api('/api/owner/sales-command/terms','POST',{
    managerId:$('termsManager').value,month:$('month').value,tier:$('tier').value,
    agreementReference:$('agreementRef').value.trim(),confirm:'SIGNED_AGREEMENT_CONFIRMED'
   });
  },'Monthly terms recorded for owner review.');
 });
 $('creditForm').addEventListener('submit',event=>{
  event.preventDefault();
  safeRun(async()=>{
   if(!ask('Verify Square capture, credited account ownership, vendor invoices, delivery labor and payment fees before recording?'))return;
   await api('/api/owner/sales-command/credits','POST',{
    orderId:$('creditOrder').value,managerId:$('creditManager').value,source:$('saleSource').value,
    directCostCents:cents('directCost'),laborCents:cents('laborCost'),
    processingCents:cents('processingCost'),refundCents:0,
    costEvidence:$('costEvidence').value.trim(),confirm:'OWNER_VERIFIED_CAPTURE_AND_COSTS'
   });
  },'Paid order reconciled.');
 });
 $('closeMonth').addEventListener('click',()=>safeRun(async()=>{
  if(!ask('Close this finished month? Draft statement values lock after close.'))return;
  await api('/api/owner/sales-command/statements/close','POST',{
   managerId:$('actionManager').value,month:$('month').value,confirm:'CLOSE_MONTH_FOR_OWNER_REVIEW'
  });
 },'Month statement closed in DRAFT.'));
 const action=kind=>'/api/owner/sales-command/statements/'+encodeURIComponent($('actionManager').value)+'/'+encodeURIComponent($('month').value)+'/'+kind;
 $('approveMonth').addEventListener('click',()=>safeRun(async()=>{
  if(!ask('Approve the locked commission statement? No money will be sent.'))return;
  await api(action('approve'),'POST',{confirm:'APPROVE_COMMISSION_STATEMENT'});
 },'Commission statement approved. No money sent.'));
 $('paidMonth').addEventListener('click',()=>safeRun(async()=>{
  const paymentReference=$('paymentRef').value.trim();
  if(paymentReference.length<8)throw Error('Enter the external payment reference after a real transfer.');
  if(!ask('Have you ALREADY sent the commission using your payment provider? This only records your confirmation.'))return;
  await api(action('paid'),'POST',{confirm:'RECORD_ALREADY_SENT_PAYMENT',paymentReference});
 },'External payment reference recorded; SBC did not send money.'));
 refresh().catch(e=>notice('Unable to load Sales Command: '+e.message,true));
})();
