'use strict';
/* SBC Academy 360 real workstation videos: presence verified, never counts as a passed lab. */
(()=>{
 const allowed=new Set(['am-01','am-02','am-03','am-04','am-05','am-06','am-07','am-08','am-09','am-10','am-11','am-12']);
 const $=id=>document.getElementById(id),root='/academy-media/academy360/';
 let generation=0;
 const tr=(es,en,spanish)=>es?spanish:en;
 function clear(video){try{video.pause();}catch(_){}video.removeAttribute('src');video.querySelectorAll('track').forEach(e=>e.remove());try{video.load();}catch(_){}video.hidden=true;}
 async function exists(url){const r=await fetch(url,{method:'HEAD',credentials:'same-origin',redirect:'error',cache:'no-store'});return r.ok&&/^video\/(webm|mp4)(?:\b|;)/i.test(r.headers.get('content-type')||'');}
 async function render(id,lang){
  const ticket=++generation,es=lang==='es',video=$('academyRecording'),status=$('academyVideoStatus'),note=$('academyVideoNotes');
  if(!video||!status)return;
  clear(video);
  if(!allowed.has(id)){status.textContent=tr(es,'No recording assigned.','No hay grabación asignada.');return;}
  status.textContent=tr(es,'Checking for a published SBC recording…','Buscando una grabación publicada de SBC…');
  note.textContent=tr(es,'The illustrated walkthrough remains available below.','La guía ilustrada sigue disponible abajo.');
  for(const ext of ['webm','mp4']){
   const src=root+id+'-'+(es?'es':'en')+'.'+ext;
   let ready=false;try{ready=await exists(src);}catch(_){}
   if(ticket!==generation)return;
   if(!ready)continue;
   video.src=src;const track=document.createElement('track');track.kind='captions';track.srclang=es?'es':'en';track.label=es?'Español':'English';track.default=true;track.src=root+id+'-'+(es?'es':'en')+'.vtt';video.append(track);video.hidden=false;
   status.textContent=tr(es,'Published real SBC test-workstation recording.','Grabación real publicada de la estación de prueba SBC.');
   note.textContent=tr(es,'Watching a video never replaces scored practice and owner certification.','Ver un video nunca reemplaza la práctica evaluada ni la certificación del dueño.');
   return;
  }
  status.textContent=tr(es,'Actual screen recording not yet published. Use the narrated illustrated lesson below.','Todavía no se ha publicado una grabación real. Use la lección ilustrada narrada de abajo.');
 }
 const video=$('academyRecording');
 if(video)video.addEventListener('error',()=>{++generation;clear(video);$('academyVideoStatus').textContent=document.documentElement.lang==='es'?'No se pudo reproducir la grabación. Use la guía ilustrada.':'This recording could not be played. Use the illustrated walkthrough.';});
 window.SBC_ACADEMY_VIDEO=Object.freeze({render,lessonIds:[...allowed]});
})();
