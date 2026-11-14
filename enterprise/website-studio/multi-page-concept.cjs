'use strict';
// Four-page private Website Studio concept: deterministic, no customer data submission,
// no public publishing, and no invented services, founding stories or credentials.
const {verifiedProfile}=require('./contracts.cjs');
const {checkPrivateBundle}=require('./qa-gate.cjs');
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const PAGES=['home','services','about','contact'];
const file=p=>p==='home'?'index.html':p+'.html';
const style='\n.sbc-inner-hero{padding:90px 0 75px;background:var(--soft)}.sbc-inner-hero h1{font:600 clamp(3rem,7vw,6.5rem)/1 var(--display);letter-spacing:-.05em;max-width:980px;margin:25px 0}.sbc-inner-hero p{max-width:760px;line-height:1.7;font-size:1.16rem}.sbc-inner-panel{padding:85px 0;background:var(--bg)}.sbc-inner-panel h2{font-size:clamp(2rem,4vw,4rem);line-height:1.1}.sbc-inner-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin-top:30px}.sbc-inner-card{background:var(--surface);border-top:4px solid var(--accent);padding:32px;min-width:0}.sbc-inner-card small{font-weight:800;letter-spacing:.1em;color:var(--accent)}.sbc-inner-card h3{font-size:1.7rem;line-height:1.2}.sbc-inner-card p{line-height:1.6}.sbc-inner-cta{padding:60px 0;background:var(--soft)}.sbc-inner-cta a{display:inline-flex;background:var(--accent);padding:15px 22px;border-radius:var(--radius);color:var(--ink);font-weight:800;text-decoration:none}@media(max-width:750px){.sbc-inner-hero,.sbc-inner-panel{padding:50px 0}.sbc-inner-grid{grid-template-columns:1fr}.sbc-inner-card{padding:24px}}\n';
function navigation(name){
 return '<header class="topbar"><div class="wrap topbar-inner"><a class="wordmark" href="index.html">'+esc(name)+'</a>'+
 '<button type="button" class="nav-toggle" aria-controls="main-nav" aria-expanded="false" data-nav-toggle>Menu</button>'+
 '<nav id="main-nav" class="nav-links" aria-label="Main navigation">'+
 PAGES.map(p=>'<a href="'+file(p)+'">'+p[0].toUpperCase()+p.slice(1)+'</a>').join('')+
 '</nav></div></header>';
}
function heading(label,title,description){
 return '<section class="sbc-inner-hero"><div class="wrap"><p class="eyebrow">'+esc(label)+'</p><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p></div></section>';
}
function section(title,subtitle,items){
 return '<section class="sbc-inner-panel"><div class="wrap"><h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p><div class="sbc-inner-grid">'+
 items.map((it,i)=>'<article class="sbc-inner-card"><small>'+String(i+1).padStart(2,'0')+' / '+esc(it.label)+'</small><h3>'+esc(it.title)+'</h3><p>'+esc(it.description)+'</p></article>').join('')+
 '</div></div></section>';
}
function closing(){
 return '<section class="sbc-inner-cta"><div class="wrap"><h2>Let\'s make this website yours.</h2><p>Customer-approved information, photography and live services come before public launch.</p><a href="contact.html">Explore contact options</a></div></section>';
}
function buildInterior(profile,page,isDraft){
 const b=profile.business;
 let body='';
 if(page==='services'){
  const items=isDraft?[
   {label:'EXAMPLE ONLY',title:'Service overview',description:'Design example, not an offering claim. Confirm the actual services with the business.'},
   {label:'EXAMPLE ONLY',title:'Customer experience',description:'Replace with the real service and appointment process after review.'},
   {label:'EXAMPLE ONLY',title:'Request process',description:'Connect verified channels only after customer authorization.'}
  ]:profile.services.map(s=>({label:'APPROVED SERVICE',title:s.name,description:s.description||'Contact the business to confirm the details.'}));
  body=heading('SERVICES / DISCOVER','A closer look at what matters.',isDraft?'The examples below show a possible design, not confirmed offerings.':'Browse the business-approved services.')+
   section(isDraft?'Service presentation examples':'Our services',isDraft?'All sample topics require business verification.':'Services confirmed by the business owner.',items.length?items:[{label:'AWAITING INFORMATION',title:'Services will appear here',description:'Confirm the service list before publication.'}])+closing();
 }else if(page==='about'){
  body=heading('ABOUT / OUR STORY',b.name,'An exceptional website begins with the true story behind the business.')+
   section('A place for the real story','Never invent a founding date, credentials, team members or awards.',[
    {label:'OWNER CONTENT NEEDED',title:'Our approach',description:'Use the owner\'s own approved mission, values and service philosophy.'},
    {label:'OWNER CONTENT NEEDED',title:'What makes us different',description:'Insert genuine project photography and verified differentiators.'}])+closing();
 }else{
  const contact=profile.contact||{};
  body=heading('CONTACT / NEXT STEPS','Start the conversation.','This private website concept does not collect or transmit visitor information.')+
   section('Get in touch','Display only contact channels the owner has confirmed.',[
    {label:contact.phone?'APPROVED':'REQUIRES VERIFICATION',title:'Phone',description:contact.phone||'Verify the business telephone number before publishing.'},
    {label:contact.email?'APPROVED':'REQUIRES VERIFICATION',title:'Email',description:contact.email||'Verify the business email address before publishing.'},
    {label:'NOT ACTIVE IN PREVIEW',title:'Inquiry form',description:'A tested, consent-aware CRM endpoint is required before enabling visitor submissions.'}]);
 }
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">'+
  '<meta name="description" content="Private '+esc(page)+' concept for '+esc(b.name)+'"><title>'+esc(page[0].toUpperCase()+page.slice(1))+' | '+esc(b.name)+'</title>'+
  '<link rel="stylesheet" href="styles.css"><script defer src="site.js"></script></head><body><a class="skip-link" href="#main">Skip to content</a>'+
  '<div class="preview-alert">'+(isDraft?'UNVERIFIED DESIGN CONCEPT · VERIFY CONTENT':'PRIVATE CONCEPT · APPROVED FACTS ONLY')+' · NOT A PUBLISHED WEBSITE</div>'+
  navigation(b.name)+'<main id="main">'+body+'</main><footer class="footer"><div class="wrap"><strong>'+esc(b.name)+'</strong>'+
  '<p>Private concept by Successful By Choice. Publication requires approved content, tested forms, authorized hosting, and release QA.</p></div></footer></body></html>';
}
function compileMultiPageConcept({profile,bundle,offerTier='starter',isDraft=false}){
 verifiedProfile(profile);
 if(!bundle||!bundle.files||typeof bundle.files['index.html']!=='string')throw Error('INVALID_SITE_BUNDLE');
 if(offerTier!=='essentials')return bundle;
 const files={...bundle.files};
 files['index.html']=files['index.html']
  .replace(/<header class="topbar">[\s\S]*?<\/header>/,navigation(profile.business.name))
  .replace(/href="#services"/g,'href="services.html"')
  .replace(/href="#contact"/g,'href="contact.html"')
  .replace(/href="#quote"/g,'href="contact.html"');
 files['styles.css']+='\n'+style;
 for(const p of ['services','about','contact'])files[file(p)]=buildInterior(profile,p,isDraft);
 const next={...bundle,files,publicationReady:false};
 const qa=checkPrivateBundle(next);
 if(!qa.passed)throw Error('STUDIO_MULTI_PAGE_QA_FAILED');
 return next;
}
module.exports={compileMultiPageConcept,PAGES};
