'use strict';
/**
 * SBC Academy V66.107 — Fantastic 4 production onboarding.
 * 12 guided hours per employee = 6 common + 6 role modules, 60 min each.
 * Day options: 2 x 6h or 3 x 4h. Time is an instructional estimate,
 * not automatic payroll or proof a worker spent the time.
 * All content is new, published under new immutable course/module IDs.
 * Historical courses, progress, attempted assessments and certifications remain intact.
 */
const VERSION='2026.11';
const BUILT_INS_TO_ARCHIVE=new Set([
 'core-foundations-v2','big3-operations-v1','role-lead_researcher-v1',
 'role-caller-v1','role-fulfillment-v1','role-manager-v1'
]);
const L=(id,title,objective,learn,practice,evidence,check,passingRule,scenario1,scenario2)=>({
 id,title,role:'all',minutes:60,
 description:objective,
 lesson:{objective,
  learn:[
   'Training method: 15 minutes for lesson and read-aloud, 30 minutes for a safe practice exercise, and 15 minutes for self-check, evidence and feedback. Do not treat listening alone as mastery.',
   ...learn
  ],
  practice:{prompt:practice,evidence},
  knowledgeCheck:{prompt:check,passingRule}
 },
 assessment:{passingScore:85,questions:[
  {id:id+'-decision',prompt:scenario1,answerType:'text'},
  {id:id+'-proof',prompt:scenario2,answerType:'text'}
 ]},
 status:'published'
});
const C=(id,title,role,description,modules)=>({
 id,title,role,version:VERSION,status:'published',description,
 source:'SBC V66.107 owner-approved Fantastic 4 production onboarding',
 curriculumVersion:VERSION,estimatedMinutes:modules.length*60,
 completionStandard:'Read the lesson, complete the practice safely, record real evidence, and submit the knowledge check. Owner certification is separate.',
 schedule:{twoSixHourShifts:'Day 1: six shared modules; Day 2: six role modules',threeFourHourShifts:'Day 1: shared 1–4; Day 2: shared 5–6 plus role 1–2; Day 3: role 3–6'},
 modules:modules.map((m,i)=>({...m,role,order:i+1,phase:role==='all'?'Fantastic 4 foundations':'Role production mastery'}))
});
const shared=C('sbc-fantastic4-foundations-202611','SBC Academy 2026 — Fantastic 4 Foundations','all',
 'Part 1 of the required 12-hour path: six 60-minute practical lessons on current SBC services, secure workflows and customer care.',[
 L('f4-01','Our company, promises and standards','Explain what SBC is, whom it serves and how to represent the brand without exaggeration.',[
  'Successful By Choice LLC is a Miami-based small-business services provider. Our message is “Because Why Not?”; our job is to be useful and accurate, not to promise overnight success.',
  'SBC helps local owners get discovered, establish credible websites, manage basic digital services, and order business print products; we also offer related business tools and services.',
  'Explain our competitive difference: coordinated help from a real small-business partner. Never claim we outperform Google, guarantee rankings or have endorsements we do not possess.',
  'Understand the chain of authority: the employee researches or calls; the owner controls financial approvals, package exceptions, credentials, vendor purchases and fulfillment clearance.',
  'Use respectful, concise communication; speak plainly, record facts and escalate uncertainty. Employees represent SBC, not GoDaddy, Google, Square or government agencies.'
 ],'Practice a 45-second introduction for a barber, contractor and restaurant. State one useful service for each, then ask a colleague to challenge any unverified claims.',
 'Write your three sector-specific introductions; identify one sentence you deliberately removed because it promised too much.',
 'Who can approve discounts, vendor purchases and customer account changes, and what should you say when you do not know the answer?',
 'Must name the owner authorization boundary, accurately describe SBC, and offer a fact-based next step.',
 'A prospect asks whether SBC guarantees first place in Google search. Give an accurate response.',
 'List the three most important facts to capture when describing SBC to a new local business.'),
 L('f4-02','The Fantastic 4: what each system actually does','Identify all four SBC surfaces and explain their handoffs without confusing customer and employee access.',[
  'sbcmia.com is the public face: services, inquiry and customer account experience. The customer portal is for customers to view their own services, orders and messages.',
  'sbcwebsites.com is the GoDaddy-powered reseller storefront for hosting, domains and related plans. GoDaddy manages much of the storefront and fulfillment scope.',
  'Office Box is a customizable customer-facing CRM/workspace product. It is a separate application and is not automatically included with every website package.',
  'SBC Command Center is the owner-controlled CRM/operations hub: leads, assigned workspaces, reports, training, orders, payment evidence and controlled handoffs.',
  'Sales Caller and Lead Researcher workspaces are ROLE SCOPES connected to Command Center. Staff may see only assigned, authorized work—not the owner dashboard, financial vault or another tenant.',
  'Links to public SBC websites are reference tools. Do not sign in as a client or use the owner account to demonstrate a worker task.'
 ],'Draw the customer journey: public inquiry → lead/research → assigned sales → owner-approved quote/order → Square payment → fulfillment → customer portal; mark the system responsible at each step.',
 'Record each of the four products and its purpose; note what is visible to a staff caller, researcher, customer and owner.',
 'What does “all four are connected” NOT mean about shared permissions, payment authorization or automatic subscriptions?',
 'Accurately separates the four platforms and their permissions; distinguishes an inquiry from a paid order.',
 'Someone thinks Office Box is the same as the employee Command Center workspace. Explain the difference.',
 'Where should a customer see messages and orders, and where should a sales caller document an outbound conversation?'),
 L('f4-03','Current services, packages and honest pricing','Distinguish SBC’s published entry offers from custom, renewal and third-party services.',[
  'Business Visibility is listed at $99: discuss Google Business Profile and card-related visibility ONLY within the current written offer; confirm current inclusions before the customer buys.',
  'Starter is listed at $199: the current owner-approved proposal includes a first-year domain, basic one-page web setup/hosting, and approximately 100 business cards as a first-year bonus. Renewal is NOT automatically the same price.',
  'Other packages and work may include managed WordPress, SSL, Microsoft 365, e-commerce, printing, signage, website care, SEO and Office Box. The owner must confirm the specific quote, scope, availability and costs.',
  'Selling a Google Business Profile is not selling Google endorsement or a guarantee of ranking. Selling a website is not a guarantee of leads, traffic, SEO position or revenue.',
  'Separate one-time setup, first-year bundled benefits, renewals, recurring subscriptions, printing/shipping and optional managed services. Never invent renewal amounts or annual terms.',
  'Use the current SBC website and approved owner price list to answer product questions. If two sources disagree, STOP and ask the owner; never quote from an old training screenshot.'
 ],'Role-play three inquiries: “I only need Google,” “I want a site and cards,” and “What will it cost next year?” Match the need without overselling.',
 'Write an accurate answer for each inquiry and identify which package terms you need the owner to verify.',
 'When can a caller state a published starting price, and when must they escalate before quoting?',
 'States $99/$199 only as published starting offers, makes renewals and scope explicit, and defers unapproved changes.',
 'A customer assumes $199 includes unlimited edits and identical yearly renewal. Correct the misunderstanding.',
 'A lead requests website, email and e-commerce. What do you record, and what must be quoted by the owner?'),
 L('f4-04','End-to-end customer journey and payment safety','Trace a lead to paid order while respecting Square, customer portal, Office Box and fulfillment holds.',[
  'Lead data is not a purchase. A warm/hot score usually indicates verified data completeness and documented opportunity—not willingness to buy.',
  'Record real customer intent and requested next step; only the authorized owner creates or approves financial commitments and paid fulfillment.',
  'SBC uses unique order-linked Square checkout for its integrated path. A link click, screenshot or webhook notification alone is not authoritative proof that a customer paid.',
  'A completed payment must reconcile to the specific SBC order, amount, currency, location and confirmed provider record; unmatched receipts must be reviewed, not attached to arbitrary customers.',
  'Do not enter customer card information into CRM notes, send personal checkout links as if official, or trigger vendor actions without clearance.',
  'After owner confirmation, a real order proceeds into fulfillment with customer requirements and status visible through the appropriate portal. Office Box access requires the right entitlement and approval.'
 ],'Map a simulated $199 order through inquiry, quote, unique Square link, verified payment, vendor handoff and portal message. Next simulate a payment marked “reconciliation required.”',
 'Provide a decision tree that HOLDs vendor action on unmatched payment or unclear customer/tenant identity.',
 'What proves paid status, and what must never be inferred from a Square webhook alone?',
 'Requires independently matched provider proof, no speculative account activation and owner-controlled fulfillment.',
 'The client emails a Square receipt screenshot, but Command Center shows Pending. What action do you take?',
 'A paid order appears linked to the wrong customer. How do you preserve evidence and escalate?'),
 L('f4-05','Trust, privacy, permissions and escalation','Protect customer records and know the immediate stop rules for privacy, calling and access.',[
  'Use your own employee login and assigned tenant and leads. Do not share credentials, bypass login roles, impersonate the owner or paste secrets into notes.',
  'Only research reputable, permitted public business information. Distinguish a publicly listed phone from permission to call or text. Never scrape private data.',
  'Before outreach follow active federal, Florida and destination-specific rules, owner compliance settings, local time, DNC/suppression and the approved Twilio account. Verify licensing/exemption questions with the owner; this lesson is not legal clearance.',
  'Identify yourself truthfully by full name and Successful By Choice; do not disguise caller ID, use unapproved prerecorded robocalls or bypass an opt-out.',
  'A “do not call again” request ends the pitch immediately. Record the actual Do Not Call outcome and escalate so the number is suppressed; do not try a different channel without required permission.',
  'Suspected customer data leaks, mismatched accounts, payment discrepancies, corrupt leads and permission errors are escalations—not workarounds.'
 ],'Work five safe hypothetical incidents: opted-out number, unexpected owner dashboard access, mismatched Square customer, corrupted CRM text, and a request to text without consent.',
 'For each incident, document stop/no-change/escalate and the minimum facts to include in the owner report.',
 'If a lead looks callable in a UI but customer asked not to be contacted, which condition wins?',
 'Suppression wins; do not call, preserve record, report to owner, and never bypass safeguards.',
 'A coworker asks for your login to finish their task. What do you do?',
 'A prospect asks not to receive calls while the phone is connected. What must you save and stop?'),
 L('f4-06','Real-world simulations and owner handoff','Demonstrate a complete, accurate customer journey and finish common-core assessment.',[
  'The employee goal is reliable quality: correct inputs, honest outcomes, actionable notes and safe escalation. Volume alone is not performance.',
  'Use a known test/demo lead and read-only/public product references for simulations; never create real charges or contact actual prospects during the course.',
  'Every owner handoff should answer: Who is the business? What was verified? What is the stated need? What permission was granted? What is the exact next action?',
  'Acknowledge limits: the owner approves quotes, paid orders, customer service actions, business commitments, staff access and complex technical exceptions.',
  'Time-clock entries determine actual hours; Academy lesson minutes estimate instructional effort and do not rewrite payroll or prove participation.'
 ],'In a role-play, begin with a publicly discoverable local business, record a qualified lead, simulate sales discovery, owner quote, Square reconciliation and an account question; flag each authority boundary.',
 'Submit a one-page simulation note including evidence/source, customer need, next owner action and one STOP condition.',
 'What makes a handoff production-ready rather than just “a warm lead”?',
 'Provides source evidence, customer need, consent/preferences, status, owner next step and verified limits.',
 'Write an example of a complete handoff and explain what makes it auditable.',
 'Describe a “do not proceed” condition and how to escalate it without destroying records.')
]);
const research=C('sbc-research-mastery-202611','Lead Researcher Academy 2026 — Production Mastery','lead_researcher',
 'Part 2 of the required 12-hour path: six 60-minute realistic research, verification and owner handoff modules.',[
 L('res-01','Lorna desk: role, shift and daily priorities','Operate the assigned researcher workspace, official clock and 4-hour research plan.',[
  'Sign in using the researcher account only. Review Needs Attention, Today’s Tasks, Research/Add Lead and the official Time Clock without entering the owner dashboard.',
  'The current four-hour plan has two-minute clock-in and clock-out blocks and roughly 215 planned minutes of direct research; actual payable time is recorded by the official Time Clock.',
  'The daily schedule is a guide, not permission to edit payroll. Follow task priority and capture legitimate completion evidence rather than checking boxes for appearance.',
  'Lead Researcher can add and verify legitimate leads and resolve authorized notices only; permission errors are documented and escalated, never bypassed.',
  'Voice/read-aloud supports learning but does not substitute for the practical exercises or knowledge checks.'
 ],'On a simulated shift, identify the first three tasks, choose a safe demo lead, practice one verification workflow and prepare the end-of-shift handoff.',
 'Write the exact navigation path and time-clock distinction; never create or alter real employee hours during practice.',
 'What should you do when a desired action is outside the researcher role?',
 'Stop, preserve the record and ask the owner. Never use a shared or privileged account.',
 'The researcher UI says a task is checked but the time clock shows no clock-in. Which is authoritative for payable time?',
 'You see a disabled owner-only action in the research UI. What should you record?'),
 L('res-02','Public-source research and data provenance','Build complete, source-backed local business records without fabricated contact details.',[
  'Start with business name, credible public source, location/service area and business type; capture website and published business contact only when actually verified.',
  'Prefer the official company website, public Google Business Profile and other reliable business sources. Record when/where the fact was observed; label uncertain fields.',
  'Differentiate the operating business from an unrelated nearby business in the same building. Similar addresses do not prove common ownership.',
  'Do not infer personal emails, owner identity, mobile numbers or decision-maker names from guesswork; do not paste private or purchased personal data into the CRM.',
  'Mark a missing website only after checking it; do not claim a business has no website based on an incomplete search.'
 ],'Research three hypothetical Miami businesses in a demo worksheet: one has a site, one has inconsistent hours, and one shares an address with another business.',
 'Provide a sample verified source/evidence field and “needs verification” note for each.',
 'When may a record be marked as verified, and which details must remain uncertain?',
 'Includes reliable public sources, exact field evidence, explicit uncertainty and no guessed identity.',
 'Two salons use the same shop address. What evidence identifies the correct company?',
 'A social profile lists a business nickname but no contact name. What do you write?'),
 L('res-03','Deduplication, lead quality and corrupt record handling','Protect CRM data integrity and distinguish lead completeness from buying intent.',[
  'Check existing records before adding: business name variations, public phone, domain, physical address and owner flags.',
  'Hot, Warm and Cold indicate current evidence quality/completeness and documented potential; never say “hot means ready to purchase.”',
  'A blank field is not proof of bad intent. Mark uncertainty and research the field rather than creating multiple guess records.',
  'If text contains binary fragments, replacement characters or obvious document artifacts, do not call, copy into outreach or delete the record. Capture minimal evidence and escalate owner-side repair.',
  'When a notice belongs to a real, resolved researcher item, use only the authorized dismissal workflow; leave unresolved or corrupted cases for owner review.'
 ],'Use four fake records including a domain duplicate, an alias, a questionable email and a corrupted business name. Decide merge candidate, verify later or escalate.',
 'Record four evidence-based decisions; never delete or merge live CRM records during class.',
 'Why is a Hot score not consent to contact or a confirmed sales opportunity?',
 'Identifies evidence vs intent and avoids unauthorized deletion/merges.',
 'A lead named with garbled characters appears in a quality report. How should you respond?',
 'Two leads share a phone but have different registered names. What steps precede marking them duplicates?'),
 L('res-04','Opportunity hypotheses and qualified handoff','Turn verifiable business needs into useful, non-speculative sales research.',[
  'Look for one concrete outreach angle: unclear hours, lack of a reachable website, missing service detail, booking friction, limited product photos or print materials needs.',
  'A research hypothesis is not a promised outcome. Write “worth asking about” rather than inventing poor Google rankings or lost revenue.',
  'Tailor the angle: barbers need booking clarity, restaurants menus/location, contractors service areas, retail products/hours, dealerships inventory inquiry.',
  'Researcher may suggest the most relevant SBC service but does not quote unauthorized prices, make sales claims or contact leads without approved role clearance.',
  'Write a handoff the caller can use in 20 seconds, linked to the original source and a question—not a 10-paragraph speculation.'
 ],'For two mocked business records, produce one verified fact, one useful question and one possible SBC offer. Practice passing these to a caller without creating a call task outside your role.',
 'Write short CRM-ready research notes with confidence and source for each lead.',
 'What separates a credible outreach angle from an invented problem?',
 'Grounded observation, qualified language and a customer question; no unsupported performance claim.',
 'A restaurant already has a menu and site. Give a discovery angle that does not falsely claim they need a new website.',
 'A lead lacks an email. Should the researcher invent or infer one? Explain.'),
 L('res-05','Research throughput with quality controls','Use the four-hour research schedule to produce accurate, reviewable work.',[
  'Start with priority exceptions and the day’s assigned mission, then focus on independent research with small quality check and handoff intervals.',
  'A target such as 16–20 researched businesses is a planning guideline, not permission to lower verification standards or manufacture records.',
  'Before marking a record ready: check duplicate risk, reliable published contact, business name, location, opportunity evidence and next action.',
  'If any field cannot be proved, mark Needs Verification. A small accurate list beats a large contaminated list.',
  'End the shift with a concise handoff: created/verified count, pending uncertainties, legitimate exceptions and any access failures.'
 ],'Simulate a 4-hour work plan using a case packet. Allocate blocks, run a five-field QC rubric on sample records, and write a handoff note.',
 'Provide a summary showing checked facts and unresolved items, never claim fabricated numeric production.',
 'What gets sacrificed first when quantity targets conflict with credible data?',
 'The quantity target is adjusted; accuracy, privacy, identity and evidence are never sacrificed.',
 'A supervisor asks for 20 leads but only 14 meet the verification threshold. What do you report?',
 'How do you document the time and evidence spent on a record that still needs verification?'),
 L('res-06','Research certification simulation and escalation','Complete an end-to-end independent research handoff without live customer mutation.',[
  'A production researcher can locate, distinguish, verify, deduplicate and annotate a business lead without misrepresenting anything.',
  'Research reports must withstand a skeptical caller’s review: credible source, accurate public contact, business fit, need hypothesis and follow-up recommendation.',
  'Show sound judgment on no-contact flags, ambiguous phone numbers, address mismatches, corrupt input and role failures.',
  'Certification is owner-reviewed. Completing or listening to lessons alone does not grant caller access or owner privileges.'
 ],'Complete a five-lead mock batch with a duplicate, a corrupt name, an uncertain business number and two clean leads; demonstrate which two can be handed to sales and why.',
 'Submit a final mini-batch summary with source links, verification status, exclusions, risks and suggested next action.',
 'When is a record ready for sales, and how should a researcher present unresolved problems?',
 'Only evidence-backed, properly scoped and non-suppressed leads are ready. All uncertainties are explicit.',
 'Create a complete caller handoff for one safe fictional lead.',
 'Explain how you would handle an improperly imported binary document entry without deleting it.')
]);
const caller=C('sbc-caller-mastery-202611','Sales Caller Academy 2026 — Production Mastery','caller',
 'Part 2 of the required 12-hour path: six 60-minute realistic calling, discovery, compliance and CRM reporting modules.',[
 L('call-01','test1 desk: call readiness and the daily shift','Navigate the caller workspace, assigned leads, Twilio dialer and 4/6-hour task plan accurately.',[
  'Sign in with the caller account; review Needs Attention, Today’s Tasks, My Assigned Leads, My Calling Desk, Sales Scripts, Training and official Time Clock.',
  'Four- and six-hour shift templates are guidance only. Clock-in must be recorded in the official Time Clock; checking tasks is not a payroll entry.',
  'The dialer shows only assigned prospects. Check lead details and calling clearance BEFORE a manually initiated Twilio call. The keypad uses tones only after connection.',
  'Switch the whole workspace between English and Español in the header. Customer details, pricing and CRM outcomes remain their original stored values.',
  'Use sbcmia.com and sbcwebsites.com as public reference sites when answering product questions; these links do not grant special access.',
  'Failure to load Twilio, missing authorization or no verified phone is STOP AND REPORT, not a reason to manually bypass the caller desk.'
 ],'Walk through a simulated assigned lead and name each control needed before calling. Demonstrate language switch and a 4-hour versus 6-hour plan without placing a real call.',
 'Write the approved pre-call checklist and what should appear in the call notes for a failed dial.',
 'What three independent conditions must be true before making a live call?',
 'Requires role clearance, active time clock, approved assigned and callable lead, and working Twilio; no bypass.',
 'The keypad shows a number but calling clearance says Not Approved. What do you do?',
 'The dialer does not load; a coworker suggests using a personal phone and writing notes later. Respond.'),
 L('call-02','Elite SBC opening, trust and relevance','Start a truthful, concise conversation using the new 33-scenario bilingual playbook.',[
  'Lead with your real full name, Successful By Choice and a concrete reason for calling. Do not claim to be Google, GoDaddy, an existing partner or a friend.',
  'Use the script as a talking point, not as robotic copy. The goal is permission for a useful question, not a rushed package pitch.',
  'Only use a personalized observation if the researcher verified it; otherwise use the honest generic local-business opening.',
  'Choose the appropriate sector talk track for barbers, salons, restaurants, contractors, retailers or dealers. The first question should fit the customer’s business.',
  'Listen carefully, take notes, and stop promptly if the prospect declines, sounds uncomfortable or asks not to be called again.',
  'Practice the English and Spanish scripts only within your language proficiency. If unable to serve the customer accurately, escalate or request reassignment.'
 ],'Practice three 30-second conversations: a busy barber, a café owner and an assistant screening calls. Alternate roles; use fact-checked context and polite exits.',
 'Submit three openers, one discovery question each, and a reflection identifying where you listened instead of reading.',
 'How do you open a call without disguising the purpose or inventing a referral?',
 'Includes full name/SBC, reason for calling, relevance, honest permission and respect for refusal.',
 'A prospect asks “Are you from Google?” Show a truthful 10-second reply.',
 'The researcher found no specific opportunity. Should you claim you audited the website? Explain.'),
 L('call-03','Discovery, qualification and correct service recommendation','Find one actual need before suggesting the right SBC offer.',[
  'Ask how customers discover the business, where inquiries are lost, what improvement matters and whether the owner wants to address it now.',
  'Separate a public opportunity hypothesis from the prospect’s actual words. Confirm both separately in notes.',
  'Map need to approved offers: basic visibility vs simple website vs printing, email, managed WordPress, e-commerce, Office Box or custom services.',
  'Use published $99/$199 entry prices only with current scope checked; escalate exact deliverables, renewal, custom plan, tax/shipping and discount requests.',
  'Qualification includes buyer interest, owner/decision-maker, preferred contact method and explicit consent for next action; never make up intent from a Hot lead score.'
 ],'Practice two fictional calls—one small visibility request, one multi-service launch. Use question-first discovery and suggest one package or owner quote, not every product.',
 'Write a sample CRM report that distinguishes verified business fact, prospect need and next step.',
 'What details should be collected before recommending a $199 starter rather than a custom quote?',
 'Needs-based fit, actual customer intent, first-year vs renewal explanation and owner confirmation where needed.',
 'A customer asks for $199 Starter plus unlimited online store setup. How do you handle scope?',
 'A lead says they might be interested in printing in six months. What should be recorded?'),
 L('call-04','Handle objections and protect customer consent','Respond to price and timing objections with integrity and stop on opt-outs.',[
  'When someone says “too expensive,” ask what would be useful or within budget; do not invent discounts or pressure them into a payment.',
  'If they already have a provider, acknowledge it and ask whether they need an improvement. If not, close politely.',
  'If they are busy, offer to end. A callback is only scheduled if the prospect actually requests and agrees to it.',
  'If they say “send information,” ask what specific topic and preferred authorized channel; never assume consent to text or start a drip campaign.',
  'If they request no further calls, immediately stop pitching, mark the Do Not Call outcome and escalate suppression. Do not retry from another number.',
  'Call lawful hours and outreach eligibility depend on destination, solicitation type, consent and applicable FTC/FCC/Florida requirements; the owner must confirm compliance decisions and any necessary registrations.'
 ],'Role-play six objection cards, including a do-not-call request and a website owner who needs nothing. End every scenario with an honest report outcome.',
 'Record decision notes and an appropriate follow-up or suppression choice for all six cases.',
 'Can a “send me information” response be treated as permission for repeated calls or texts?',
 'No; obtain channel-specific permission and record the actual request, or do not send.',
 'The prospect requests removal after you begin the pricing pitch. What exactly do you do?',
 'A client declines three times. Should a caller keep asking a closing question? Explain.'),
 L('call-05','Accurate call reports and owner-only quote/payment handoff','Document real outcomes in the correct CRM fields and keep payments owner-governed.',[
  'After each conversation select the factual result: No Answer, Voicemail, Conversation, Interested, Appointment Requested, Follow-up Requested, Not Interested or Do Not Call.',
  'Record contact person if supplied, customer’s exact need, objections, source discrepancies and actual permission for follow-up. Use a callback time only when explicitly agreed.',
  'A call report is not a sale, payment, customer approval or quote. Do not edit payment status, merchant settings, Office Box entitlement or vendor jobs.',
  'A confirmed prospect need is handed to the owner with a concise request and a suggested package, not a promise to deliver or a claim that Square captured funds.',
  'If real price, shipping or renewals differ from a script, stop quoting and ask the owner. Do not collect card data in notes.'
 ],'Complete three sample call reports: no answer, interested with agreed follow-up, and Do Not Call. Then draft one owner escalation for a package exception.',
 'Provide expected outcome, contact detail, clear note and authorization status for each example.',
 'What distinguishes Interest from a Won/Paid order?',
 'Interest is conversation status; paid requires provider-confirmed, order-linked payment and owner-controlled fulfillment.',
 'Someone agrees to receive a quote but has not paid. Which CRM outcome is appropriate and why?',
 'A customer dictates their card number. What should the caller say and avoid recording?'),
 L('call-06','Sales certification simulation and first-week coaching','Demonstrate a complete, safe discovery and handoff before owner authorizes live calling.',[
  'Show the full cycle: qualify assigned lead → confirm call eligibility → honest introduction → discover one need → propose the relevant next step → record accurate CRM results.',
  'A successful call can end in a consented appointment, a polite rejection or a correctly documented Do Not Call. Never score fabricated activity as performance.',
  'Staff may complete Academy learning but live calling clearance, certification and any escalated transaction still require separate owner-controlled approval.',
  'Use the 33-scenario playbook to coach improvement; repeat role-plays after feedback and escalate unclear script or policy changes.',
  'First week after onboarding: collect call-quality feedback from the owner; monitor real contact rates, complete records and consent compliance—not just call counts.'
 ],'Perform a full 10-minute mock call with a skeptical restaurant owner: the owner voices objections, changes topic and requests follow-up. Record a complete simulated CRM outcome, then redo the weak moment.',
 'Submit the rubric: identity/reason, discovery, truthful offer, DNC awareness, CRM evidence, owner handoff and next coaching action.',
 'Which actions can you execute without owner clearance, and which must remain blocked?',
 'Distinguishes permitted assigned calling and documentation from pricing exceptions, payment/fulfillment and tenant access.',
 'Show how you would handle a false promise accidentally made to a prospect.',
 'Write a short post-call owner report that would allow a safe, useful follow-up.')
]);
const COURSES=[shared,research,caller];
const CURRENT_IDS=new Set(COURSES.map(c=>c.id));
function validate(){
 const errors=[];
 const ids=new Set(),mods=new Set();
 for(const c of COURSES){
  if(ids.has(c.id))errors.push('duplicate course '+c.id);ids.add(c.id);
  if(c.modules.length!==6)errors.push('course module count '+c.id);
  if(c.estimatedMinutes!==360)errors.push('course estimated minutes '+c.id);
  for(const m of c.modules){
   if(mods.has(m.id))errors.push('duplicate module '+m.id);mods.add(m.id);
   if(m.minutes!==60||m.lesson.learn.length<5||!m.lesson.practice.prompt||!m.lesson.practice.evidence||!m.lesson.knowledgeCheck.passingRule||m.assessment.questions.length!==2)errors.push('incomplete teaching '+m.id);
  }
 }
 return {ok:!errors.length,errors,courseCount:COURSES.length,lessonCount:mods.size,hoursPerEmployee:12};
}
function install(s,normalizeCourse,clock=()=>new Date().toISOString()){
 if(!s||!Array.isArray(s.courses)||typeof normalizeCourse!=='function')throw Error('SBC Elite Academy: invalid catalog state');
 let changed=false;
 s.migration=s.migration||{};
 for(const c of COURSES){
  if(!s.courses.some(x=>x.id===c.id)){
   s.courses.push(normalizeCourse(c,'SBC V66.107 Elite Academy'));
   changed=true;
  }
 }
 for(const c of s.courses){
  if(BUILT_INS_TO_ARCHIVE.has(c.id)&&c.status==='published'){
   c.status='archived';c.archivedAt=c.archivedAt||clock();changed=true;
  }
 }
 if(!s.migration.elite2026Applied){
  s.migration.elite2026Applied=true;
  s.migration.elite2026Version=VERSION;
  changed=true;
 }
 if(changed){
  s.migration.elite2026PendingSave=true;
  s.migration.elite2026AppliedAt=s.migration.elite2026AppliedAt||clock();
  s.updatedAt=clock();
 }
 return changed;
}
module.exports={VERSION,COURSES,CURRENT_IDS,BUILT_INS_TO_ARCHIVE,install,validate};
