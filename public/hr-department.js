'use strict';
/* SBC V66.149 owner-only, separate department workstation.
 * Read-only: no create/update/delete, payment, vendor, AI or PII export.
 */
(() => {
 const $=id=>document.getElementById(id);
 const elems={loading:$('loading'),login:$('signIn'),app:$('workspace'),message:$('message')};
 let data=null;
 async function request(url,options={}){
  const response=await fetch(url,{...options,credentials:'same-origin',cache:'no-store',
   headers:{'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(String(payload.error||payload.message||'Request unavailable').slice(0,200));
  return payload;
 }
 function show(which,text){
  elems.loading.hidden=which!=='loading';elems.login.hidden=which!=='login';elems.app.hidden=which!=='app';
  if(text)elems.message.textContent=text;
  $('reload').hidden=which!=='app';$('logout').hidden=which==='loading';
 }
 function cell(row,value){
  const td=document.createElement('td');td.textContent=String(value??'—');row.append(td);return td;
 }
 function clear(id){const node=$(id);node.replaceChildren();return node}
 function empty(node,cols,description){
  const tr=document.createElement('tr'),td=cell(tr,description);td.colSpan=cols;node.append(tr);
 }
 function money(value,currency){
  const n=Number(value);
  const num=Number.isFinite(n)?n:0;
  const code=/^[A-Z]{3}$/.test(String(currency||''))?String(currency):'USD';
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency:code}).format(num)}
  catch{return num.toFixed(2)+' '+code}
 }
 function paint(d){
  data=d;const people=Array.isArray(d.people)?d.people:[];
  const payroll=Array.isArray(d.payrollRuns)?d.payrollRuns:[];
  $('staffCount').textContent=String(d.totals?.active??0);
  $('onboardingCount').textContent=String(d.totals?.onboardingReview??0);
  $('clockCount').textContent=String(d.totals?.openTimeEntries??0);
  $('payCount').textContent=String(d.totals?.approvedPayroll??0);
  $('alert').textContent=String(d.warning||'Read-only personnel records. No payment or classification is certified.');
  const peopleBody=clear('peopleRows'),attendanceBody=clear('attendanceRows'),payBody=clear('payrollRows');
  for(const p of people){
   const tr=document.createElement('tr');cell(tr,p.strName||p.username||'Unknown');
   cell(tr,String(p.role||'').replaceAll('_',' '));
   cell(tr,p.locationCountry||'Not recorded');
   cell(tr,p.onboardingStatus||'Not started');
   cell(tr,p.agreementRecorded?'Agreement recorded':'Review required');
   cell(tr,p.expired?'Expired':p.active?'Active':'Inactive');
   peopleBody.append(tr);
   const time=document.createElement('tr');cell(time,p.strName||p.username||'Unknown');
   cell(time,String(p.closedHours??0));cell(time,String(p.openClockEntries??0));
   cell(time,(p.openClockEntries??0)>0?'Investigate open clock':'No open clock flagged');
   attendanceBody.append(time);
  }
  if(!people.length){empty(peopleBody,6,'No assigned workforce accounts.');empty(attendanceBody,4,'No time records.');}
  const indexed=new Map(people.map(p=>[p.id,p.strName||p.username]));
  for(const r of payroll){
   const tr=document.createElement('tr');
   cell(tr,indexed.get(r.staffId)||'Unknown member');
   cell(tr,[r.periodStart,r.periodEnd].filter(Boolean).join(' — ')||'Unspecified');
   cell(tr,money(r.recordedAmount,r.currency));
   cell(tr,r.status||'Needs Review');
   cell(tr,r.hasPaymentReference?'Yes (unverified)':'No');
   payBody.append(tr);
  }
  if(!payroll.length)empty(payBody,5,'No saved payroll runs. This does not prove there are no amounts owing.');
 }
 async function refresh(){
  show('loading');
  try{
   const me=await request('/api/me');
   const user=me.user||{};
   if(user.role!=='owner'){show('login','This department currently requires the SBC owner role. HR-manager account permissions are not enabled.');return;}
   const d=await request('/api/hr/workspace');
   if(d.readOnly!==true||d.roleActivation!=='HR_MANAGER_NOT_ENABLED')throw Error('Unverified HR permission contract');
   paint(d);show('app');
  }catch(e){show('login',String(e.message||e));}
 }
 $('loginForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  const login=$('loginForm');
  const button=login.querySelector('button[type="submit"]');
  button.disabled=true;elems.message.textContent='Signing in securely…';
  try{
   await request('/api/login',{method:'POST',body:JSON.stringify({
    username:$('username').value,password:$('password').value})});
   $('password').value='';
   await refresh();
  }catch(e){elems.message.textContent=String(e.message||'Sign-in unavailable');}
  finally{button.disabled=false;}
 });
 $('reload').addEventListener('click',()=>refresh());
 $('logout').addEventListener('click',async()=>{
  try{await request('/api/logout',{method:'POST'});}catch{}
  show('login','Signed out of this workstation.');
 });
 const tabs=[...document.querySelectorAll('[data-tab]')];
 for(const tab of tabs)tab.addEventListener('click',()=>{
  for(const item of tabs)item.setAttribute('aria-selected',item===tab?'true':'false');
  for(const panel of document.querySelectorAll('[data-panel]'))
   panel.hidden=panel.getAttribute('data-panel')!==tab.dataset.tab;
 });
 refresh();
})();