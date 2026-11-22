'use strict';
const L=(en,es)=>({en,es});
const NODES={
 start:{prompt:L('“I already use Instagram. Why would I need this?”','«Ya uso Instagram. ¿Para qué necesito esto?»'),choices:[
  {label:L('Ask what works well and whether anything is missing','Preguntar qué funciona y si falta algo'),next:'needs',points:1},
  {label:L('Tell them Instagram is useless','Decir que Instagram no sirve'),next:'trust',points:0},
  {label:L('Guarantee a website will double sales','Garantizar que el sitio duplicará ventas'),next:'trust',points:0,critical:'truthfulness'}]},
 needs:{prompt:L('“I mainly want customers to find my hours and services. Send me details by email only.”','«Quiero que encuentren horarios y servicios. Envíeme información solo por correo». '),choices:[
  {label:L('Confirm the need, requested channel and an approved written scope','Confirmar la necesidad, el canal solicitado y un alcance escrito aprobado'),next:'timing',points:1},
  {label:L('Call repeatedly until they buy','Llamar repetidamente hasta que compren'),next:'stop',points:0,critical:'contactPermission'}]},
 trust:{prompt:L('“That sounds pushy. I do not want more calls.”','«Eso suena insistente. No quiero más llamadas». '),choices:[
  {label:L('Acknowledge the request, stop calls and document the restriction','Reconocer la solicitud, detener llamadas y registrar la restricción'),next:'end',points:1},
  {label:L('Call from a different number','Llamar desde otro número'),next:'end',points:0,critical:'contactPermission'}]},
 timing:{prompt:L('“I need to think about the price.”','«Necesito pensar en el precio». '),choices:[
  {label:L('Offer to explain approved scope and respect their decision','Ofrecer aclarar el alcance aprobado y respetar su decisión'),next:'end',points:1},
  {label:L('Invent a discount that expires today','Inventar un descuento que vence hoy'),next:'end',points:0,critical:'paymentAuthority'}]},
 stop:{prompt:L('“Stop contacting me.”','«Deje de contactarme». '),choices:[
  {label:L('End contact and record the opt-out','Detener el contacto y registrar la exclusión'),next:'end',points:1},
  {label:L('Try a text message instead','Intentar por mensaje de texto'),next:'end',points:0,critical:'contactPermission'}]}
};
function nodes(lang='en'){if(!['en','es'].includes(lang))throw Object.assign(Error('ACADEMY_LANGUAGE_UNSUPPORTED'),{status:422});return Object.fromEntries(Object.entries(NODES).map(([id,n])=>[id,{prompt:n.prompt[lang],choices:n.choices.map(c=>({label:c.label[lang],next:c.next}))}]));}
function grade(choices,lang='en'){
 if(!['en','es'].includes(lang))throw Object.assign(Error('ACADEMY_LANGUAGE_UNSUPPORTED'),{status:422});
 if(!Array.isArray(choices)||choices.length<2||choices.length>3)throw Object.assign(Error('ACADEMY_DIALOGUE_INCOMPLETE'),{status:422});
 let node='start',points=0;const critical=[],path=[],feedback=[];
 const coach={truthfulness:L('Never guarantee sales or invent evidence. Explain approved deliverables.','Nunca garantice ventas ni invente evidencia. Explique entregables aprobados.'),contactPermission:L('Honor the requested channel or opt-out. Do not switch numbers or channels to evade it.','Respete el canal solicitado o la exclusión. No cambie de número ni de canal para evitarla.'),paymentAuthority:L('A discount requires actual owner approval; never manufacture urgency.','Un descuento requiere aprobación real del dueño; nunca invente urgencia.')};
 for(const choice of choices){const n=NODES[node],c=n?.choices?.[choice];if(!Number.isInteger(choice)||!c)throw Object.assign(Error('ACADEMY_DIALOGUE_PATH_INVALID'),{status:422});path.push({node,choice});points+=c.points;if(c.critical)critical.push(c.critical);feedback.push({node,correct:c.points===1,message:(c.critical?coach[c.critical]:c.points===1?L('Respectful, grounded next step.','Siguiente paso respetuoso y fundamentado.'):L('Acknowledge the owner’s current solution and ask before recommending.','Reconozca la solución actual y pregunte antes de recomendar.'))[lang]});node=c.next;}
 if(node!=='end')throw Object.assign(Error('ACADEMY_DIALOGUE_INCOMPLETE'),{status:422});
 const score=Math.round(100*points/choices.length);return {score,passed:score>=90&&critical.length===0,critical,path,feedback,version:'2026.11.22.2'};
}
module.exports={nodes,grade};
