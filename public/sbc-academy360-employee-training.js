'use strict';
/* Academy 360 cross-role media viewer — read-only. Never mutates or proxies training attempts.
 * Academy 360 Account Manager official scoring is still restricted by server-side role gates.
 */
(()=>{
 const COURSE=[
  ["am-01","The SBC Standard · Because Why Not?","El estándar SBC · Because Why Not?"],
  ["am-02","Fantastic 4 · One Business, Connected Systems","Fantastic 4 · Un negocio, sistemas conectados"],
  ["am-03","Account 360 · Own Every Relationship","Account 360 · Cuide cada relación"],
  ["am-04","Research Trust, Permission & Outreach Safety","Investigación, permiso y contacto seguro"],
  ["am-05","Discovery Mastery · Diagnose Before You Pitch","Descubrimiento · Diagnostique antes de ofrecer"],
  ["am-06","Product & Price Intelligence · No Hidden Promises","Productos, precios y límites del alcance"],
  ["am-07","Instant Sites · Sell the Demonstration, Not a Fiction","Instant Sites · Demuestre trabajo real"],
  ["am-08","Objection Lab · Respond Without Pressure","Objeciones · Responda sin presión"],
  ["am-09","Follow-Up Engine · Meetings, Notes & Next Actions","Seguimiento · Reuniones, notas y tareas"],
  ["am-10","Square, Quotes & Fulfillment · The Trust Boundary","Square, cotizaciones y evidencia del cobro"],
  ["am-11","Relationship Growth · Office Box, Retention & Renewals","Relación, Office Box y renovaciones"],
  ["am-12","Final Field Simulation · Account Manager Certification","Simulación final · Certificación"]
 ];
 const $=id=>document.getElementById(id),base='/academy-media/academy360/';
 const state={lang:'en',idx:0,mode:'video',allowed:false,ticket:0};
 const es=()=>state.lang==='es',tr=(en,spanish)=>es()?spanish:en;
 async function valid(url,mime){
  try{const r=await fetch(url,{method:'HEAD',credentials:'same-origin',cache:'no-store',redirect:'error'});
   return r.ok&&(r.headers.get('content-type')||'').toLowerCase().split(';')[0].trim()===mime;
  }catch(_){return false;}
 }
 function hideMedia(){
  for(const node of [$('academyVideo'),$('academyAudio')]){node.pause();node.removeAttribute('src');if(node.tagName==='VIDEO')node.querySelectorAll('track').forEach(t=>t.remove());node.load();}
  $('academyPhotos').replaceChildren();
 }
 function choose(mode){
  state.mode=mode;
  for(const m of ['video','audio','photos']){$('pane-'+m).hidden=m!==mode;$('mode-'+m).setAttribute('aria-pressed',String(m===mode));}
  if(mode==='video')$('academyAudio').pause();else $('academyVideo').pause();
 }
 async function show(index){
  if(!state.allowed)return;
  state.idx=Math.min(COURSE.length-1,Math.max(0,index));
  const ticket=++state.ticket,[id,titleEn,titleEs]=COURSE[state.idx],title=tr(titleEn,titleEs),lang=state.lang,stem=id+'-'+lang;
  hideMedia();$('lessonTitle').textContent=title;$('lessonDescription').textContent=tr('Module '+(state.idx+1)+' of 12 · Narrated interface walkthrough','Módulo '+(state.idx+1)+' de 12 · Demostración narrada');
  $('previousLesson').disabled=state.idx===0;$('nextLesson').disabled=state.idx===COURSE.length-1;
  for(const b of $('lessonList').querySelectorAll('button')){b.classList.toggle('active',b.dataset.lesson===id);b.setAttribute('aria-current',b.dataset.lesson===id?'step':'false');}
  $('mediaStatus').textContent=tr('Checking available lesson media…','Verificando los medios de la lección…');
  const videoUrl=base+stem+'.mp4',audioUrl=base+stem+'-audio.webm',vttUrl=base+stem+'.vtt';
  const foundVideo=await valid(videoUrl,'video/mp4');if(ticket!==state.ticket)return;
  if(foundVideo){$('academyVideo').src=videoUrl;if(await valid(vttUrl,'text/vtt')){const captions=document.createElement('track');captions.kind='captions';captions.srclang=lang;captions.label=lang==='es'?'Español':'English';captions.src=vttUrl;captions.default=true;$('academyVideo').append(captions);}}
  const foundAudio=await valid(audioUrl,'audio/webm');if(ticket!==state.ticket)return;
  if(foundAudio)$('academyAudio').src=audioUrl;
  let photoCount=0;
  for(let i=1;i<=4;i++){const url=base+stem+'-'+String(i).padStart(2,'0')+'.webp';if(await valid(url,'image/webp')){if(ticket!==state.ticket)return;const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=url;img.alt=tr('SBC fictional-interface training screenshot '+i,'Captura de prueba ficticia SBC '+i);img.loading='lazy';caption.textContent=tr('Step '+i+' · Example interface','Paso '+i+' · Interfaz de ejemplo');figure.append(img,caption);$('academyPhotos').append(figure);photoCount++;}}
  if(ticket!==state.ticket)return;
  $('mediaStatus').textContent=tr(
    'Media: '+(foundVideo?'Video ready':'Video unavailable')+' · '+(foundAudio?'Audio ready':'Audio unavailable')+' · '+photoCount+' screenshots',
    'Medios: '+(foundVideo?'Video disponible':'Video no disponible')+' · '+(foundAudio?'Audio disponible':'Audio no disponible')+' · '+photoCount+' capturas');
  choose(state.mode);
 }
 async function boot(){
  let user=null;
  try{
   const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   if(!response.ok)throw Error('LOGIN_REQUIRED');
   const json=await response.json();user=json.user;
  }catch(_){$('academyRoleMessage').textContent='Sign in to your SBC workstation to view training. No lesson scores were changed.';return;}
  const role=String(user?.role||'').toLowerCase();
  if(!['caller','lead_researcher','lead_generator','researcher','prospector','owner','account_manager'].includes(role)){
   $('academyRoleMessage').textContent='This employee role has no Academy multimedia access.';return;
  }
  state.allowed=true;
  $('academyRoleMessage').textContent=role==='account_manager'?
    'Account Manager: use the scored Academy panel in your official workstation to submit answers, progress and owner review. This view is media-only.':
    role==='owner'?'Owner read-only media preview. Employee scores are assessed and reviewed separately in your authorized Academy review panel.':
    'Certification is not available under a caller or research account. You can watch the new Academy 360 videos here; official Account Manager scores and owner certification require an approved account_manager login. Your historic research/caller course records are preserved.';
  for(const [id,en,esTitle] of COURSE){const b=document.createElement('button');b.type='button';b.dataset.lesson=id;b.textContent=String(COURSE.findIndex(x=>x[0]===id)+1).padStart(2,'0')+' · '+tr(en,esTitle);b.onclick=()=>show(COURSE.findIndex(x=>x[0]===id));$('lessonList').append(b);}
  for(const lang of ['en','es'])$('lang-'+lang).onclick=()=>{state.lang=lang;document.documentElement.lang=lang;for(const l of ['en','es'])$('lang-'+l).setAttribute('aria-pressed',String(l===lang));for(const b of $('lessonList').querySelectorAll('button')){const [id,en,esTitle]=COURSE.find(item=>item[0]===b.dataset.lesson)||[];if(id)b.textContent=String(COURSE.findIndex(x=>x[0]===id)+1).padStart(2,'0')+' · '+tr(en,esTitle);}show(state.idx);};
  for(const mode of ['video','audio','photos'])$('mode-'+mode).onclick=()=>choose(mode);
  $('previousLesson').onclick=()=>show(state.idx-1);$('nextLesson').onclick=()=>show(state.idx+1);
  await show(0);
 }
 boot();
})();
