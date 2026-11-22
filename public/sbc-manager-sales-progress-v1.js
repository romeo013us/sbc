'use strict';
/* Manager's own sales progress only. No vendor cost details or payment actions. */
(()=>{
 const root=document.getElementById('sbcSalesProgress');if(!root)return;
 const status=document.getElementById('sbcSalesProgressStatus');
 const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0)/100);
 const month=()=>{const p=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',timeZone:'America/New_York'}).formatToParts(new Date());
  return p.find(x=>x.type==='year').value+'-'+p.find(x=>x.type==='month').value;};
 const translations={
  en:{collected:'My collected sales',goal:'My monthly quota',progress:'Quota progress',commission:'Commission estimate',
   status:'Commission is conditional on reaching the monthly target, closing the month, and owner approval.',
   unavailable:'Sales progress is not enabled yet. Contact the owner.',
   noTerms:'Signed compensation terms not recorded for this month.'},
  es:{collected:'Mis ventas cobradas',goal:'Mi meta mensual',progress:'Progreso de meta',commission:'Comisión estimada',
   status:'La comisión requiere alcanzar la meta mensual, cerrar el mes y recibir la aprobación del propietario.',
   unavailable:'El progreso de ventas aún no está disponible. Comuníquese con el propietario.',
   noTerms:'No se registraron términos firmados para este mes.'}
 };
 let current=null;
 function card(label,value){
  const art=document.createElement('article');art.className='panel';
  const title=document.createElement('h3'),amount=document.createElement('p');
  title.textContent=label;amount.textContent=value;amount.style.fontSize='clamp(20px,3vw,30px)';amount.style.fontWeight='800';
  art.append(title,amount);return art;
 }
 function render(){
  const t=translations[document.documentElement.lang==='es'?'es':'en'];
  root.replaceChildren();
  if(!current){status.textContent=t.unavailable;return;}
  root.style.display='grid';root.style.gridTemplateColumns='repeat(auto-fit,minmax(180px,1fr))';root.style.gap='12px';
  for(const args of [[t.collected,money(current.revenueCents)],[t.goal,money(current.quotaCents)],
   [t.progress,current.goalAttainmentPercent+'%'],[t.commission,money(current.lockedStatement?.commissionCents??current.commissionCents)]])
   root.append(card(...args));
  status.textContent=(current.termsConfigured?t.status:t.noTerms)+' '+(current.lockedStatement?.status||current.commissionStatus);
 }
 async function load(){
  try{
   const response=await fetch('/api/sbc/sales/compensation/me?month='+encodeURIComponent(month()),{
    credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const json=await response.json();if(!response.ok||json.ok!==true)throw Error('UNAVAILABLE');
   current=json;render();
  }catch{current=null;render();}
 }
 document.getElementById('sbcSalesProgressRefresh').addEventListener('click',load);
 for(const id of ['lang-en','lang-es'])document.getElementById(id)?.addEventListener('click',()=>setTimeout(render,0));
 load();
})();