'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const status=(message,error=false)=>{$('trustStatus').textContent=message;$('trustStatus').classList.toggle('error',error)};
 let busy=false,paused=false,ready=false;
 const api=async(path,method='GET',data)=>{
  const resp=await fetch(path,{method,credentials:'same-origin',cache:'no-store',
   headers:{Accept:'application/json',...(data?{'Content-Type':'application/json'}:{})},
   ...(data?{body:JSON.stringify(data)}:{})});
  const result=await resp.json().catch(()=>({}));
  if(!resp.ok||result.ok!==true)throw Error(String(result.code||'REQUEST_FAILED')+' · HTTP '+resp.status);
  return result;
 };
 const setButtons=()=>{$('trustApprove').disabled=busy||!ready;$('trustRefresh').disabled=busy;$('trustPause').disabled=!busy};
 async function refresh(){
  const state=await api('/api/owner/trusted-leads/preview');
  const skip=state.skipped||{},held=Object.entries(skip).filter(([key])=>key!=='ALREADY_APPROVED').reduce((n,[,v])=>n+v,0);
  $('trustTotal').textContent=String(state.totalTenant??0);
  $('trustEligible').textContent=String(state.approvable??0);
  $('trustDone').textContent=String(skip.ALREADY_APPROVED??0);
  $('trustHeld').textContent=String(held);
  ready=Number(state.approvable)>0&&state.databaseWritable===true;
  setButtons();
  status(state.databaseWritable?'Owner inventory loaded. Eligible records can be accepted with no external re-verification.':'Database is not writable. Owner approval remains locked.',!state.databaseWritable);
  return state;
 }
 $('trustRefresh').addEventListener('click',()=>refresh().catch(e=>status('Cannot load: '+e.message,true)));
 $('trustPause').addEventListener('click',()=>{paused=true;status('Pause requested. Current database batch will finish before stopping.')});
 $('trustApprove').addEventListener('click',async()=>{
  if(busy)return;
  const original=Number($('trustEligible').textContent)||0;
  if(!original)return;
  if(!window.confirm('Accept all '+original+' eligible existing leads as OWNER-TRUSTED research? This is not independent verification, consent to market, or permission to contact suppressed leads.'))return;
  busy=true;paused=false;setButtons();
  let committed=0,batches=0;
  try{
   while(!paused&&batches<1000){
    const r=await api('/api/owner/trusted-leads/approve-batch','POST',{confirm:'OWNER_TRUSTED_ALL_EXISTING',limit:80});
    committed+=Number(r.approved)||0;batches++;
    $('trustProgress').textContent='Saved '+committed+' lead(s) in '+batches+' batch(es). Remaining eligible: '+r.remaining+'.';
    status('Owner-trusted CRM records saved. No external verification or outreach performed.');
    if(r.remaining===0||r.approved===0)break;
   }
   await refresh();
   status('Completed or paused: '+committed+' existing lead(s) accepted with your approval. Any held records remain unchanged.');
  }catch(e){status('Stopped after '+committed+' committed lead(s): '+e.message,true)}
  finally{busy=false;setButtons()}
 });
 refresh().catch(e=>status('Owner inventory unavailable: '+e.message,true));
})();