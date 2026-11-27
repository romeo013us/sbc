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
 const profileNode=document.getElementById('sbcMyWorkstationProfile');
 let profile=null,profileRead=0;
 const trialNode=document.getElementById('sbcMyTrialProgress');let trialRead=0;
 async function loadTrial(){
  if(!trialNode)return;const seq=++trialRead;trialNode.textContent='Checking your enrolled trial…';
  try{
   const response=await fetch('/api/sbc/sales/workforce/trial/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const data=await response.json();if(!response.ok||data.ok!==true)throw Error('UNAVAILABLE');
   if(seq!==trialRead)return;const t=data.trial,r=t?.review;
   trialNode.textContent=!t?'No paid trial enrollment recorded.':('Paid trial · '+t.startDate+' to '+t.endDate+' · '+t.stage+' · Day 5: '+t.checkpoints.day5+' · Day 10: '+t.checkpoints.day10+' · Day 15: '+t.checkpoints.day15+(r?' · Recorded sales '+money(r.revenueCents)+' / '+money(r.targetCents)+' · '+r.newPayingCustomers+' new customers. Results provisional; ledger completeness not verified.':' · No completed trial days yet.'));
  }catch{if(seq===trialRead)trialNode.textContent='Paid trial progress unavailable. Ask the owner to verify your enrollment.';}
 }

 const awardNode=document.getElementById('sbcMyAwards');let awardRead=0;
 async function loadAwards(){
  if(!awardNode)return;const seq=++awardRead;
  const heading=document.createElement('h3');heading.textContent='My achievements';
  const status=document.createElement('p');status.textContent='Checking your achievement history…';
  awardNode.replaceChildren(heading,status);
  try{
   const r=await fetch('/api/sbc/sales/workforce/awards/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const d=await r.json();if(!r.ok||d.ok!==true||!Array.isArray(d.awards))throw Error('UNAVAILABLE');
   if(seq!==awardRead)return;
   const labels={RISING_STAR:'Rising Star',CERTIFIED_CLOSER:'Certified Closer',REVENUE_CHAMPION:'Revenue Champion',ELITE:'Elite Account Manager',PRESIDENTS_CLUB:"President’s Club"};
   awardNode.replaceChildren(heading);
   if(!d.awards.length){status.textContent='No achievements recorded yet.';awardNode.append(status);}
   else for(const a of d.awards){const item=document.createElement('p');item.textContent=(labels[a.code]||a.code)+' · '+(a.periodKey==='LIFETIME'?'Milestone':a.periodKey);awardNode.append(item);}
  }catch{if(seq===awardRead){status.textContent='Achievement history unavailable.';awardNode.replaceChildren(heading,status);}}
 }
 function renderProfile(){
  if(!profileNode)return;
  const es=document.documentElement.lang==='es';
  if(!profile?.tier){profileNode.textContent=es?'Perfil de puesto sin verificar. Consulte al propietario.':'Workstation tier not verified. Ask the owner to configure your profile.';return;}
  const label=profile.tier==='senior'?(es?'Gerente de cuentas sénior':'Senior Account Manager'):(es?'Gerente de cuentas estándar':'Standard Account Manager');
  profileNode.textContent=label+' · '+(es?'Meta semanal: ':'Weekly revenue target: ')+money(profile.weeklyQuotaCents)+' · '+(es?'Compensación y permisos por separado.':'Signed compensation and calling permissions are separate.');
 }
 async function loadProfile(){
  if(!profileNode)return;const seq=++profileRead;profile=null;renderProfile();
  try{const response=await fetch('/api/sbc/sales/workstation/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const data=await response.json();if(!response.ok||data.ok!==true)throw Error('UNAVAILABLE');
   if(seq===profileRead){profile=data.profile;renderProfile();}
  }catch{if(seq===profileRead){profile=null;renderProfile();}}
 }

 function card(label,value){
  const art=document.createElement('article');art.className='panel';
  const title=document.createElement('h3'),amount=document.createElement('p');
  title.textContent=label;amount.textContent=value;amount.style.fontSize='clamp(20px,3vw,30px)';amount.style.fontWeight='800';
  art.append(title,amount);return art;
 }
 function render(){
  renderProfile();
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
 document.getElementById('sbcSalesProgressRefresh').addEventListener('click',()=>{void load();void loadProfile();void loadTrial();void loadAwards();});
 document.getElementById('refresh')?.addEventListener('click',()=>{void loadProfile();void loadTrial();void loadAwards();});
 for(const id of ['lang-en','lang-es'])document.getElementById(id)?.addEventListener('click',()=>setTimeout(render,0));
 load();void loadProfile();void loadTrial();void loadAwards();
})();