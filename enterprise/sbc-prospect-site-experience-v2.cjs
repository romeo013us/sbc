'use strict';
/* Native SBC Website Production presentation system. No provider API or spend.
 * CRM website facts are displayed only after explicit verification and owner
 * website approval. A published static export needs a SEPARATE release flag;
 * an approved prospect concept is NOT automatically a live customer site.
 */
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clean=(raw,max=140)=>String(raw??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const ARCHETYPE=Object.freeze({automotive:'trade',trades:'trade',professional:'professional',beauty:'hospitality',dining:'hospitality',local:'local'});
const archetype=category=>ARCHETYPE[category]||'local';
function verifiedFacts(demo){
 const raw=demo?.verifiedBusinessDetails||demo?.customer?.websiteVerifiedDetails;
 if(demo?.status!=='Approved'||!raw||raw.verified!==true)return null;
 const tel=clean(raw.phone,32).replace(/[().\s-]/g,'');
 const phone=/^\+?[0-9]{10,15}$/.test(tel)?tel:'';
 const services=Array.isArray(raw.services)?raw.services.map(x=>clean(x,70)).filter(Boolean).slice(0,8):[];
 const serviceAreas=Array.isArray(raw.serviceAreas)?raw.serviceAreas.map(x=>clean(x,12)).filter(x=>/^\d{5}(?:-\d{4})?$/.test(x)).slice(0,12):[];
 return {phone,services,serviceAreas,streetAddress:clean(raw.streetAddress),city:clean(raw.city,65),region:clean(raw.region,30),postalCode:clean(raw.postalCode,12),openingHours:clean(raw.openingHours,90)};
}
function publicReleaseReady(model,options){
 const f=model.facts;
 return options?.staticMode===true&&options?.publicationApproved===true&&model.approved===true&&
  !!(f?.phone&&f?.streetAddress&&f?.city&&f?.region&&/^\d{5}(?:-\d{4})?$/.test(f?.postalCode||''));
}
function industryPanel(model){
 const f=model.facts;
 let label,title,description,extra;
 switch(model.layout){
  case 'trade':
   label='SERVICE AREA / VISIBILITY';title='Built for people who need help nearby.';
   description='Explore a service-focused layout with clear estimates, contact paths, and a place to show confirmed coverage.';
   extra=f?.serviceAreas.length?'<p class="sbc-fact-label">Confirmed service ZIP codes</p><div class="sbc-fact-chips">'+f.serviceAreas.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'<p class="sbc-fact-note">SERVICE AREA · Add verified ZIP codes before launch.</p>';break;
  case 'professional':
   label='CONSULTATION / CLARITY';title='Make expertise easy to understand.';
   description='A focused editorial layout for consultations, professional services, and clear next steps. Credentials are shown only after verification.';
   extra='<p class="sbc-fact-note">CREDENTIALS · Show licenses and qualifications only after the owner confirms them.</p>';break;
  case 'hospitality':
   label='VISIT / EXPLORE';title='Give guests a reason to explore.';
   description='An image-led layout for dining, beauty, and storefront experiences, with space for confirmed hours and visits.';
   extra=f?.openingHours?'<p class="sbc-fact-label">Confirmed opening hours</p><strong>'+esc(f.openingHours)+'</strong>':'<p class="sbc-fact-note">HOURS & LOCATION · Add confirmed visitor details before launch.</p>';break;
  default:
   label='NEXT STEP / CONNECTION';title='A clear introduction to the business.';
   description='A flexible layout that helps visitors explore an offering and understand what happens next.';
   extra='<p class="sbc-fact-note">CUSTOMIZE · Add verified details after the owner approves the content.</p>';
 }
 if(f?.streetAddress&&f?.city)extra+='<p class="sbc-verified-address">'+esc([f.streetAddress,f.city,f.region,f.postalCode].filter(Boolean).join(', '))+'</p>';
 return '<section class="sbc-industry-spotlight sbc-industry-spotlight--'+model.layout+'" aria-label="Industry-specific website layout"><div class="container sbc-spotlight-grid"><div><p class="kicker">'+label+'</p><h2>'+esc(title)+'</h2><p>'+esc(description)+'</p></div><div class="sbc-spotlight-facts">'+extra+'</div></div></section>';
}
function mobileActions(model,anchor){
 const service=anchor(model,'services',model.tier==='starter'?'services':'');
 const contact=anchor(model,'contact',model.tier==='starter'?'contact':'');
 const about=anchor(model,'about',model.tier==='starter'?'about':'');
 const third=model.publicationReady&&model.facts?.phone?
  '<a class="sbc-action-call" href="tel:'+esc(model.facts.phone)+'">Call Now</a>':
  '<a href="'+esc(about)+'">About</a>';
 return '<nav class="sbc-mobile-actionbar" aria-label="Mobile quick navigation"><a href="'+esc(service)+'">Services</a><a href="'+esc(contact)+'">Contact</a>'+third+'</nav>';
}
function schema(model){
 if(!model.publicationReady)return '';
 const f=model.facts;
 const data={'@context':'https://schema.org','@type':'LocalBusiness',name:model.business,telephone:f.phone,
  address:{'@type':'PostalAddress',streetAddress:f.streetAddress,addressLocality:f.city,addressRegion:f.region,postalCode:f.postalCode,addressCountry:'US'}};
 if(f.serviceAreas.length)data.areaServed=f.serviceAreas;
 const safe=JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 return '<script type="application/ld+json">'+safe+'</script>';
}
function description(model){
 const place=model.facts?.city||model.rawCity;
 return 'Website concept for '+model.business+' — '+model.industry+(place?' in '+place:'')+'. Explore the design and request verified business details before launch.';
}
function heroDescription(model){
 const featured=model.facts?.services?.[0];
 const place=model.facts?.city?' in '+model.facts.city:'';
 return 'Explore a '+model.industry+' website concept for '+model.business+place+'. '+
  (featured?'Verified service highlight: '+featured+'. ':'')+
  'Business details, images, and contact options are finalized before public launch.';
}
function contactDetails(model){
 const f=model.facts;
 const phone=f?.phone||'Business number — add before launch';
 const location=f?.streetAddress&&f?.city?[f.streetAddress,f.city,f.region,f.postalCode].filter(Boolean).join(', '):
  'Verified address and service area — add before launch';
 return '<div class="contact-lines"><div><span>PHONE</span><strong>'+esc(phone)+'</strong></div>'+
  '<div><span>EMAIL</span><strong>Business email — add before launch</strong></div>'+
  '<div><span>LOCATION</span><strong>'+esc(location)+'</strong></div></div>';
}
module.exports={archetype,verifiedFacts,publicReleaseReady,industryPanel,mobileActions,schema,description,heroDescription,contactDetails,esc};
