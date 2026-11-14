'use strict';
// Full, responsive prospect websites—not screenshots. No AI credits, external
// API calls, real contact submissions, fake testimonials or made-up credentials.
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const text=(v,max=160)=>String(v??'').trim().slice(0,max);
const EXPERIENCE=require('./sbc-prospect-site-experience-v2.cjs');
const palettes=[
 {match:/window tint|auto tint|car tint|tinting|window film/i,label:'WINDOW FILM & TINT',ink:'#101721',p:'#24a8ba',soft:'#e8f6fa',hero:'Shade. Style. A new perspective.',category:'tint'},
 {match:/auto|mechanic|tire|detailing|collision|body shop|car wash/i,label:'AUTOMOTIVE',ink:'#0b1426',p:'#d84829',soft:'#fff1e8',hero:'precision in every detail',category:'automotive'},
 {match:/salon|beauty|barber|spa|lash|nail|hair/i,label:'BEAUTY & CARE',ink:'#251824',p:'#a44f83',soft:'#fff0f8',hero:'a beautiful experience starts here',category:'beauty'},
 {match:/restaurant|cafe|bakery|catering|kitchen|food|grill/i,label:'DINING & FOOD',ink:'#242015',p:'#a97625',soft:'#faf2e4',hero:'good taste deserves a great first impression',category:'dining'},
 {match:/roof|plumb|electric|construction|contractor|handyman|hvac|landscap|lawn|clean|pool/i,label:'HOME & FIELD SERVICES',ink:'#102f2b',p:'#22796b',soft:'#eaf8f3',hero:'a better way to get the job done',category:'trades'},
 {match:/law|legal|attorney|notary|insurance|tax|account|finance/i,label:'PROFESSIONAL SERVICES',ink:'#1b2c46',p:'#bb8843',soft:'#f8f2e8',hero:'professional service, presented with confidence',category:'professional'}
];
const generic={label:'LOCAL BUSINESS',ink:'#16283f',p:'#416fbb',soft:'#eef4ff',hero:'local excellence, beautifully presented',category:'local'};
const serviceNames={
 tint:['Tint consultation','Window film options','Care and maintenance','Request a tint estimate'],
 automotive:['Services & maintenance','Detailing & care','Request an estimate','Why choose this business'],
 beauty:['Treatments & services','Appointment experience','Personalized consultation','Discover the studio'],
 dining:['Explore the menu','Visit & discover','Special occasions','Get in touch'],
 trades:['Core services','Projects & expertise','Request an estimate','Service area'],
 professional:['Professional services','How we work','Book a consultation','Your next step'],
 local:['What we do','Our approach','Request a quote','Get in touch']
};
const faqs={
 tint:[['What tint options are available?','Film types, shade levels and availability are confirmed directly with the business.'],['How do I request an estimate?','Contact details and the approved inquiry process are connected before the website launches.']],
 automotive:[['Can I request an estimate?','Yes—this finished site will link to the business’s approved estimate process after launch.'],['How can I schedule service?','Scheduling information and availability are added during client onboarding.']],
 beauty:[['How do I book?','Approved booking links and current availability are added before the website goes live.'],['Are service prices listed?','The owner can supply a current service menu and prices during onboarding.']],
 dining:[['Can I view a menu?','An approved menu can be published after the business confirms items and pricing.'],['Where is the restaurant?','The verified location and operating hours are added before launch.']],
 trades:[['What areas do you serve?','The verified service areas are added when the business approves this website.'],['Can I request a quote?','Yes. The finished site will connect to the company’s preferred inquiry process.']],
 professional:[['How do I get started?','The approved consultation or intake details are added during onboarding.'],['Can I speak with your team?','The verified contact details will be published after the business approves the website.']],
 local:[['How do I get started?','Contact and appointment details will be confirmed before launch.'],['Can I ask a question?','Yes. The approved inquiry process is added before launch.']]
};
/* Curated Unsplash stock references: illustrative, never represented as the prospect's photos.
   Owner verifies image/person/property rights before public launch. No paid API or AI. */
const stockPhotos={
 beauty:[
 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1400&q=78',
 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1100&q=76',
 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1100&q=76'],
 automotive:[
 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=78',
 'https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1100&q=76',
 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1100&q=76'],
 dining:[
 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=78',
 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1100&q=76',
 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1100&q=76'],
 trades:[
 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1400&q=78',
 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1100&q=76',
 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1100&q=76'],
 professional:[
 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=78',
 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1100&q=76',
 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1100&q=76'],
 local:[
 'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1400&q=78',
 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1100&q=76',
 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1100&q=76']
};
// No generative API needed: stable client-specific art direction within each
// industry, never a random theme that changes after a refresh.
stockPhotos.tint=stockPhotos.automotive;
const creativeCopy=Object.freeze({
 tint:{headline:'Your ride. A sharper look.',description:'Explore a modern window-tinting concept with film options, vehicle-focused visuals and a simple path to ask about a tint project. All products and claims require owner confirmation.',servicesTitle:'Explore your tint project',services:['Start with a conversation about your vehicle, preferred appearance and practical needs.','See where approved film types, shade choices and product details will appear after confirmation.','Give drivers a clear place to review approved film-care instructions and appointment details.','Make it easy to request pricing once the business connects its verified estimate process.'],journey:['Tell us about your vehicle','Review confirmed film options','Request an approved estimate']},
 automotive:{headline:'Confidence starts with the details.',description:'A vehicle-service website concept designed to make information clear and connect drivers with the right next step.',servicesTitle:'Explore vehicle services',services:['Introduce verified maintenance and repair work by vehicle or service need.','Explain how customers can discuss symptoms, timing and available service options.','Show approved inspection or estimate procedures before a customer books.','Help visitors find accurate contact details and next steps.'],journey:['Describe your vehicle','Explore confirmed services','Contact the shop']},
 beauty:{headline:'Your next look begins here.',description:'An editorial studio concept centered on approved treatments, style inspiration and a calm appointment journey.',servicesTitle:'Discover your studio experience',services:['Present confirmed treatments in a clear, browsable format.','Help visitors explore approved looks and service details.','Show the actual appointment process once confirmed by the studio.','Introduce the team and consultation experience using approved information.'],journey:['Explore treatments','Choose your style','Request an appointment']},
 dining:{headline:'An appetite for something special.',description:'A food-forward website concept with space for an approved menu, inviting photography and easy directions.',servicesTitle:'Explore the dining experience',services:['Feature verified dishes and menu categories with owner-approved descriptions.','Explain dining, takeaway or catering options only when available.','Show approved hours, location and reservation details.','Give guests a clear way to ask about their visit.'],journey:['Browse the approved menu','Plan your visit','Get in touch']},
 trades:{headline:'Made for the work that matters.',description:'An organized service-business concept that makes projects, service areas and estimate requests easy to explore.',servicesTitle:'Explore the service experience',services:['Display verified services and project types with straightforward explanations.','Describe the approved estimate process and what clients should prepare.','Show confirmed service areas and availability.','Present real project examples only when approved by the business.'],journey:['Describe your project','Confirm service coverage','Request an estimate']},
 professional:{headline:'Clarity makes the difference.',description:'An authoritative, approachable concept for introducing verified expertise, services and client intake.',servicesTitle:'Explore professional services',services:['Explain confirmed practice or service areas in plain language.','Describe the consultation and onboarding process after approval.','Make verified credentials, contact information and disclosures easy to find.','Guide visitors to the approved intake process.'],journey:['Review services','Understand the process','Request a consultation']},
 local:{headline:'Built around your next step.',description:'A flexible concept that will present real services, images and business details once the owner has approved them.',servicesTitle:'Explore what is possible',services:['Introduce what the business provides once the owner confirms it.','Explain the customer experience with accurate and approved details.','Make it easy to learn about available services and pricing.','Connect visitors to an approved contact or booking channel.'],journey:['Explore the business','Review confirmed services','Get in touch']}
});
const artDirections=Object.freeze({
 tint:[{ink:'#09131c',p:'#18a2b8',soft:'#e8f7f9'},{ink:'#15191f',p:'#dd6538',soft:'#f8eee7'},{ink:'#101925',p:'#c2a36c',soft:'#f8f3e7'}],
 automotive:[{ink:'#0b1426',p:'#d84829',soft:'#fff1e8'},{ink:'#142530',p:'#177d89',soft:'#ecf9f9'},{ink:'#191b25',p:'#ac5e22',soft:'#fff2e5'}],
 beauty:[{ink:'#251824',p:'#a44f83',soft:'#fff0f8'},{ink:'#1f2632',p:'#925c69',soft:'#f9eff0'},{ink:'#25302b',p:'#6b7760',soft:'#f1f5eb'}],
 dining:[{ink:'#242015',p:'#a97625',soft:'#faf2e4'},{ink:'#29211d',p:'#ac4f31',soft:'#fcf1e8'},{ink:'#162b28',p:'#5b8066',soft:'#eaf4eb'}],
 trades:[{ink:'#102f2b',p:'#22796b',soft:'#eaf8f3'},{ink:'#1b293a',p:'#496ca3',soft:'#eef3fd'},{ink:'#2a2922',p:'#9a7139',soft:'#faf2e5'}],
 professional:[{ink:'#1b2c46',p:'#bb8843',soft:'#f8f2e8'},{ink:'#1e3134',p:'#467b79',soft:'#edf8f4'},{ink:'#332a39',p:'#916384',soft:'#faf0f7'}],
 local:[{ink:'#16283f',p:'#416fbb',soft:'#eef4ff'},{ink:'#24332d',p:'#4c896d',soft:'#eaf7ee'},{ink:'#292437',p:'#9a619b',soft:'#f9effb'}]
});
function stableDesignIndex(business){
 let hash=2166136261;
 for(const ch of String(business||'').trim().toLowerCase()){
  hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619);
 }
 return (hash>>>0)%3;
}
const allowed=new Set(['home','services','about','contact']);
function define(demo,opts={}) {
 const customer=demo?.customer||{};
 const business=text(customer.businessName||customer.contactName||demo?.businessName||'Your Business',100);
 const industry=text(demo?.industry||customer.industry||'Local Business',100);
 const baseStyle=palettes.find(x=>x.match.test(industry))||generic;
 const edits=demo?.siteEdits&&typeof demo.siteEdits==='object'&&!Array.isArray(demo.siteEdits)?demo.siteEdits:{};
 const choice=Number.isInteger(edits.themeVariant)&&edits.themeVariant>=1&&edits.themeVariant<=3?edits.themeVariant-1:null;
 const designIndex=choice===null?stableDesignIndex(business):choice;
 const style={...baseStyle,...artDirections[baseStyle.category][designIndex]};
 const designVariant=baseStyle.category+'-'+(designIndex+1);
 const tier=['starter','essentials'].includes(String(demo?.offerTier))?demo.offerTier:'essentials';
 const slug=String(demo?.slug||'').replace(/[^a-z0-9-]/gi,'').slice(0,90);
 const slugId=String(demo?.id||'').replace(/[^a-z0-9_-]/gi,'').slice(0,100);
 const approved=demo?.status==='Approved';
 const prefix=opts.staticMode?'':(approved?'/demo/'+slug:'/api/website-demos/'+slugId+'/preview');
 const title=esc(business),safeIndustry=esc(industry);
 const rawCity=text(customer.city||'',70),city=rawCity?esc(rawCity):'your community';
 const facts=EXPERIENCE.verifiedFacts(demo);
 const layout=EXPERIENCE.archetype(style.category==='tint'?'automotive':style.category);
 const names=Array.isArray(edits.services)&&edits.services.length?edits.services:(facts?.services.length?facts.services:(serviceNames[style.category]||serviceNames.local));
 const questions=faqs[style.category]||faqs.local;
 const defaultPhotos=stockPhotos[style.category]||stockPhotos.local;
 const images=defaultPhotos.slice(designIndex).concat(defaultPhotos.slice(0,designIndex));
 const model={business,title,industry,safeIndustry,style,designVariant,edits,tier,prefix,city,rawCity,layout,facts,names,questions,approved,slug,images,creative:creativeCopy[style.category]||creativeCopy.local,staticMode:opts.staticMode===true};
 model.publicationReady=EXPERIENCE.publicReleaseReady(model,opts);
 return model;
}
const anchor=(model,page,fragment='')=>model.staticMode
 ? (model.tier==='starter'?'index.html'+(fragment?'#'+fragment:''):(page==='home'?'index.html':page+'.html')+(fragment?'#'+fragment:''))
 : model.prefix+(model.tier==='starter'?(fragment?'#'+fragment:''):(page==='home'?'':'?page='+encodeURIComponent(page))+(fragment?'#'+fragment:''));
const symbol=(n)=>({arrow:'↗',check:'✓',spark:'✦',menu:'☰',phone:'↗'})[n]||'✦';
function heroVisual(model){
 const s=model.style;
 return '<div class="hero-art"><div class="art-stage">'+
 '<img class="art-photo" src="'+esc(model.images[0])+'" alt="Example stock photo for '+model.safeIndustry+' — not a photo of '+model.title+'" loading="eager" decoding="async" fetchpriority="high" width="1400" height="1000">'+
 '<span class="sample-photo-label">EXAMPLE STOCK PHOTO · REPLACE WITH YOUR IMAGES</span>'+
 '<span class="art-kicker">'+esc(s.label)+'</span><div class="art-shape art-shape-a" aria-hidden="true"></div><div class="art-shape art-shape-b" aria-hidden="true"></div>'+
 '<div class="art-card"><span class="art-line">YOUR BUSINESS · YOUR FUTURE WEBSITE</span><strong>'+model.title+'</strong><span>EXAMPLE DESIGN · FINAL DETAILS CUSTOMIZED</span></div></div>'+
 '<div class="art-foot"><span>VISUAL DIRECTION / 01</span><span>ILLUSTRATIVE PHOTOGRAPHY</span></div></div>';
}
function navigation(m,page){
 const navs=m.tier==='starter'?[['home','Home'],['services','Services'],['about','About'],['contact','Contact']]:[['home','Home'],['services','Services'],['about','About'],['contact','Contact']];
 const links=navs.map(([key,label])=>'<a href="'+esc(anchor(m,key,m.tier==='starter'&&key!=='home'?key:''))+'"'+(page===key?' aria-current="page"':'')+'>'+label+'</a>').join('');
 return '<header class="nav" id="top"><div class="nav-inner">'+
 '<a class="brand" href="'+esc(anchor(m,'home'))+'"><span class="brand-mark">'+symbol('spark')+'</span><span>'+m.title+'</span></a>'+
 '<button class="mobile-toggle" aria-controls="siteNavigation" aria-expanded="false" type="button" aria-label="Toggle navigation">'+symbol('menu')+'</button>'+
 '<nav id="siteNavigation" aria-label="Primary navigation">'+links+'</nav>'+
 '<a class="nav-cta" href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'">Let’s connect <span aria-hidden="true">'+symbol('arrow')+'</span></a>'+
 '</div></header>';
}
function sectionHeading(kicker,title,desc){
 return '<div class="section-heading"><p class="kicker">'+esc(kicker)+'</p><h2>'+esc(title)+'</h2><p class="section-sub">'+esc(desc)+'</p></div>';
}
function interiorVisual(m){
 return '<figure class="interior-example sbc-reveal">'+
 '<img src="'+esc(m.images[1])+'" alt="Example stock photo for '+m.safeIndustry+' — not a photo of '+m.title+'" loading="lazy" decoding="async" width="1100" height="825">'+
 '<figcaption>Example stock photo · Concept imagery, not this business</figcaption></figure>';
}
function voiceAction(m){
 const narration='Welcome to '+m.business+'. This is an example website for the business. See how services, example images and a clear contact page can look. The final details and photos are personalized after purchase and approval.';
 return '<div class="site-voice"><button type="button" class="site-voice-button" data-site-voice="'+esc(narration)+'" aria-label="Play example spoken website welcome">▶ Hear a sample welcome</button>'+
 '<span class="site-voice-status" data-site-voice-state aria-live="polite">Optional voice preview · no audio starts automatically</span></div>';
}
function visualGallery(m){
 const photos=m.images.map((url,i)=>'<figure class="sample-gallery-card sbc-reveal">'+
 '<img src="'+esc(url)+'" loading="lazy" decoding="async" width="1100" height="825" alt="Example stock photo '+(i+1)+' for '+m.safeIndustry+' — not a photo of '+m.title+'">'+
 '<figcaption><strong>EXAMPLE '+String(i+1).padStart(2,'0')+'</strong><span>Stock photo · replace during onboarding</span></figcaption></figure>').join('');
 return '<section class="section sample-gallery" aria-label="Sample gallery"><div class="container">'+
 sectionHeading('SAMPLE GALLERY / CREATIVE DIRECTION','The look. The feel. The possibilities.','These are example stock photos—not photos of this business. Replace them with approved photos during onboarding.')+
 '<div class="sample-gallery-grid">'+photos+'</div></div></section>';
}
function videoExperience(m){
 const player=m.staticMode
 ? '<div class="site-film-placeholder" role="img" aria-label="Example video placeholder for final customer media">VIDEO PREVIEW · ADD YOUR APPROVED CLIP AT LAUNCH</div>'
 : '<video class="sbc-site-film" controls muted playsinline loop preload="none" poster="'+esc(m.images[1])+'" aria-label="Sample video, not footage of this business"><source src="/demo-media/sbc-motion.mp4" type="video/mp4">Video preview unavailable on this browser.</video>';
 return '<section class="section sample-video-section" aria-label="Sample video"><div class="container sample-video-grid"><div class="sample-video-copy sbc-reveal"><p class="kicker">MOTION / SAMPLE VIDEO</p><h2>More than a website. <em>An experience.</em></h2><p>A short motion example shows how video could bring the brand to life. This is a demonstration, not footage of '+m.title+'. Final approved footage can replace it.</p><span class="video-sample-note">Sample video · Play only when selected · No autoplay sound</span></div><div class="site-film-frame sbc-reveal">'+player+'<span class="sample-video-badge">SAMPLE VIDEO · NOT THE REAL BUSINESS</span></div></div></section>';
}
function services(m,full=false){
 const s=m.names.slice(0,full?4:3);
 const cards=s.map((name,index)=>'<article class="service-card"><div class="service-counter">0'+(index+1)+' / '+esc(m.style.label)+'</div>'+
 '<div class="service-shape service-shape-'+(index%3)+'" aria-hidden="true"></div>'+
 '<h3>'+esc(name)+'</h3><p>'+esc(m.creative.services[index]||'The owner can add verified details for this service before publication.')+'</p>'+
 '<a href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'" class="text-link">Explore the next step <span aria-hidden="true">↗</span></a></article>').join('');
 return '<section class="section section-cream" id="services"><div class="container">'+sectionHeading('01 / WHAT WE DO',m.creative.servicesTitle,'A purpose-built website concept. Actual offerings are confirmed with the business before launch.')+'<div class="service-grid">'+cards+'</div></div></section>';
}
function why(m){
 return '<section class="section contrast" id="about"><div class="container split"><div><p class="kicker light">02 / A BETTER FIRST IMPRESSION</p><h2 class="display">Built around <em>your</em> business.</h2><p class="contrast-copy">'+esc(m.edits.about||'A website should make the right introduction before someone ever picks up the phone. This design creates a polished, clear experience from the first scroll to the final step.')+'</p>'+
 '<a class="button button-outline" href="'+esc(anchor(m,'about',m.tier==='starter'?'about':''))+'">Get to know us <span aria-hidden="true">↗</span></a></div>'+
 '<div class="value-stack"><div class="value-item"><strong>01</strong><div><h3>Designed for real visitors</h3><p>Easy navigation, readable content, and mobile-first layouts.</p></div></div>'+
 '<div class="value-item"><strong>02</strong><div><h3>Clear from the first click</h3><p>Highlights, services, and next steps that are easy to find.</p></div></div>'+
 '<div class="value-item"><strong>03</strong><div><h3>Ready for your final details</h3><p>Add verified contact information, approved service text, and branding before launch.</p></div></div></div></div></section>';
}
function how(m){
 return '<section class="section"><div class="container">'+sectionHeading('03 / SIMPLE BY DESIGN','A clear path, start to finish','A natural journey that helps visitors know what comes next.')+
 '<div class="steps">'+m.creative.journey.map((step,i)=>'<div><span>STEP 0'+(i+1)+'</span><h3>'+esc(step)+'</h3><p>'+esc(i===2?'The approved booking or contact channel is connected before launch.':'Details are personalized with verified customer-approved information.')+'</p></div>').join('')+'</div></div></section>';
}
function faqsBlock(m){
 return '<section class="section section-cream" id="faq"><div class="container narrow">'+sectionHeading('04 / GOOD TO KNOW','Frequently asked questions','Useful answers without guessing about a business’s operations.')+
 '<div class="faqs">'+m.questions.map(q=>'<details><summary>'+esc(q[0])+'<span aria-hidden="true">+</span></summary><p>'+esc(q[1])+'</p></details>').join('')+'</div></div></section>';
}
function callout(m){
 return '<section class="cta-section" id="contact"><div class="container cta-inner"><p class="kicker light">LET’S MAKE THIS YOURS</p><h2>Make a great first<br><em>impression.</em></h2><p>The structure and design are ready. Final contact details, service details, and approved business information are completed before launch.</p><a class="button button-light" href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'">Contact information <span>↗</span></a></div></section>';
}
function home(m){
 return '<main id="main"><section class="hero"><div class="container hero-grid"><div class="hero-copy"><p class="kicker">'+esc(m.style.label)+' / DIGITAL EXPERIENCE</p><h1>'+esc(m.edits.headline||m.business)+'<span class="hero-period">.</span></h1><p class="hero-lede">'+esc(m.creative.headline)+'.</p><p class="hero-desc">'+esc(m.edits.subheadline||m.creative.description)+'</p>'+
 '<div class="hero-buttons"><a class="button button-main" href="'+esc(anchor(m,'services',m.tier==='starter'?'services':''))+'">Explore services <span>↗</span></a><a class="button button-ghost" href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'">Get in touch</a></div>'+voiceAction(m)+'<div class="hero-caption"><span>RESPONSIVE</span><i></i><span>CLEAR</span><i></i><span>CRAFTED WITH CARE</span></div></div>'+heroVisual(m)+'</div></section>'+
 '<div class="marquee" aria-hidden="true"><div class="container marquee-inner"><span>DESIGNED FOR THE WAY PEOPLE BROWSE</span><span>✦</span><span>BUILT TO MAKE A LASTING IMPRESSION</span><span>✦</span><span>MADE FOR YOUR NEXT CHAPTER</span></div></div>'+
 EXPERIENCE.industryPanel(m)+services(m)+(m.edits.showGallery===false?'':visualGallery(m))+why(m)+(m.edits.showVideo===false?'':videoExperience(m))+how(m)+(m.edits.showFaq===false?'':faqsBlock(m))+callout(m)+'</main>';
}
function servicesPage(m){
 return '<main id="main"><section class="interior-hero"><div class="container"><p class="kicker">'+esc(m.style.label)+' / SERVICES</p><h1>What we <em>offer.</em></h1><p>Explore the services and experiences this business could present online. Final descriptions are confirmed with the owner before launch.</p>'+interiorVisual(m)+'</div></section>'+services(m,true)+visualGallery(m)+how(m)+callout(m)+'</main>';
}
function aboutPage(m){
 return '<main id="main"><section class="interior-hero"><div class="container"><p class="kicker">ABOUT / OUR STORY</p><h1>More than a <em>first impression.</em></h1><p>A business deserves a digital home with personality and purpose. This page is ready for the owner’s real history, photos, credentials, and team information.</p>'+interiorVisual(m)+'</div></section>'+
 why(m)+'<section class="section"><div class="container">'+sectionHeading('YOUR STORY','There is a story behind every great business','A space for the details that make your company unique.')+
 '<div class="story-block"><div class="story-art" aria-hidden="true"><span>YOUR STORY</span><strong>01 — THE BEGINNING</strong></div><div><p class="kicker">ABOUT THE BUSINESS</p><h3>Made for your people.</h3><p>This section is thoughtfully structured for the real founder story, service philosophy, values, and team. It becomes truly yours once the business confirms its details.</p><p class="info-label">CUSTOMIZE BEFORE LAUNCH: OWNER STORY, TEAM, PHOTOS, CREDENTIALS</p></div></div></div></section>'+callout(m)+'</main>';
}
function contactPage(m){
 return '<main id="main"><section class="interior-hero"><div class="container"><p class="kicker">CONTACT / NEXT STEPS</p><h1>Start the <em>conversation.</em></h1><p>Everything visitors need to take the next step—ready to connect to approved contact details and inquiry methods after launch.</p>'+interiorVisual(m)+'</div></section>'+
 '<section class="section"><div class="container contact-grid"><div>'+sectionHeading('GET IN TOUCH','We would love to hear from you','Final business phone, email, hours, and location are entered after owner confirmation.')+
 ''+EXPERIENCE.contactDetails(m)+'</div>'+
 '<div class="contact-panel"><p class="kicker">WEBSITE CONCEPT · FORM PREVIEW</p><h3>Tell us what you need.</h3><p>This polished inquiry form is a demonstration. It does not submit, save, or transmit any visitor data until the owner approves a live website.</p>'+
 '<form class="demo-form" data-demo-form><label>Your name <input placeholder="Your full name" name="name" autocomplete="off"></label><label>Email <input type="email" placeholder="name@example.com" name="email" autocomplete="off"></label><label>How can we help? <textarea name="message" placeholder="Tell us a little about your project" rows="5"></textarea></label><button type="submit" class="button button-main">Preview inquiry <span>↗</span></button><p class="form-feedback" role="status" aria-live="polite">Demo only — no information is collected or sent.</p></form></div></div></section>'+callout(m)+'</main>';
}
function renderPage(demo,page='home',options={}){
 const m=define(demo,options),requested=String(page||'home').trim().toLowerCase();
 if(!allowed.has(requested))throw Object.assign(new Error('SITE_PAGE_NOT_FOUND'),{status:404});
 if(m.tier==='starter' && requested!=='home')throw Object.assign(new Error('STARTER_SINGLE_PAGE_ONLY'),{status:404});
 const safeTitle=requested==='home'?m.title:esc(requested.charAt(0).toUpperCase()+requested.slice(1))+' | '+m.title;
 const tagline=EXPERIENCE.description(m);
 const head='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="robots" content="'+(m.publicationReady?'index,follow':'noindex,nofollow,noarchive')+'"><meta name="referrer" content="no-referrer">'+
 '<meta name="description" content="'+esc(tagline)+'"><title>'+safeTitle+'</title>'+
 EXPERIENCE.schema(m)+'<link rel="stylesheet" href="'+(m.staticMode?'site.css':'/sbc-prospect-site.css')+'">';
 const body=requested==='home'?home(m):requested==='services'?servicesPage(m):requested==='about'?aboutPage(m):contactPage(m);
 const foot='<footer class="footer"><div class="container"><div><a class="footer-brand" href="'+esc(anchor(m,'home'))+'">'+m.title+'</a><p>Made for the people who matter most—your customers.</p></div><div><span>EXPLORE</span><a href="'+esc(anchor(m,'services',m.tier==='starter'?'services':''))+'">Services</a><a href="'+esc(anchor(m,'about',m.tier==='starter'?'about':''))+'">About</a><a href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'">Contact</a></div><div><span>WEBSITE CONCEPT</span><p>Created by Successful By Choice</p><p>Details &amp; imagery to be approved before launch.</p></div></div><div class="container footer-bottom"><span>Website concept © '+new Date().getFullYear()+'</span><span>Built to become yours.</span></div></footer>';
 const banner='<div class="preview-banner" role="note"><div class="container"><strong>Website concept preview</strong><span>Fully navigable design · Business details finalized after purchase · Not an official live business website</span></div></div>';
 return '<!doctype html><html lang="en"><head>'+head+'</head><body data-sbc-layout="'+m.layout+'" data-sbc-design-variant="'+esc(m.designVariant)+'" style="--site-ink:'+m.style.ink+';--site-primary:'+m.style.p+';--site-soft:'+m.style.soft+'"><a class="skip-link" href="#main">Skip to content</a>'+banner+navigation(m,requested)+body+foot+EXPERIENCE.mobileActions(m,anchor)+
 '<script defer src="'+(m.staticMode?'site.js':'/sbc-prospect-site.js')+'"></script></body></html>';
}
function availablePages(demo){return String(demo?.offerTier)==='starter'?['home']:['home','services','about','contact'];}
module.exports={renderPage,availablePages,define};
