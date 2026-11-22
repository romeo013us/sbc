'use strict';
/* SBC Academy 360 · Account Manager Mastery V66.165
 * Immutable, approved teaching content. Hypothetical practice cases are
 * clearly labeled. Neither reading nor quiz scores grant production access.
 * Tenant/customer information is NEVER included in built-in lessons.
 */
const VERSION='2026.11.22';
const COURSE_ID='sbc-account-manager-mastery-20261122';
const M=[
{
id:'am-01',title:'The SBC Standard · Because Why Not?',mins:35,skill:'Brand representation',
objective:'Represent SBC with accuracy, warmth, and owner-level accountability.',
learn:[
'Our job is to earn the right to manage a customer relationship—not to win a single transaction. Speak with the confidence of a partner and the discipline of an operator.',
'Introduce SBC as a Miami small-business services company. Websites, domains, hosting, branded print, signage and Office Box are distinct products; never suggest they are all included in one price.',
'Do not guarantee Google rankings, sales, approval, customer results, or delivery dates. Replace a promise with an approved next step and an owner-reviewed scope.',
'Respect every customer even when they say no. Keep records factual, concise and useful to the next person who opens Account 360.',
'Your account is a long-term responsibility. Follow up, ensure fulfillment handoffs, check renewals, and escalate problems. Never open another employee’s assigned accounts without authority.',
'Every action must pass the truthful-claim, consent, privacy, and owner-approval rules before it touches a real customer.'
],
es:['Nuestra meta es cuidar la relación del cliente a largo plazo, no conseguir una venta a cualquier costo.','SBC ayuda a pequeños negocios en Miami. Los servicios no vienen todos incluidos en un solo precio.','No prometa resultados en Google, ventas, fechas ni descuentos sin confirmación.','Documente información real en Account 360 y escale decisiones reservadas al dueño.'],
say:'Hi, I am calling from Successful By Choice. We help local business owners build a professional presence and manage business services. I have a quick question about your current website—would now be a bad time?',
practice:'Record a 45-second opening for a Miami barbershop. Remove every unsupported promise. Explain when you would ask permission to continue.',
red:'Guaranteed first-page ranking, fake endorsements, unapproved discounts, and persistent outreach after an opt-out.',
case:'A shop owner asks if SBC can guarantee they will get twenty new customers this month. Answer without promising outcomes.',
quiz:[
['What is the primary purpose of an SBC account manager?',['Close any sale before the next caller','Build and manage a truthful long-term relationship','Promise the biggest discount'],1,'Stewardship outlasts the transaction.'],
['A prospect asks whether SBC guarantees Google rankings.',['Say yes if they buy Growth','Confirm the exact ranking privately','Explain that rankings are not guaranteed'],2,'An unsupported outcome cannot be promised.'],
['Who may approve a nonstandard price?',['The account manager alone','The authorized owner','The prospect'],1,'Owner authorization controls financial exceptions.']
]},
{
id:'am-02',title:'Fantastic 4 · One Business, Connected Systems',mins:40,skill:'Product/system mapping',
objective:'Route each task to the correct SBC product while maintaining account ownership.',
learn:[
'sbcmia.com is SBC’s flagship service website. It presents the offer and collects inquiries; it is not an employee CRM.',
'sbcwebsites.com is the domain, hosting and reseller surface. It has different renewal, billing and provider boundaries from SBC design services.',
'SBC Command Center is the authoritative internal CRM, Account 360 workspace, tasks, approvals, and sales handoff.',
'Office Box is a separate customer-facing workspace/CRM product. Never include it in a website package unless the signed quote says so.',
'No employee should silently move customer data between tenants or imply that an integration is live before verifying it.',
'Describe the flow: inquiry → researched account → approved contact → discovery → real preview → owner-approved quote → verified payment → controlled fulfillment → follow-up.'
],
es:['sbcmia.com es el sitio público de servicios de SBC.','sbcwebsites.com administra dominios y otros servicios de revendedor.','Command Center organiza el CRM, asignaciones y aprobaciones internas.','Office Box es un producto CRM separado para clientes; no lo incluya sin una cotización aprobada.'],
say:'Our services work together, but they have different responsibilities. Let me show you which part solves your immediate need and what the first-year and renewal terms really cover.',
practice:'Draw the four systems and explain five handoffs. Identify where Account 360, Square, and the customer portal belong.',
red:'Claiming every product is bundled, sharing credentials, or treating a preview as a published website.',
case:'A customer wants a website and assumes Office Box and three business emails are free. Explain the package boundaries.',
quiz:[
['Where does an account manager manage assigned customers?',['Command Center Account 360','A public Google search','The reseller storefront'],0,'Account 360 is the controlled internal record.'],
['Which SBC product is the customer-facing CRM offering?',['Office Box','Command Center owner login','Google Business Profile'],0,'Office Box is distinct from the employee system.'],
['What follows an owner-approved quote before fulfillment?',['A verbal yes','Verified captured payment and safeguards','An assumed Square charge'],1,'Never conflate an inquiry, quote, and captured payment.']
]},
{
id:'am-03',title:'Account 360 · Own Every Relationship',mins:45,skill:'CRM case management',
objective:'Build a complete, actionable account record with audit-ready next steps.',
learn:[
'Confirm business identity, industry, primary number, email, location, and research provenance before using the record to make material claims.',
'Use assignment boundaries: your portfolio is yours to manage; another manager’s account and every other tenant remain out of scope.',
'Write the difference between observed facts, customer statements, reasonable hypotheses, and unanswered questions.',
'After each authorized conversation: record outcome, objections, interest, promised next step and exact follow-up date; do not imply a call happened when it did not.',
'Check previous notes and website demos before calling so you never repeat work or falsely claim a completed site.',
'Document escalations when contact details, owner decisions, payment evidence or fulfillment statuses do not match.'
],
es:['Revise la identidad, el sector, los datos de contacto y la fuente del registro.','Solo gestione las cuentas asignadas a su cartera.','Separe hechos, palabras del cliente, hipótesis y preguntas pendientes.','Después de una conversación autorizada, registre el resultado y la próxima fecha de seguimiento.'],
say:'Before I recommend anything, I want to make sure I have your business details correct and understand which outcome matters most to you.',
practice:'Use the practice-only mock Account 360. Enter a sourced business identity, a discovery note, a safe status and a follow-up date.',
red:'Claiming to have called, marking a lead verified without evidence, editing another account, or logging fabricated contact consent.',
case:'A phone number returns as disconnected but the email seems correct. What should you do with the account?',
quiz:[
['Which note is strongest?',['I think they need it','Owner said their site is outdated; request demo Friday at 2pm','Hot sale, call whenever'],1,'Specific attributed evidence and a dated next step are useful.'],
['An account belongs to another AM.',['Edit the assignment yourself','Proceed in private','Ask the owner for review/assignment'],2,'Portfolio ownership is enforced.'],
['What may be marked as completed?',['A proposed follow-up','An actual, recorded action','A simulated practice call'],1,'Do not create false history.']
]},
{
id:'am-04',title:'Research Trust, Permission & Outreach Safety',mins:40,skill:'Lead intake and consent',
objective:'Use Lorna’s owner-trusted research without confusing it with contact consent.',
learn:[
'Owner-trusted research means the business record was accepted under SBC policy; it is not independent proof of every field or permission to call.',
'Respect do-not-contact, opt-out, phone recovery holds, wrong numbers, customer status and contact restrictions, even when lead score is Hot.',
'A good lead is a business opportunity, not a person who has agreed to hear a pitch. Follow the approved preflight and applicable contact rules.',
'If a phone fails, mark the issue and follow the approved recovery path; do not repeatedly dial or use unrelated contacts.',
'Never bypass assigned portfolio, local-hours rules, consent preferences or required owner signoff.',
'Escalate uncertain Florida telemarketing and commercial outreach issues rather than inventing legal exemptions.'
],
es:['Una investigación aprobada por el dueño no equivale al consentimiento para llamar.','Respete las listas de exclusión, negativas de contacto y números incorrectos.','La prioridad “Hot” no significa permiso legal para contactar.','Si tiene dudas legales o de horarios, consulte al dueño antes de llamar.'],
say:'I’m reviewing your business information and wanted to check whether this is an appropriate time to speak. If you prefer not to be contacted, I will record that request.',
practice:'Review five fictional leads: owner-trusted, wrong number, opted-out, duplicate, and new inquiry. Choose the permitted next step for each.',
red:'Auto-dialing all “verified” leads, ignoring an opt-out, or implying website research grants consent.',
case:'Lorna completed excellent research, but the owner explicitly said “do not call again.” What is your next action?',
quiz:[
['Owner-trusted research means…',['Automatic SMS consent','The record was accepted under an internal research policy','Independent proof of identity'],1,'Trust classification is not independent verification or consent.'],
['A lead is marked Do Not Contact.',['Keep dialing politely','Try from a different number','Suppress outreach and log appropriately'],2,'Opt-out and suppression protections remain controlling.'],
['A Hot temperature means…',['Priority for safe review, not permission','Consent to all channels','Confirmed revenue'],0,'Research priority is not authorization.']
]},
{
id:'am-05',title:'Discovery Mastery · Diagnose Before You Pitch',mins:50,skill:'Consultative discovery',
objective:'Ask useful questions and identify the right problem without pressure.',
learn:[
'Start with an honest introduction and a permission-based transition; do not assume the customer has time.',
'Ask what the business currently uses to be found, where its online presence fails, and what a realistic improvement looks like.',
'Listen more than you speak. Summarize the problem and ask the business owner to correct your understanding.',
'Qualify whether the owner wants more information, a demonstration, a proposal, or no follow-up. Never call a cold inference a sale.',
'Tailor discovery by industry: booking and directions for a barber; services/photos/quote requests for an auto shop; menu/contact for a restaurant.',
'Do not jump straight to package price when the business’s actual problem is unknown. End with a concrete, consent-aware next step.'
],
es:['Primero pida permiso para hablar y escuche las necesidades del negocio.','Pregunte cómo encuentran los clientes el negocio y qué les hace falta.','Repita el problema con sus palabras para confirmar que entendió.','Cierre con un siguiente paso concreto; no presione para comprar.'],
say:'How do most new customers find you today? When someone searches for your business, what do you wish they could see or do that they cannot right now?',
practice:'Run two five-minute discovery conversations: a shop with no website and a shop with a working but outdated website. Record three signals and one unanswered question each.',
red:'Talking over the owner, inventing their pain point, or forcing a demo after they decline.',
case:'A salon already has Instagram and says it gets enough customers. Ask a useful non-leading question about its website needs.',
quiz:[
['Best first discovery question?',['Do you want the $999 package?','How do customers find you today?','Why is your business behind?'],1,'Discovery starts with the customer’s situation.'],
['When should you propose a package?',['After listening and confirming the need','Before any questions','Only after sending a payment link'],0,'Fit comes before price.'],
['The owner says they are busy.',['Continue the pitch','Schedule only with permission','Keep talking louder'],1,'Respect timing and consent.']
]},
{
id:'am-06',title:'Product & Price Intelligence · No Hidden Promises',mins:45,skill:'Offer fit',
objective:'Explain the published starting packages and where approvals are required.',
learn:[
'Current published website starting tiers are $199 Starter, $499 Custom, $799 Advanced, and $999 Growth. Confirm the current live catalog before final pricing.',
'The $199 tier is a starter one-page website concept; $499 is a larger custom multi-page scope; higher tiers offer more features. Exact inclusions may change and must match the approved quote.',
'Domains, hosting, SSL, Microsoft 365 email, print, e-commerce, Office Box, and monthly maintenance may have separate billing or renewal terms.',
'SSL inclusion, business cards and edits are conditional on the current approved offer. Do not cite older training screenshots as binding.',
'Present no more than two packages aligned with the stated business need; explain meaningful differences and tradeoffs without overselling.',
'No manager may approve a discount, commission, vendor purchase, or unquoted deliverable independently.'
],
es:['Los precios web de referencia son $199, $499, $799 y $999; confirme la oferta vigente.','Explique qué está incluido y qué cuesta aparte.','Dominio, alojamiento, SSL, correo y renovaciones pueden facturarse por separado.','No prometa descuentos o funciones sin una cotización aprobada.'],
say:'Based on what you described, our Starter and Custom options may be worth comparing. The exact scope, first-year services, and renewal terms will be written in your quote before you decide.',
practice:'Compare an auto shop one-page site, a barbershop multi-page site, and an online store. Recommend one qualified next step for each.',
red:'Unapproved “free forever,” unlimited edits, permanent hosting at a one-time price, or guaranteed sales.',
case:'A customer asks if the $199 includes a free domain for life and unlimited changes. Clarify accurately.',
quiz:[
['How many published starting website tiers are in this lesson?',['Four','Two','One'],0,'Use the current live catalog as final authority.'],
['Are renewal terms identical to first-year promotion?',['Always','Only if written in the quote','Yes when paid by Square'],1,'Separate initial work from recurring services.'],
['An AM wants to add a free premium email service.',['Add without notice','Promise now, fix later','Request owner quote approval'],2,'Scope exceptions need owner approval.']
]},
{
id:'am-07',title:'Instant Sites · Sell the Demonstration, Not a Fiction',mins:50,skill:'Proof-based website demo',
objective:'Show a real preview only when it exists and describe its limitations.',
learn:[
'Before you say “I built a website concept for you,” verify the preview actually exists for that business and is not a generic template.',
'Use Website Studio’s actual private URL and confirm the business name, contact fields and industry before sending or demonstrating a draft.',
'Explain that a design concept is not a finished or published customer site. Placeholders, forms, photos, services and prices require customer confirmation.',
'The $199 starter concept is one page; larger packages may include more sections and more customization only after quoting.',
'Never invent testimonials, licenses, business awards, performance results or customer services absent owner confirmation.',
'After the demo, ask for feedback, log requested changes and invite the customer to an approved proposal rather than forcing a checkout.'
],
es:['Compruebe que existe una vista previa real antes de decir que creó un concepto.','Aclare que una vista previa no es un sitio publicado.','No invente reseñas, premios, servicios ni datos del cliente.','Anote los comentarios y solicite una propuesta aprobada.'],
say:'We prepared a private website concept to help you visualize an improvement. It is a draft—not a live website—and we would confirm your services, photos, and contact information before launch.',
practice:'Open a practice-only website preview, identify three placeholders, and demonstrate a truthful 90-second presentation with a follow-up question.',
red:'Claiming a fake portfolio, live forms, verified customer reviews or published status from a private concept.',
case:'The prospect likes an unpublished sample but asks whether the contact form already sends messages. Give the safe answer.',
quiz:[
['When can you say a concept was built for this customer?',['When a generic template exists','When an actual customer-specific preview is accessible','Immediately after researching a business'],1,'Truthfully represent actual work.'],
['Can a draft’s placeholder contact form be called live?',['No, unless tested and deployed','Yes, if it looks polished','Yes when the customer likes it'],0,'Never infer functioning backend from a preview.'],
['A draft has fictional reviews.',['Publish immediately','Say they are real','Remove or clearly label before customer presentation'],2,'No fabricated social proof.']
]},
{
id:'am-08',title:'Objection Lab · Respond Without Pressure',mins:50,skill:'Objection handling',
objective:'Handle price, timing, trust, and competitor questions empathetically.',
learn:[
'First acknowledge the concern. Ask what specifically worries the owner: scope, budget, timing, trust, ownership or expected result.',
'Do not attack competitors; compare the actual offer terms and the service model.',
'“I already have Instagram” is not an objection to dismiss. Ask whether the business also needs searchable service pages, directions, ownership or appointment paths.',
'“Too expensive” often means the value or timing is unclear. Explore scope alternatives without discounting below approved pricing.',
'“Send me information” should end in permission-based follow-up with the requested material, not a fake appointment.',
'Respect a firm no immediately. Record the disposition and never treat resistance as consent.'
],
es:['Reconozca la preocupación antes de responder.','Pregunte si el problema es precio, tiempo, confianza o alcance.','No critique a la competencia ni presione al cliente.','Si el cliente dice que no, respételo y registre el resultado.'],
say:'That makes sense. Can I ask which part concerns you most—the initial cost, the monthly commitments, or making sure the website will actually fit your business?',
practice:'Record two objection responses: “I only use Instagram” and “My cousin makes sites cheaper.” Use one empathy statement, one question, and one factual next step.',
red:'“Your current provider is terrible,” manufactured scarcity, or promising a price without approval.',
case:'An auto shop owner says the $499 package is too much. Respond without inventing a discount.',
quiz:[
['First step when a client says “too expensive”?',['Explore the concern respectfully','Immediately cut the price in half','Argue the client is wrong'],0,'Seek understanding before presenting an approved option.'],
['A prospect prefers a competitor.',['Insult their provider','Compare verified scope and respect their choice','Invent competitor failures'],1,'Truthful comparison builds trust.'],
['A clear no means…',['Continue until they agree','Move to another channel','Stop and document the disposition'],2,'Opt-out must be respected.']
]},
{
id:'am-09',title:'Follow-Up Engine · Meetings, Notes & Next Actions',mins:40,skill:'Pipeline hygiene',
objective:'Maintain a precise, non-intrusive account plan from first conversation onward.',
learn:[
'Use Account 360 to record the actual conversation, disposition, next action, appointment details and promised deliverables.',
'Do not set follow-up dates without customer permission when consent is required; respect preferred channels and opt-outs.',
'Send only owner-approved email or text content using authorized systems. Never simulate sends or claim delivery without a provider receipt.',
'Prepare each follow-up from the last conversation: what they wanted, what was sent, what remains unresolved and what you can legitimately offer.',
'An appointment is not a sale, a quote is not payment, and a payment attempt is not a successful capture.',
'Ensure unresolved requests are not forgotten during PTO, reassignment, or a manager’s exit; account history must survive staff turnover.'
],
es:['Registre la conversación real, el resultado y el siguiente paso.','Respete las preferencias de contacto y las solicitudes de no llamar.','No diga que envió un mensaje sin confirmación del proveedor.','Un seguimiento o una cotización no equivalen a una venta cobrada.'],
say:'Would it be helpful if I sent the written scope and checked back on Tuesday? If another day or no follow-up works better, I will respect that.',
practice:'Create a fictional 7-day follow-up plan, including two permission checks and one owner escalation, without touching real customer data.',
red:'Fabricated call attempts, chasing opted-out contacts, or treating unsent messages as delivered.',
case:'A prospect asked for an email only. What information can you document and what must you not do?',
quiz:[
['What proves a message was sent?',['A button press alone','A verified provider outcome','A draft in the CRM'],1,'Actual delivery evidence matters.'],
['What belongs in next action?',['A dated, specific, authorized task','A generic “follow up”','Nothing after a quote'],0,'Concrete tasks make account care reliable.'],
['A customer opts out of calls.',['Dial at a different hour','Have someone else call','Honor the preference and update controls'],2,'Keep contact choices in force.']
]},
{
id:'am-10',title:'Square, Quotes & Fulfillment · The Trust Boundary',mins:45,skill:'Payment process control',
objective:'Hand off sales without guessing payment status or authorizing purchases.',
learn:[
'Only the owner-approved quote and checkout rail determine the agreed offer, total, conditions, tax and special terms.',
'Square checkout links may be sent only through approved workflows. A generated link or a customer promise is not proof of captured funds.',
'Never mark paid, complete, fulfilled or commissioned from a browser screen that lacks independently recorded capture evidence.',
'After captured payment is confirmed, the owner-controlled fulfillment process coordinates website delivery and any provider purchases or print orders.',
'Do not submit a vendor order, alter the price, refund a customer or move payroll funds without permission.',
'Escalate duplicate orders, refunds, chargebacks and inconsistent receipts. Protect each customer’s data and financial records.'
],
es:['Solo use cotizaciones y enlaces de pago aprobados.','Un enlace de Square no demuestra que el pago fue recibido.','Confirme evidencia real del pago antes de indicar “pagado”.','Las compras, devoluciones y entregas requieren los controles del dueño.'],
say:'The next step is an owner-approved written quote. When you are comfortable with the exact scope, SBC will send the appropriate checkout link. We do not start paid fulfillment until the payment is verified.',
practice:'Classify six fictional events: quote sent, Square link created, payment pending, payment completed, refund, and chargeback. Identify which are recognized revenue.',
red:'Fake receipts, estimated paid totals, emailing credit-card data, or manually initiating vendor spend.',
case:'The customer says they paid, but Command Center shows Pending and there is no capture evidence. What do you say?',
quiz:[
['Does a Square link prove payment?',['Yes','No','Only if the price is $199'],1,'A link is not captured funds.'],
['Who may approve a vendor purchase?',['The assigned AM','Any employee','Authorized owner within controls'],2,'Financial authority stays owner-controlled.'],
['What if payment proof conflicts?',['Escalate and leave fulfillment held','Mark paid anyway','Delete the quote'],0,'Fail closed on uncertain payment.']
]},
{
id:'am-11',title:'Relationship Growth · Office Box, Retention & Renewals',mins:45,skill:'Account retention',
objective:'Keep customers supported after initial purchase and identify appropriate next needs.',
learn:[
'Your relationship continues after a website goes live: ensure handoff notes, maintenance expectations, contact ownership and actual completion status are documented.',
'Review the services the customer actually owns, their renewal dates and the current price and agreement before talking about renewals.',
'Office Box may help businesses coordinate appointments, projects and customer records, but it is a separate product and must be quoted accurately.',
'Only suggest upsells after you know the customer’s use case. Example: a busy auto shop may benefit from an accurate services page or online lead capture.',
'Use retention check-ins to detect problems early, not to generate unnecessary meetings.',
'When there is a complaint, capture the facts, assign the appropriate support request and escalate service failures quickly.'
],
es:['La relación continúa después de la primera venta.','Revise las fechas y condiciones reales de renovación.','Office Box es una opción adicional, no un regalo implícito.','Ofrezca servicios nuevos solo si ayudan al cliente; documente problemas y escalaciones.'],
say:'I’m checking how the website is working for your business and whether anything needs attention. We can also review upcoming renewals so there are no surprises.',
practice:'Prepare a 30/60/90-day account care plan for a fictional restaurant. Include delivery follow-up, renewal confirmation and a customer support escalation.',
red:'Silent renewal charges, unsupported add-ons, fake project completion, or ignoring support complaints.',
case:'A customer is worried about an upcoming hosting renewal and believes it is free. Explain the next steps accurately.',
quiz:[
['When does account management end?',['After the first sale','After the first call','It continues through support and renewals'],2,'Account stewardship is an ongoing relationship.'],
['Office Box should be offered when…',['It fits verified needs and has written scope','Every website customer must get it free','The manager wants commission'],0,'Customer need and approved scope control.'],
['A renewal amount is unclear.',['Guess based on last year','Check the current agreement and owner-approved price','Tell the customer not to worry'],1,'Clarity prevents billing surprises.']
]},
{
id:'am-12',title:'Final Field Simulation · Account Manager Certification',mins:90,skill:'Capstone and ethics',
objective:'Demonstrate a complete SBC customer journey without touching production data.',
learn:[
'Complete a four-stage fictional account simulation: qualification, discovery, private website concept, owner-approved quote and customer care plan.',
'Use approved opening, permission, needs diagnosis, value explanation, privacy guard and a clear next action.',
'Record a complete Account 360-style case note with sourced business facts, the customer’s stated need, proposal status and follow-up date.',
'Explain exactly when a Square payment is truly captured and what must be escalated before fulfillment.',
'Respond to an objection without pressure and correctly honor a contact opt-out.',
'Submit your practice evidence and complete the objective knowledge exam. A supervisor must still review skills and the owner alone can certify live readiness.'
],
es:['Realice una simulación completa sin usar datos reales.','Demuestre descubrimiento, presentación, notas y seguimiento.','Explique pagos, restricciones y cuándo pedir aprobación.','La certificación final requiere observación y aprobación del dueño.'],
say:'I want to understand your business first. If a website concept would help, I can show a private draft and then request an accurate, owner-approved proposal. We will follow your contact preferences throughout.',
practice:'Perform a recorded or observed 15-minute mock discovery, a 3-minute site demonstration, a written Account 360 note and a written risk/approval handoff. The owner reviews the complete capstone.',
red:'Any fabricated fact, consent bypass, unsupported payment claim, real-customer data in training, or self-issued certification.',
case:'A fictional barber likes the demo, asks for a discount and wants to pay immediately. Give the complete safe customer journey.',
quiz:[
['A completed quiz means…',['Automatic live contact authorization','Part of the competency evidence, not certification','Owner approval is no longer required'],1,'Only the owner grants certification and live clearance.'],
['Where should training scenarios run?',['In isolated fictional practice','Using a random real customer','On the production payment gateway'],0,'Simulations do not touch production accounts or money.'],
['What is an automatic critical fail in the capstone?',['A brief pause to think','Asking a discovery question','Fabricating payment or violating opt-out'],2,'Safety rules outrank sales performance.']
]}
];
const COURSE=Object.freeze({
 id:COURSE_ID,title:'SBC Academy 360 · Account Manager Mastery',
 role:'account_manager',version:VERSION,status:'published',
 description:'SBC-specific customer relationship apprenticeship: 12 intensive lessons, narrated visual simulations, role-play, objective quizzes, scenario evidence and owner-approved certification.',
 source:'SBC owner-commissioned Academy 360 V66.165',curriculumVersion:VERSION,
 estimatedMinutes:M.reduce((s,m)=>s+m.mins,0),
 completionStandard:'Read/watch narrated simulations, score at least 90% on server-graded knowledge checks, submit observed role-play evidence, and obtain explicit owner certification. A quiz does not authorize outreach.',
 certification:{ownerApprovalRequired:true,liveAccountAccessNotGranted:true,knowledgeThreshold:90,capstoneObserved:true},
 modules:M.map((m,i)=>({
  id:m.id,role:'account_manager',order:i+1,minutes:m.mins,title:m.title,description:m.objective,
  status:'published',phase:i<4?'Operating standards':i<8?'Sales mastery':'Account stewardship',
  lesson:{objective:m.objective,learn:m.learn,practice:{prompt:m.practice,evidence:'Owner-reviewed fictional case, attributed notes and a specific next action.'},
  knowledgeCheck:{prompt:m.case,passingRule:'At least 90% on server-graded multiple choice, plus authentic scenario evidence and owner observation.'}},
  academyMedia:{skill:m.skill,script:m.say,redFlags:m.red,scenario:m.case,spanish:m.es,
    sceneLabels:['See the customer problem','Ask a grounded question','Show the approved workflow','Confirm the next step'],
    format:'interactive-narrated-motion-lesson',fictional:true},
  assessment:{passingScore:90,questions:[
   {id:m.id+'-case',prompt:m.case,answerType:'text'},
   {id:m.id+'-proof',prompt:'Document your action, evidence, approval boundary, and next-step plan.',answerType:'text'}]}
 }))
});
const QUESTIONS=Object.freeze(Object.fromEntries(M.map(m=>[m.id,m.quiz.map(([prompt,choices,correct,rationale],i)=>({
 id:m.id+'-q'+(i+1),prompt,choices,correct,rationale}))])));
function publicQuestions(id){
 const q=QUESTIONS[id];return q?q.map(({id,prompt,choices})=>({id,prompt,choices})):null;
}
function grade(id,answers){
 const qs=QUESTIONS[id];
 if(!qs)throw Object.assign(Error('UNKNOWN_LESSON'),{status:404});
 if(!Array.isArray(answers)||answers.length!==qs.length||answers.some(v=>!Number.isInteger(v)||v<0||v>2))
  throw Object.assign(Error('INVALID_ASSESSMENT'),{status:422});
 let correct=0;const details=qs.map((q,i)=>{const ok=answers[i]===q.correct;
  if(ok)correct++;return {id:q.id,correct:ok,rationale:q.rationale};});
 const score=Math.round(correct/qs.length*100);
 return {score,passed:score>=90,correct,total:qs.length,details,remediation:score>=90?'':'Review the lesson, repeat the fictional simulation, and retake the assessment.'};
}
function install(s,normalizeCourse,clock=()=>new Date().toISOString()){
 if(!s||!Array.isArray(s.courses)||typeof normalizeCourse!=='function')throw Error('TRAINING_CATALOG_REQUIRED');
 if(s.courses.some(c=>String(c.id)===COURSE_ID))return false;
 s.courses.push(normalizeCourse(COURSE,'SBC Academy 360 Account Manager Mastery'));
 s.migration=s.migration||{};s.migration.amAcademy20261122Applied=true;
 s.migration.amAcademy20261122At=clock();s.migration.elite2026PendingSave=true;s.updatedAt=clock();
 return true;
}
module.exports={VERSION,COURSE_ID,COURSE,QUESTIONS,publicQuestions,grade,install};
