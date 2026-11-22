'use strict';
/* Private-by-default local capture. Files must be reviewed and deployed separately. */
(()=>{
 const $=id=>document.getElementById(id);
 const lessons=[["am-01","Prospect research","Find a fictional prospect; show evidence source and decision-maker validation."],["am-02","Account 360 navigation","Open a synthetic Account 360 and show history, account ownership and next step."],["am-03","Lead qualification","Validate phone, category, address and website gap; never fabricate facts."],["am-04","Permission-based outreach","Show consent, call controls, notes and truthful introduction; never call a real person."],["am-05","Discovery demonstration","Ask precise questions and document needs inside a fictional account."],["am-06","Package scope and pricing","Explain SBC package levels and owner-approved scope; distinguish recurring fees."],["am-07","Actual website concept","Open a real private draft preview; explain the work honestly and schedule demo."],["am-08","Objection handling","Role-play price/timing objections with calm, evidence-based responses."],["am-09","Account follow-up","Demonstrate task scheduling and owner approval in a synthetic account."],["am-10","Square payment safeguards","Show a fictional/test order and what actually verifies payment; no real checkout."],["am-11","Fulfillment and retention","Demonstrate reviewed handoff, customer care and renewal reminders."],["am-12","Observed bilingual capstone","Show end-to-end fictional discovery, concept, proposal, controls and handoff."]];
 let recorder=null,display=null,microphone=null,chunks=[],blob=null,blobUrl=null,started=0,elapsed=0;
 let audioRecorder=null,audioChunks=[],audioBlob=null,shotCount=0;
 const name=()=>$('lessonSelect').value+'-'+$('languageSelect').value;
 const say=(message,error=false)=>{$('recorderStatus').textContent=message;$('recorderStatus').classList.toggle('error',error);};
 function release(){
  const preview=$('captureSource');try{preview.pause();}catch(_){}preview.srcObject=null;
  $('captureStill').disabled=true;
  for(const media of [display,microphone])if(media)media.getTracks().forEach(t=>{try{t.stop();}catch(_){}});
  display=null;microphone=null;
 }
 async function capturePhoto(){
  const live=$('captureSource');
  if(!display||shotCount>=4||live.readyState<2){say(shotCount>=4?'Four photos are already captured.':'Screen is not ready for a screenshot.',true);return;}
  const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(live.videoWidth,live.videoHeight));
  canvas.width=Math.round(live.videoWidth*scale);canvas.height=Math.round(live.videoHeight*scale);
  if(!canvas.width||!canvas.height){say('The shared screen has no frame yet.',true);return;}
  canvas.getContext('2d').drawImage(live,0,0,canvas.width,canvas.height);
  const frame=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));
  if(!frame||frame.type!=='image/webp'){say('WebP capture unavailable. Use Chrome or Edge.',true);return;}
  shotCount++;const filename=name()+'-'+String(shotCount).padStart(2,'0')+'.webp';
  download(filename,frame);$('captureStill').disabled=shotCount>=4;
  say('Photo saved: '+filename+'. Check for private information before adding it to Academy.');
 }

 const time=n=>{const x=Math.max(0,Math.round(n*1000));return [Math.floor(x/3600000),Math.floor(x/60000)%60,Math.floor(x/1000)%60].map(v=>String(v).padStart(2,'0')).join(':')+'.'+String(x%1000).padStart(3,'0');};
 function vtt(text,seconds){const lines=String(text).split(/\n+/).map(s=>s.trim()).filter(Boolean);if(!lines.length||!Number.isFinite(seconds)||seconds<5)throw Error('Add spoken captions and record at least five seconds.');const step=seconds/lines.length;return 'WEBVTT\n\n'+lines.map((line,i)=>(i+1)+'\n'+time(step*i)+' --> '+time(step*(i+1))+'\n'+line+'\n').join('\n');}
 function download(filename,bytes){const url=URL.createObjectURL(bytes),a=document.createElement('a');a.download=filename;a.href=url;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function selected(){const s=lessons.find(row=>row[0]===$('lessonSelect').value);$('shotTitle').textContent=s[1];$('shotNotes').textContent=s[2];$('videoFilename').textContent=name()+'.webm';}
 function stop(){if(recorder&&recorder.state!=='inactive')recorder.stop();else release();}
 async function start(){
  if(!window.MediaRecorder||!navigator.mediaDevices?.getDisplayMedia){say('Capture requires a supported secure browser, such as current Chrome or Edge.',true);return;}
  if(!$('fictionalOnly').checked){say('Confirm TEST Account Manager, synthetic data only, and no credentials or real payments.',true);return;}
  chunks=[];blob=null;elapsed=0;audioChunks=[];audioBlob=null;audioRecorder=null;shotCount=0;$('downloadVideo').disabled=true;$('downloadAudio').disabled=true;$('downloadVtt').disabled=true;$('captureStill').disabled=true;$('previewVideo').hidden=true;
  try{
   display=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:24},audio:false});
   if($('withMic').checked)microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
   const live=$('captureSource');live.srcObject=display;live.muted=true;Promise.resolve(live.play()).catch(()=>{});
   if(microphone){
    const format=['audio/webm;codecs=opus','audio/webm'].find(f=>MediaRecorder.isTypeSupported(f));
    if(format){
     audioRecorder=new MediaRecorder(microphone,{mimeType:format});
     audioRecorder.ondataavailable=e=>{if(e.data?.size)audioChunks.push(e.data);};
     audioRecorder.onstop=()=>{audioBlob=new Blob(audioChunks,{type:format});$('downloadAudio').disabled=!audioBlob.size;};
    }
   }
   const tracks=[...display.getVideoTracks(),...(microphone?microphone.getAudioTracks():[])];
   const formats=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
   const mime=formats.find(f=>MediaRecorder.isTypeSupported(f));if(!mime)throw Error('WebM recording is unavailable in this browser.');
   const combined=new MediaStream(tracks);recorder=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:2200000});
   started=performance.now();recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
   recorder.onstop=()=>{if(audioRecorder&&audioRecorder.state!=='inactive')audioRecorder.stop();elapsed=(performance.now()-started)/1000;blob=new Blob(chunks,{type:mime});release();$('startRecord').disabled=false;$('stopRecord').disabled=true;if(!blob.size){say('No video bytes captured.',true);return;}if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(blob);$('previewVideo').src=blobUrl;$('previewVideo').hidden=false;$('downloadVideo').disabled=false;$('downloadVtt').disabled=false;say('Local video captured. Review, download and separately deploy after owner approval. Nothing was uploaded.');};
   recorder.onerror=()=>{release();$('startRecord').disabled=false;$('stopRecord').disabled=true;say('Recorder error: video was not uploaded.',true);};
   display.getVideoTracks()[0].addEventListener('ended',stop,{once:true});
   recorder.start(1000);if(audioRecorder)audioRecorder.start(1000);$('captureStill').disabled=false;$('startRecord').disabled=true;$('stopRecord').disabled=false;say('Capturing selected screen. Stop before any real contact, credentials or payment screen.');
  }catch(e){release();$('startRecord').disabled=false;$('stopRecord').disabled=true;say(e.message||'Screen recording permission refused.',true);}
 }
 $('lessonSelect').replaceChildren(...lessons.map(([id,title])=>{const o=document.createElement('option');o.value=id;o.textContent=id.toUpperCase()+' · '+title;return o;}));
 $('lessonSelect').addEventListener('change',selected);$('languageSelect').addEventListener('change',selected);
 $('startRecord').addEventListener('click',start);$('stopRecord').addEventListener('click',stop);
 $('downloadVideo').addEventListener('click',()=>{if(blob)download(name()+'.webm',blob);});
$('downloadAudio').addEventListener('click',()=>{if(audioBlob)download(name()+'-audio.webm',audioBlob);});
$('captureStill').addEventListener('click',capturePhoto);
 $('downloadVtt').addEventListener('click',()=>{try{download(name()+'.vtt',new Blob([vtt($('transcript').value,elapsed)],{type:'text/vtt'}));say('Draft captions exported. Review ALL text and timings against recorded speech before publishing.');}catch(e){say(e.message,true);}});
 window.addEventListener('pagehide',()=>{stop();release();if(blobUrl)URL.revokeObjectURL(blobUrl);});
 window.SBC_ACADEMY_RECORDER=Object.freeze({lessons:lessons.map(([id,title])=>({id,title})),vtt,time,screenshotName:count=>name()+'-'+String(count).padStart(2,'0')+'.webp'});
 selected();
})();
