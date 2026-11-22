'use strict';
(()=>{
 const COURSE='sbc-account-manager-mastery-20261122',PREFIX='/api/sbc/academy-am/v1';
 const STAGES=[
  [['Prospect intelligence','Inteligencia del prospecto'],['am-01','am-02','am-03']],
  [['Website-first discovery','Descubrimiento de necesidades'],['am-04','am-05']],
  [['Honest website demonstration','Demostración web honesta'],['am-07']],
  [['Consultative proposal','Propuesta consultiva'],['am-06','am-08']],
  [['Square & payment evidence','Square y evidencia de cobro'],['am-10']],
  [['Follow-up & owner controls','Seguimiento y controles'],['am-09']],
  [['Delivery & account care','Entrega y cuidado de cuenta'],['am-11']],
  [['Bilingual capstone','Simulación final bilingüe'],['am-12']]
 ];
 const $=id=>document.getElementById(id);
 const state={lang:'en',course:null,summary:null,attempts:[],certs:[],user:null,moduleId:'am-01',scene:0,questions:[],lab:null,nodes:null,path:[],node:'start',budget:null,readOnly:true,busy:false,tab:'Lesson',voice:null,speaking:false,paused:false};
 const t=(en,es)=>state.lang==='es'?es:en;
 const ES={skip:'Ir al estudio',journey:'SU RECORRIDO DE CERTIFICACIÓN',practiceOnly:'● PRÁCTICA FICTICIA',isolated:'Desarrolle habilidades en casos aislados. Las cuentas reales y los pagos quedan fuera de esta aula.',workspace:'← Gestión de cuentas',ownerDesk:'Revisión del dueño →',loading:'Conectando su registro…',fastTrack:'INCORPORACIÓN PARA PERSONAL EXPERIMENTADO',headline:'Gane la confianza. Cuide la relación.',intro:'El proceso de SBC, desde la primera conversación hasta la próxima renovación. Observe. Practique. Demuestre.',eightStages:'8 etapas',twelveLabs:'12 laboratorios',ownerObserved:'Simulación observada por el dueño',progress:'avance',timeBudget:'SU PRESUPUESTO DE CAPACITACIÓN',budgetTitle:'2 turnos · 8 horas de trabajo pagadas',clockIn:'Registrar entrada e iniciar',clockOut:'Registrar salida',refresh:'Actualizar',nextMove:'SU SIGUIENTE PASO',continue:'Continuar →',lessonTab:'01 · Aprenda',labTab:'02 · Practique',knowledgeTab:'03 · Demuestre',visualStudio:'ESTUDIO VISUAL DE APRENDIZAJE',illustration:'PROCESO ILUSTRADO',fictional:'FICTICIO',proof:'EVIDENCIA',sourceFirst:'Primero la fuente',authority:'AUTORIDAD',ownerControlled:'Control del dueño',play:'▶ Narrar',pause:'Pausar',nextScene:'Siguiente →',speed:'Velocidad',voiceNote:'Narración del navegador. Es una ilustración, no una grabación del sistema real.',fieldNotes:'NOTAS DEL ENTRENADOR',mustKnow:'Lo que debe saber',critical:'LÍMITE CRÍTICO',tryPractice:'Practicar →',workSample:'SU MUESTRA DE TRABAJO',objectionArena:'Conversación con decisiones',resetPractice:'Reiniciar conversación',submitLab:'Evaluar mi trabajo',humanSkill:'HABILIDAD HUMANA · EVIDENCIA',practiceConversation:'Practique la conversación',ownResponse:'Su respuesta original · solo información ficticia',capstoneNote:'En la simulación final, coordine una llamada y una demostración observadas en inglés y español. Este texto es una nota; no demuestra fluidez oral.',submitPractice:'Presentar evidencia',noShortcuts:'SIN ATAJOS',sampleRule:'Mínimo 90%. Un error crítico causa una falla. El dueño revisa por separado la nota y la simulación observada.',knowledgeGate:'EVALUACIÓN EN EL SERVIDOR',proveUnderstanding:'Demuestre lo que entiende',quizRule:'Mínimo 90% por lección. Esta evaluación de tres preguntas requiere las tres correctas. Revise los comentarios y repita si hace falta.',submitQuiz:'Evaluar conocimientos',nextLesson:'Siguiente lección →',sbcStandard:'EL ESTÁNDAR SBC',certEarned:'La certificación se gana.',certRequirements:'Conocimientos, decisiones prácticas, observación bilingüe y aprobación de Jonathan. Completar lecciones no otorga acceso a clientes.',footer:'Successful By Choice LLC · Because Why Not? · Capacitación privada · Sin llamadas reales ni intentos de pago'};
 const original=new Map([...document.querySelectorAll('[data-i18n]')].map(e=>[e,e.innerHTML]));
 function translate(){document.documentElement.lang=state.lang;for(const [e,en] of original){if(state.lang==='es')e.textContent=ES[e.dataset.i18n]||e.textContent;else e.innerHTML=en;}for(const l of ['en','es'])$('lang'+(l==='en'?'En':'Es')).setAttribute('aria-pressed',String(state.lang===l));}
 function notice(text,bad=false){$('notice').textContent=text;$('notice').classList.toggle('error',bad);}
 async function call(path,{method='GET',body}={}){
  const r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',redirect:'manual',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const d=await r.json().catch(()=>null);if(!r.ok||!d||d.ok===false)throw Error(d?.error||d?.message||t('Academy unavailable. Sign in again if your session expired.','Academia no disponible. Inicie sesión si ha caducado.')+' ('+r.status+')');return d;
 }
 const mod=()=>state.course?.modules.find(m=>m.id===state.moduleId);
 const localized=m=>state.lang==='es'?{...m,...m.translations.es}:m;
 const owner=()=>state.user?.role==='owner';
 const latest=(id,type)=>state.attempts.filter(a=>a.courseId===COURSE&&a.moduleId===id&&a.type===type).at(-1);
 const knowledge=id=>latest(id,'sbc_am_objective')?.passed===true;
 const practiced=id=>{const a=latest(id,'sbc_am_roleplay_for_owner_review');return Boolean(a&&a.passed!==false);};
 const sampled=id=>latest(id,'sbc_am_work_sample')?.passed===true;
 const complete=id=>['completed','passed'].includes(state.summary?.modules.find(m=>m.id===id)?.status)&&knowledge(id)&&practiced(id)&&sampled(id);
 const stage=id=>STAGES.findIndex(s=>s[1].includes(id));
 const unlocked=i=>owner()||STAGES.slice(0,i).every(s=>s[1].every(complete));
 const writable=()=>!owner()&&!state.readOnly&&!state.busy&&state.budget?.active===true;

 function gradingBlocker(){
  if(!state.user)return t('Verifying your employee session.','Verificando la sesión del empleado.');
  if(owner())return t('Owner preview cannot score employee work. Use the test Account Manager login for official scoring; review submissions in the Owner Review Desk.','La vista del dueño no puede evaluar el trabajo del empleado. Use la cuenta de prueba de gerente para las evaluaciones oficiales y revise el trabajo en el panel del dueño.');
  if(state.readOnly)return t('Training is read-only during recovery. No score can be saved.','La capacitación está en modo de solo lectura por recuperación. No puede guardar calificaciones.');
  if(!state.budget)return t('Checking official training time.','Verificando el tiempo oficial de capacitación.');
  if(state.budget.ownerReviewRequired)return t('Your training time needs owner approval before scoring can continue.','Necesita aprobación del dueño para continuar las evaluaciones.');
  if(!state.budget.active)return t('Start your official training clock above to enable the Score buttons.','Inicie el reloj oficial de capacitación arriba para activar los botones de evaluación.');
  return '';
 }
 function nextMissingStep(){
  const id=state.moduleId;
  if(!sampled(id))return {tab:'Lab',label:t('Score my work sample →','Evaluar mi práctica →'),message:t('Open 02 · Practice. Choose every decision, add at least 80 characters of fictional case evidence, then click Score my work sample. The server grades the structured decisions.','Abra 02 · Practique. Elija todas las decisiones, escriba 80 caracteres de evidencia ficticia y pulse Evaluar mi práctica. El servidor califica las decisiones estructuradas.')};
  if(!practiced(id))return {tab:'Lab',label:t('Submit my roleplay note →','Enviar mi simulación →'),message:t('Write at least 80 characters in Your own response, then click Submit practice evidence. This note goes to owner review; it is not automatically scored.','Escriba al menos 80 caracteres en Su respuesta original y envíe la evidencia. Esta nota requiere revisión del dueño y no se califica automáticamente.')};
  if(!knowledge(id))return {tab:'Knowledge',label:t('Score my knowledge answers →','Evaluar mis respuestas →'),message:t('Open 03 · Prove it. Answer all three questions, then click Score my knowledge answers for your server score and explanations. All three must be correct to meet the 90% minimum.','Abra 03 · Demuestre. Conteste las tres preguntas y pulse Evaluar mis respuestas para ver la nota oficial y las explicaciones. Debe acertar las tres para superar el 90%.')};
  if(!complete(id))return {tab:'Knowledge',label:t('Refresh my lesson progress →','Actualizar mi avance →'),message:t('Your scores and practice note are recorded. Refresh your record to confirm lesson completion. Owner certification remains separate.','Sus calificaciones y notas ya están registradas. Actualice el expediente para confirmar la lección. La certificación del dueño es independiente.')};
  return {tab:'Lesson',label:t('Continue to next lesson →','Seguir a la próxima lección →'),message:t('This lesson is complete. Continue to the next unlocked lesson or arrange your owner-observed bilingual capstone.','Esta lección está completa. Continúe a la próxima lección desbloqueada o coordine la simulación bilingüe con el dueño.')};
 }
 function renderGuidance(){
  const host=$('academyStepList');if(!host)return;
  const id=state.moduleId,blocker=gradingBlocker(),next=nextMissingStep();
  const steps=[
   [t('Watch the real-interface demonstration and review the screenshots','Vea la demostración y las capturas del sistema'),null],
   [t('Score the structured work sample (90% minimum)','Evalúe la práctica estructurada (mínimo 90%)'),sampled(id)],
   [t('Submit the written roleplay for owner review','Envíe la simulación escrita para revisión'),practiced(id)],
   [t('Score all three knowledge answers','Evalúe las tres respuestas de conocimientos'),knowledge(id)],
   [t('Complete the lesson; owner certification is separate','Complete la lección; la certificación es independiente'),complete(id)]
  ];
  host.replaceChildren();
  for(const [label,done] of steps){const li=document.createElement('li');li.textContent=(done===true?'✓ ':done===false?'○ ':'▶ ')+label;if(done)li.className='complete';host.append(li);}
  $('academyActionStatus').textContent=blocker||next.message;
  $('academyNextAction').textContent=owner()?t('Open Owner Review Desk →','Abrir revisión del dueño →'):blocker?t('Find scoring requirements ↑','Ver requisitos de evaluación ↑'):next.label;
  $('academyNextAction').disabled=state.busy||!state.course;
  $('labGateHint').textContent=blocker||t('Select each decision, write 80+ characters of fictional case evidence, then Score my work sample. The choices receive a server score; free-text roleplay is reviewed by the owner.','Seleccione cada decisión, escriba 80 caracteres de evidencia ficticia y evalúe la práctica. El servidor califica las decisiones; el dueño revisa la simulación escrita.');
  $('quizGateHint').textContent=blocker||t('Answer all three and press Score my knowledge answers. Feedback appears below the button. Three correct answers meet the 90% standard.','Conteste las tres y pulse Evaluar mis respuestas. Los comentarios aparecen debajo del botón. Debe acertar las tres para alcanzar el 90%.');
  $('nextMove').textContent=blocker||next.message;
 }

 function controls(){$('quizSubmit').disabled=!writable()||!state.questions.length;$('labSubmit').disabled=!writable()||!state.lab;$('submitPractice').disabled=!writable();renderGuidance();$('clockInAcademy').disabled=state.busy||state.readOnly||owner()||Boolean(state.budget?.clockedIn)||Boolean(state.budget?.ownerReviewRequired);$('clockOutAcademy').disabled=state.busy||state.readOnly||owner()||!state.budget?.clockedIn;}
 async function loadData(){
  const [data,record]=await Promise.all([call('/api/training/courses/'+COURSE),call('/api/training')]);
  state.course=data.course;state.summary=data.summary;state.user=record.user;state.attempts=record.attempts||[];state.certs=record.certifications||[];state.readOnly=Boolean(data.readOnly||record.readOnly||data.recoveryRequired);
  $('session').textContent=(state.user?.name||'SBC')+' · '+(owner()?t('Owner preview','Vista del dueño'):t('Account Manager','Gerente de cuentas'));
  $('ownerLink').hidden=!owner();renderNav();
 }
 async function refreshBudget(){
  try{state.budget=await call(PREFIX+'/window');state.readOnly=Boolean(state.readOnly||state.budget.readOnly);renderBudget();controls();}
  catch(e){state.budget=null;controls();$('budgetMessage').textContent=e.message;throw e;}
 }
 function renderBudget(){
  const b=state.budget;if(!b)return;
  $('budgetUsed').textContent=b.trainingMinutes+' / '+b.approvedMinutes+t(' training minutes',' minutos de capacitación');
  $('budgetShifts').textContent=(b.closedShifts||0)+' / '+b.approvedShifts+t(' shifts completed',' turnos completados');
  $('budgetState').textContent=b.ownerReviewRequired?t('Owner review required','Revisión del dueño requerida'):b.clockedIn?t('Official clock running','Reloj oficial activo'):t('Clock stopped','Reloj detenido');
  $('budgetMessage').textContent=owner()?t('Owner preview. Review trainee time and certification from the owner desk.','Vista del dueño. Revise el tiempo y la certificación de cada empleado en su panel.'):b.ownerReviewRequired?t('Training budget reached. Additional assigned training needs the owner’s decision. Worked time remains payable.','Presupuesto agotado. El dueño debe decidir antes de asignar más capacitación. El trabajo realizado sigue siendo pagadero.'):t('400 minutes of core lessons + 80 minutes for review and flexibility. ','400 minutos de contenido + 80 para revisión y flexibilidad. ')+b.minutesRemaining+t(' minutes remain. Only the official training clock counts.',' minutos restantes. Solo cuenta el reloj oficial.');
  document.querySelector('.budget').classList.toggle('review',Boolean(b.ownerReviewRequired));
 }
 function title(m){return state.lang==='es'?m.translations.es.title:m.title;}
 function renderNav(){
  const nav=$('stageNav');nav.replaceChildren();let done=0;
  STAGES.forEach((s,i)=>{const b=document.createElement('button'),finished=s[1].every(complete);done+=s[1].filter(complete).length;b.type='button';b.disabled=!unlocked(i)||state.busy;b.className=stage(state.moduleId)===i?'active':'';b.setAttribute('aria-current',stage(state.moduleId)===i?'step':'false');const badge=document.createElement('span');badge.className='step-num';badge.textContent=finished?'✓':String(i+1).padStart(2,'0');const copy=document.createElement('span');copy.className='step-copy';const label=document.createElement('b');label.textContent=s[0][state.lang==='es'?1:0];const small=document.createElement('small');small.textContent=finished?t('Complete · review','Completo · revisar'):unlocked(i)?t('Practice and prove competence','Practique y demuestre competencia'):t('Previous stage required','Requiere la etapa anterior');copy.append(label,small);b.append(badge,copy);b.onclick=()=>select(s[1].find(id=>!complete(id))||s[1][0]);nav.append(b);});
  const pct=Math.round(done/12*100);$('percent').textContent=pct+'%';$('ring').style.background='conic-gradient(#f4ca75 '+pct*3.6+'deg,#26475b 0)';$('completionSummary').textContent=done+t(' of 12 lessons completed',' de 12 lecciones completadas');
  const cert=state.certs.filter(c=>c.courseId===COURSE).at(-1);
  const certified=done===12&&cert?.status==='Certified'&&cert.academyVersion==='2026.11.22.2'&&(!cert.expiresAt||Date.parse(cert.expiresAt)>Date.now())&&cert.capstoneAttemptId===latest('am-12','sbc_am_roleplay_for_owner_review')?.id&&cert.capstoneReviewId===latest('am-12','sbc_am_roleplay_for_owner_review')?.academyRubric?.reviewId;
  $('certLabel').textContent=certified?t('Owner certification recorded','Certificación del dueño registrada'):t('Live clearance requires owner approval','El acceso requiere aprobación del dueño');
  $('certState').textContent=certified?t('OWNER CERTIFIED','CERTIFICADO POR EL DUEÑO'):t('OWNER REVIEW REQUIRED','REVISIÓN DEL DUEÑO');
  $('nextMove').textContent=done===12?t('Complete the observed bilingual capstone and ask Jonathan to review the evidence.','Complete la simulación observada en ambos idiomas y solicite la revisión de Jonathan.'):t('Finish the lesson, pass the work sample, submit practice, then pass the knowledge check.','Complete la lección, apruebe la práctica, presente evidencia y apruebe conocimientos.');
  renderGuidance();
  const modules=$('moduleNav');modules.replaceChildren();
  for(const id of STAGES[stage(state.moduleId)][1]){const m=state.course?.modules.find(m=>m.id===id);if(!m)continue;const b=document.createElement('button');b.type='button';b.textContent=(complete(id)?'✓ ':'')+title(m);b.setAttribute('aria-current',String(id===state.moduleId));b.onclick=()=>select(id);modules.append(b);}
 }
 function scenes(){const m=mod(),x=localized(m);return state.lang==='es'?[x.scenario,x.learn[0],x.learn[3],x.script]:[m.academyMedia.scenario,m.lesson.learn[0],m.lesson.learn[3],m.academyMedia.script];}
 function stopVoice(){state.speaking=false;state.paused=false;state.voice=null;try{window.speechSynthesis?.cancel()}catch(_){}$('playScene').textContent=t('▶ Narrate','▶ Narrar');$('pauseVoice').textContent=t('Pause','Pausar');}
 function renderScene(){
  if(!mod())return;const labels=state.lang==='es'?['Comprenda la necesidad','Haga una pregunta útil','Aplique el proceso','Confirme el siguiente paso']:['Understand the need','Ask a useful question','Apply the process','Confirm the next action'];
  $('sceneTitle').textContent=labels[state.scene];$('sceneCount').textContent=String(state.scene+1).padStart(2,'0')+' / 04';$('mockTitle').textContent=labels[state.scene];$('mockBody').textContent=scenes()[state.scene];$('screenLabel').textContent='SBC · '+t('FICTIONAL CASE','CASO FICTICIO');
  ['flowOne','flowTwo','flowThree'].forEach((id,i)=>{$(id).textContent=(state.lang==='es'?['INVESTIGAR','DESCUBRIR','APROBAR']:['RESEARCH','DISCOVER','APPROVE'])[i];$(id).classList.toggle('focus',Math.min(state.scene,2)===i);});
  $('prevScene').disabled=state.scene===0;$('nextScene').disabled=state.scene===3;
  $('motionCanvas').classList.remove('scene-enter');void $('motionCanvas').offsetWidth;$('motionCanvas').classList.add('scene-enter');
 }

 function chooseVoice(voices,lang,preferred){
  const candidates=Array.from(voices||[]).filter(v=>String(v.lang||'').toLowerCase().startsWith(lang));
  if(preferred&&preferred!=='auto'){const selected=candidates.find(v=>v.voiceURI===preferred);if(selected)return selected;}
  const score=v=>{
   const name=String(v.name||'').toLowerCase(),locale=String(v.lang||'').toLowerCase();
   return (/natural|neural|premium|enhanced/.test(name)?100:0)+(/google|microsoft|aria|jenny|samantha|paulina|helena/.test(name)?30:0)+(locale===(lang==='es'?'es-es':'en-us')?8:0);
  };
  return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
 }
 function populateVoices(){
  const select=$('narrationVoice');if(!select)return;
  const lang=state.lang,voices=(window.speechSynthesis?.getVoices()||[]).filter(v=>String(v.lang||'').toLowerCase().startsWith(lang));
  const stored=(()=>{try{return localStorage.getItem('sbc-academy360-voice-'+lang)||'auto';}catch(_){return 'auto';}})();
  select.replaceChildren();const first=document.createElement('option');first.value='auto';first.textContent=t('Best available device voice','Mejor voz del dispositivo');select.append(first);
  for(const v of voices){const item=document.createElement('option');item.value=v.voiceURI;item.textContent=v.name+' · '+v.lang+(v.localService?' · local':'');select.append(item);}
  select.value=voices.some(v=>v.voiceURI===stored)?stored:'auto';
  $('voiceStatus').textContent=voices.length?t('Choose a clearer voice, then try ▶ Test voice. The video soundtrack is separate.','Elija una voz más clara y pruebe ▶ Test voice. La banda sonora del video es independiente.'):t('No matching voice found on this browser. The device default may be used.','No se encontró una voz del idioma. Puede usarse la voz predeterminada del dispositivo.');
 }

 function narrate(){
  if(state.speaking){stopVoice();return;}
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){$('voiceStatus').textContent=t('Narration is unavailable. The full written lesson remains available.','La narración no está disponible. Puede leer la lección completa.');return;}
  stopVoice();state.speaking=true;const id=state.moduleId,lang=state.lang;
  function next(){if(!state.speaking||state.moduleId!==id||state.lang!==lang)return;const u=new SpeechSynthesisUtterance(scenes()[state.scene]);const v=chooseVoice(speechSynthesis.getVoices(),lang,$('narrationVoice').value);u.lang=lang==='es'?'es-ES':'en-US';if(v)u.voice=v;u.rate=Number($('voiceRate').value);state.voice=u;$('playScene').textContent=t('Stop narration','Detener narración');$('voiceStatus').textContent=t('Narrating scene ','Narrando escena ')+(state.scene+1)+' / 4';u.onend=()=>{if(state.voice!==u||!state.speaking)return;if(state.scene<3){state.scene++;renderScene();next();}else stopVoice();};u.onerror=()=>{if(state.voice===u){stopVoice();$('voiceStatus').textContent=t('Voice could not play. Read the written transcript.','No se pudo reproducir la voz. Lea la transcripción.');}};speechSynthesis.speak(u);}
  next();
 }
 function renderLesson(){const m=mod();if(!m)return;const x=localized(m),es=state.lang==='es';$('lessonKicker').textContent=t('STAGE ','ETAPA ')+(stage(m.id)+1)+' / 8 · '+m.minutes+t(' core minutes',' minutos');$('lessonTitle').textContent=title(m);$('lessonObjective').textContent=es?x.objective:m.description;$('scenario').textContent=es?x.scenario:m.academyMedia.scenario;$('sampleScript').textContent='“'+(es?x.script:m.academyMedia.script)+'”';$('redFlags').textContent=es?x.redFlags:m.academyMedia.redFlags;$('practicePrompt').textContent=es?x.practice:m.lesson.practice.prompt;const list=document.createElement('ul');for(const point of es?x.learn:m.lesson.learn){const li=document.createElement('li');li.textContent=point;list.append(li);}$('learnPoints').replaceChildren(list);renderScene();window.SBC_ACADEMY_VIDEO?.render(m.id,state.lang);}
 function fieldset(q,i,prefix){const field=document.createElement('fieldset');field.className=prefix==='lab'?'lab-field':'quiz-item';const legend=document.createElement('legend');legend.textContent=(i+1)+'. '+(q.label||q.prompt);field.append(legend);for(const [j,choice] of (q.options||q.choices).entries()){const l=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');input.type='radio';input.name=prefix+'-'+(q.id||i);input.value=String(j);input.required=true;text.textContent=choice;l.append(input,text);field.append(l);}return field;}
 function renderQuestions(){const host=$('quizQuestions');host.replaceChildren();state.questions.forEach((q,i)=>host.append(fieldset(q,i,'quiz')));controls();}
 function renderLab(){if(!state.lab)return;$('labTitle').textContent=state.lab.title;$('artifactPrompt').textContent=state.lab.artifactPrompt;const host=$('labFields');host.replaceChildren();state.lab.fields.forEach((f,i)=>host.append(fieldset(f,i,'lab')));$('dialogueArena').hidden=!['am-08','am-12'].includes(state.moduleId);renderDialogue();controls();}
 function renderDialogue(){if(!state.nodes)return;const node=state.nodes[state.node],host=$('dialogueChoices');host.replaceChildren();$('dialoguePrompt').textContent=node?.prompt||t('Conversation finished. Submit your work sample for server feedback.','Conversación terminada. Presente el trabajo para recibir comentarios.');if(node)node.choices.forEach((c,i)=>{const b=document.createElement('button');b.type='button';b.textContent=c.label;b.onclick=()=>{state.path.push(i);state.node=c.next;renderDialogue();};host.append(b);});}
 async function select(id){
  if(state.busy)return;if(!unlocked(stage(id))){notice(t('Finish the previous stage first.','Complete primero la etapa anterior.'),true);return;}
  stopVoice();state.moduleId=id;state.scene=0;state.questions=[];state.lab=null;state.path=[];state.node='start';
  $('quizFeedback').textContent='';$('labFeedback').textContent='';$('practiceStatus').textContent='';$('practiceResponse').value=latest(id,'sbc_am_roleplay_for_owner_review')?.response||'';$('caseArtifact').value=latest(id,'sbc_am_work_sample')?.response||'';
  renderNav();renderLesson();$('quizQuestions').replaceChildren();$('labFields').replaceChildren();controls();
  try{const [q,l]=await Promise.all([call(PREFIX+'/quiz/'+id+'?lang='+state.lang),call(PREFIX+'/lab/'+id+'?lang='+state.lang)]);if(state.moduleId!==id)return;state.questions=q.questions;state.lab=l.lab;state.nodes=l.dialogue;renderQuestions();renderLab();notice(state.readOnly?t('View-only recovery mode. Scores and evidence cannot be saved.','Modo de recuperación: solo lectura. No se guardan evaluaciones.'):t('Training record connected. Use fictional information throughout.','Registro conectado. Use solo información ficticia.'));}catch(e){notice(e.message,true);}
 }
 function showTab(tab){state.tab=tab;for(const name of ['Lesson','Lab','Knowledge']){const selected=name===tab;$('panel'+name).hidden=!selected;$('tab'+name).setAttribute('aria-selected',String(selected));$('tab'+name).tabIndex=selected?0:-1;}renderGuidance();}
 async function finishIfReady(id){if(!knowledge(id)||!practiced(id)||!sampled(id))return;await call('/api/training/progress',{method:'POST',body:{courseId:COURSE,moduleId:id,status:'completed',evidence:'Academy 360: server-scored knowledge and structured fictional work sample passed, and an original practice case note was submitted. Owner observation and certification remain separate.'}});await loadData();renderNav();notice(t('Lesson evidence saved. Continue to the next lesson.','Evidencia guardada. Continúe con la siguiente lección.'));}
 async function submit(action){if(!writable())return;state.busy=true;controls();try{await action();}catch(e){notice(e.message,true);}finally{state.busy=false;renderNav();await refreshBudget().catch(()=>{});controls();}}
 $('quiz').onsubmit=e=>{e.preventDefault();const id=state.moduleId;submit(async()=>{const answers=state.questions.map(q=>Number(document.querySelector('input[name="quiz-'+q.id+'"]:checked')?.value??NaN));if(answers.some(n=>!Number.isInteger(n)))throw Error(t('Answer every question.','Responda todas las preguntas.'));const r=await call(PREFIX+'/quiz/'+id,{method:'POST',body:{answers,lang:state.lang}});$('quizFeedback').className='feedback '+(r.passed?'good':'bad');$('quizFeedback').textContent=(r.passed?t('PASS','APROBADO'):t('RETRY','REPETIR'))+' · '+r.score+'%\n'+r.details.map((d,i)=>(i+1)+'. '+d.rationale).join('\n');await loadData();await finishIfReady(id);});};
 $('labForm').onsubmit=e=>{e.preventDefault();const id=state.moduleId;submit(async()=>{const decisions=Object.fromEntries(state.lab.fields.map(f=>[f.id,Number(document.querySelector('input[name="lab-'+f.id+'"]:checked')?.value??NaN)]));if(Object.values(decisions).some(n=>!Number.isInteger(n)))throw Error(t('Make every work-sample decision.','Responda cada decisión.'));const r=await call(PREFIX+'/lab/'+id,{method:'POST',body:{decisions,artifact:$('caseArtifact').value,lang:state.lang,dialogue:state.path}});$('labFeedback').className='feedback '+(r.passed?'good':'bad');$('labFeedback').textContent=(r.passed?t('PASS','APROBADO'):t('RETRY','REPETIR'))+' · '+r.score+'%\n'+r.feedback.map(f=>(f.correct?'✓ ':'• ')+f.feedback).join('\n')+(r.dialogue?'\n'+t('Conversation: ','Conversación: ')+r.dialogue.score+'%\n'+r.dialogue.feedback.map(f=>f.message).join('\n'):'')+(r.critical.length?'\n'+t('Critical boundary failed.','Falla de límite crítico.'):'');await loadData();await finishIfReady(id);});};
 $('submitPractice').onclick=()=>{const id=state.moduleId;if($('practiceResponse').value.trim().length<80){$('practiceStatus').textContent=t('Write at least 80 characters of original fictional case notes before submitting.','Escriba al menos 80 caracteres originales de su caso ficticio antes de enviar.');return;}submit(async()=>{await call(PREFIX+'/roleplay/'+id,{method:'POST',body:{response:$('practiceResponse').value}});$('practiceStatus').textContent=t('Case note saved for owner review.','Nota guardada para la revisión del dueño.');await loadData();await finishIfReady(id);});};
 for(const tab of ['Lesson','Lab','Knowledge']){$('tab'+tab).onclick=()=>showTab(tab);$('tab'+tab).onkeydown=e=>{const names=['Lesson','Lab','Knowledge'];if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const i=names.indexOf(state.tab),n=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;showTab(names[n]);$('tab'+names[n]).focus();}};}
 $('goPractice').onclick=()=>showTab('Lab');$('dialogueReset').onclick=()=>{state.path=[];state.node='start';renderDialogue();};
 function nextLesson(){const order=STAGES.flatMap(s=>s[1]),i=order.indexOf(state.moduleId),id=order[i+1];if(!complete(state.moduleId)){const next=nextMissingStep();showTab(next.tab);notice(next.message,true);return;}if(id&&unlocked(stage(id))){select(id);showTab('Lesson');}else notice(t('Finish this stage or arrange owner capstone review.','Complete esta etapa o coordine la revisión del dueño.'));}
 $('nextLesson').onclick=nextLesson;
 function followNext(){if(owner()){location.assign('/sbc-am-academy-owner.html');return;}const blocker=gradingBlocker();if(blocker){notice(blocker,true);$('clockInAcademy').focus();return;}const step=nextMissingStep();if(complete(state.moduleId)){nextLesson();return;}showTab(step.tab);$('panel'+step.tab).scrollIntoView?.({block:'start',behavior:'smooth'});notice(step.message);}
 $('academyNextAction').onclick=followNext;
 $('continueLesson').onclick=()=>{const id=STAGES.flatMap(s=>s[1]).find(id=>!complete(id));if(id&&id!==state.moduleId){select(id).then(()=>{showTab('Lesson');renderGuidance();});}else followNext();};
 $('narrationVoice').addEventListener('change',()=>{stopVoice();try{localStorage.setItem('sbc-academy360-voice-'+state.lang,$('narrationVoice').value);}catch(_){}});
 $('voiceSample').onclick=()=>{stopVoice();if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){$('voiceStatus').textContent=t('Browser voice unavailable.','La voz del navegador no está disponible.');return;}const u=new SpeechSynthesisUtterance(t('Welcome to SBC Academy 360. Learn at your own pace, then score your work.','Bienvenido a SBC Academy 360. Aprenda a su ritmo y evalúe su trabajo.'));u.lang=state.lang==='es'?'es-ES':'en-US';u.voice=chooseVoice(speechSynthesis.getVoices(),state.lang,$('narrationVoice').value);u.rate=Number($('voiceRate').value);speechSynthesis.speak(u);$('voiceStatus').textContent=t('Playing selected voice preview.','Escuchando la voz seleccionada.');};
 if(window.speechSynthesis)window.speechSynthesis.addEventListener?.('voiceschanged',populateVoices);
 $('playScene').onclick=narrate;$('pauseVoice').onclick=()=>{if(!state.speaking)return;if(state.paused){speechSynthesis.resume();state.paused=false;}else{speechSynthesis.pause();state.paused=true;}$('pauseVoice').textContent=state.paused?t('Resume','Continuar'):t('Pause','Pausar');};
 $('prevScene').onclick=()=>{stopVoice();state.scene=Math.max(0,state.scene-1);renderScene();};$('nextScene').onclick=()=>{stopVoice();state.scene=Math.min(3,state.scene+1);renderScene();};
 for(const lang of ['en','es'])$('lang'+(lang==='en'?'En':'Es')).onclick=async()=>{if(state.busy)return;const response=$('practiceResponse').value,artifact=$('caseArtifact').value;state.lang=lang;translate();populateVoices();renderBudget();await select(state.moduleId);$('practiceResponse').value=response;$('caseArtifact').value=artifact;};
 $('budgetRefresh').onclick=()=>refreshBudget().catch(e=>notice(e.message,true));
 $('clockInAcademy').onclick=()=>{if(state.busy||state.readOnly||owner())return;state.busy=true;controls();(async()=>{try{const c=await call('/api/v9/time/status');if(c.open&&c.open.mode!=='training')throw Error(t('End your other official shift before training.','Termine el otro turno antes de capacitarse.'));if(!c.open)await call('/api/v9/time/clock',{method:'POST',body:{action:'in',mode:'training'}});await call(PREFIX+'/window/start',{method:'POST',body:{}});notice(t('Official training clock started.','Reloj oficial de capacitación iniciado.'));}catch(e){notice(e.message,true);}finally{state.busy=false;await refreshBudget().catch(()=>{});controls();}})();};
 $('clockOutAcademy').onclick=()=>{if(state.busy||state.readOnly||owner())return;state.busy=true;controls();(async()=>{try{await call('/api/v9/time/clock',{method:'POST',body:{action:'out'}});notice(t('Official clock-out recorded.','Salida registrada en el reloj oficial.'));}catch(e){notice(e.message,true);}finally{state.busy=false;await refreshBudget().catch(()=>{});controls();}})();};
 window.addEventListener('pagehide',stopVoice);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice();});
 let poll;window.addEventListener('pagehide',()=>clearInterval(poll));
 (async()=>{try{populateVoices();await loadData();await refreshBudget();state.moduleId=STAGES.flatMap(s=>s[1]).find(id=>!complete(id))||'am-01';await select(state.moduleId);poll=setInterval(()=>{if(!document.hidden&&!state.busy)refreshBudget().catch(()=>{});},30000);}catch(e){notice(e.message,true);controls();}})();
})();
