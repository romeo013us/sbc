/* SBC Workforce Academy V66.97.
 * Read-only presentation enhancement. Only the existing SBC Training API
 * in lead-research.js may record real lesson progress.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{root.SBCWorkforceAcademy=api;api.install(root);}
})(typeof window!=='undefined'?window:{},function(){
 'use strict';
 let W=null,speech=null,activeToolbar=null,observer=null,setupDone=false;
 const clamp=n=>Math.max(0,Math.min(100,Number.isFinite(Number(n))?Number(n):0));
 const make=(t,text,cl)=>{const e=W.document.createElement(t);if(text!==undefined)e.textContent=String(text);if(cl)e.className=cl;return e;};
 const $=id=>W?.document?.getElementById(id);
 const percent=s=>clamp(s?.percent);
 function updateStat(id,value){const el=$(id);if(el)el.textContent=String(value);}
 function setCatalog(items){
  if(!W)return;const arr=Array.isArray(items)?items:[];
  let assigned=arr.filter(i=>i.assigned),completed=0,visible=0;
  const rows=[...($('training-list')?.querySelectorAll('.course-row')||[])];
  for(let i=0;i<rows.length;i++){
   const item=arr[i];if(!item)continue;
   const row=rows[i],stats=item.summary,progress=stats?percent(stats):0;
   row.querySelector('.academy-course-meter')?.remove();
   row.querySelector('.academy-course-badge')?.remove();
   const meter=make('div',undefined,'academy-course-meter');meter.setAttribute('role','progressbar');
   meter.setAttribute('aria-label','Course progress');
   meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');
   meter.setAttribute('aria-valuenow',String(Math.round(progress)));
   const fill=make('span');fill.style.width=progress+'%';meter.append(fill);
   const badge=make('span',!stats?'Available course':progress===100?'Completed':progress>0?'In progress':'Assigned · not started','academy-course-badge'+(!stats||progress===0?' pending':''));
   const details=row.querySelector('small');
   if(details){details.insertAdjacentElement('afterend',meter);meter.insertAdjacentElement('afterend',badge);}
   if(stats){visible+=1;if(progress>=100)completed+=1;}
  }
  const incomplete=assigned.filter(i=>!i.summary||percent(i.summary)<100).length;
  updateStat('academy-assigned',assigned.length);
  updateStat('academy-completed',completed);
  updateStat('academy-to-do',incomplete);
  updateStat('academy-percent',visible?Math.round(assigned.reduce((n,item)=>n+(item.summary?percent(item.summary):0),0)/Math.max(1,assigned.length))+'%':'—');
  const bar=$('academy-total-progress');
  if(bar)bar.style.width=(assigned.length?Math.round(assigned.reduce((n,i)=>n+(i.summary?percent(i.summary):0),0)/assigned.length):0)+'%';
 }
 function setCourse(course,summary){
  const detail=$('training-detail');if(!detail||!course)return;
  detail.querySelector('.academy-lesson-nav')?.remove();
  const nav=make('div',undefined,'academy-lesson-nav');
  const back=make('button','← All my courses','outline');
  back.type='button';back.onclick=()=>{stop();detail.hidden=true;const list=$('training-list');if(list&&list.scrollIntoView)list.scrollIntoView({block:'start',behavior:'smooth'});};
  nav.append(back);
  const meta=make('small',(Array.isArray(course.modules)?course.modules.length:0)+' lessons · '+percent(summary)+'% complete','academy-reading-note');
  nav.append(meta);detail.insertBefore(nav,detail.firstChild);
  detail.dataset.academyCourseId=String(course.id||'');
  setTimeout(decorate,0);
 }
 function supported(){return Boolean(W&&'speechSynthesis'in W&&typeof W.SpeechSynthesisUtterance==='function');}
 function setStatus(toolbar,message){
  if(!toolbar)return;const s=toolbar.querySelector('[data-academy-status]');if(s)s.textContent=String(message);
 }
 function resetControls(toolbar){
  if(!toolbar)return;
  for(const b of toolbar.querySelectorAll('button'))b.disabled=!supported();
  const pause=toolbar.querySelector('[data-academy-pause]');if(pause)pause.textContent='Pause';
 }
 function stop(){
  if(W?.SBCWorkforceAudio?.stop)W.SBCWorkforceAudio.stop();
  if(supported())try{W.speechSynthesis.cancel();}catch(_){}
  speech=null;setStatus(activeToolbar,'Ready to read the current lesson aloud.');
  resetControls(activeToolbar);activeToolbar=null;
 }
 function enhanceLesson(content){
  if(!content)return;
  // V66.109: delegate to the shared section navigation reader. Keep V66.97
  // browser read-aloud code below as a safe fallback when the new file fails.
  if(W?.SBCWorkforceAudio?.mount){W.SBCWorkforceAudio.mount(content,W);return;}
  if(content.querySelector('.academy-audio'))return;
  const toolbar=make('div',undefined,'academy-audio');
  toolbar.setAttribute('aria-label','Read this Academy lesson aloud');
  const title=make('strong','🎧 Listen to this lesson');toolbar.append(title);
  const play=make('button','Read aloud','outline');play.type='button';
  const pause=make('button','Pause','outline');pause.type='button';pause.dataset.academyPause='';
  const off=make('button','Stop','outline');off.type='button';
  toolbar.append(play,pause,off);
  const note=make('small','Voice uses the browser’s built-in speech and starts only when you choose Read aloud.','academy-reading-note');note.dataset.academyStatus='';toolbar.append(note);
  if(!supported()){play.disabled=true;pause.disabled=true;off.disabled=true;setStatus(toolbar,'Audio reading is unavailable in this browser. You can still read and complete the lesson.');}
  else{pause.disabled=true;off.disabled=true;}
  play.onclick=()=>{
   if(!supported())return;
   stop();
   const text=[...content.querySelectorAll('.lesson-part h4,.lesson-part p,.lesson-part li')].map(e=>String(e.textContent||'').trim()).filter(Boolean).join('.\n');
   if(!text){setStatus(toolbar,'No readable lesson content is available.');return;}
   const u=new W.SpeechSynthesisUtterance(text.slice(0,14500));u.lang='en-US';u.rate=.93;u.pitch=1;u.volume=1;
   speech=u;activeToolbar=toolbar;
   u.onend=()=>{if(speech!==u)return;speech=null;setStatus(toolbar,'Lesson reading finished.');pause.disabled=true;off.disabled=true;};
   u.onerror=()=>{if(speech!==u)return;speech=null;setStatus(toolbar,'Audio stopped or was interrupted.');pause.disabled=true;off.disabled=true;};
   pause.disabled=false;off.disabled=false;setStatus(toolbar,'Reading lesson aloud…');
   try{W.speechSynthesis.speak(u);}catch(e){speech=null;setStatus(toolbar,'Audio playback unavailable.');}
  };
  pause.onclick=()=>{if(!supported()||!speech)return;
   if(W.speechSynthesis.paused){W.speechSynthesis.resume();pause.textContent='Pause';setStatus(toolbar,'Reading resumed.');}
   else{W.speechSynthesis.pause();pause.textContent='Resume';setStatus(toolbar,'Reading paused.');}
  };
  off.onclick=stop;
  content.insertBefore(toolbar,content.firstChild);
 }
 function decorate(){
  const detail=$('training-detail');if(!detail||detail.hidden)return;
  const open=[...detail.querySelectorAll('.training-lesson-content:not([hidden])')];
  for(const content of open)enhanceLesson(content);
 }
 function install(win){
  if(!win?.document||!win.MutationObserver)return;W=win;
  const start=()=>{
   if(setupDone)return;setupDone=true;
   const detail=$('training-detail');if(detail){observer=new win.MutationObserver(decorate);observer.observe(detail,{childList:true,subtree:true});}
   win.document.addEventListener('click',e=>{
    if(e.target.closest('.training-module-head button')||e.target.closest('[data-tab]:not([data-tab="training"])'))stop();
   },true);
   win.addEventListener('pagehide',stop,{once:true});
  };
  if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 }
 return {install,setCatalog,setCourse,percent,stop};
});
