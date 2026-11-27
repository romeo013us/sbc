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
  resetProfile();$('trialEnrollSave').disabled=true;$('trialEnrollReview').disabled=true;$('recognitionRun').disabled=true;resetRecognition();
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
  for(const id of ['termsManager','creditManager','actionManager','workforceManager'])
   options(id,managers,r=>r.name+' · '+r.managerId);
  options('workstationManager',managers.filter(r=>r.active),r=>r.name+' · '+r.managerId);
  void loadProfile();
  const active=managers.filter(r=>r.active);
  options('recognitionManager',active,r=>r.name+' · '+r.managerId);
  $('recognitionRun').disabled=!active.length;
  options('trialEnrollFirst',active,r=>r.name+' · '+r.managerId);
  options('trialEnrollSecond',[{managerId:'',name:'None'},...active],r=>r.name);
  $('trialEnrollSave').disabled=!active.length;$('trialEnrollReview').disabled=!active.length;
  options('creditOrder',candidates,r=>r.orderId+' · '+money(r.grossCents));
  setActionButtons(true);
  notice('Loaded '+managers.length+' manager(s), '+candidates.length+
   ' eligible uncategorized paid order(s). No changes made. All figures remain subject to evidence review.');
 }
 const safeRun=async(action,message)=>{
  try{await action();notice(message);await refresh()}catch(e){notice('Action not completed: '+e.message,true)}
 };
 const ask=message=>window.confirm(message);
 let profileSnapshot=null,profileRequest=0;
 function resetProfile(){profileRequest++;profileSnapshot=null;$('workstationSave').disabled=true;$('promotionReview').disabled=true;for(const id of ['workstationBilingual','promotionLedger','promotionTrial','promotionQuality','promotionReliability'])$(id).checked=false;$('promotionAgreement').value='';$('promotionStatus').textContent='Load and review employee evidence.';$('workstationAcademy').textContent='Academy readiness not loaded.';}
 async function loadProfile(){
  resetProfile();const seq=profileRequest,managerId=$('workstationManager').value,status=$('workstationStatus');
  if(!managerId){status.textContent='Choose an active Account Manager first.';return;}
  status.textContent='Loading current profile…';
  try{const data=await api('/api/owner/sales-command/workstation/profile?managerId='+encodeURIComponent(managerId));
   if(seq!==profileRequest||managerId!==$('workstationManager').value)return;
   profileSnapshot={managerId,revision:data.profile.revision};$('workstationTier').value=data.profile.tier||'standard';
   status.textContent=data.profile.tier?'Current profile: '+data.profile.tier+' · revision '+data.profile.revision:'No profile configured. Select a tier and confirm.';
   $('workstationSave').disabled=false;
   $('promotionReview').disabled=false;
   try{
    const a=await api('/api/owner/sales-command/workforce/academy?managerId='+encodeURIComponent(managerId));
    if(seq===profileRequest){const r=a.academy;$('workstationAcademy').textContent='Academy: '+r.completedModules+'/'+r.totalModules+' modules · '+(r.certified?'Certified':'Not certified')+' · '+r.trainingMinutes+' training minutes'+(r.ownerReviewRequired?' · Owner review required':'');}
   }catch(err){if(seq===profileRequest)$('workstationAcademy').textContent='Academy readiness unavailable: '+err.message;}

  }catch(e){if(seq===profileRequest)status.textContent='Profile unavailable: '+e.message+' · Check the approved workstation schema and owner access.';}
 }
 $('workstationManager').addEventListener('change',loadProfile);
 $('workstationLoad').addEventListener('click',loadProfile);
 function promotionInputs(){
  return {ledgerReviewed:$('promotionLedger').checked,trialAccepted:$('promotionTrial').checked,qualityPassed:$('promotionQuality').checked,reliabilityPassed:$('promotionReliability').checked,bilingualEvidenceConfirmed:$('workstationBilingual').checked,agreementReference:$('promotionAgreement').value.trim(),promotionConfirm:'OWNER_APPROVED_EARNED_SENIOR'};
 }
 $('promotionReview').addEventListener('click',async()=>{
  const snapshot=profileSnapshot,seq=profileRequest,out=$('promotionStatus');if(!snapshot)return;
  const button=$('promotionReview');button.disabled=true;
  try{const d=await api('/api/owner/sales-command/workforce/senior-review','POST',{managerId:snapshot.managerId,...promotionInputs()});if(seq!==profileRequest)return;
   const r=d.review;out.textContent=(r.eligible?'Eligible for owner review.':'Not yet eligible: '+r.missing.join(', '))+ ' · Completed weeks '+r.startDate+' to '+r.endDate+' · '+r.weeklyRevenueCents.map(money).join(' / ')+'. Proposed criteria; no promotion or pay change.';
  }catch(err){if(seq===profileRequest)out.textContent='Senior review unavailable: '+err.message;}
  finally{if(seq===profileRequest)button.disabled=false;}
 });
 $('workstationProfileForm').addEventListener('submit',async e=>{
  e.preventDefault();const snapshot=profileSnapshot,tier=$('workstationTier').value,status=$('workstationStatus');
  if(!snapshot||snapshot.managerId!==$('workstationManager').value)return;
  const bilingual=$('workstationBilingual').checked;
  if(tier==='senior'&&!bilingual){status.textContent='Confirm live English and Spanish proficiency before assigning Senior.';return;}
  const promotion=promotionInputs();
  if(tier==='senior'&&(!promotion.ledgerReviewed||!promotion.trialAccepted||!promotion.qualityPassed||!promotion.reliabilityPassed||promotion.agreementReference.length<12)){status.textContent='Complete Senior evidence review and enter the signed agreement reference.';return;}
  if(!ask('Assign this workspace profile? Senior requires current evidence. This does not change compensation or calling permissions.'))return;
  resetProfile();const seq=profileRequest;
  try{await api('/api/owner/sales-command/workstation/profile','POST',{managerId:snapshot.managerId,tier,expectedRevision:snapshot.revision,...promotion,bilingualEvidenceConfirmed:bilingual,confirm:'OWNER_CONFIRMED_WORKSTATION_TIER'});
   if(seq===profileRequest){await loadProfile();if(profileSnapshot?.managerId===snapshot.managerId)status.textContent='Profile saved and reloaded. Signed compensation and calling permissions are unchanged.';}
  }catch(err){if(seq===profileRequest)status.textContent='Profile not saved: '+err.message+'. Reload before retrying.';}
 });

 $('trialPlanForm').addEventListener('submit',async event=>{
  event.preventDefault();const result=$('trialPlanResult');result.textContent='Calculating scheduled trial costs…';
  try{const tiers=[$('trialPlanFirst').value,$('trialPlanSecond').value].filter(Boolean);
   const r=await api('/api/owner/sales-command/workforce/trial-plan','POST',{startDate:$('trialPlanStart').value,tiers,reserveCents:cents('trialPlanReserve')});
   const p=r.plan;
   result.textContent=p.workdays+' scheduled working days · planned base pay '+money(p.plannedBaseCents)+' · reserve shortfall '+money(p.reserveShortfallCents)+' · Day 5: '+p.checkpoints.day5+' · Day 10: '+p.checkpoints.day10+' · Day 15: '+p.checkpoints.day15+' · Final: '+p.endDate+'. '+p.limitations;
  }catch(e){result.textContent='Trial plan unavailable: '+e.message;}
 });
 function enrollmentInputs(){
  const second=$('trialEnrollSecond').value,secondTier=$('trialPlanSecond').value;
  if(Boolean(second)!==Boolean(secondTier))throw Error('Select matching second candidate and tier in the planner.');
  const members=[{managerId:$('trialEnrollFirst').value,tier:$('trialPlanFirst').value,agreementReference:$('trialAgreementFirst').value.trim()}];
  if(second)members.push({managerId:second,tier:secondTier,agreementReference:$('trialAgreementSecond').value.trim()});
  return {startDate:$('trialPlanStart').value,reserveCents:cents('trialPlanReserve'),members,signedTermsConfirmed:$('trialSigned').checked,payScheduleReviewed:$('trialPay').checked,fairOpportunityConfirmed:$('trialFair').checked,confirm:'OWNER_CONFIRMED_PAID_TRIAL'};
 }
 $('trialEnrollForm').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('trialEnrollSave'),status=$('trialEnrollStatus');if(button.disabled)return;
  try{
   const body=enrollmentInputs();
   if(!ask('Record the signed paid trial for '+body.members.length+' manager(s)? All earned pay remains due; no funds move.'))return;
   button.disabled=true;
   const r=await api('/api/owner/sales-command/workforce/enroll','POST',body);
   status.textContent='Enrollment recorded · '+r.startDate+' to '+r.endDate+' · '+r.memberCount+' manager(s). No payment initiated.';
   $('trialAgreementFirst').value='';$('trialAgreementSecond').value='';$('trialSigned').checked=false;$('trialPay').checked=false;$('trialFair').checked=false;
  }catch(err){status.textContent='Enrollment not recorded: '+err.message;}
  finally{button.disabled=false;}
 });
 $('trialEnrollReview').addEventListener('click',async()=>{
  const id=$('trialEnrollFirst').value,status=$('trialEnrollStatus');
  try{const d=await api('/api/owner/sales-command/workforce/enrollment?managerId='+encodeURIComponent(id));if(id!==$('trialEnrollFirst').value)return;
   const t=d.trial,r=t?.review;
   status.textContent=!t?'No enrolled trial for this manager.':t.tier+' · '+t.stage+' · '+t.startDate+' to '+t.endDate+(r?' · Recorded collected sales '+money(r.revenueCents)+' / '+money(r.targetCents)+' · '+r.newPayingCustomers+' new customers. Ledger completeness not verified; grade withheld.':' · No completed trial days yet.');
  }catch(err){if(id===$('trialEnrollFirst').value)status.textContent='Enrollment review unavailable: '+err.message;}
 });
 $('payScheduleForm').addEventListener('submit',async e=>{
  e.preventDefault();const out=$('payScheduleResult'),button=e.submitter;
  if(button?.disabled)return;if(button)button.disabled=true;out.textContent='Checking reviewed schedule…';
  try{
   const d=await api('/api/owner/sales-command/workforce/pay-schedule','POST',{startDate:$('payScheduleStart').value,firstPayday:$('payScheduleFirst').value,agreementReference:$('payScheduleAgreement').value.trim(),scheduleReviewed:$('payScheduleReviewed').checked});
   out.replaceChildren();
   for(const p of d.schedule.periods){out.append(make('p',p.startDate+' – '+p.endDate+' · planned payday '+p.payday+(p.finalPartialPeriod?' · final partial period; check final-pay rules':'')));}
   out.append(make('p','No payment initiated. '+d.schedule.limitations));
  }catch(err){out.textContent='Calendar unavailable: '+err.message;}
  finally{if(button)button.disabled=false;}
 });
 let payrollEpoch=0;
 function resetPayrollPreview(){payrollEpoch++;$('trialPayrollHoursReviewed').checked=false;$('trialPayrollRateReviewed').checked=false;$('trialPayrollResult').textContent='Confirm the selected manager, completed period and actual minutes.';}
 for(const id of ['workstationManager','trialPayrollPeriod','trialPayrollTraining','trialPayrollOther'])$(id).addEventListener('change',resetPayrollPreview);
 $('trialPayrollForm').addEventListener('submit',async e=>{
  e.preventDefault();const out=$('trialPayrollResult'),seq=++payrollEpoch,managerId=$('workstationManager').value;
  try{
   const parse=id=>{const raw=$(id).value;if(!/^\d+$/.test(raw))throw Error('ENTER_WHOLE_PAYABLE_MINUTES');return Number(raw);};
   if(!managerId)throw Error('SELECT_ENROLLED_MANAGER');
   const d=await api('/api/owner/sales-command/workforce/payroll-preview','POST',{managerId,periodIndex:Number($('trialPayrollPeriod').value),trainingMinutes:parse('trialPayrollTraining'),otherPaidMinutes:parse('trialPayrollOther'),hoursReviewed:$('trialPayrollHoursReviewed').checked,signedRateConfirmed:$('trialPayrollRateReviewed').checked});
   if(seq!==payrollEpoch)return;const p=d.payroll;
   out.textContent=p.tier+' · '+p.periodStart+' to '+p.periodEnd+' · '+p.totalPaidMinutes+' paid minutes · '+money(p.hourlyCents)+'/hr · Straight-time base pay '+money(p.basePayCents)+'. No payment initiated. '+p.limitations;
  }catch(err){if(seq===payrollEpoch)out.textContent='Payroll preview unavailable: '+err.message;}
 });
 let recognitionEpoch=0;
 function resetRecognition(){
  recognitionEpoch++;$('recognitionAwardActions').replaceChildren();for(const id of ['recognitionLedger','recognitionQualityReviewed','recognitionQualityPassed'])$(id).checked=false;
  $('recognitionResult').textContent='Review the selected periods and manager before attesting evidence.';
 }
 for(const id of ['recognitionManager','recognitionWeek','month'])$(id).addEventListener('change',resetRecognition);
 for(const id of ['recognitionLedger','recognitionQualityReviewed','recognitionQualityPassed'])$(id).addEventListener('change',()=>{recognitionEpoch++;$('recognitionAwardActions').replaceChildren();$('recognitionResult').textContent='Evidence changed. Review eligibility again.';});
 $('recognitionForm').addEventListener('submit',async e=>{
  e.preventDefault();const out=$('recognitionResult'),button=$('recognitionRun');if(button.disabled)return;
  const seq=++recognitionEpoch,managerId=$('recognitionManager').value,month=$('month').value,weekStart=$('recognitionWeek').value;
  button.disabled=true;$('recognitionAwardActions').replaceChildren();out.textContent='Reading reconciled sales and signed terms…';
  try{
   const d=await api('/api/owner/sales-command/workforce/recognition','POST',{managerId,month,weekStart,ledgerComplete:$('recognitionLedger').checked,qualityReviewed:$('recognitionQualityReviewed').checked,qualityPassed:$('recognitionQualityPassed').checked});
   if(seq!==recognitionEpoch)return;
   const names={RISING_STAR:'Rising Star',CERTIFIED_CLOSER:'Certified Closer',REVENUE_CHAMPION:'Revenue Champion',ELITE:'Elite Account Manager',PRESIDENTS_CLUB:"President’s Club"};
   const awards=d.result.eligibleForOwnerReview.map(x=>names[x]||x);
   const actions=$('recognitionAwardActions');
   const evidence={managerId,month,weekStart,ledgerComplete:$('recognitionLedger').checked,qualityReviewed:$('recognitionQualityReviewed').checked,qualityPassed:$('recognitionQualityPassed').checked};
   for(const awardCode of d.result.eligibleForOwnerReview){
    const grant=make('button','Record '+(names[awardCode]||awardCode));grant.type='button';
    grant.addEventListener('click',async()=>{
     if(seq!==recognitionEpoch||grant.disabled)return;
     if(!evidence.ledgerComplete||!evidence.qualityReviewed||!evidence.qualityPassed)return;
     if(!ask('Record this nonfinancial achievement for the selected employee? A closed statement and current evidence will be rechecked.'))return;
     grant.disabled=true;
     try{
      await api('/api/owner/sales-command/workforce/awards','POST',{...evidence,awardCode,confirm:'OWNER_CONFIRMED_NONFINANCIAL_AWARD'});
      if(seq===recognitionEpoch){grant.textContent='Recorded: '+(names[awardCode]||awardCode);out.append(make('p','Achievement recorded. No pay or promotion change.'));}
     }catch(err){if(seq===recognitionEpoch){grant.disabled=false;out.append(make('p','Award not recorded: '+err.message));}}
    });
    actions.append(grant);
   }

   out.replaceChildren(make('p','Recorded sales: week '+money(d.weeklyRevenueCents)+' · month '+money(d.monthlyRevenueCents)),make('p',awards.length?'Eligible for owner review: '+awards.join(' · '):'No eligible achievements on the submitted evidence.'),make('p','No award granted. Owner attestations are not independent verification. No compensation or promotion change.'));
  }catch(err){if(seq===recognitionEpoch)out.textContent='Recognition review unavailable: '+err.message;}
  finally{if(seq===recognitionEpoch)button.disabled=!managers.some(r=>r.active);else if(button.disabled&&managers.some(r=>r.active))button.disabled=false;}
 });
 async function workforcePolicy(){
  const r=await api('/api/owner/sales-command/workforce/policy'),p=r.policy;
  const line=t=>money(t.hourlyCents)+'/hr · '+money(t.weeklyQuotaCents)+'/week · '+(t.commissionBps/100)+'% eligible gross profit · Spanish '+t.spanish;
  $('workforcePolicy').textContent='Proposed new agreements: Standard '+line(p.standard)+'; Senior '+line(p.senior)+'. Biweekly base pay; payout lag pending compliance review. Existing signed terms unchanged; new V2 terms require exact monthly quota and rate confirmation.';
 }
 $('workforceReview').addEventListener('submit',async e=>{
  e.preventDefault();const result=$('workforceResult');result.textContent='Reading reconciled sales ledger…';
  try{
   const params=new URLSearchParams({managerId:$('workforceManager').value,tier:$('workforceTier').value,startDate:$('workforceStart').value,throughDate:$('workforceThrough').value});
   const data=await api('/api/owner/sales-command/workforce/review?'+params),r=data.review;
   result.textContent='Collected '+money(r.revenueCents)+' / '+money(r.targetCents)+' · Grade '+(r.grade??'not graded')+' · '+r.newPayingCustomers+' new paying customers · Day 10 milestone: '+r.twoCustomerMilestone+'. Ledger completeness not verified; review lead quality and signed terms. No payroll or personnel action.';
  }catch(err){result.textContent='Review unavailable: '+err.message;}
 });
 workforcePolicy().catch(e=>{$('workforcePolicy').textContent='Proposed policy unavailable: '+e.message;});
 $('month').value=monthNow();
 setActionButtons(false);
 $('refresh').addEventListener('click',()=>safeRun(refresh,'Report loaded.'));
 $('termsForm').addEventListener('submit',event=>{
  event.preventDefault();
  safeRun(async()=>{
   const tier=$('tier').value,terms={standard_v2:{confirmMonthlyQuotaCents:216700,confirmCommissionBps:900},senior_v2:{confirmMonthlyQuotaCents:433300,confirmCommissionBps:1200}}[tier];
   if(!ask('Confirm the signed compensation agreement for this contractor and month: '+$('tier').selectedOptions[0].textContent+'?'))return;
   await api('/api/owner/sales-command/terms','POST',{
    managerId:$('termsManager').value,month:$('month').value,tier,...(terms||{}),
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
