'use strict';
// Fictional work samples only. This module has no provider, CRM or clock writes.
const VERSION='2026.11.22.2';
const L=(en,es)=>({en,es});
const field=(id,label,options,correct,feedback,critical=[])=>({id,label,options,correct,feedback,critical});
const CHOICE={
 truth:field('truth',L('Your promise to the owner','Su promesa al dueño'),[L('Guarantee twenty new customers','Garantizar veinte clientes nuevos'),L('Explain approved scope and measurable next steps','Explicar el alcance aprobado y los próximos pasos'),L('Guarantee first place on Google','Garantizar el primer lugar en Google')],1,L('Sell an agreed deliverable; never guarantee outcomes.','Venda un entregable acordado; nunca garantice resultados.'),[0,2]),
 systems:field('systems',L('Where does the relationship record belong?','¿Dónde se administra la relación?'),[L('Command Center · Account 360','Command Center · Account 360'),L('An employee’s personal spreadsheet','Una hoja personal del empleado'),L('The public reseller checkout','La tienda pública de revendedor')],0,L('Keep account history in the controlled internal record.','Mantenga el historial en el registro interno autorizado.')),
 facts:field('facts',L('How will you record the customer need?','¿Cómo registrará la necesidad?'),[L('Assume they have no customers','Suponer que no tienen clientes'),L('Mark a sale before discovery','Marcar una venta antes del descubrimiento'),L('Attribute the customer’s statement and separate unknowns','Atribuir la declaración del cliente y separar las dudas')],2,L('A useful note separates observed facts, statements and unknowns.','Una nota útil separa hechos, declaraciones y dudas.')),
 contact:field('contact',L('The profile contains a do-not-contact instruction','El perfil indica que no se debe contactar'),[L('Call once because the lead is hot','Llamar una vez porque es un cliente prioritario'),L('Honor the restriction and document the hold','Respetar la restricción y documentar el bloqueo'),L('Switch phone numbers to get through','Cambiar de número para comunicarse')],1,L('Lead priority never overrides a contact restriction.','La prioridad nunca anula una restricción de contacto.'),[0,2]),
 discover:field('discover',L('Choose your discovery question','Elija su pregunta de descubrimiento'),[L('How do customers find you, and what is missing?','¿Cómo lo encuentran los clientes y qué le falta?'),L('You need the most expensive package, right?','Necesita el paquete más caro, ¿verdad?'),L('Why is your business failing?','¿Por qué está fracasando su negocio?')],0,L('Use an open question grounded in the owner’s situation.','Use una pregunta abierta basada en la situación del dueño.')),
 scope:field('scope',L('A one-page website inquiry needs a first offer','Una consulta sobre una página necesita una oferta inicial'),[L('$199 reference tier; verify current approved inclusions','Nivel de referencia de $199; verificar las inclusiones vigentes'),L('$199 plus free email and hosting forever','$199 con correo y alojamiento gratis para siempre'),L('Quote an invented $99 package','Cotizar un paquete inventado de $99')],0,L('Use the current approved catalog; state renewal and scope boundaries.','Use el catálogo vigente; aclare los límites y las renovaciones.'),[1,2]),
 preview:field('preview',L('The concept has placeholders and an untested form','El concepto tiene marcadores y un formulario sin probar'),[L('Tell the customer it is already live','Decir que ya está publicado'),L('Use placeholder reviews as real testimonials','Presentar reseñas ficticias como reales'),L('Disclose draft status and verify before launch','Aclarar que es un borrador y verificar antes de publicar')],2,L('A concept is evidence of design work, not a deployed service.','Un concepto demuestra diseño, no un servicio publicado.'),[0,1]),
 objection:field('objection',L('“My cousin can build it cheaper.”','«Mi primo lo hace más barato». '),[L('Insult their cousin’s work','Insultar el trabajo de su primo'),L('Acknowledge, ask about needs, compare verified scope','Reconocer la preocupación, preguntar y comparar el alcance real'),L('Invent a discount available today only','Inventar un descuento solo por hoy')],1,L('Respect the alternative and clarify the actual value and terms.','Respete la alternativa y aclare el valor y las condiciones.'),[2]),
 next:field('next',L('What is the next recorded action?','¿Cuál es la siguiente acción registrada?'),[L('A specific agreed task, owner and date','Una tarea específica acordada, responsable y fecha'),L('“Follow up someday”','«Dar seguimiento algún día»'),L('Mark a message delivered before sending','Marcar un mensaje como entregado antes de enviarlo')],0,L('A useful next step has permission, ownership and timing.','Un siguiente paso útil tiene permiso, responsable y fecha.'),[2]),
 payment:field('payment',L('Checkout link exists; payment still says Pending','Hay un enlace de pago; el estado sigue Pendiente'),[L('Mark paid and start fulfillment','Marcar pagado e iniciar la entrega'),L('Hold fulfillment; reconcile trusted capture evidence','Bloquear la entrega y conciliar evidencia confiable del cobro'),L('Use the customer’s promise as a receipt','Usar la promesa del cliente como recibo')],1,L('A link or promise is not verified captured payment.','Un enlace o una promesa no demuestra un cobro verificado.'),[0,2]),
 approval:field('approval',L('Customer requests a discount and a rush vendor order','El cliente pide descuento y una compra urgente'),[L('Place the vendor order now','Hacer la compra ahora'),L('Approve both to close faster','Aprobar ambos para cerrar rápido'),L('Request owner approval of exception and spend','Solicitar al dueño la aprobación de la excepción y del gasto')],2,L('Discounts, refunds and provider spending stay within owner authority.','Descuentos, devoluciones y gastos requieren la autorización del dueño.'),[0,1]),
 handoff:field('handoff',L('What does fulfillment need?','¿Qué necesita el equipo de entrega?'),[L('Confirmed scope, assets, open questions, owner and due date','Alcance confirmado, recursos, dudas, responsable y fecha'),L('Only “customer bought a site”','Solo «el cliente compró un sitio»'),L('Customer passwords in a training response','Contraseñas del cliente en una respuesta de capacitación')],0,L('A complete brief prevents rework; never collect secrets in training.','Un informe completo evita retrabajo; nunca recopile contraseñas en capacitación.'),[2]),
 renew:field('renew',L('A customer disputes a hosting renewal','Un cliente cuestiona la renovación del alojamiento'),[L('Guess the price and promise it is waived','Adivinar el precio y prometer que no se cobra'),L('Review the agreement, confirm terms and escalate','Revisar el acuerdo, confirmar las condiciones y escalar'),L('Ignore them after the first sale','Ignorarlo después de la primera venta')],1,L('Retention starts with accurate service and renewal records.','La retención comienza con registros precisos del servicio y las renovaciones.'),[0])
};
const DEFINITIONS=[
 ['am-01',L('Represent SBC with confidence','Represente a SBC con confianza'),['truth','approval','next']],
 ['am-02',L('Route a website and CRM inquiry','Dirija una consulta de sitio web y CRM'),['systems','scope','handoff']],
 ['am-03',L('Build an actionable Account 360 note','Prepare una nota útil de Account 360'),['systems','facts','next']],
 ['am-04',L('Protect a suppressed lead','Proteja un registro con restricción'),['contact','facts','next']],
 ['am-05',L('Discover a salon’s actual needs','Descubra las necesidades de un salón'),['discover','facts','next']],
 ['am-06',L('Scope a one-page website offer','Defina una oferta de una página'),['scope','approval','renew']],
 ['am-07',L('Demonstrate an honest website concept','Presente un concepto web con honestidad'),['preview','truth','next']],
 ['am-08',L('Handle a cheaper competitor','Maneje una alternativa más económica'),['objection','discover','approval']],
 ['am-09',L('Create a permission-based follow-up','Prepare un seguimiento autorizado'),['next','contact','facts']],
 ['am-10',L('Reconcile a pending payment','Concilie un pago pendiente'),['payment','approval','handoff']],
 ['am-11',L('Deliver and protect a renewal','Entregue y proteja una renovación'),['handoff','renew','next']],
 ['am-12',L('Run the entire customer journey','Complete el recorrido del cliente'),['discover','preview','scope','payment','contact','handoff','renew']]
];
const LABS=Object.fromEntries(DEFINITIONS.map(([id,title,keys])=>[id,{id,title,fields:keys.map(k=>CHOICE[k])}]));
function language(lang){if(lang==null||lang==='en')return 'en';if(lang==='es')return 'es';throw Object.assign(Error('ACADEMY_LANGUAGE_UNSUPPORTED'),{status:422});}
function publicLab(id,lang='en'){
 const l=language(lang),lab=LABS[id];if(!lab)return null;
 return {id,version:VERSION,title:lab.title[l],fictional:true,passScore:90,
  fields:lab.fields.map(f=>({id:f.id,label:f.label[l],options:f.options.map(v=>v[l])})),
  artifactPrompt:l==='es'?'Escriba una nota ficticia: necesidad confirmada, evidencia, duda pendiente, límite de aprobación y siguiente paso con responsable y fecha.':'Write a fictional case note: confirmed need, evidence, open question, approval boundary and next step with an owner and date.'};
}
function validateText(text,min=20,max=3500){
 if(typeof text!=='string'||text.trim().length<min||text.length>max)throw Object.assign(Error('ACADEMY_CASE_NOTE_LENGTH_INVALID'),{status:422});
 if(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)||/(?:\+?1[\s-]?)?\(?[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}/.test(text)||/\b(?:password|contrase[nñ]a|api[_ -]?key)\s*[:=]/i.test(text))throw Object.assign(Error('ACADEMY_POSSIBLE_REAL_CONTACT_OR_SECRET'),{status:422});
 return text.trim();
}
function gradeLab(id,payload={}){
 const lab=LABS[id],lang=language(payload.lang);if(!lab)throw Object.assign(Error('ACADEMY_LAB_UNKNOWN'),{status:404});
 const a=payload.decisions;if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length!==lab.fields.length)throw Object.assign(Error('ACADEMY_LAB_ALL_DECISIONS_REQUIRED'),{status:422});
 const artifact=validateText(payload.artifact);let count=0;const critical=[];
 const feedback=lab.fields.map(f=>{
  const choice=a[f.id];if(!Number.isInteger(choice)||choice<0||choice>=f.options.length)throw Object.assign(Error('ACADEMY_LAB_DECISION_INVALID'),{status:422});
  const correct=choice===f.correct;if(correct)count++;if(f.critical.includes(choice))critical.push(f.id);
  return {field:f.id,correct,feedback:f.feedback[lang]};
 });
 const score=Math.round(100*count/lab.fields.length);
 return {version:VERSION,moduleId:id,lang,score,passed:score>=90&&critical.length===0,critical,feedback,artifact,
  artifactReview:'OWNER_REVIEW_REQUIRED',decisions:Object.fromEntries(lab.fields.map(f=>[f.id,a[f.id]]))};
}
const RUBRIC=[
 ['discovery',L('Discovery and listening','Descubrimiento y escucha')],['accuracy',L('Truthful scope and product knowledge','Alcance veraz y conocimiento del producto')],
 ['demo',L('Clear, honest website demonstration','Demostración web clara y honesta')],['objections',L('Respectful objection handling','Manejo respetuoso de objeciones')],
 ['controls',L('Payment, privacy and owner controls','Controles de pagos, privacidad y dueño')],['handoff',L('CRM evidence and delivery handoff','Evidencia CRM y entrega')],['bilingual',L('Professional English and Spanish','Inglés y español profesionales')]
];
function gradeRubric(payload={}){
 const ratings=payload.ratings;
 if(!ratings||RUBRIC.some(([id])=>!Number.isInteger(ratings[id])||ratings[id]<0||ratings[id]>4))throw Object.assign(Error('ACADEMY_RUBRIC_ALL_DIMENSIONS_0_TO_4'),{status:422});
 if(!['live_observed','reviewed_recording'].includes(payload.method)||!Array.isArray(payload.languages)||!['en','es'].every(l=>payload.languages.includes(l)))throw Object.assign(Error('ACADEMY_BILINGUAL_OBSERVATION_REQUIRED'),{status:422});
 const notes=validateText(payload.notes,30,2000),evidence=validateText(payload.evidence,12,500);
 const criticalNames=['truthfulness','contactPermission','paymentAuthority','privacy'];
 if(!payload.critical||criticalNames.some(k=>typeof payload.critical[k]!=='boolean'))throw Object.assign(Error('ACADEMY_CRITICAL_CHECKS_REQUIRED'),{status:422});
 const score=Math.round(100*RUBRIC.reduce((s,[id])=>s+ratings[id],0)/(RUBRIC.length*4));
 const critical=criticalNames.filter(k=>payload.critical[k]);
 return {version:VERSION,score,passed:score>=90&&critical.length===0&&RUBRIC.every(([id])=>ratings[id]>=3),ratings:Object.fromEntries(RUBRIC.map(([id])=>[id,ratings[id]])),critical,notes,evidence,method:payload.method,languages:['en','es']};
}
function rubric(lang='en'){const l=language(lang);return RUBRIC.map(([id,label])=>({id,label:label[l]}));}
module.exports={VERSION,publicLab,gradeLab,validateText,gradeRubric,rubric,language};
