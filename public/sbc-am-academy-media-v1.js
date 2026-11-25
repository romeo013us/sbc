'use strict';
/* SBC Academy 360: label synthetic training simulations truthfully until authenticated employee screen recordings are verified. */
(()=>{
 const allowed=new Set(['am-01','am-02','am-03','am-04','am-05','am-06','am-07','am-08','am-09','am-10','am-11','am-12']);
 const $=id=>document.getElementById(id),root='/academy-media/academy360/';
 let generation=0,mode='video',captionOn=true,spanish=false,available={video:false,audio:false,photos:0};
 const tr=(es,en,spanish)=>es?spanish:en;
 const video=$('academyRecording'),audio=$('academyAudioRecording');
 function clearMedia(node){
  if(!node)return;
  try{node.pause();}catch(_){}
  node.removeAttribute('src');
  node.querySelectorAll('track').forEach(e=>e.remove());
  try{node.load();}catch(_){}
  node.hidden=true;
 }
 async function exists(url,mimes){
  const r=await fetch(url,{method:'HEAD',credentials:'same-origin',redirect:'error',cache:'no-store'});
  const mime=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  return r.ok&&mimes.includes(mime);
 }
 function mediaNow(){return mode==='video'?video:mode==='audio'?audio:null;}
 function pauseInactive(){
  for(const node of [video,audio])if(node!==mediaNow())try{node.pause();}catch(_){}
 }
 function refreshControls(){
  const fallback=!available.video&&!available.audio;
  $('clearNarration').hidden=!fallback;
  for(const id of ['playScene','pauseVoice'])$(id).hidden=!fallback;
  $('voiceRate').closest('label').hidden=!fallback;
  $('academyModeVideo').disabled=!available.video;
  $('academyModeAudio').disabled=!available.audio;
  const active=mediaNow(),ok=mode==='video'?available.video:mode==='audio'?available.audio:false;
  $('academyAvControls').hidden=!ok;
  $('academyVideoCaptions').hidden=mode!=='video'||!video.querySelector('track');
  $('academyVideoFullscreen').hidden=mode!=='video';
  $('academyVideoCaptions').setAttribute('aria-pressed',String(captionOn));
  $('academyVideoCaptions').textContent=captionOn?'CC On':'CC Off';
  $('academyMediaPlay').textContent=active&&!active.paused?'❚❚ Pause':'▶ Play';
 }
 function show(next){
  if(!['video','audio','photos'].includes(next))return;
  mode=next;
  for(const name of ['video','audio','photos']){
   $('academy'+name[0].toUpperCase()+name.slice(1)+'Pane').hidden=name!==mode;
   $('academyMode'+name[0].toUpperCase()+name.slice(1)).setAttribute('aria-pressed',String(name===mode));
  }
  pauseInactive();refreshControls();
 }
 async function findRecording(id,lang,type,extensions,mimes){
  for(const extension of extensions){
   const url=root+id+'-'+lang+(type==='audio'?'-audio':'')+'.'+extension;
   let ok=false;try{ok=await exists(url,mimes);}catch(_){}
   if(ok)return url;
  }
  return null;
 }
 function makePhoto(url,index,id,es){
  const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption'),open=document.createElement('button');
  image.src=url;image.loading='lazy';image.decoding='async';
  image.alt=tr(es,'Simulated SBC training image '+index+' for '+id+' using fictional records','Imagen simulada de capacitación SBC '+index+' para '+id+' con datos ficticios');
  caption.textContent=tr(es,'Simulated training scene '+index+' · fictional account','Escena simulada de capacitación '+index+' · cuenta ficticia');
  open.type='button';open.className='academy-photo-open';open.setAttribute('aria-label',tr(es,'Enlarge screenshot '+index,'Ampliar captura '+index));
  open.append(image);figure.append(open,caption);
  open.addEventListener('click',()=>{
   $('academyEnlargedPhoto').src=url;$('academyEnlargedPhoto').alt=image.alt;$('academyPhotoDescription').textContent=caption.textContent;
   const dialog=$('academyPhotoDialog');
   if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  });
  return figure;
 }
 async function render(id,language){
  const ticket=++generation,es=language==='es',lang=es?'es':'en';
  spanish=es;
  clearMedia(video);clearMedia(audio);available={video:false,audio:false,photos:0};refreshControls();
  $('academyPhotoGallery').replaceChildren();
  if(!allowed.has(id)){$('academyVideoStatus').textContent=tr(es,'Lesson media unavailable.','Medios no disponibles.');show('video');return;}
  $('academyVideoStatus').textContent=tr(es,'Checking simulated lesson video…','Buscando video simulado de la lección…');
  $('academyAudioStatus').textContent=tr(es,'Checking original instructor audio…','Buscando audio original del instructor…');
  $('academyPhotosStatus').textContent=tr(es,'Checking illustrated simulation images…','Buscando imágenes ilustradas de simulación…');
  $('academyVideoNotes').textContent=tr(es,'Use the timeline to scrub, pause, replay, rewind or fast-forward. Video and audio never replace assessed practice.','Use la línea de tiempo para avanzar, pausar, repetir y retroceder. Los videos y audios no sustituyen la práctica evaluada.');
  const videos=await findRecording(id,lang,'video',['webm','mp4'],['video/webm','video/mp4']);
  if(ticket!==generation)return;
  if(videos){
   video.src=videos;video.hidden=false;available.video=true;
   // Caption files are optional. Do not claim captions exist without checking their MIME.
   const vtt=root+id+'-'+lang+'.vtt';
   let captions=false;try{captions=await exists(vtt,['text/vtt']);}catch(_){}
   if(ticket!==generation)return;
   if(captions){
    const t=document.createElement('track');t.kind='captions';t.label=es?'Español':'English';t.srclang=lang;t.src=vtt;t.default=true;video.append(t);
    try{t.track.mode=captionOn?'showing':'disabled';}catch(_){}
   }
   $('academyVideoStatus').textContent=tr(es,'Simulated SBC training video using fictional accounts. Authentic signed-in employee screen recording is still pending.'+(captions?' Captions available.':' Captions not yet approved.'),'Video simulado de capacitación SBC con cuentas ficticias. La grabación auténtica de una sesión de empleado sigue pendiente.'+(captions?' Subtítulos disponibles.':' Subtítulos pendientes.'));
  }else $('academyVideoStatus').textContent=tr(es,'Screen recording not published yet. Use the narrated illustrated workflow below.','Aún no se ha publicado el video real. Use la guía ilustrada narrada de abajo.');
  const sound=await findRecording(id,lang,'audio',['webm','mp3','m4a'],['audio/webm','audio/mpeg','audio/mp4']);
  if(ticket!==generation)return;
  if(sound){
   audio.src=sound;audio.hidden=false;available.audio=true;
   $('academyAudioStatus').textContent=tr(es,'Automatically generated lesson narration ready. Listen, pause and change the speed.','Narración generada automáticamente. Escuche, pause y cambie la velocidad.');
  }else $('academyAudioStatus').textContent=tr(es,'Recorded audio not published yet. Use ▶ Narrate below for spoken instruction in your language.','El audio grabado aún no está publicado. Use ▶ Narrar abajo para escuchar la guía en su idioma.');
  const gallery=$('academyPhotoGallery');
  for(let index=1;index<=4;index++){
   let url=null;
   const number=String(index).padStart(2,'0');
   for(const [ext,mime] of [['webp','image/webp'],['png','image/png'],['jpg','image/jpeg']]){
    const candidate=root+id+'-'+lang+'-'+number+'.'+ext;
    try{if(await exists(candidate,[mime])){url=candidate;break;}}catch(_){}
    if(ticket!==generation)return;
   }
   if(url){gallery.append(makePhoto(url,index,id,es));available.photos++;}
  }
  if(ticket!==generation)return;
  $('academyPhotosStatus').textContent=available.photos?
   tr(es,available.photos+' simulated training images with fictional records; not authenticated employee screenshots. Tap to enlarge.',available.photos+' imágenes simuladas de capacitación con datos ficticios; no son capturas auténticas de empleados. Toque para ampliar.'):
   tr(es,'Actual workstation screenshots are not yet published. The four illustrated step-by-step scenes remain available below.','Aún no hay capturas reales publicadas. Las cuatro escenas ilustradas paso a paso siguen disponibles abajo.');
  show(available.video?'video':available.audio?'audio':'photos');
 }
 for(const [name,id] of [['video','academyModeVideo'],['audio','academyModeAudio'],['photos','academyModePhotos']]){
  $(id).addEventListener('click',()=>show(name));
 }
 $('academyMediaPlay').addEventListener('click',()=>{
  const node=mediaNow();if(!node||node.hidden)return;
  if(node.paused)Promise.resolve(node.play()).catch(()=>{});else node.pause();
  refreshControls();
 });
 for(const [id,seconds] of [['academyMediaRewind',-10],['academyMediaForward',10]]){
  $(id).addEventListener('click',()=>{
   const node=mediaNow();if(!node||node.hidden)return;
   const end=Number.isFinite(node.duration)?node.duration:Number.POSITIVE_INFINITY;
   const now=Number.isFinite(node.currentTime)?node.currentTime:0;
   node.currentTime=Math.max(0,Math.min(end,now+seconds));
  });
 }
 $('academyMediaSpeed').addEventListener('change',()=>{
  const speed=Number($('academyMediaSpeed').value);
  if(![.75,1,1.25,1.5,2].includes(speed))return;
  video.playbackRate=speed;audio.playbackRate=speed;
 });
 $('academyVideoCaptions').addEventListener('click',()=>{
  captionOn=!captionOn;
  for(const track of video.textTracks||[])try{track.mode=captionOn?'showing':'disabled';}catch(_){}
  refreshControls();
 });
 $('academyVideoFullscreen').addEventListener('click',()=>{if(!video.hidden)Promise.resolve(video.requestFullscreen?.()).catch(()=>{});});
 $('academyClosePhoto').addEventListener('click',()=>{
  const d=$('academyPhotoDialog');
  if(typeof d.close==='function')d.close();else d.removeAttribute('open');
 });
 for(const node of [video,audio]){
  node.addEventListener('play',()=>{pauseInactive();refreshControls();});
  node.addEventListener('pause',refreshControls);
  node.addEventListener('ended',refreshControls);
  node.addEventListener('error',()=>{
   const selected=node===video?'video':'audio';
   if(!available[selected]||!node.getAttribute('src'))return;
   available[selected]=false;
   if(selected==='video')$('academyVideoStatus').textContent=tr(spanish,'The video failed to play. Choose available audio or the illustrated lesson.','No se pudo reproducir el video. Elija el audio disponible o la lección ilustrada.');
   else $('academyAudioStatus').textContent=tr(spanish,'Audio unavailable. Choose available video or the narrated illustration.','Audio no disponible. Elija el video disponible o la guía ilustrada con narración.');
   clearMedia(node);
   if(mode===selected)show(available.video?'video':available.audio?'audio':'photos');
   else refreshControls();
  });
 }
 window.SBC_ACADEMY_VIDEO=Object.freeze({render,show,lessonIds:[...allowed]});
})();