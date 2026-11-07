/* SBC V66.109 — shared read-aloud for researcher and sales caller training.
 * Browser SpeechSynthesis, not a streamed audio recording. Timeline navigates
 * spoken text SECTIONS, not elapsed seconds. No API, CRM or training writes.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.SBCWorkforceAudio=api;api.install(root);}
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 const PART_LIMIT=280;
 function chunks(parts,maximum=PART_LIMIT){
  const limit=Math.max(100,Math.min(900,Number(maximum)||PART_LIMIT)),out=[];
  for(const item of Array.isArray(parts)?parts:[]){
   const line=String(item||'').replace(/\s+/g,' ').trim();
   if(!line)continue;
   let buffer='';
   const flush=()=>{if(buffer.trim())out.push(buffer.trim());buffer='';};
   const sentences=line.match(/[^.!?;]+[.!?;]*|.+$/g)||[line];
   for(const raw of sentences){
    const sentence=raw.trim();if(!sentence)continue;
    if(sentence.length>limit){
     flush();
     for(const word of sentence.split(/\s+/)){
      if(word.length>limit){flush();for(let i=0;i<word.length;i+=limit)out.push(word.slice(i,i+limit));continue;}
      if(buffer.length+word.length+1>limit)flush();
      buffer+=(buffer?' ':'')+word;
     }
     flush();
    }else{
     if(buffer.length+sentence.length+1>limit)flush();
     buffer+=(buffer?' ':'')+sentence;
    }
   }
   flush();
  }
  return out;
 }
 function createPlayer({segments,synth,Utterance,onState,rate=.93,language='en-US'}={}){
  const items=(Array.isArray(segments)?segments:[]).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim());
  const supported=Boolean(synth&&typeof synth.speak==='function'&&typeof synth.cancel==='function'&&typeof Utterance==='function');
  let position=0,mode='idle',serial=0,utterance=null,disposed=false;
  const emit=message=>{if(typeof onState==='function')onState({position,count:items.length,mode,supported,message:message||''});};
  const clamp=index=>Math.max(0,Math.min(items.length-1,Math.trunc(Number(index)||0)));
  function cancel(){serial+=1;utterance=null;if(supported)try{synth.cancel();}catch(_){}}
  function begin(){
   if(disposed)return;
   if(!supported||!items.length){mode='unavailable';emit('Audio unavailable in this browser. Read the lesson instead.');return;}
   const token=++serial,spoken=new Utterance(items[position]);utterance=spoken;
   spoken.lang=language;spoken.rate=rate;spoken.pitch=1;spoken.volume=1;mode='playing';
   spoken.onend=()=>{
    if(disposed||serial!==token||utterance!==spoken)return;
    if(position+1<items.length){position++;begin();}
    else{utterance=null;mode='ended';emit('Lesson audio completed.');}
   };
   spoken.onerror=()=>{
    if(disposed||serial!==token||utterance!==spoken)return;
    utterance=null;mode='error';emit('Audio stopped. Select Play to retry.');
   };
   try{
    // Some browsers keep the engine paused when a previous utterance is canceled.
    if(synth.paused&&typeof synth.resume==='function')synth.resume();
    synth.speak(spoken);emit('Reading lesson aloud…');
   }catch(_){utterance=null;mode='error';emit('Audio playback failed. Reading is still available.');}
  }
  function play(){
   if(disposed)return;
   if(!supported||!items.length){mode='unavailable';emit('Voice unavailable.');return;}
   if(mode==='playing')return;
   if(mode==='paused'){
    try{synth.resume();mode='playing';emit('Reading resumed.');}catch(_){mode='error';emit('Resume failed.');}
    return;
   }
   if(mode==='ended')position=0;
   cancel();begin();
  }
  function pause(){
   if(disposed||!supported)return;
   if(mode==='paused'){play();return;}
   if(mode!=='playing')return;
   try{synth.pause();mode='paused';emit('Reading paused.');}catch(_){emit('Unable to pause.');}
  }
  function stop(){
   if(disposed)return;
   cancel();position=0;mode='idle';emit('Ready to read this lesson.');
  }
  function seek(index){
   if(disposed||!items.length)return;
   const resume=mode==='playing';
   cancel();position=clamp(index);mode='idle';
   if(resume)begin();else emit('Ready at selected section. Press Play.');
  }
  function previous(){seek(position-1);}
  function next(){seek(position+1);}
  function dispose(){if(disposed)return;cancel();disposed=true;mode='idle';}
  emit(supported?'Ready to read this lesson.':'Audio unavailable in this browser.');
  return {play,pause,stop,seek,previous,next,dispose,snapshot:()=>({position,count:items.length,mode,supported,disposed})};
 }
 function textParts(content){
  if(!content||typeof content.querySelectorAll!=='function')return [];
  return [...content.querySelectorAll('.lesson-part h4,.lesson-part p,.lesson-part li')]
   .map(n=>String(n.textContent||'').trim()).filter(Boolean);
 }
 let active=null,installed=false,observer=null;
 function stop(){
  if(active){active.player.stop();}
 }
 function mount(content,win){
  const W=win||(typeof window!=='undefined'?window:null);
  if(!W||!content?.ownerDocument)return null;
  const existing=content.__sbcVoicePlayer;
  if(existing&&content.querySelector('.academy-audio-v66109'))return existing;
  if(existing){existing.dispose();content.__sbcVoicePlayer=null;}
  // Do not remove a previous reader belonging to a different client.
  if(content.querySelector('.academy-audio'))return null;
  if(active&&active.root!==content){active.player.dispose();active=null;}
  const document=content.ownerDocument;
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const toolbar=node('div','academy-audio academy-audio-v66109');
  toolbar.setAttribute('role','group');toolbar.setAttribute('aria-label','Lesson narration controls');
  const heading=node('strong',null,'🎧 Listen to this lesson');
  const actions=node('div','academy-audio-actions');
  const button=(name,label)=>{const b=node('button',null,name);b.type='button';b.setAttribute('aria-label',label);actions.append(b);return b;};
  const rewind=button('⏪ Rewind','Previous spoken section');
  const play=button('▶ Play','Play lesson narration');
  const pause=button('⏸ Pause','Pause or resume narration');
  const stopBtn=button('⏹ Stop','Stop narration and return to first section');
  const forward=button('⏩ Forward','Next spoken section');
  const seeker=node('div','academy-audio-seek');
  const label=node('label',null,'Lesson position');
  const slider=node('input');slider.type='range';slider.min='0';slider.step='1';slider.value='0';
  slider.setAttribute('aria-label','Jump to spoken lesson section');
  const count=node('output','academy-audio-mark');
  const state=node('small','academy-audio-status');state.setAttribute('role','status');state.setAttribute('aria-live','polite');
  const note=node('small','academy-audio-note','Rewind, Forward and the slider move between spoken sections, not seconds.');
  label.append(slider);seeker.append(label,count);
  toolbar.append(heading,actions,seeker,state,note);
  const parts=chunks(textParts(content));
  function refresh(s){
   count.textContent=s.count?(s.position+1)+' / '+s.count+' sections':'No readable sections';
   slider.max=String(Math.max(0,s.count-1));slider.value=String(s.position);
   slider.setAttribute('aria-valuetext',s.count?'Section '+(s.position+1)+' of '+s.count:'No sections');
   const ready=s.supported&&s.count>0;
   for(const button of [play,pause,stopBtn,rewind,forward])button.disabled=!ready;
   slider.disabled=!ready;
   pause.disabled=!ready||!['playing','paused'].includes(s.mode);
   rewind.disabled=!ready||s.position===0;
   forward.disabled=!ready||s.position>=s.count-1;
   play.textContent=s.mode==='paused'?'▶ Resume':'▶ Play';
   state.textContent=s.message||'Ready.';
  }
  const player=createPlayer({segments:parts,synth:W.speechSynthesis,Utterance:W.SpeechSynthesisUtterance,onState:refresh});
  content.__sbcVoicePlayer=player;active={root:content,player};
  rewind.addEventListener('click',()=>player.previous());
  play.addEventListener('click',()=>player.play());
  pause.addEventListener('click',()=>player.pause());
  stopBtn.addEventListener('click',()=>player.stop());
  forward.addEventListener('click',()=>player.next());
  slider.addEventListener('input',()=>player.seek(slider.value));
  content.insertBefore(toolbar,content.firstChild);
  return player;
 }
 function install(win){
  if(installed||!win?.document||!win.MutationObserver)return;
  installed=true;
  const doc=win.document;
  const sync=()=>{
   if(active&&(!active.root.isConnected||active.root.closest('[hidden]'))){
    active.player.dispose();active=null;
   }
   const opened=doc.querySelector('.training-lesson-content:not([hidden])');
   if(opened&&!opened.closest('[hidden]')&&opened.querySelector('.lesson-part')){
    if(!opened.querySelector('.academy-audio-v66109'))mount(opened,win);
   }
  };
  const start=()=>{
   observer=new win.MutationObserver(sync);
   observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
   doc.addEventListener('click',e=>{
    if(e.target.closest('.training-module-head button,[data-tab],[data-panel]')){
     if(active){active.player.dispose();active=null;}
    }
   },true);
   doc.addEventListener('visibilitychange',()=>{
    if(doc.hidden&&active&&active.player.snapshot().mode==='playing')active.player.pause();
   });
   win.addEventListener('pagehide',()=>{if(active){active.player.dispose();active=null;}observer?.disconnect();},{once:true});
   sync();
  };
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
 }
 return {chunks,createPlayer,textParts,mount,install,stop};
});