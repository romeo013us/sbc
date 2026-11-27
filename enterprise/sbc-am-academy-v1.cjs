'use strict';
/* SBC Academy 360 · Account Manager Mastery V66.165
 * Immutable, approved teaching content. Hypothetical practice cases are
 * clearly labeled. Neither reading nor quiz scores grant production access.
 * Tenant/customer information is NEVER included in built-in lessons.
 */
const VERSION='2026.11.22.2';
const CURRICULUM_VERSION='2026.11.26.1';
// Additive bilingual study content; preserve practical/certification version and historical attempts.
const DEPTH={
 "am-01": {
  "en": [
   "SBC is Successful By Choice LLC, a Miami small-business services company. Use the official name, authentic SBC logo and motto 'Because Why Not?' consistently. Do not create another logo, claim to represent a provider, or promise a service that is not on the approved catalog.",
   "Match the customer's need to the correct service: a website explains the business, a domain is its address, hosting runs the site, SSL protects the connection, professional email supports communication, and search visibility helps people discover accurate information. None guarantees new sales.",
   "Print, business cards, flyers, banners, DTF apparel and signage are physical deliverables: collect quantities, dimensions, artwork, finish, delivery destination and proof approval before requesting an exact quote. Florida notary work is a separate regulated service; route it to the authorized notary rather than promising legal advice.",
   "Daily work means reviewing assigned accounts, preparing real evidence, recording actual outcomes and protecting customer information. Use only approved prices and terms; when uncertain, record the question and escalate instead of inventing an answer."
  ],
  "es": [
   "SBC es Successful By Choice LLC, una empresa de servicios para pequeños negocios de Miami. Use el nombre oficial, el logotipo auténtico y el lema 'Because Why Not?'. No invente otro logotipo, ni diga que representa a un proveedor, ni prometa servicios fuera del catálogo aprobado.",
   "Relacione la necesidad con el servicio: el sitio explica el negocio, el dominio es su dirección, el alojamiento permite su funcionamiento, SSL protege la conexión, el correo profesional facilita la comunicación y la visibilidad ayuda a encontrar datos correctos. Ninguno garantiza ventas.",
   "Las tarjetas, volantes, pancartas, ropa DTF y letreros son productos físicos: confirme cantidad, medidas, diseño, acabado, destino y aprobación de prueba antes de solicitar una cotización. La notaría de Florida es un servicio regulado separado; remita al notario autorizado, sin dar asesoría legal.",
   "El trabajo diario incluye revisar cuentas asignadas, preparar evidencia real, registrar resultados verdaderos y proteger datos. Use condiciones aprobadas y, si tiene dudas, documente la pregunta y escálela en lugar de inventar una respuesta."
  ],
  "q": [
   [
    "A prospect asks whether SBC guarantees sales after buying a website.",
    [
     "Promise a minimum number of leads",
     "Explain the website's purpose without guaranteeing results",
     "Promise a refund if there are no sales"
    ],
    "Un prospecto pregunta si SBC garantiza ventas con un sitio web.",
    [
     "Prometa un mínimo de prospectos",
     "Explique la función del sitio sin garantizar resultados",
     "Prometa una devolución si no vende"
    ],
    1
   ],
   [
    "A customer wants 500 business cards and branded shirts.",
    [
     "Order immediately from a vendor",
     "Quote from memory without specifications",
     "Confirm quantity, artwork, sizing, proof and approved scope first"
    ],
    "Un cliente pide 500 tarjetas y camisetas.",
    [
     "Compre de inmediato al proveedor",
     "Cotice de memoria sin especificaciones",
     "Confirme cantidad, diseño, tallas, prueba y alcance aprobado"
    ],
    2
   ]
  ]
 },
 "am-02": {
  "en": [
   "Think of the Fantastic 4 as four separate responsibilities: sbcmia.com is the service storefront, sbcwebsites.com handles reseller offerings and renewals, Command Center manages SBC's own operations, and Office Box is a distinct customer workspace. Never use an employee login as a customer account.",
   "Domains, hosting, SSL and Microsoft 365 email may have provider-specific terms. Check the live catalog, ownership, billing period and renewal obligations before offering a bundle. A reseller order and an SBC design project are separate records and must be reconciled rather than assumed identical.",
   "Square is the approved payment evidence rail where configured. GoDaddy, VistaPrint Pro, 4over4 and approved signage vendors are fulfillment partners, not permission to spend. Employees prepare accurate orders and proofs; only authorized purchasing workflows submit them.",
   "Trace a fictional inquiry through Account 360, discovery, a private preview, approved quote, verified payment, production, delivery and renewal. At every handoff record who owns the next task, which system is authoritative and what evidence is still missing."
  ],
  "es": [
   "Considere Fantastic 4 como cuatro responsabilidades: sbcmia.com presenta servicios, sbcwebsites.com maneja ofertas y renovaciones de revendedor, Command Center administra operaciones internas y Office Box es un espacio separado para clientes. No use cuentas de empleados como cuentas de clientes.",
   "Dominios, alojamiento, SSL y Microsoft 365 pueden tener condiciones de proveedor distintas. Consulte catálogo, titularidad, período de cobro y renovaciones. Un pedido de revendedor y un proyecto de diseño SBC son registros distintos que deben conciliarse.",
   "Square aporta evidencia de pago cuando está configurado. GoDaddy, VistaPrint Pro, 4over4 y proveedores aprobados de letreros son socios de entrega, no permiso para gastar. El empleado prepara pedidos y pruebas; solo el proceso autorizado los envía.",
   "Siga una consulta ficticia por Account 360, descubrimiento, vista privada, cotización aprobada, pago verificado, producción, entrega y renovación. En cada paso registre el responsable, el sistema de referencia y la evidencia pendiente."
  ],
  "q": [
   [
    "A customer asks for Office Box with every hosting renewal.",
    [
     "Verify separate Office Box entitlement and quote",
     "Automatically add a free CRM",
     "Use your employee CRM login"
    ],
    "Un cliente pide Office Box con cada renovación de alojamiento.",
    [
     "Verifique la licencia y cotización separada de Office Box",
     "Agregue un CRM gratis",
     "Use su acceso interno de empleado"
    ],
    0
   ],
   [
    "Who submits a paid print vendor order?",
    [
     "Anyone who prepared the mockup",
     "The approved purchasing workflow after owner clearance",
     "The lead researcher automatically"
    ],
    "¿Quién envía un pedido pagado al proveedor de impresión?",
    [
     "Cualquiera que preparó el diseño",
     "El proceso de compra autorizado tras aprobación del dueño",
     "El investigador automáticamente"
    ],
    1
   ]
  ]
 },
 "am-03": {
  "en": [
   "Open the assigned account and confirm the actual business name, decision maker, primary phone, email, physical address, industry, website, GBP listing, source and current disposition. Distinguish street address from a map listing or service-area location; do not overwrite a discrepancy without evidence.",
   "Use Account 360 as the central case file. Review the prior note, current owner or account manager assignment, appointment date, call history and saved website status before opening a composer or dialer. A Hot score is prioritization, not an authorization or a promise of interest.",
   "Keep each note actionable: who actually answered, what they said, what was verified, what remains unknown, the disposition and agreed next step. Example: a fictional shop owner says it has an outdated site and requests a Thursday demo; record that statement, date and unresolved scope.",
   "Use the appropriate status for a genuine bad number, a request for callback, a language handoff or an opt-out. Do not delete or mark a lead lost because it cannot be handled in English; preserve history and route it to the approved bilingual queue."
  ],
  "es": [
   "Abra la cuenta asignada y confirme nombre, decisor, teléfono principal, correo, dirección física, sector, sitio, perfil de Google, fuente y estado. Distinga dirección física de ubicación en mapas o área de servicio; no cambie discrepancias sin evidencia.",
   "Use Account 360 como expediente central. Revise la nota previa, asignación, cita, historial de llamadas y estado del sitio guardado antes de abrir el marcador o un mensaje. Una puntuación Hot indica prioridad, no permiso ni garantía de interés.",
   "Haga útil cada nota: quién respondió, qué dijo, qué se verificó, qué falta, resultado y siguiente paso acordado. Ejemplo: un dueño ficticio dice que su sitio es anticuado y pide una demostración el jueves; registre su declaración, fecha y alcance pendiente.",
   "Use el estado correcto para número incorrecto, devolución de llamada, transferencia por idioma o exclusión. No elimine ni marque perdido a quien no habla inglés; conserve el historial y remita a la cola bilingüe autorizada."
  ],
  "q": [
   [
    "A map listing and the CRM street address disagree.",
    [
     "Overwrite both with your guess",
     "Record the mismatch and seek reliable evidence",
     "Delete the address"
    ],
    "La ubicación en mapas y la dirección CRM no coinciden.",
    [
     "Cambie ambas según su suposición",
     "Registre la diferencia y busque evidencia fiable",
     "Elimine la dirección"
    ],
    1
   ],
   [
    "A valid business contact speaks Spanish only.",
    [
     "Mark bad number",
     "Mark not interested",
     "Record language handoff and preserve the account"
    ],
    "Un contacto válido solo habla español.",
    [
     "Marque número incorrecto",
     "Marque sin interés",
     "Registre transferencia por idioma y conserve la cuenta"
    ],
    2
   ]
  ]
 },
 "am-04": {
  "en": [
   "Start with Lorna's research evidence, not assumptions about names, accents, reviews or appearance. Confirm the business identity and source, reconcile website and Google profile status, and record missing fields. Do not infer a person's language or willingness to buy from ethnicity or a name.",
   "Before contact, consult the current assignment, suppression, consent and applicable calling rules. A verified telephone number is only evidence of a number; it does not authorize every channel or automated contact. A working dialer does not override permission.",
   "If a person requests no further contact, log the real request and use the approved suppression action immediately. Never change phone numbers, send another channel message or use a different employee to work around the request. For a bad number, follow the documented re-verification path.",
   "When a prospect says they prefer Spanish, politely offer a bilingual callback if permitted. Record the preference and route it to the Spanish callback queue for owner-authorized assignment; do not call the number repeatedly or invent an outcome. Use company-approved instructions for outreach hours and escalation."
  ],
  "es": [
   "Comience con evidencia de Lorna, no con suposiciones por nombres, acentos, reseñas o apariencia. Confirme identidad y fuente, concilie sitio y perfil de Google, y registre campos faltantes. No deduzca idioma ni intención de compra por etnia o nombre.",
   "Antes del contacto, consulte asignación, exclusiones, consentimiento y reglas aplicables. Un teléfono verificado solo comprueba el número; no autoriza todos los canales ni contacto automatizado. Un marcador funcional no anula los permisos.",
   "Si alguien pide no recibir más contacto, registre la solicitud real y aplique la exclusión aprobada. No cambie números, mensajes ni empleados para evadirla. Si el número es incorrecto, siga la ruta documentada de nueva verificación.",
   "Si el prospecto prefiere español, ofrezca con cortesía una devolución bilingüe si está permitida. Registre la preferencia y remita a la cola de español con asignación autorizada por el dueño; no repita llamadas ni invente resultados. Siga los horarios y escalaciones aprobados."
  ],
  "q": [
   [
    "A Hot lead has an explicit do-not-contact request.",
    [
     "Use another channel",
     "Honor the suppression and stop sales contact",
     "Call from a personal number"
    ],
    "Un prospecto Hot pidió no recibir más contacto.",
    [
     "Use otro canal",
     "Respete la exclusión y cese el contacto comercial",
     "Llame desde un número personal"
    ],
    1
   ],
   [
    "The prospect speaks a language you cannot support.",
    [
     "Guess based on their name",
     "Record a bad number",
     "Ask their preferred language and route an authorized callback"
    ],
    "El prospecto habla un idioma que no domina.",
    [
     "Deduzca por el nombre",
     "Registre número incorrecto",
     "Pregunte el idioma preferido y remita una devolución autorizada"
    ],
    2
   ]
  ]
 },
 "am-05": {
  "en": [
   "Use John's approved conversational approach: introduce yourself, confirm the decision maker and ask whether the business has a website. Adapt the introduction to the employee's real name; do not pretend to be John. Only say a site was built when an actual reviewed account-specific preview exists.",
   "Discover the customer's current channels, most important services, typical customers and friction: contact, hours, appointments, menus, photos, inquiries or outdated details. Separate observed facts from hypotheses. Do not assume that having only social media is a problem.",
   "Examples: for a barber, ask about booking and an existing Booksy link; for an auto shop, ask about services and phone inquiries; for a restaurant, ask how people find current menus and hours. For a shop, ask about online inventory, payment and shipping needs before proposing e-commerce.",
   "Close discovery with a specific permission-based next step: an agreed ten-minute meeting, a scope clarification, a requested quote or no further contact. Record the real outcome and date in Account 360. Prepare a private concept before the agreed demonstration if it does not yet exist."
  ],
  "es": [
   "Use el enfoque conversacional aprobado de John: preséntese, confirme al decisor y pregunte si tiene sitio. Adapte la presentación al nombre real del empleado; no finja ser John. Solo diga que creó un sitio si existe una vista previa real y revisada de esa cuenta.",
   "Descubra canales actuales, servicios principales, clientes típicos y dificultades: contacto, horarios, citas, menús, fotos, consultas o datos desactualizados. Separe hechos de hipótesis. No presuponga que usar solo redes sociales sea un problema.",
   "Ejemplos: en barberías pregunte por reservas y Booksy; en talleres, servicios y llamadas; en restaurantes, menús y horarios actuales. En tiendas, confirme inventario, cobro y envío antes de proponer comercio electrónico.",
   "Cierre el descubrimiento con permiso y un paso concreto: reunión de diez minutos, aclarar alcance, cotización solicitada o no más contacto. Registre resultado y fecha en Account 360. Prepare el concepto privado antes de la demostración si aún no existe."
  ],
  "q": [
   [
    "No approved preview exists yet; the owner asks what you built.",
    [
     "Say you already built it",
     "Explain that you can prepare a private concept",
     "Send another customer's site as theirs"
    ],
    "No hay vista previa aprobada; el dueño pregunta qué creó.",
    [
     "Diga que ya la creó",
     "Explique que puede preparar un concepto privado",
     "Envíe el sitio de otro cliente como propio"
    ],
    1
   ],
   [
    "A barber asks about online booking.",
    [
     "Promise a working Booksy integration without a link",
     "Ignore the question",
     "Confirm the existing booking provider/link and scope before promising integration"
    ],
    "Una barbería pregunta por reservas en línea.",
    [
     "Prometa Booksy sin enlace",
     "Ignore la pregunta",
     "Confirme proveedor, enlace y alcance antes de prometer integración"
    ],
    2
   ]
  ]
 },
 "am-06": {
  "en": [
   "Learn the current website package reference ladder: Starter $199, Custom $499, Advanced $799 and Growth $999. These are starting reference offers, not permission to quote an old screenshot. Confirm deliverables, domain and hosting term, SSL inclusion, renewal, editable content, pages, revisions and any add-ons in the current approved catalog.",
   "Explain the separate economics of a domain, hosting, SSL and professional email. Domains and hosting can renew; SSL can be included or separately charged depending on the offer; email seats, backups, SEO, management and extra work may have distinct fees. Never say 'free forever' or 'unlimited' without approved terms.",
   "Office Box is separately priced by plan, usage and team requirements. Print and apparel depend on specifications and shipping. Signage depends on dimensions, mounting and approved proof. Notary pricing and eligible service scope must be confirmed with the authorized Florida notary.",
   "Practice pricing from the live catalog: compare one-page and multi-page needs; identify the recurring services; explain the difference between a design deposit, full quoted total and actual payment. If a requested price, discount, monthly care amount or deal limit is not verified, escalate for written approval."
  ],
  "es": [
   "Aprenda la escala web de referencia: Starter $199, Custom $499, Advanced $799 y Growth $999. Son ofertas de referencia, no permiso para cotizar una captura antigua. Confirme entregables, plazo de dominio y alojamiento, SSL, renovación, edición, páginas, revisiones y extras en el catálogo aprobado vigente.",
   "Explique por separado dominio, alojamiento, SSL y correo profesional. Dominio y alojamiento pueden renovarse; SSL depende del paquete; buzones, respaldos, SEO, gestión y trabajo extra pueden tener cargos distintos. Nunca diga gratis para siempre ni ilimitado sin condiciones aprobadas.",
   "Office Box tiene precio separado según plan, uso y equipo. Impresión y ropa dependen de especificaciones y envío; letreros, de medidas, montaje y prueba. Precio y alcance notarial deben confirmarse con el notario autorizado de Florida.",
   "Practique con el catálogo vigente: compare necesidades de una o varias páginas, identifique servicios recurrentes y distinga anticipo, total cotizado y pago real. Si precio, descuento, mantenimiento mensual o límite de trato no está verificado, escale para aprobación escrita."
  ],
  "q": [
   [
    "A customer wants unlimited lifetime hosting with the $199 Starter.",
    [
     "Confirm term and renewal in the approved quote",
     "Agree because it is easier to close",
     "Promise lifetime hosting verbally"
    ],
    "Un cliente pide alojamiento ilimitado de por vida con Starter de $199.",
    [
     "Confirme plazo y renovación en la cotización aprobada",
     "Acepte para cerrar",
     "Prometa alojamiento de por vida verbalmente"
    ],
    0
   ],
   [
    "An old sales sheet lists an unconfirmed care-plan price.",
    [
     "Offer it immediately",
     "Use the current catalog or request owner approval",
     "Invent a lower price"
    ],
    "Una hoja antigua indica un precio de mantenimiento no confirmado.",
    [
     "Ofrézcalo de inmediato",
     "Use catálogo vigente o solicite aprobación del dueño",
     "Invente un precio inferior"
    ],
    1
   ]
  ]
 },
 "am-07": {
  "en": [
   "Website Production starts with a verified brief: correct business name, industry, services, location, contact routes, brand assets, approved pricing and desired goal. Unknown information stays explicitly marked. Use private concepts or uploaded ZIP previews only for the correct account and inspect actual content before showing it.",
   "Check the preview on phone and desktop. Confirm navigation, visible contact buttons, accessibility, text contrast and image rights. For booking or forms, verify the actual destination and implementation; a button, placeholder or unconfigured form is not proof that messages or appointments are working.",
   "Use original or properly licensed images; never fabricate testimonials, awards, certifications, staff images or client authorizations. Do not imply that a concept is already live or owned by the prospect. Keep private previews separate from public customer websites and production publication.",
   "Demo flow: show the problem, explain one real improvement, ask for feedback, confirm scope and request an approved quote. Track feedback, ZIP/preview version, approval and next meeting. Do not publish, buy a domain, set up email or promise final delivery until the relevant approval and verified payment."
  ],
  "es": [
   "Website Production comienza con un brief verificado: nombre, sector, servicios, ubicación, contacto, marca, precios aprobados y objetivo. Marque lo desconocido. Use conceptos privados o ZIP solo de la cuenta correcta y revise contenido real antes de mostrarlo.",
   "Revise la vista en móvil y escritorio: navegación, contacto, accesibilidad, contraste y derechos de imágenes. Para reservas o formularios, verifique destino e implementación; un botón o formulario sin configurar no demuestra que funcionen mensajes o citas.",
   "Use imágenes propias o licenciadas; nunca invente testimonios, premios, certificaciones, fotos de empleados o autorizaciones. No diga que el concepto está publicado ni que pertenece al prospecto. Separe vistas privadas de sitios públicos.",
   "En la demostración: muestre el problema, explique una mejora real, pida comentarios, confirme alcance y solicite cotización aprobada. Registre comentarios, versión, aprobación y próxima reunión. No publique, compre dominio, configure correo ni prometa entrega sin autorización y pago verificado."
  ],
  "q": [
   [
    "A private demo has a contact button with no configured backend.",
    [
     "Claim the form works",
     "Label it as unconfigured and verify before launch",
     "Send a fake confirmation"
    ],
    "Una demostración privada tiene contacto sin backend.",
    [
     "Afirme que funciona",
     "Indique que no está configurado y verifique antes de publicar",
     "Envíe confirmación falsa"
    ],
    1
   ],
   [
    "Which evidence is required before saying a preview exists?",
    [
     "A guessed link",
     "A screenshot from a different customer",
     "The actual reviewed account-specific preview"
    ],
    "¿Qué evidencia permite decir que existe una vista previa?",
    [
     "Un enlace supuesto",
     "Captura de otro cliente",
     "Vista real revisada de la cuenta específica"
    ],
    2
   ]
  ]
 },
 "am-08": {
  "en": [
   "Handle objections with acknowledge, clarify, respond, next action. Price can mean affordability, cash timing, unclear scope or mistrust; ask which before suggesting an approved alternative. Never create false scarcity, pressure the owner or invent a discount.",
   "If the owner already uses Facebook or Instagram, recognize that those tools may work. Ask whether customers can easily find current hours, services or contact details; explain the complementary role of an accurate website only if relevant.",
   "If a prospect says a competitor is cheaper, compare verified deliverables, renewals, ownership, support and payment terms, not unsupported competitor claims. Explain what SBC can verify and offer to put the exact scope in writing.",
   "Practice in both English and Spanish. If the answer is unknown, say you will verify with the owner or current catalog. A request to stop is not an objection to overcome: honor the opt-out, log the real disposition and do not schedule unsolicited follow-up."
  ],
  "es": [
   "Maneje objeciones reconociendo, aclarando, respondiendo y acordando el siguiente paso. El precio puede ser presupuesto, momento de pago, alcance confuso o desconfianza; pregunte antes de ofrecer alternativa aprobada. No invente urgencia ni descuentos.",
   "Si el dueño usa Facebook o Instagram, reconozca que pueden servirle. Pregunte si clientes encuentran horarios, servicios y contacto; explique el papel complementario de un sitio correcto solo si es pertinente.",
   "Si un competidor es más barato, compare entregables, renovaciones, titularidad, soporte y condiciones verificadas, no afirmaciones sin respaldo. Explique lo que SBC puede comprobar y ofrezca alcance por escrito.",
   "Practique en inglés y español. Si desconoce la respuesta, diga que verificará con el dueño o catálogo. Una solicitud de no contactar no es una objeción que superar: respete, registre y no programe seguimiento no solicitado."
  ],
  "q": [
   [
    "A prospect says $499 is too much.",
    [
     "Promise any discount",
     "Ask what concern matters and compare approved scopes",
     "Insult cheaper competitors"
    ],
    "Un prospecto dice que $499 es demasiado.",
    [
     "Prometa cualquier descuento",
     "Pregunte qué le preocupa y compare alcances aprobados",
     "Insulte a competidores"
    ],
    1
   ],
   [
    "A customer asks a question outside your knowledge.",
    [
     "Make up a confident answer",
     "Avoid documenting it",
     "Record the question and verify with the current approved source"
    ],
    "Un cliente pregunta algo que usted no sabe.",
    [
     "Invente una respuesta segura",
     "No lo documente",
     "Registre la pregunta y verifique con fuente aprobada"
    ],
    2
   ]
  ]
 },
 "am-09": {
  "en": [
   "After an actual conversation, record the disposition, contact person, objection, preferred channel and permission, commitments and agreed next date. No answer is not a completed conversation, and a callback request is not a sale. Avoid duplicate calls and conflicting dates.",
   "Book a ten-minute website demo through the existing appointment editor only with an agreed time and time zone. Verify the assigned account, event title, duration, meeting method/link and whether confirmation was actually sent. Do not claim a Zoom meeting exists when no meeting link is ready.",
   "Follow-up must continue the prior discussion, not restart from a generic pitch. Prepare the private preview or scope the customer requested, check whether the original question was resolved, and keep the next action specific. If the customer requested email only, honor that restriction.",
   "Review overdue tasks, callbacks, missed appointments and account handoffs at shift start and end. Preserve the chronology and distinguish proposal, booked meeting, quote sent, paid and completed. Escalate an unassigned bilingual callback or missing owner decision instead of leaving a record without next action."
  ],
  "es": [
   "Después de una conversación real, registre resultado, contacto, objeción, canal preferido y permiso, compromisos y fecha acordada. Sin respuesta no es conversación completa, y pedir devolución no es venta. Evite llamadas duplicadas y fechas contradictorias.",
   "Reserve una demostración de diez minutos con el editor existente solo con horario y zona acordados. Verifique cuenta, título, duración, método o enlace y confirmación realmente enviada. No afirme que existe Zoom si no hay enlace.",
   "El seguimiento debe continuar la conversación previa. Prepare vista privada o alcance solicitado, revise si la pregunta se resolvió y haga concreto el siguiente paso. Si el cliente pidió solo correo, respete esa restricción.",
   "Revise tareas vencidas, devoluciones, citas perdidas y transferencias al inicio y fin del turno. Conserve la cronología y distinga propuesta, reunión, cotización, pago y entrega. Escale una devolución bilingüe sin asignación o una aprobación pendiente en vez de dejarla sin acción."
  ],
  "q": [
   [
    "A customer verbally requests a demo at 2 PM but the time zone is unknown.",
    [
     "Guess the time zone",
     "Confirm date, zone and method before booking",
     "Mark the quote paid"
    ],
    "Un cliente pide demostración a las 2, sin zona horaria.",
    [
     "Suponga la zona",
     "Confirme fecha, zona y método antes de reservar",
     "Marque cotización pagada"
    ],
    1
   ],
   [
    "An email confirmation fails.",
    [
     "Claim it was sent",
     "Call repeatedly",
     "Record the failure and use the approved recovery workflow"
    ],
    "Falla la confirmación por correo.",
    [
     "Diga que se envió",
     "Llame repetidamente",
     "Registre la falla y use el proceso de recuperación aprobado"
    ],
    2
   ]
  ]
 },
 "am-10": {
  "en": [
   "A quote describes proposed scope; a signed or approved quote establishes terms; a checkout link is a payment invitation; a completed provider capture is payment evidence. Settlement to a bank is another event. Do not treat quote totals, open orders, test payments or links as actual collected customer revenue.",
   "Use approved Square checkout and reconcile the customer, order ID, provider payment ID, amount, currency and completion status. If status is pending, missing, disputed, duplicate, refunded or reversed, hold paid fulfillment and escalate. Do not collect card numbers or secrets in CRM notes.",
   "Production handoff requires the agreed deliverable, payment evidence, customer contact and approved assets. Print work needs approved artwork proof and specifications; hosting or domain provisioning needs correct ownership and terms; web work needs approved scope and tested preview. Only authorized workflows commit vendor purchases.",
   "Refunds, chargebacks, price exceptions, payroll and money movement require explicit owner review and controlled financial workflows. An employee may collect facts, explain the next step and prepare an escalation, but must never manually invent a receipt, alter money or mark an order complete before evidence."
  ],
  "es": [
   "Una cotización propone alcance; una cotización firmada o aprobada establece condiciones; un enlace invita a pagar; una captura completada del proveedor aporta evidencia de pago. El depósito bancario es otro evento. No trate cotizaciones, pedidos abiertos, pagos de prueba o enlaces como ingresos cobrados.",
   "Use Square aprobado y concilie cliente, pedido, identificador de pago, importe, moneda y estado. Si está pendiente, ausente, disputado, duplicado, reembolsado o revertido, detenga la entrega pagada y escale. No guarde tarjetas ni secretos en notas.",
   "La transferencia a producción necesita entregable acordado, pago, contacto y activos aprobados. Impresión requiere prueba y especificaciones; dominio y alojamiento, titularidad y condiciones; sitio, alcance y vista probada. Solo procesos autorizados realizan compras.",
   "Devoluciones, contracargos, precios especiales, nómina y movimiento de dinero requieren revisión del dueño y procesos controlados. El empleado reúne hechos y prepara escalación; nunca inventa recibos, altera fondos ni marca entrega sin evidencia."
  ],
  "q": [
   [
    "An open order has a large quoted value and no confirmed capture.",
    [
     "Report it as collected revenue",
     "Keep it separate from collected revenue",
     "Mark paid from the customer's message"
    ],
    "Un pedido abierto tiene valor alto sin captura confirmada.",
    [
     "Repórtelo como ingreso cobrado",
     "Manténgalo separado del ingreso cobrado",
     "Márquelo pagado por mensaje"
    ],
    1
   ],
   [
    "A print customer pays but has not approved the artwork.",
    [
     "Order immediately",
     "Invent an approval",
     "Hold vendor purchase until required proof and approvals are confirmed"
    ],
    "Un cliente de impresión paga pero no aprobó el diseño.",
    [
     "Compre de inmediato",
     "Invente aprobación",
     "Detenga la compra hasta confirmar prueba y aprobaciones"
    ],
    2
   ]
  ]
 },
 "am-11": {
  "en": [
   "After sale, maintain one accountable owner for the customer record. Confirm which project or service was delivered, what is still pending, who owns each next action and what the customer actually accepted. A completed internal task does not prove public website or vendor delivery.",
   "Review domains, hosting, SSL, email and managed services for actual renewal dates and terms. Notify customers using approved contact preferences and the current agreement. Never promise a free renewal, auto-charge, or transfer without verified entitlement and authorization.",
   "Use Office Box discovery to determine real need: customer records, team size, tasks, lead imports or other verified features. Confirm current plan limits and price before offering it. Do not silently copy customer information between Office Box and Command Center or claim an unverified integration.",
   "Retention workflow: check after delivery, resolve reported defects with factual tickets, review renewal needs, and propose an add-on only when it solves a stated problem. Document a 30/60/90-day care plan as appropriate, respect the customer's choices and escalate complaints rather than hiding them."
  ],
  "es": [
   "Después de vender, mantenga un responsable de la cuenta. Confirme qué proyecto o servicio se entregó, qué falta, responsable de cada acción y aceptación real del cliente. Una tarea interna terminada no prueba sitio público ni entrega de proveedor.",
   "Revise fechas y condiciones reales de renovación de dominios, alojamiento, SSL, correo y gestión. Avise según preferencias de contacto y acuerdo vigente. No prometa renovación gratis, cobro automático ni transferencia sin derecho y autorización verificados.",
   "Descubra necesidad real de Office Box: registros, equipo, tareas, importación de prospectos u otras funciones verificadas. Confirme límites y precio vigentes. No copie datos silenciosamente entre Office Box y Command Center ni afirme integración sin verificación.",
   "Retención: compruebe después de entrega, resuelva defectos con tickets factuales, revise renovaciones y ofrezca extras solo si resuelven un problema declarado. Documente plan de cuidado de 30/60/90 días según corresponda, respete decisiones y escale quejas."
  ],
  "q": [
   [
    "A customer believes their domain renewal is free forever.",
    [
     "Verify the actual agreement and renewal terms",
     "Confirm the assumption",
     "Charge without informing them"
    ],
    "Un cliente cree que el dominio se renueva gratis para siempre.",
    [
     "Verifique acuerdo y condiciones reales",
     "Confirme la suposición",
     "Cobre sin informarle"
    ],
    0
   ],
   [
    "A customer has an unresolved website defect.",
    [
     "Mark the project completed and ignore it",
     "Record the problem, route support, track the resolution",
     "Sell another package instead"
    ],
    "Un cliente tiene un defecto de sitio sin resolver.",
    [
     "Marque terminado e ignórelo",
     "Registre el problema, remita soporte y siga la solución",
     "Venda otro paquete"
    ],
    1
   ]
  ]
 },
 "am-12": {
  "en": [
   "Use a fictional account only. Start by identifying the correct Fantastic 4 system, verifying research, checking contact eligibility and choosing an appropriate discovery question. Explain the difference between an account note, a lead status, a booked appointment, an approved quote and actual payment.",
   "Demonstrate a complete call in English and Spanish: genuine introduction, permission, discovery, objection, truthful website status, agreed next action and factual note. If the case includes a language handoff or opt-out, route it correctly; never contact a real customer in training.",
   "Use the current catalog to compare two appropriate offers, explain recurring service terms, prepare the private website concept and demonstrate its actual limitations. For a print or Office Box add-on, identify separate scope, proof and approval. Escalate any unknown price, permission, payout or legal question.",
   "Complete the server-graded knowledge checks, isolated practical samples and owner-observed capstone. The 90% minimum and critical-error rules still apply. Training time remains recorded; at the two-shift/eight-hour review point, request authorized paid remediation if needed. Certification is granted by the owner, not a quiz or employee self-assessment."
  ],
  "es": [
   "Use solo una cuenta ficticia. Identifique el sistema de Fantastic 4 correcto, verifique investigación, revise permiso de contacto y elija una pregunta. Distinga nota, estado, cita, cotización aprobada y pago real.",
   "Demuestre llamada completa en inglés y español: presentación genuina, permiso, descubrimiento, objeción, estado real del sitio, siguiente paso y nota factual. Si hay transferencia por idioma o exclusión, use la ruta correcta; nunca contacte clientes reales en capacitación.",
   "Use catálogo actual para comparar dos ofertas apropiadas, explicar recurrencia, preparar concepto privado y mostrar límites reales. Para impresión u Office Box, identifique alcance separado, prueba y aprobación. Escale precios, permisos, pagos o preguntas legales desconocidos.",
   "Complete pruebas del servidor, muestras aisladas y simulación observada por el dueño. Siguen el mínimo del 90% y reglas de errores críticos. Registre tiempo; al revisar dos turnos u ocho horas, solicite recuperación pagada autorizada si hace falta. Certifica el dueño, no una prueba ni autoevaluación."
  ],
  "q": [
   [
    "An employee passes every quiz but has not completed the observed capstone.",
    [
     "Unlock live calling",
     "Self-certify",
     "Complete owner-observed review and obtain explicit certification"
    ],
    "Un empleado aprueba pruebas pero no completa simulación observada.",
    [
     "Desbloquee llamadas reales",
     "Autocertifíquese",
     "Complete revisión observada y obtenga certificación explícita"
    ],
    2
   ],
   [
    "The eight-hour training review point is reached without mastery.",
    [
     "Stop the clock and continue unpaid",
     "Request owner-approved paid remediation; preserve the training gate",
     "Pretend the employee passed"
    ],
    "Se alcanzan ocho horas sin dominar el contenido.",
    [
     "Pare el reloj y siga sin pago",
     "Solicite recuperación pagada aprobada y conserve el bloqueo",
     "Finja que aprobó"
    ],
    1
   ]
  ]
 }
};
const ES=require('./sbc-am-academy-es-v2.cjs');
const PRACTICE=require('./sbc-am-practice-v2.cjs');
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
 source:'SBC owner-commissioned Academy 360 V66.165',curriculumVersion:CURRICULUM_VERSION,
 estimatedMinutes:480,coreMinutes:400,reviewAndFlexMinutes:80,
 completionStandard:'Read/watch narrated simulations, score at least 90% on server-graded knowledge checks, submit observed role-play evidence, and obtain explicit owner certification. A quiz does not authorize outreach.',
 certification:{ownerApprovalRequired:true,liveAccountAccessNotGranted:true,knowledgeThreshold:90,capstoneObserved:true},
 modules:M.map((m,i)=>({
  id:m.id,role:'account_manager',order:i+1,minutes:[15,20,25,25,35,30,35,35,25,30,35,90][i],title:m.title,description:m.objective,
  translations:{es:{...ES.LESSONS[m.id],deepDive:DEPTH[m.id].es}},
  status:'published',phase:i<4?'Operating standards':i<8?'Sales mastery':'Account stewardship',
  lesson:{objective:m.objective,learn:m.learn,deepDive:DEPTH[m.id].en,practice:{prompt:m.practice,evidence:'Owner-reviewed fictional case, attributed notes and a specific next action.'},
  knowledgeCheck:{prompt:m.case,passingRule:'At least 90% on server-graded multiple choice, plus authentic scenario evidence and owner observation.'}},
  academyMedia:{skill:m.skill,script:m.say,redFlags:m.red,scenario:m.case,spanish:m.es,
    sceneLabels:['See the customer problem','Ask a grounded question','Show the approved workflow','Confirm the next step'],
    format:'interactive-narrated-motion-lesson',fictional:true},
  assessment:{passingScore:90,questions:[
   {id:m.id+'-case',prompt:m.case,answerType:'text'},
   {id:m.id+'-proof',prompt:'Document your action, evidence, approval boundary, and next-step plan.',answerType:'text'}]}
 }))
});
const QUESTIONS=Object.freeze(Object.fromEntries(M.map(m=>[m.id,[...m.quiz,...DEPTH[m.id].q.map(([prompt,choices,_es,_esChoices,correct])=>[prompt,choices,correct,'Review the corresponding bilingual SBC study guide and verify the approved process.'])].map(([prompt,choices,correct,rationale],i)=>({
 id:m.id+'-q'+(i+1),prompt,choices,correct,rationale}))])));
function publicQuestions(id,lang='en'){
 const l=PRACTICE.language(lang),q=QUESTIONS[id],translated=q?[...ES.QUESTIONS[Number(String(id).slice(-2))-1],...DEPTH[id].q.map(([_en,_choices,prompt,choices])=>[prompt,choices])]:[];
 return q?q.map(({id,prompt,choices},i)=>({id,prompt:l==='es'?translated[i][0]:prompt,choices:l==='es'?translated[i][1]:choices})):null;
}
function grade(id,answers,lang='en'){
 const l=PRACTICE.language(lang);
 const qs=QUESTIONS[id];
 if(!qs)throw Object.assign(Error('UNKNOWN_LESSON'),{status:404});
 if(!Array.isArray(answers)||answers.length!==qs.length||answers.some(v=>!Number.isInteger(v)||v<0||v>2))
  throw Object.assign(Error('INVALID_ASSESSMENT'),{status:422});
 let correct=0;const details=qs.map((q,i)=>{const ok=answers[i]===q.correct;
  if(ok)correct++;return {id:q.id,correct:ok,rationale:l==='es'?(ok?'Decisión correcta según el proceso de SBC.':'Revise el punto de la lección relacionado y repita la práctica ficticia.'):q.rationale};});
 const score=Math.round(correct/qs.length*100);
 return {score,passed:score>=90,correct,total:qs.length,details,remediation:score>=90?'':l==='es'?'Revise la lección, repita el caso ficticio y vuelva a evaluar.':'Review the lesson, repeat the fictional simulation, and retake the assessment.'};
}
function install(s,normalizeCourse,clock=()=>new Date().toISOString()){
 if(!s||!Array.isArray(s.courses)||typeof normalizeCourse!=='function')throw Error('TRAINING_CATALOG_REQUIRED');
 const existing=s.courses.find(c=>String(c.id)===COURSE_ID);
 if(existing){
  if(existing.curriculumVersion===CURRICULUM_VERSION)return false;
  const refreshed=normalizeCourse(COURSE,'SBC Academy 360 Account Manager Mastery');
  Object.assign(existing,refreshed,{status:existing.status,createdAt:existing.createdAt||refreshed.createdAt});
  s.migration=s.migration||{};s.migration.amAcademyV2PendingSave=true;s.updatedAt=clock();return true;
 }
 s.courses.push(normalizeCourse(COURSE,'SBC Academy 360 Account Manager Mastery'));
 s.migration=s.migration||{};s.migration.amAcademy20261122Applied=true;
 s.migration.amAcademy20261122At=clock();s.migration.elite2026PendingSave=true;s.updatedAt=clock();
 return true;
}
module.exports={VERSION,CURRICULUM_VERSION,COURSE_ID,COURSE,QUESTIONS,publicQuestions,grade,install};
