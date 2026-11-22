'use strict';
(()=>{
 const COURSE='sbc-account-manager-mastery-20261122';
 const STAGES=[
  {title:'Prospect intelligence',subtitle:'Understand SBC and the account',ids:['am-01','am-02','am-03']},
  {title:'Website-first discovery',subtitle:'Research trust and qualification',ids:['am-04','am-05']},
  {title:'Live concept presentation',subtitle:'Show the work truthfully',ids:['am-07']},
  {title:'Consultative proposal',subtitle:'Quote the correct scope',ids:['am-06','am-08']},
  {title:'Square & paid order evidence',subtitle:'Never infer captured payment',ids:['am-10']},
  {title:'Owner approval & governance',subtitle:'Know your decision boundary',ids:['am-09']},
  {title:'Durable delivery handoff',subtitle:'Never lose the next step',ids:['am-11']},
  {title:'Retention & certification',subtitle:'Prove complete account stewardship',ids:['am-12']}
 ];
 const $=id=>document.getElementById(id);
 const state={course:null,summary:null,attempts:[],certs:[],moduleId:STAGES[0].ids[0],scene:0,lang:'en',speaking:false,paused:false,voice:null,busy:false,questions:null,score:null,readOnly:true,budget:null};
 const t=(en,es)=>state.lang==='es'?es:en;
 function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
 async function call(path,{method='GET',body}={}){
  const response=await fetch(path,{method,cache:'no-store',credentials:'same-origin',redirect:'manual',
   headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(response.redirected||response.type==='opaqueredirect')throw Error('Your SBC sign-in expired. Sign in again to continue training.');
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data||data.ok===false)throw Error(String(data?.error||data?.message||'Academy unavailable')+' (HTTP '+response.status+')');
  return data;
 }
 const module=()=>state.course?.modules?.find(m=>m.id===state.moduleId);
 const progress=()=>state.summary?.modules?.find(m=>m.id===state.moduleId);
 const completed=id=>['completed','passed'].includes(String(state.summary?.modules?.find(m=>m.id===id)?.status||''));
 const stageIndex=id=>STAGES.findIndex(s=>s.ids.includes(id));
 const unlocked=stage=>STAGES.slice(0,stage).every(s=>s.ids.every(completed));
 const quizPassed=id=>state.attempts.some(a=>a.courseId===COURSE&&a.moduleId===id&&a.type==='sbc_am_objective'&&a.passed===true&&Number(a.score)>=90);
 const practiced=id=>state.attempts.some(a=>a.courseId===COURSE&&a.moduleId===id&&a.type==='sbc_am_roleplay_for_owner_review');
 const loadData=async()=>{
  const data=await call('/api/training/courses/'+encodeURIComponent(COURSE));
  state.course=data.course;state.summary=data.summary;state.readOnly=Boolean(data.readOnly||data.recoveryRequired);
  const user=await call('/api/training');
  state.attempts=Array.isArray(user.attempts)?user.attempts:[];
  state.certs=Array.isArray(user.certifications)?user.certifications:[];
  $('session').textContent=(user.user?.name||'SBC employee')+' · '+(user.user?.role||'Training');
 };
 async function refreshBudget(){
  try{
   const b=await call('/api/sbc/academy-am/v1/window');state.budget=b;
   const used=Number(b.trainingMinutes)||0;
   $('budgetUsed').textContent=used+' / '+(b.policy?.baseMinutes+(b.ownerOverride?Number(b.policy?.maxExtensionMinutes||0):0))+' tracked training minutes';
   $('budgetShifts').textContent=String(b.closedShifts??0)+' closed / '+(b.policy?.baseShifts||2)+' planned shifts';
   $('budgetState').textContent=b.ownerReviewRequired?'Owner review required':b.status==='NOT_STARTED'?'Not started':b.clockedIn?'Training clock running':'Ready for next shift';
   const locked=b.ownerReviewRequired||!b.clockedIn||b.status==='NOT_STARTED';
   $('budgetMessage').textContent=b.ownerReviewRequired?
    'Training budget reached. No additional assigned lessons are permitted until the owner decides whether to certify, reassign, or explicitly approve an extension. Worked time remains payable.' :
    'Target: complete the Academy within two scheduled training shifts (eight time-clock hours). '+Math.max(0,Number(b.minutesRemaining??480))+' minutes remain in this training budget. Passing and owner certification are separate.';
   document.querySelector('.budget').classList.toggle('review',Boolean(b.ownerReviewRequired));
   $('clockInAcademy').disabled=b.ownerReviewRequired||b.clockedIn;
   $('clockOutAcademy').disabled=!b.clockedIn;
   $('quizSubmit').disabled=state.readOnly||state.busy||locked||!state.questions?.length;
   $('submitPractice').disabled=state.readOnly||state.busy||locked;
   return b;
  }catch(e){state.budget=null;$('budgetMessage').textContent='Training-clock status unavailable: '+e.message;
   $('quizSubmit').disabled=true;$('submitPractice').disabled=true;
   throw e;
  }
 }
 function activeCert(){return state.certs.slice().reverse().find(c=>c.courseId===COURSE&&c.status==='Certified')||null;}
 function renderNav(){
  const nav=$('stageNav');nav.replaceChildren();
  let done=0;const total=STAGES.reduce((s,v)=>s+v.ids.length,0);
  for(let i=0;i<STAGES.length;i++){
   const st=STAGES[i],locked=!unlocked(i),finished=st.ids.every(completed);
   done+=st.ids.filter(completed).length;
   const b=document.createElement('button');
   b.type='button';b.disabled=locked;b.className=i===stageIndex(state.moduleId)?'active':'';
   b.setAttribute('aria-current',b.className==='active'?'step':'false');
   const badge=document.createElement('span');badge.className='step-num';badge.textContent=finished?'✓':String(i+1).padStart(2,'0');
   const text=document.createElement('span');text.className='step-copy';
   const name=document.createElement('b');name.textContent=st.title;
   const sub=document.createElement('small');sub.textContent=locked?'🔒 Prerequisite required':finished?'Completed · review anytime':st.subtitle;
   text.append(name,sub);b.append(badge,text);
   b.addEventListener('click',()=>{if(!locked)select(st.ids.find(id=>!completed(id))||st.ids[0])});nav.append(b);
  }
  const pct=total?Math.round(done/total*100):0;
  $('percent').textContent=pct+'%';
  $('completionSummary').textContent=done+' of '+total+' lessons completed';
  $('ring').style.background='conic-gradient(#74e6d9 '+(pct*3.6)+'deg,#2b5475 0)';
  const certified=activeCert();
  $('certLabel').textContent=certified?'Owner-certified Account Manager':pct===100?'All lessons complete · owner review needed':'Training in progress';
  $('certState').textContent=certified?'CERTIFIED · OWNER APPROVED':'OWNER CERTIFICATION REQUIRED';
 }
 function sceneData(m){
  const info=m.academyMedia||{},s=STAGES[stageIndex(m.id)]||STAGES[0];
  const text=(state.lang==='es'&&Array.isArray(info.spanish))?info.spanish:[];
  const english=[info.scenario,m.lesson?.learn?.[0],m.lesson?.learn?.[3],info.script];
  return [
    {title:t('Understand the customer','Comprender al cliente'),body:text[0]||english[0],label:'UNDERSTAND',status:'RESEARCH',flow:0},
    {title:t('Ask the right question','Haga la pregunta correcta'),body:text[1]||english[1],label:'DISCOVER',status:'REVIEW',flow:1},
    {title:t('Follow the SBC process','Siga el proceso de SBC'),body:text[2]||english[2],label:'PROTECT',status:'CONTROLLED',flow:2},
    {title:t('Deliver the next action','Confirme el siguiente paso'),body:text[3]||english[3],label:'HANDOFF',status:'OWNER REVIEW',flow:2}
  ].map(x=>({...x,stage:s.title}));
 }
 function stopVoice(){
  state.speaking=false;state.paused=false;
  if('speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(_){}
  $('playScene').textContent=t('▶ Play lesson','▶ Reproducir lección');
  $('pauseVoice').textContent=t('⏸ Pause','⏸ Pausar');
 }
 function renderScene(){
  const m=module();if(!m)return;
  const items=sceneData(m),scene=items[state.scene]||items[0],canvas=$('motionCanvas');
  $('sceneCount').textContent=String(state.scene+1).padStart(2,'0')+' / 04';
  $('captionTitle').textContent=scene.title;
  $('caption').textContent=scene.body;
  $('sceneTitle').textContent=t('Animated workflow walkthrough','Demostración visual interactiva');
  $('screenLabel').textContent='SBC · '+scene.stage.toUpperCase().slice(0,26);
  $('mockEyebrow').textContent=t('FICTIONAL BUSINESS / LEARNING MODE','NEGOCIO FICTICIO / PRÁCTICA');
  $('mockTitle').textContent=scene.title;
  $('mockBody').textContent=scene.body;
  $('mockStat').textContent=scene.status;
  $('flowOne').textContent=t('RESEARCH','INVESTIGAR');
  $('flowTwo').textContent=t('DISCOVER','DESCUBRIR');
  $('flowThree').textContent=t('APPROVE','APROBAR');
  for(const [i,id] of ['flowOne','flowTwo','flowThree'].entries())$(id).classList.toggle('focus',scene.flow===i);
  canvas.classList.remove('animating');
  void canvas.offsetWidth;
  canvas.classList.add('animating');
  $('prevScene').disabled=state.scene<=0;
  $('nextScene').disabled=state.scene>=3;
 }
 function speak(){
  const m=module();if(!m)return;
  if(!('speechSynthesis'in window)||typeof window.SpeechSynthesisUtterance!=='function'){
   $('voiceStatus').textContent=t('Narration is unavailable in this browser. Use the visual lesson and written transcript.','La narración no está disponible en este navegador.');
   return;
  }
  stopVoice();state.speaking=true;
  $('playScene').textContent=t('◼ Stop narration','◼ Detener narración');
  function next(){
   if(!state.speaking)return;
   const scene=sceneData(m)[state.scene];
   const utterance=new window.SpeechSynthesisUtterance(scene.title+'. '+scene.body);
   utterance.lang=state.lang==='es'?'es-ES':'en-US';
   utterance.rate=Number($('voiceRate').value)||1;
   utterance.pitch=1;utterance.volume=1;
   const voice=(window.speechSynthesis.getVoices?.()||[]).find(v=>String(v.lang).toLowerCase().startsWith(state.lang==='es'?'es':'en'));
   if(voice)utterance.voice=voice;
   state.voice=utterance;
   utterance.onend=()=>{
    if(!state.speaking||state.voice!==utterance)return;
    if(state.scene>=3){state.speaking=false;$('playScene').textContent=t('▶ Replay lesson','▶ Repetir lección');$('voiceStatus').textContent=t('Visual narration complete.','Narración completada.');return}
    state.scene++;renderScene();next();
   };
   utterance.onerror=()=>{if(state.voice===utterance)stopVoice();};
   $('voiceStatus').textContent=t('Narrating visual scene ','Narrando escena visual ')+(state.scene+1)+' / 4';
   window.speechSynthesis.speak(utterance);
  }
  next();
 }
 async function select(id){
  stopVoice();state.moduleId=id;state.scene=0;state.score=null;state.questions=null;
  renderNav();renderLesson();
  $('quizQuestions').replaceChildren();$('quizFeedback').textContent='';
  $('practiceResponse').value='';$('practiceStatus').textContent='';
  $('quizSubmit').disabled=true;
  if(!unlocked(stageIndex(id))){
   notice('This stage is locked until all lessons in the previous stage are complete.',true);return;
  }
  try{
   const result=await call('/api/sbc/academy-am/v1/quiz/'+encodeURIComponent(id));
   if(state.moduleId!==id)return;
   state.questions=result.questions||[];renderQuiz();
   notice(state.readOnly?t('Recovery mode: you may study but cannot save scores or practice evidence.','Modo recuperación: puede estudiar, pero no guardar evidencias.'):t('Training connected. Assessments and practice evidence save to your SBC account.','Capacitación conectada. Sus resultados y prácticas se guardan en SBC.'),state.readOnly);
  }catch(e){notice('Quiz service: '+e.message,true)}
 }
 function renderLesson(){
  const m=module();if(!m)return;
  const info=m.academyMedia||{},st=STAGES[stageIndex(m.id)];
  $('lessonKicker').textContent='STAGE '+String(stageIndex(m.id)+1).padStart(2,'0')+' / 08 · '+(info.skill||'SBC MASTERY').toUpperCase();
  $('lessonTitle').textContent=m.title;
  $('lessonObjective').textContent=state.lang==='es'?'Objetivo: '+(info.spanish?.[0]||m.description):m.description;
  $('scenario').textContent=t(info.scenario||m.lesson?.knowledgeCheck?.prompt,info.spanish?.[0]||info.scenario||'Ejercicio basado en un negocio ficticio.');
  $('sampleScript').textContent='“'+t(info.script||'',info.spanish?.[3]||info.script||'')+'”';
  $('redFlags').textContent=info.redFlags||'Do not fabricate a customer fact or payment.';
  const points=$('learnPoints');points.replaceChildren();
  const learn=state.lang==='es'&&info.spanish?.length?info.spanish:m.lesson?.learn||[];
  for(const copy of learn){const p=document.createElement('div');p.className='point';p.textContent=copy;points.append(p)}
  $('practiceStatus').textContent=practiced(m.id)?t('Practice previously submitted for review.','Práctica enviada anteriormente.'):'';
  $('quizFeedback').className='feedback';
  $('quizFeedback').textContent=quizPassed(m.id)?t('Knowledge gate previously passed.','Evaluación de conocimientos aprobada anteriormente.'):'';
  $('submitPractice').disabled=state.readOnly||state.busy||!state.budget?.clockedIn||state.budget.ownerReviewRequired;
  renderScene();
 }
 function renderQuiz(){
  const host=$('quizQuestions');host.replaceChildren();
  const qs=state.questions||[];
  for(let i=0;i<qs.length;i++){
   const q=qs[i],field=document.createElement('fieldset');field.className='quiz-item';
   const legend=document.createElement('legend');legend.textContent=(i+1)+'. '+q.prompt;field.append(legend);
   for(let j=0;j<(q.choices||[]).length;j++){
    const label=document.createElement('label'),input=document.createElement('input');
    input.type='radio';input.name='question-'+i;input.value=String(j);
    input.required=true;
    const text=document.createElement('span');text.textContent=q.choices[j];label.append(input,text);field.append(label);
   }host.append(field);
  }
  $('quizSubmit').disabled=state.readOnly||!qs.length||!state.budget?.clockedIn||state.budget.ownerReviewRequired;
 }
 async function finishIfReady(){
  const id=state.moduleId;
  if(completed(id)||!quizPassed(id)||!practiced(id))return;
  await call('/api/training/progress',{method:'POST',body:{courseId:COURSE,moduleId:id,status:'completed',
   evidence:'SBC Academy 360: Completed the server-scored >=90% assessment, submitted a written fictional practice response for owner review and reviewed all four motion scenes; training completion does not authorize live customer interaction.'}});
  await loadData();renderNav();renderLesson();
  notice(t('Lesson completed and saved. The next stage unlocks when all lessons in this stage are complete.','Lección guardada. La siguiente etapa se abrirá al completar todas las lecciones.'));
 }
 $('playScene').addEventListener('click',()=>{if(state.speaking)stopVoice();else speak()});
 $('pauseVoice').addEventListener('click',()=>{
  if(!state.speaking||!('speechSynthesis'in window))return;
  if(state.paused){window.speechSynthesis.resume();state.paused=false;$('pauseVoice').textContent='⏸ Pause';}
  else{window.speechSynthesis.pause();state.paused=true;$('pauseVoice').textContent='▶ Resume';}
 });
 $('prevScene').addEventListener('click',()=>{stopVoice();state.scene=Math.max(0,state.scene-1);renderScene()});
 $('nextScene').addEventListener('click',()=>{stopVoice();state.scene=Math.min(3,state.scene+1);renderScene()});
 for(const lang of ['en','es'])$('lang'+lang.charAt(0).toUpperCase()+lang.slice(1)).addEventListener('click',()=>{
  stopVoice();state.lang=lang;
  $('langEn').setAttribute('aria-pressed',String(lang==='en'));
  $('langEs').setAttribute('aria-pressed',String(lang==='es'));
  if(module()){renderLesson();renderQuiz()}
 });
 $('submitPractice').addEventListener('click',async()=>{
  if(state.busy||state.readOnly||!state.budget?.clockedIn||state.budget.ownerReviewRequired)return;
  const response=$('practiceResponse').value.trim();
  if(response.length<80||response.length>3500){$('practiceStatus').textContent='Write between 80 and 3,500 characters of original fictional practice.';return}
  state.busy=true;$('submitPractice').disabled=true;
  try{
   const result=await call('/api/sbc/academy-am/v1/roleplay/'+state.moduleId,{method:'POST',body:{response}});
   $('practiceStatus').textContent=result.submitted?'Practice saved for owner review.':'Submission not confirmed.';
   await loadData();await finishIfReady();
  }catch(e){$('practiceStatus').textContent=e.message;notice(e.message,true)}
  finally{state.busy=false;await refreshBudget().catch(()=>{})}
 });
 $('quiz').addEventListener('submit',async e=>{
  e.preventDefault();
  if(state.busy||state.readOnly||!state.budget?.clockedIn||state.budget.ownerReviewRequired||!state.questions?.length)return;
  const values=state.questions.map((q,i)=>{
   const selected=document.querySelector('input[name="question-'+i+'"]:checked');
   return selected?Number(selected.value):null;
  });
  if(values.includes(null)){$('quizFeedback').textContent='Answer all three questions before submitting.';return}
  state.busy=true;$('quizSubmit').disabled=true;
  try{
   const result=await call('/api/sbc/academy-am/v1/quiz/'+state.moduleId,{method:'POST',body:{answers:values}});
   $('quizFeedback').className='feedback '+(result.passed?'good':'bad');
   $('quizFeedback').textContent=(result.passed?'PASS':'RETRY')+' · '+result.score+'% · '+result.correct+' of '+result.total+' correct. '+(result.remediation||'Remember: the owner reviews practice and grants certification separately.');
   await loadData();await finishIfReady();
  }catch(e){$('quizFeedback').className='feedback bad';$('quizFeedback').textContent=e.message;notice(e.message,true)}
  finally{state.busy=false;await refreshBudget().catch(()=>{})}
 });
 $('budgetRefresh').addEventListener('click',()=>refreshBudget().catch(e=>notice(e.message,true)));
 $('clockInAcademy').addEventListener('click',async()=>{
  if(state.busy)return;state.busy=true;$('clockInAcademy').disabled=true;
  try{
   const current=await call('/api/v9/time/status');
   if(current.open&&current.open.mode!=='training')throw Error('You are clocked in for a different shift. End that shift using the official time clock before beginning training.');
   if(!current.open)await call('/api/v9/time/clock',{method:'POST',body:{action:'in',mode:'training'}});
   await call('/api/sbc/academy-am/v1/window/start',{method:'POST',body:{}});
   await refreshBudget();renderLesson();renderQuiz();
   notice('Official training clock is running. The eight-hour fast-track budget is active.');
  }catch(e){notice('Training shift not started: '+e.message+'. Verify the official time clock before retrying.',true)}
  finally{state.busy=false;await refreshBudget().catch(()=>{})}
 });
 $('clockOutAcademy').addEventListener('click',async()=>{
  if(state.busy)return;state.busy=true;$('clockOutAcademy').disabled=true;
  try{
   await call('/api/v9/time/clock',{method:'POST',body:{action:'out'}});
   await refreshBudget();notice('Official training time recorded. Your progress is saved. Return for the next approved shift or owner review.');
  }catch(e){notice('Clock-out not confirmed: '+e.message,true)}
  finally{state.busy=false;await refreshBudget().catch(()=>{})}
 });
 window.addEventListener('pagehide',stopVoice,{once:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.speaking&&'speechSynthesis'in window)try{window.speechSynthesis.pause();state.paused=true}catch(_){}});
 (async()=>{try{
  await loadData();
  if(!state.course||!Array.isArray(state.course.modules))throw Error('SBC Academy curriculum is not installed in this release.');
  renderNav();await refreshBudget();await select(state.moduleId);
 }catch(e){
  notice(e.message+' No account records or training scores were changed.',true);
  $('lessonObjective').textContent='The Academy requires your authenticated SBC account and an installed training catalog.';
  $('playScene').disabled=true;$('submitPractice').disabled=true;$('quizSubmit').disabled=true;
 }})();
})();