'use strict';
// Full, responsive prospect websites—not screenshots. No AI credits, external
// API calls, real contact submissions, fake testimonials or made-up credentials.
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const text=(v,max=160)=>String(v??'').trim().slice(0,max);
const palettes=[
 {match:/auto|mechanic|tire|detailing|collision|body shop|car wash/i,label:'AUTOMOTIVE',ink:'#0b1426',p:'#d84829',soft:'#fff1e8',hero:'precision in every detail',category:'automotive'},
 {match:/salon|beauty|barber|spa|lash|nail|hair/i,label:'BEAUTY & CARE',ink:'#251824',p:'#a44f83',soft:'#fff0f8',hero:'a beautiful experience starts here',category:'beauty'},
 {match:/restaurant|cafe|bakery|catering|kitchen|food|grill/i,label:'DINING & FOOD',ink:'#242015',p:'#a97625',soft:'#faf2e4',hero:'good taste deserves a great first impression',category:'dining'},
 {match:/roof|plumb|electric|construction|contractor|handyman|hvac|landscap|lawn|clean|pool/i,label:'HOME & FIELD SERVICES',ink:'#102f2b',p:'#22796b',soft:'#eaf8f3',hero:'a better way to get the job done',category:'trades'},
 {match:/law|legal|attorney|notary|insurance|tax|account|finance/i,label:'PROFESSIONAL SERVICES',ink:'#1b2c46',p:'#bb8843',soft:'#f8f2e8',hero:'professional service, presented with confidence',category:'professional'}
];
const generic={label:'LOCAL BUSINESS',ink:'#16283f',p:'#416fbb',soft:'#eef4ff',hero:'local excellence, beautifully presented',category:'local'};
const serviceNames={
 automotive:['Services & maintenance','Detailing & care','Request an estimate','Why choose this business'],
 beauty:['Treatments & services','Appointment experience','Personalized consultation','Discover the studio'],
 dining:['Explore the menu','Visit & discover','Special occasions','Get in touch'],
 trades:['Core services','Projects & expertise','Request an estimate','Service area'],
 professional:['Professional services','How we work','Book a consultation','Your next step'],
 local:['What we do','Our approach','Request a quote','Get in touch']
};
const faqs={
 automotive:[['Can I request an estimate?','Yes—this finished site will link to the business’s approved estimate process after launch.'],['How can I schedule service?','Scheduling information and availability are added during client onboarding.']],
 beauty:[['How do I book?','Approved booking links and current availability are added before the website goes live.'],['Are service prices listed?','The owner can supply a current service menu and prices during onboarding.']],
 dining:[['Can I view a menu?','An approved menu can be published after the business confirms items and pricing.'],['Where is the restaurant?','The verified location and operating hours are added before launch.']],
 trades:[['What areas do you serve?','The verified service areas are added when the business approves this website.'],['Can I request a quote?','Yes. The finished site will connect to the company’s preferred inquiry process.']],
 professional:[['How do I get started?','The approved consultation or intake details are added during onboarding.'],['Can I speak with your team?','The verified contact details will be published after the business approves the website.']],
 local:[['How do I get started?','Contact and appointment details will be confirmed before launch.'],['Can I ask a question?','Yes. The approved inquiry process is added before launch.']]
};
const allowed=new Set(['home','services','about','contact']);
function define(demo,opts={}) {
 const customer=demo?.customer||{};
 const business=text(customer.businessName||customer.contactName||demo?.businessName||'Your Business',100);
 const industry=text(demo?.industry||customer.industry||'Local Business',100);
 const style=palettes.find(x=>x.match.test(industry))||generic;
 const tier=['starter','essentials'].includes(String(demo?.offerTier))?demo.offerTier:'essentials';
 const slug=String(demo?.slug||'').replace(/[^a-z0-9-]/gi,'').slice(0,90);
 const slugId=String(demo?.id||'').replace(/[^a-z0-9_-]/gi,'').slice(0,100);
 const approved=demo?.status==='Approved';
 const prefix=opts.staticMode?'':(approved?'/demo/'+slug:'/api/website-demos/'+slugId+'/preview');
 const title=esc(business),safeIndustry=esc(industry);
 const rawCity=text(customer.city||'',70),city=rawCity?esc(rawCity):'your community';
 const names=serviceNames[style.category]||serviceNames.local;
 const questions=faqs[style.category]||faqs.local;
 return {business,title,industry,safeIndustry,style,tier,prefix,city,names,questions,approved,slug,staticMode:opts.staticMode===true};
}
const anchor=(model,page,fragment='')=>model.staticMode
 ? (model.tier==='starter'?'index.html'+(fragment?'#'+fragment:''):(page==='home'?'index.html':page+'.html')+(fragment?'#'+fragment:''))
 : model.prefix+(model.tier==='starter'?(fragment?'#'+fragment:''):(page==='home'?'':'?page='+encodeURIComponent(page))+(fragment?'#'+fragment:''));
const symbol=(n)=>({arrow:'↗',check:'✓',spark:'✦',menu:'☰',phone:'↗'})[n]||'✦';
function heroVisual(model){
 const s=model.style;
 return '<div class="hero-art" aria-hidden="true"><div class="art-stage"><span class="art-kicker">'+esc(s.label)+'</span>'+
 '<div class="art-shape art-shape-a"></div><div class="art-shape art-shape-b"></div><div class="art-orbit"></div>'+
 '<div class="art-card"><span class="art-line">EST. FOR YOUR NEXT CHAPTER</span><strong>'+esc(model.business)+'</strong><span>YOUR EXPERIENCE. REIMAGINED.</span></div></div>'+
 '<div class="art-foot"><span>DESIGN DIRECTION / 01</span><span>PREVIEW EDITION</span></div></div>';
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
function services(m,full=false){
 const s=m.names.slice(0,full?4:3);
 const cards=s.map((name,index)=>'<article class="service-card"><div class="service-counter">0'+(index+1)+' / '+esc(m.style.label)+'</div>'+
 '<div class="service-shape service-shape-'+(index%3)+'" aria-hidden="true"></div>'+
 '<h3>'+esc(name)+'</h3><p>'+esc(index===0?'Discover the essential services this business can present with clarity, personality, and professionalism.':index===1?'Make it simple for visitors to explore the experience and find the right next step.':index===2?'Turn interest into an inquiry with a clear, focused path that makes sense on any device.':'A dedicated place for the details that matter most to your customers.')+'</p>'+
 '<a href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'" class="text-link">Explore the next step <span aria-hidden="true">↗</span></a></article>').join('');
 return '<section class="section section-cream" id="services"><div class="container">'+sectionHeading('01 / WHAT WE DO','Services made easy to explore','Every detail has a purpose: help customers understand the offer and take action.')+'<div class="service-grid">'+cards+'</div></div></section>';
}
function why(m){
 return '<section class="section contrast" id="about"><div class="container split"><div><p class="kicker light">02 / A BETTER FIRST IMPRESSION</p><h2 class="display">Built around <em>your</em> business.</h2><p class="contrast-copy">A website should make the right introduction before someone ever picks up the phone. This design creates a polished, clear experience from the first scroll to the final step.</p>'+
 '<a class="button button-outline" href="'+esc(anchor(m,'about',m.tier==='starter'?'about':''))+'">Get to know us <span aria-hidden="true">↗</span></a></div>'+
 '<div class="value-stack"><div class="value-item"><strong>01</strong><div><h3>Designed for real visitors</h3><p>Easy navigation, readable content, and mobile-first layouts.</p></div></div>'+
 '<div class="value-item"><strong>02</strong><div><h3>Clear from the first click</h3><p>Highlights, services, and next steps that are easy to find.</p></div></div>'+
 '<div class="value-item"><strong>03</strong><div><h3>Ready for your final details</h3><p>Add verified contact information, approved service text, and branding before launch.</p></div></div></div></div></section>';
}
function how(m){
 return '<section class="section"><div class="container">'+sectionHeading('03 / SIMPLE BY DESIGN','A clear path, start to finish','A natural journey that helps visitors know what comes next.')+
 '<div class="steps"><div><span>STEP 01</span><h3>Discover</h3><p>Learn about the business and what it offers.</p></div>'+
 '<div><span>STEP 02</span><h3>Explore</h3><p>Find the right service, information, or solution.</p></div>'+
 '<div><span>STEP 03</span><h3>Connect</h3><p>Use the approved contact method when the site is launched.</p></div></div></div></section>';
}
function faqsBlock(m){
 return '<section class="section section-cream" id="faq"><div class="container narrow">'+sectionHeading('04 / GOOD TO KNOW','Frequently asked questions','Useful answers without guessing about a business’s operations.')+
 '<div class="faqs">'+m.questions.map(q=>'<details><summary>'+esc(q[0])+'<span aria-hidden="true">+</span></summary><p>'+esc(q[1])+'</p></details>').join('')+'</div></div></section>';
}
function callout(m){
 return '<section class="cta-section" id="contact"><div class="container cta-inner"><p class="kicker light">LET’S MAKE THIS YOURS</p><h2>Make a great first<br><em>impression.</em></h2><p>The structure and design are ready. Final contact details, service details, and approved business information are completed before launch.</p><a class="button button-light" href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'">Contact information <span>↗</span></a></div></section>';
}
function home(m){
 return '<main id="main"><section class="hero"><div class="container hero-grid"><div class="hero-copy"><p class="kicker">'+esc(m.style.label)+' / DIGITAL EXPERIENCE</p><h1>'+m.title+'<span class="hero-period">.</span></h1><p class="hero-lede">'+esc(m.style.hero.charAt(0).toUpperCase()+m.style.hero.slice(1))+'.</p><p class="hero-desc">A confident online home for the business. Designed to introduce services, build a memorable first impression, and make the next step simple.</p>'+
 '<div class="hero-buttons"><a class="button button-main" href="'+esc(anchor(m,'services',m.tier==='starter'?'services':''))+'">Explore services <span>↗</span></a><a class="button button-ghost" href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'">Get in touch</a></div><div class="hero-caption"><span>RESPONSIVE</span><i></i><span>CLEAR</span><i></i><span>CRAFTED WITH CARE</span></div></div>'+heroVisual(m)+'</div></section>'+
 '<div class="marquee" aria-hidden="true"><div class="container marquee-inner"><span>DESIGNED FOR THE WAY PEOPLE BROWSE</span><span>✦</span><span>BUILT TO MAKE A LASTING IMPRESSION</span><span>✦</span><span>MADE FOR YOUR NEXT CHAPTER</span></div></div>'+
 services(m)+why(m)+how(m)+faqsBlock(m)+callout(m)+'</main>';
}
function servicesPage(m){
 return '<main id="main"><section class="interior-hero"><div class="container"><p class="kicker">'+esc(m.style.label)+' / SERVICES</p><h1>What we <em>offer.</em></h1><p>Explore the services and experiences this business could present online. Final descriptions are confirmed with the owner before launch.</p></div></section>'+services(m,true)+how(m)+callout(m)+'</main>';
}
function aboutPage(m){
 return '<main id="main"><section class="interior-hero"><div class="container"><p class="kicker">ABOUT / OUR STORY</p><h1>More than a <em>first impression.</em></h1><p>A business deserves a digital home with personality and purpose. This page is ready for the owner’s real history, photos, credentials, and team information.</p></div></section>'+
 why(m)+'<section class="section"><div class="container">'+sectionHeading('YOUR STORY','There is a story behind every great business','A space for the details that make your company unique.')+
 '<div class="story-block"><div class="story-art" aria-hidden="true"><span>YOUR STORY</span><strong>01 — THE BEGINNING</strong></div><div><p class="kicker">ABOUT THE BUSINESS</p><h3>Made for your people.</h3><p>This section is thoughtfully structured for the real founder story, service philosophy, values, and team. It becomes truly yours once the business confirms its details.</p><p class="info-label">CUSTOMIZE BEFORE LAUNCH: OWNER STORY, TEAM, PHOTOS, CREDENTIALS</p></div></div></div></section>'+callout(m)+'</main>';
}
function contactPage(m){
 return '<main id="main"><section class="interior-hero"><div class="container"><p class="kicker">CONTACT / NEXT STEPS</p><h1>Start the <em>conversation.</em></h1><p>Everything visitors need to take the next step—ready to connect to approved contact details and inquiry methods after launch.</p></div></section>'+
 '<section class="section"><div class="container contact-grid"><div>'+sectionHeading('GET IN TOUCH','We would love to hear from you','Final business phone, email, hours, and location are entered after owner confirmation.')+
 '<div class="contact-lines"><div><span>PHONE</span><strong>Business number — add before launch</strong></div><div><span>EMAIL</span><strong>Business email — add before launch</strong></div><div><span>LOCATION</span><strong>Verified address and service area — add before launch</strong></div></div></div>'+
 '<div class="contact-panel"><p class="kicker">WEBSITE CONCEPT · FORM PREVIEW</p><h3>Tell us what you need.</h3><p>This polished inquiry form is a demonstration. It does not submit, save, or transmit any visitor data until the owner approves a live website.</p>'+
 '<form class="demo-form" data-demo-form><label>Your name <input placeholder="Your full name" name="name" autocomplete="off"></label><label>Email <input type="email" placeholder="name@example.com" name="email" autocomplete="off"></label><label>How can we help? <textarea name="message" placeholder="Tell us a little about your project" rows="5"></textarea></label><button type="submit" class="button button-main">Preview inquiry <span>↗</span></button><p class="form-feedback" role="status" aria-live="polite">Demo only — no information is collected or sent.</p></form></div></div></section>'+callout(m)+'</main>';
}
function renderPage(demo,page='home',options={}){
 const m=define(demo,options),requested=String(page||'home').trim().toLowerCase();
 if(!allowed.has(requested))throw Object.assign(new Error('SITE_PAGE_NOT_FOUND'),{status:404});
 if(m.tier==='starter' && requested!=='home')throw Object.assign(new Error('STARTER_SINGLE_PAGE_ONLY'),{status:404});
 const safeTitle=requested==='home'?m.title:esc(requested.charAt(0).toUpperCase()+requested.slice(1))+' | '+m.title;
 const tagline='A website concept for '+m.business+' — prepared by Successful By Choice. Final business information requires client approval.';
 const head='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">'+
 '<meta name="description" content="'+esc(tagline)+'"><title>'+safeTitle+'</title>'+
 '<link rel="stylesheet" href="'+(m.staticMode?'site.css':'/sbc-prospect-site.css')+'">';
 const body=requested==='home'?home(m):requested==='services'?servicesPage(m):requested==='about'?aboutPage(m):contactPage(m);
 const foot='<footer class="footer"><div class="container"><div><a class="footer-brand" href="'+esc(anchor(m,'home'))+'">'+m.title+'</a><p>Made for the people who matter most—your customers.</p></div><div><span>EXPLORE</span><a href="'+esc(anchor(m,'services',m.tier==='starter'?'services':''))+'">Services</a><a href="'+esc(anchor(m,'about',m.tier==='starter'?'about':''))+'">About</a><a href="'+esc(anchor(m,'contact',m.tier==='starter'?'contact':''))+'">Contact</a></div><div><span>WEBSITE CONCEPT</span><p>Created by Successful By Choice</p><p>Details &amp; imagery to be approved before launch.</p></div></div><div class="container footer-bottom"><span>Website concept © '+new Date().getFullYear()+'</span><span>Built to become yours.</span></div></footer>';
 const banner='<div class="preview-banner" role="note"><div class="container"><strong>Website concept preview</strong><span>Fully navigable design · Business details finalized after purchase · Not an official live business website</span></div></div>';
 return '<!doctype html><html lang="en"><head>'+head+'</head><body style="--site-ink:'+m.style.ink+';--site-primary:'+m.style.p+';--site-soft:'+m.style.soft+'"><a class="skip-link" href="#main">Skip to content</a>'+banner+navigation(m,requested)+body+foot+
 '<script defer src="'+(m.staticMode?'site.js':'/sbc-prospect-site.js')+'"></script></body></html>';
}
function availablePages(demo){return String(demo?.offerTier)==='starter'?['home']:['home','services','about','contact'];}
module.exports={renderPage,availablePages,define};
