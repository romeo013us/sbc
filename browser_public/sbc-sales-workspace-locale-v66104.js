/* SBC V66.104 — in-workspace English/Spanish switch. UI strings only.
   Translation never changes customer data, saved call outcomes, API values or source course content. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SBCSalesLocale=api;
})(typeof window==='undefined'?{}:window,function(){
 'use strict';
 const es={
  'Sales Caller Workspace':'Espacio de ventas y llamadas','Sales Caller':'Agente de ventas','Verified employee session':'Sesión de empleado verificada',
  'Needs Attention':'Requiere atención','Today’s Tasks':'Tareas de hoy','My Assigned Leads':'Mis prospectos asignados',
  'My Calling Desk':'Mi centro de llamadas','Sales Scripts / Español':'Guiones de venta',
  'My Training':'Mi capacitación','Time Clock':'Control horario','Sign out':'Cerrar sesión',
  'Sales Caller Desk':'Centro de ventas','Work assigned prospects, document conversations, and escalate orders.':'Trabaja con prospectos asignados, registra conversaciones y remite pedidos.',
  'SUCCESSFUL BY CHOICE · WORKFORCE':'SUCCESSFUL BY CHOICE · EQUIPO','Refresh':'Actualizar','Assigned Leads':'Prospectos asignados',
  'Callable':'Contactables','Priority Follow-ups':'Seguimientos prioritarios','Calling Clearance':'Autorización para llamar',
  'Checking…':'Verificando…','Training required':'Capacitación requerida','Approved':'Autorizado','Unavailable':'No disponible',
  'Clock status pending':'Consultando horario','Clocked out':'Fuera de turno','Clock unavailable':'Horario no disponible',
  'YOUR DAILY SALES MISSION':'TU MISIÓN DIARIA DE VENTAS',
  'Connect with businesses. Build lasting relationships.':'Conecta con negocios. Construye relaciones duraderas.',
  'Review assigned prospects, make helpful calls, record real conversations, and pass interested customers to the SBC owner. Only your work appears here.':'Revisa tus prospectos, realiza llamadas útiles, registra conversaciones reales y remite clientes interesados al dueño de SBC. Aquí solo aparece tu trabajo.',
  'Priority 1 — Callbacks & Notifications':'Prioridad 1 — Devoluciones de llamada y avisos',
  'Overdue callbacks appear first, followed by unscheduled requests and upcoming appointments. Only assigned, callable leads are shown. Do not contact opted-out or suppressed numbers.':'Primero aparecen las llamadas atrasadas; después las solicitudes sin horario y las citas próximas. Solo se muestran prospectos asignados y contactables. No llames a números excluidos.',
  'Loading follow-ups…':'Cargando seguimientos…','No follow-ups currently listed':'No hay seguimientos en la lista',
  'Check assigned leads and notifications; absence here does not prove callbacks were completed.':'Revisa los prospectos asignados y los avisos; una lista vacía no prueba que se completaron las llamadas.',
  'No scheduled callbacks recorded':'No hay devoluciones programadas','Check assigned leads and notifications; do not assume follow-ups were completed.':'Revisa los prospectos y avisos; no supongas que los seguimientos se completaron.',
  'My Daily Shift Checklist':'Mi lista diaria del turno','Shift schedule (display only — actual hours follow the time clock)':'Horario del turno (solo guía; las horas reales dependen del reloj)',
  '4-hour shift':'Turno de 4 horas','6-hour shift':'Turno de 6 horas',
  'Clock in to begin the timed schedule.':'Registra tu entrada para iniciar el horario.',
  'Checklist progress is saved in this browser. It does not change payroll or substitute for saved CRM call reports.':'El progreso se guarda en este navegador. No modifica la nómina ni reemplaza los reportes de llamadas guardados en el CRM.',
  'Assigned Sales Prospects':'Prospectos de ventas asignados','Search business, contact or phone':'Buscar negocio, contacto o teléfono',
  'Type business name or phone…':'Escribe nombre del negocio o teléfono…',
  'Only leads assigned to this employee in the tenant are displayed. Assignment changes require owner approval.':'Solo aparecen prospectos asignados a este empleado. Los cambios de asignación requieren autorización del dueño.',
  'Call & Document':'Llamar y documentar','Assigned prospect':'Prospecto asignado',
  'Select an assigned lead':'Selecciona un prospecto asignado','Choose a prospect to view its verified contact number.':'Selecciona un prospecto para ver su número de contacto.',
  'Business number':'Número del negocio','Select an assigned prospect':'Selecciona un prospecto asignado',
  'Keypad digits send tones during connected calls.':'El teclado envía tonos durante las llamadas conectadas.',
  '☎ Call with Twilio':'☎ Llamar con Twilio','■ End Call':'■ Finalizar llamada',
  'Live calling requires completed onboarding, certification, an active employee clock-in and a configured Twilio browser connection. No automatic calls.':'Para llamar debes completar la incorporación y certificación, registrar tu entrada y disponer de Twilio. No hay llamadas automáticas.',
  'Call Notes / Report':'Notas e informe de llamada','Select an assigned lead first.':'Primero selecciona un prospecto.',
  'Person contacted':'Persona contactada','Result':'Resultado',
  'No answer':'No contestó','Left voicemail':'Dejó mensaje de voz','Conversation':'Conversación',
  'Interested':'Interesado','Appointment requested':'Solicitó cita','Follow-up requested':'Solicitó seguimiento',
  'Not interested':'No interesado','Do not call — escalate to owner':'No llamar — informar al dueño',
  'Callback time (if requested)':'Horario para devolver la llamada (si se solicitó)',
  'Conversation / objection notes':'Notas de conversación u objeciones',
  'No private payment card details; document actual conversation only.':'No anotes datos de tarjetas de pago; documenta solo la conversación real.',
  'Save Report for Owner Review':'Guardar informe para revisión del dueño',
  'A call report is not a payment, verified sale, or approval. Pricing and fulfillment decisions remain owner-controlled.':'Un informe de llamada no es un pago, venta verificada ni autorización. El dueño controla precios y cumplimiento.',
  'Consultative Sales Scripts / Guiones':'Guiones de venta consultiva','Use these as talking points, not guaranteed pricing or consent to call. Honor refusals and federal/state outreach rules.':'Usa estos guiones como guía, no como precio garantizado ni consentimiento. Respeta las negativas y las reglas de contacto.',
  'Assigned Training & Calling Clearance':'Capacitación y autorización para llamadas',
  'Complete assigned Academy training and have the owner verify onboarding and certification before live calling.':'Completa los cursos asignados y solicita al dueño verificar tu incorporación y certificación antes de llamar.',
  'Clock & Breaks':'Turno y descansos','Loading the official time clock…':'Cargando el horario oficial…',
  'Clock In':'Registrar entrada','Start Break':'Iniciar descanso','End Break':'Terminar descanso','Clock Out':'Registrar salida',
  "SBC's authoritative time entries determine payable time. This checklist does not record payroll hours.":'El registro horario oficial de SBC determina las horas pagables. Esta lista no registra horas de nómina.',
  'OWNER PREVIEW — READ ONLY':'VISTA PREVIA DEL DUEÑO — SOLO LECTURA',
  'You are viewing a staff-scoped projection, not impersonating the employee. Calling, clocking, account changes and record edits are disabled.':'Estás viendo una vista limitada del empleado, sin suplantarlo. Las llamadas, el reloj y las ediciones están deshabilitados.',
  'Return to Owner Command Center':'Volver al centro de control del dueño',
  'Priority Follow-ups':'Seguimientos prioritarios','Four-Hour Shift Plan':'Plan de turno de cuatro horas',
  'Assigned Leads':'Prospectos asignados','Call & Notes':'Llamadas y notas',
  'English / Español':'Idioma de la plataforma','Training & Certification':'Capacitación y certificación','Clock & Breaks':'Horario y descansos',
  'Open lead':'Abrir prospecto','Select for call':'Seleccionar para llamar','View details':'Ver detalles',
  'Not callable':'No contactable','No matching assigned leads':'No hay prospectos coincidentes',
  'Ask the owner to assign a reviewed lead batch.':'Solicita al dueño que asigne prospectos revisados.',
  'Open task':'Abrir tarea','Open course':'Abrir curso','Open lessons':'Abrir lecciones',
  'Open lesson':'Abrir lección','Close lesson':'Cerrar lección','Back to courses':'Volver a cursos',
  'Lesson objective':'Objetivo de la lección','What you need to learn':'Qué debes aprender',
  'Practice exercise':'Ejercicio práctico','Evidence to record':'Evidencia que debes registrar',
  'Knowledge check':'Verificación de conocimientos','What a good answer demonstrates':'Qué demuestra una buena respuesta',
  'Assessment preparation':'Preparación de evaluación','Estimated lesson time:':'Tiempo estimado de la lección:',
  'Your answer to the knowledge check':'Tu respuesta a la verificación de conocimientos',
  'Your lesson notes':'Tus notas de la lección',
  'I have read the lesson and completed the practice and knowledge check.':'Leí la lección y completé el ejercicio y la verificación de conocimientos.',
  'Save Completed Lesson':'Guardar lección completada',
  'Write what you learned and how you would apply it to a real SBC lead.':'Escribe qué aprendiste y cómo lo aplicarías con un prospecto real de SBC.',
  'Write a short, specific reflection (at least 12 characters). This records lesson study, not a graded exam or certification.':'Escribe una reflexión concreta (mínimo 12 caracteres). Esto registra estudio, no un examen calificado ni una certificación.',
  'Lesson completed. You can reopen and review it at any time.':'Lección completada. Puedes volver a abrirla y repasarla.',
  'These are review prompts, not an automatically graded assessment. Formal certification remains owner-controlled.':'Estas preguntas son para repaso, no un examen automático. La certificación sigue bajo control del dueño.',
  'Source course lessons are provided as written by SBC Academy.':'El material del curso se presenta tal como fue redactado por la Academia SBC.',
  'Read and complete each lesson; you cannot complete an unopened lesson.':'Lee y completa cada lección; no puedes completar una lección sin abrirla.',
  'No courses assigned':'No hay cursos asignados','No active lessons have been published in this course.':'No hay lecciones activas publicadas para este curso.',
  'No published training is available for your account.':'No hay capacitación publicada para tu cuenta.',
  'Loading course and lesson material…':'Cargando material del curso y las lecciones…',
  'SBC Academy':'Academia SBC','Assigned':'Asignado','Available':'Disponible','In progress':'En curso','Completed':'Completado',
  'Not started':'Sin comenzar','Passed':'Aprobado','Failed':'No aprobado',
  'Copy':'Copiar','Opening':'Saludo inicial','Discovery':'Descubrimiento','Offer':'Oferta',
  'Objection':'Objeción','Close':'Cierre','Respect refusal':'Respetar negativa',
  'Overdue callback':'Devolución atrasada','Callback time needs confirmation':'Confirmar horario de devolución',
  'Due within 24 hours':'Vence en 24 horas','Scheduled callback':'Devolución programada',
  'Confirm a callback time with the owner':'Confirma la hora de devolución con el dueño',
  'No phone':'Sin teléfono','No Website':'Sin sitio web',

  'Review assigned callbacks and Do Not Call requests':'Revisar devoluciones de llamada y solicitudes de no llamar',
  'Check your assigned leads, scheduled callbacks, and priority owner notes before starting calls.':'Consulta tus prospectos, llamadas programadas y notas prioritarias del dueño antes de llamar.',
  'Return scheduled callbacks':'Devolver llamadas programadas',
  'Call only assigned, authorized leads and record callback outcomes.':'Llama únicamente a prospectos asignados y autorizados; registra los resultados.',
  'Outbound calling — focused block 1':'Llamadas salientes — bloque 1',
  'Use approved bilingual scripts, respect DNC decisions, and save accurate call notes.':'Usa guiones bilingües aprobados, respeta las exclusiones y guarda notas precisas.',
  'Call notes and lead follow-up checks':'Revisar notas y seguimientos de prospectos',
  'Verify completed dispositions and requested callback times were saved.':'Comprueba que se guardaron los resultados y los horarios solicitados.',
  'Outbound calling — focused block 2':'Llamadas salientes — bloque 2',
  'Continue approved calls from your own assigned lead list. Route interested prospects to the SBC owner.':'Continúa las llamadas autorizadas a tus prospectos y remite los interesados al dueño de SBC.',
  'High-intent follow-ups':'Seguimientos de alto interés',
  'Confirm appointments and owner handoffs; do not create quotes or collect payments without authorization.':'Confirma citas y traspasos al dueño; no crees cotizaciones ni cobres sin autorización.',
  'Verify daily results':'Verificar resultados del día',
  'Recheck missing call reports, bounced contacts, and tomorrow’s scheduled callbacks.':'Revisa informes faltantes, contactos fallidos y llamadas programadas para mañana.',
  'Shift handoff and time clock':'Cierre del turno y control horario',
  'Record outcomes and unresolved requests, then complete your official clock-out.':'Anota resultados y solicitudes pendientes; después registra tu salida oficial.',
  'Additional outbound calling — focused block 3':'Llamadas salientes adicionales — bloque 3',
  'Continue assigned prospect calling. Complete call notes and honor every opt-out immediately.':'Continúa con tus prospectos; completa las notas y respeta de inmediato cada solicitud de no contacto.',
  'Additional outreach and scheduled follow-ups':'Contactos adicionales y seguimientos programados',
  'Continue prospect calls and priority callbacks within permitted calling hours; submit owner handoffs.':'Continúa las llamadas y devoluciones prioritarias dentro del horario permitido; remite los casos al dueño.',
  'Light Mode':'Modo claro','Dark Mode':'Modo oscuro',
  'Not Started':'Sin iniciar','Not Certified':'Sin certificación','Certified':'Certificado','Expired':'Vencido',
  'Read-only employee preview':'Vista de empleado de solo lectura',
  'Open course and lessons':'Abrir curso y lecciones',
  'Lesson reader unavailable. Refresh the page. Completion is disabled.':'El lector no está disponible. Actualiza la página. No puedes completar la lección.',
  'This lesson has no readable course material. Contact the SBC owner; completion is disabled.':'Esta lección no tiene material de lectura. Contacta al dueño de SBC; no puedes marcarla como completada.',
  'Owner preview is read-only. No training progress can be submitted.':'La vista del dueño es de solo lectura; no se puede registrar progreso.',
  'Ask the SBC owner to assign published learning material.':'Solicita al dueño que asigne material de capacitación publicado.',
  'Training unavailable':'Capacitación no disponible','Course unavailable':'Curso no disponible',
  'The course did not load; no training progress was changed.':'El curso no cargó y no se modificó el progreso.',
  'Lesson study progress saved.':'Progreso de lección guardado.',
  'Training completion not saved:':'No se guardó la capacitación:',
  'Clocked out':'Fuera de turno','Clocked in':'En turno',
  'Read-only employee preview':'Vista del empleado de solo lectura',
  'Owner preview':'Vista del dueño',
  'Research links':'Enlaces de consulta','Official SBC website':'Sitio web oficial de SBC',
  'Website plans and domains':'Planes web y dominios','Open SBC website':'Abrir sitio de SBC',
  'Open website storefront':'Abrir tienda web',
  'These are public reference sites. No staff access to owner settings or customer accounts is granted.':'Estos son sitios públicos de consulta. No dan acceso a configuración del dueño ni a cuentas de clientes.',
  'Language':'Idioma','Whole-workspace language':'Idioma de todo el espacio de trabajo',
  'Save progress':'Guardar progreso','No lessons have been published in this course.':'No hay lecciones publicadas para este curso.',
  'Owner preview':'Vista previa del dueño','Read-only employee preview':'Vista previa de empleado de solo lectura',
  'English':'Inglés','Español':'Español','English / Español':'Inglés / Español',
  'Clearance needed':'Requiere autorización','No follow-ups currently listed':'Sin seguimientos pendientes'
 };
 const patterns=[

  [/^Schedule anchored to verified clock-in: (.+) · ([46])-hour plan\.$/,m=>'Horario anclado a la entrada verificada: '+m[1]+' · plan de '+m[2]+' horas.'],
  [/^Clock in to activate the ([46])-hour plan\. This is a guide, not a payroll setting\.$/,m=>'Registra tu entrada para activar el plan de '+m[1]+' horas. Es una guía, no un ajuste de nómina.'],
  [/^(\d+) minutes · Minute (\d+)–(\d+)$/,m=>m[1]+' minutos · minuto '+m[2]+'–'+m[3]],
  [/^(\d+) minutes · (.+) – (.+)$/,m=>m[1]+' minutos · '+m[2]+' – '+m[3]],
  [/^Onboarding: (.+) · Certification: (.+) · Live calls (.+)$/,m=>'Incorporación: '+(es[m[1]]||m[1])+' · Certificación: '+(es[m[2]]||m[2])+' · Llamadas '+(m[3]==='approved'?'autorizadas':'bloqueadas hasta autorización del dueño')],
  [/^(.+) · caller$/,m=>m[1]+' · agente de ventas'],
  [/^(\d+) of (\d+) checked · (\d+) planned minutes$/,m=>m[1]+' de '+m[2]+' marcadas · '+m[3]+' minutos planificados'],

  [/^(\d+) of (\d+) checked · (\d+) planned minutes$/,m=>m[1]+' de '+m[2]+' marcadas · '+m[3]+' minutos planificados'],
  [/^(\d+) min · (.+)$/,m=>m[1]+' min · '+(es[m[2]]||m[2])],
  [/^(\d+) lessons · (\d+)% complete$/,m=>m[1]+' lecciones · '+m[2]+'% completado'],
  [/^(\d+) lessons$/,m=>m[1]+' lecciones'],
  [/^Clocked in since (.+)$/,m=>'Entrada registrada desde '+m[1]],
  [/^Employee clocked in at (.+)$/,m=>'Empleado inició el turno a las '+m[1]],
  [/^Shift schedule anchored to (.+)$/,m=>'Horario del turno anclado a '+m[1]],
  [/^No call placed \/ call failed: (.+)$/,m=>'No se realizó la llamada / llamada fallida: '+m[1]]
 ];
 let language='en',observer=null,scheduled=false,host=null;
 const remembered=new WeakMap(),attrs=new WeakMap();
 function convert(s,lang=language){
  if(lang!=='es')return String(s);
  const raw=String(s),trim=raw.trim();if(Object.prototype.hasOwnProperty.call(es,trim))return raw.replace(trim,es[trim]);
  for(const [pattern,make] of patterns){const m=trim.match(pattern);if(m)return raw.replace(trim,make(m));}
  return raw;
 }
 function changeText(node){
  if(!node?.parentElement||node.parentElement.closest('script,style,textarea,code,pre'))return;
  let record=remembered.get(node);
  if(!record||record.rendered!==node.nodeValue){record={original:node.nodeValue,rendered:node.nodeValue};remembered.set(node,record);}
  const next=convert(record.original);
  if(next!==node.nodeValue){node.nodeValue=next;record.rendered=next;}
 }
 function changeAttrs(element){
  if(!element?.getAttribute)return;
  let original=attrs.get(element);if(!original){original={};attrs.set(element,original);}
  for(const name of ['placeholder','title','aria-label']){
   if(!element.hasAttribute(name))continue;
   const current=element.getAttribute(name),rec=original[name];
   if(!rec||rec.rendered!==current)original[name]={original:current,rendered:current};
   const next=convert(original[name].original);
   if(next!==current){element.setAttribute(name,next);original[name].rendered=next;}
  }
 }
 function refresh(root=host){
  if(!root||!root.ownerDocument)return;
  const doc=root.ownerDocument;
  const filter=doc.defaultView?.NodeFilter?.SHOW_TEXT||4;
  const walk=doc.createTreeWalker(root,filter);let node;
  while((node=walk.nextNode()))changeText(node);
  changeAttrs(root);
  for(const item of root.querySelectorAll('*'))changeAttrs(item);
  if(doc.documentElement)doc.documentElement.lang=language;
  for(const name of ['lang-en','lang-es']){
   const button=doc.getElementById(name);if(!button)continue;
   const active=name==='lang-'+language;
   button.classList.toggle('primary',active);button.classList.toggle('outline',!active);
   button.setAttribute('aria-pressed',String(active));
  }
 }
 function install(element){
  host=element;if(!host)return;
  refresh(host);
  const C=host.ownerDocument?.defaultView?.MutationObserver;
  if(!C)return;
  observer?.disconnect();
  observer=new C(()=>{if(scheduled)return;scheduled=true;Promise.resolve().then(()=>{scheduled=false;refresh(host);});});
  observer.observe(host,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
 }
 function setLanguage(next){language=next==='es'?'es':'en';refresh(host);return language;}
 return {convert,install,refresh,setLanguage,getLanguage:()=>language};
});
