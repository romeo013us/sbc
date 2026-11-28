'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const criteria=[['independentClosing','Independent closing ability',25],['coldCalling','Cold calling',20],['objectionHandling','Objection handling',15],['spokenCommunication','Spoken communication',10],['customerDiscovery','Customer discovery',10],['accountOwnership','Account ownership',5],['technicalAptitude','Technical aptitude',5],['professionalism','Professionalism',5],['reliability','Reliability',5]];
 const grid=$('hiringScores');
 if(!grid)return;
 for(const [key,title,max] of criteria){
  const label=document.createElement('label');
  label.textContent=title+' (0–'+max+')';
  const input=document.createElement('input');input.id='score_'+key;input.type='number';input.min='0';input.max=String(max);input.step='1';input.required=true;input.value='0';
  label.append(input);grid.append(label);
 }
 const api=async(path,body)=>{
  const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});
  const v=await r.json().catch(()=>({}));
  if(!r.ok||!v.ok)throw Error(v.code||'Request failed');
  return v.result;
 };
 const output=(id,message,bad)=>{const el=$(id);el.textContent=message;el.classList.toggle('error',Boolean(bad));};
 $('hiringForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const scores=Object.fromEntries(criteria.map(([key])=>[key,Number($('score_'+key).value)]));
  const evidence=Object.fromEntries(['referenceVerified','salesEvidenceVerified','englishLive','spanishLive','closingSimulationPassed'].map(k=>[k,$('evidence_'+k).checked]));
  try{
   const r=await api('/api/owner/sales-command/hiring/evaluate',{tier:$('hiringTier').value,scores,evidence});
   output('hiringResult',r.score+'/100 · Target '+r.minimumScore+' · '+(r.scoreThresholdMet?'Score target met':'Score below target')+' · '+(r.missing.length?'Missing: '+r.missing.join(', '):'Required evidence recorded')+' · Owner review required.',false);
  }catch(err){output('hiringResult','Evaluation unavailable: '+err.message,true)}
 });
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
 const cents=id=>{const raw=$(id).value;if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(raw))throw Error('Invalid amount: '+id);return Math.round(Number(raw)*100)};
 $('forecastForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
   const body={monthlyRevenueCents:cents('forecastRevenue'),productGrossMarginBps:Math.round(Number($('forecastMargin').value)*100),
    standardManagers:Number($('forecastStandard').value),seniorManagers:Number($('forecastSenior').value),
    hoursPerWeek:Number($('forecastHours').value),fixedOverheadCents:cents('forecastOverhead')};
   const r=await api('/api/owner/sales-command/hiring/forecast',body);
   if(r.compensationPolicy!=='V2_PROPOSED_SIGNED_TERMS'||r.isForecast!==true||r.paymentInitiated!==false)throw Error('V2 forecast policy unavailable');
   output('forecastResult','Revenue '+money(r.monthlyRevenueCents)+' · Product gross profit '+money(r.monthlyGrossProfitCents)+' · Base pay '+money(r.monthlyBasePayCents)+' · Commission '+money(r.monthlyCommissionCents)+' · Other overhead '+money(r.fixedOverheadCents)+' · Estimated operating contribution '+money(r.estimatedOperatingContributionCents)+'. V2 proposed signed terms; equal revenue allocation; not actual net profit.',false);
  }catch(err){output('forecastResult','Forecast unavailable: '+err.message,true)}
 });
})();