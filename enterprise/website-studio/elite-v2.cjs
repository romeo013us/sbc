'use strict';
// Private, deterministic V2 design composition. Never calls AI, remote imagery, payments or publication.
const {verifiedProfile}=require('./contracts.cjs');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const directions=Object.freeze({
 tint:{id:'precision',label:'PRECISION IN EVERY DETAIL',glyph:'M100 270L235 105L360 260L510 115'},
 automotive:{id:'performance',label:'BUILT FOR THE JOURNEY',glyph:'M85 310L230 180L370 270L510 105'},
 beauty:{id:'atelier',label:'AN EDITORIAL EXPERIENCE',glyph:'M90 260C160 70 460 90 505 300'},
 dining:{id:'culinary',label:'GATHER AROUND',glyph:'M125 310C80 175 395 60 505 275'},
 trades:{id:'craft',label:'BUILT WITH PURPOSE',glyph:'M95 285L245 110L380 280L500 140'},
 professional:{id:'editorial',label:'THE DETAILS MATTER',glyph:'M120 110L470 110L470 330L120 330Z'},
 local:{id:'community',label:'YOUR NEIGHBORHOOD STORY',glyph:'M95 255C175 125 375 90 500 220'}
});
const VIBES=Object.freeze(['original','cinematic','minimal','warm']);
const HERO_STYLES=Object.freeze(['auto','split','stacked','cinema']);
const SERVICE_LAYOUTS=Object.freeze(['auto','bento','grid','editorial']);

function luminance(hex){
 if(typeof hex!=='string'||!/^#[A-Fa-f0-9]{6}$/.test(hex))throw Error('INVALID_STUDIO_PALETTE');
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 const linear=rgb.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
}
function contrastRatio(a,b){
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function resolveSoftSurfaceInk(palette){
 if(!palette||typeof palette!=='object')throw Error('INVALID_STUDIO_PALETTE');
 const soft=palette.soft;
 // Prefer the palette's brand dark/light color, then fail safe to a maximum
 // contrast neutral. Never assume "ink" is readable on the *soft* surface.
 for(const candidate of [palette.background,palette.ink]){
  if(typeof candidate==='string'&&/^#[A-Fa-f0-9]{6}$/.test(candidate)&&contrastRatio(candidate,soft)>=4.5)
   return candidate.toUpperCase();
 }
 return contrastRatio('#000000',soft)>=contrastRatio('#FFFFFF',soft)?'#000000':'#FFFFFF';
}
function softHeadingContrastCSS(palette){
 const safe=resolveSoftSurfaceInk(palette);
 return '\nbody[data-sbc-studio-version="2"]{--sbc-v2-soft-contrast-ink:'+safe+'}\n'+
 '.sbc-v2-showcase .sbc-v2-heading{color:var(--sbc-v2-soft-contrast-ink)}\n'+
 '.sbc-v2-showcase .sbc-v2-heading .eyebrow{color:var(--sbc-v2-soft-contrast-ink);opacity:1}\n'+
 '.sbc-v2-questions{color:var(--sbc-v2-soft-contrast-ink)}\n'+
 'body[data-sbc-vibe="cinematic"]{--sbc-v2-soft-contrast-ink:#F8FAFC}\n'+
 'body[data-sbc-vibe="minimal"]{--sbc-v2-soft-contrast-ink:#1B302A}\n'+
 'body[data-sbc-vibe="warm"]{--sbc-v2-soft-contrast-ink:#36271F}\n';
}

function buildPlan(profile,tokens){
 verifiedProfile(profile);
 const vertical=directions[tokens?.identity?.vertical]?tokens.identity.vertical:'local';
 const option=Number(String(tokens?.identity?.variant||'').match(/-(\d)$/)?.[1]||1);
 return Object.freeze({schemaVersion:2,zeroAI:true,direction:directions[vertical].id,vertical,
  paletteVariant:Math.max(1,Math.min(3,option)),
  heroStyle:['beauty','professional'].includes(vertical)?'stacked':vertical==='dining'?'cinema':'split',
  serviceLayout:['beauty','professional'].includes(vertical)?'editorial':vertical==='trades'?'bento':'grid',
  publicationReady:false,source:'OWNER_VERIFIED_FACTS_ONLY'});
}
function verifiedFacts(profile){
 const b=profile.business;
 const location=[b.city,b.region].filter(Boolean).join(', ')||'Location to be confirmed';
 const rows=[['Business type',b.category],['Location',location],
  ['Approved services',String(profile.services.length)]];
 return '<section class="sbc-v2-facts" aria-label="Verified business information"><div class="wrap sbc-v2-fact-grid">'+
  rows.map(([label,value])=>'<div class="sbc-v2-fact"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('')+
  '</div></section>';
}
function serviceEdit(profile){
 if(!profile.services.length)return '';
 const cards=profile.services.slice(0,6).map((s,i)=>
  '<article class="sbc-v2-tile"><span class="sbc-v2-num">'+String(i+1).padStart(2,'0')+'</span>'+
  '<h3>'+esc(s.name)+'</h3><p>'+esc(s.description||'Contact the business for current details.')+'</p>'+
  '<a href="#contact">Discuss this service <span aria-hidden="true">↗</span></a></article>').join('');
 return '<section class="sbc-v2-showcase"><div class="wrap"><div class="sbc-v2-heading">'+
  '<p class="eyebrow">THE SERVICE EDIT</p><h2>Explore '+esc(profile.business.name)+'</h2>'+
  '<p>Confirmed offerings, thoughtfully presented. Pricing and availability are confirmed by the business.</p></div>'+
  '<div class="sbc-v2-service-grid">'+cards+'</div></div></section>';
}
function nextSteps(){
 const steps=[['Explore','Review the business-approved services.'],
  ['Connect','Ask about the service details that matter to you.'],
  ['Plan','Confirm scope, timing, and next steps with the business.']];
 return '<section class="sbc-v2-path" id="getting-started"><div class="wrap">'+
  '<div class="sbc-v2-heading"><p class="eyebrow">THE NEXT STEP</p><h2>Easy to get started.</h2></div>'+
  '<div class="sbc-v2-path-grid">'+steps.map(([title,body],i)=>
  '<article class="sbc-v2-path-card"><span>'+String(i+1).padStart(2,'0')+
  '</span><h3>'+title+'</h3><p>'+body+'</p></article>').join('')+'</div></div></section>';
}
function questions(profile){
 const b=profile.business,c=profile.contact;
 const items=[
  ['Which services are listed?',profile.services.map(s=>s.name).join(', ')||'Ask the business about current offerings.'],
  ['Where is the business based?',[b.city,b.region].filter(Boolean).join(', ')||'Ask the business to confirm its location.'],
  ['How can I get in touch?',c.phone&&c.email?'Use the verified phone number or email shown here.':c.phone?'Use the phone number shown here.':c.email?'Use the email address shown here.':'Contact details are pending confirmation.']
 ];
 return '<section class="sbc-v2-questions" id="questions"><div class="wrap sbc-v2-questions-grid">'+
  '<div><p class="eyebrow">THE ESSENTIALS</p><h2>Good questions.<br>Clear answers.</h2><p>Only business-approved information, never fabricated reviews or claims.</p></div>'+
  '<div class="sbc-v2-faq">'+items.map(([q,a])=>
  '<details><summary>'+esc(q)+'</summary><p>'+esc(a)+'</p></details>').join('')+'</div></div></section>';
}
function callToAction(profile){
 return '<section class="sbc-v2-conversion"><div class="wrap sbc-v2-conversion-grid">'+
  '<div><p class="eyebrow">KEEP THE CONVERSATION GOING</p><h2>Let’s talk about '+esc(profile.business.category.toLowerCase())+'.</h2>'+
  '<p>Reach out for confirmed details, current pricing and availability.</p></div>'+
  '<a class="sbc-v2-action" href="#contact">Start a conversation <span aria-hidden="true">↗</span></a></div></section>';
}
function graphic(direction){
 return '<div class="sbc-v2-art" aria-hidden="true"><svg class="sbc-v2-glyph" viewBox="0 0 600 480" focusable="false" xmlns="http://www.w3.org/2000/svg">'+
  '<circle cx="330" cy="235" r="170" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="2"/>'+
  '<circle cx="330" cy="235" r="112" fill="none" stroke="currentColor" stroke-opacity=".16" stroke-width="2"/>'+
  '<path d="'+direction.glyph+'" fill="none" stroke="currentColor" stroke-opacity=".65" stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/>'+
  '</svg></div>';
}
const styles=`
body[data-sbc-studio-version="2"]{--v2-bg:var(--bg);--v2-ink:var(--ink);--v2-surface:var(--surface);--v2-soft:var(--soft);--v2-accent:var(--accent);overflow-wrap:anywhere}
body[data-sbc-studio-version="2"] h1{font-size:clamp(3.4rem,7.2vw,7.4rem);line-height:.98;letter-spacing:-.06em}
body[data-sbc-studio-version="2"] h2{font-size:clamp(2.2rem,4.3vw,4.5rem);line-height:1.04;letter-spacing:-.055em}
body[data-sbc-studio-version="2"] .composed-hero{isolation:isolate;overflow:hidden}
body[data-sbc-studio-version="2"] .composed-hero:after{content:"";position:absolute;right:-15%;bottom:-55%;width:70vw;height:70vw;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--v2-accent),transparent 86%),transparent 65%);pointer-events:none;z-index:-1}
body[data-sbc-studio-version="2"] .composition-art{box-shadow:0 30px 80px -42px #0008;isolation:isolate}
.sbc-v2-art{position:absolute;inset:0;pointer-events:none;color:var(--v2-accent);opacity:.68}
.sbc-v2-glyph{display:block;width:100%;height:100%;filter:drop-shadow(0 10px 23px #0004)}
.sbc-v2-facts{padding:23px 0;background:var(--v2-ink);color:var(--v2-bg)}
.sbc-v2-fact-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.sbc-v2-fact{min-width:0;border-left:1px solid currentColor;padding:14px 22px}
.sbc-v2-fact span{display:block;font-size:.7rem;font-weight:800;letter-spacing:.15em;text-transform:uppercase;opacity:.7;margin-bottom:9px}
.sbc-v2-fact strong{font-size:clamp(1rem,1.4vw,1.4rem);line-height:1.2}
.sbc-v2-showcase,.sbc-v2-questions{padding:clamp(70px,9vw,135px) 0;background:var(--v2-soft);color:var(--v2-ink)}
.sbc-v2-heading{max-width:800px;margin:0 0 42px}.sbc-v2-heading>p:not(.eyebrow){max-width:52ch}
.sbc-v2-service-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;grid-auto-flow:dense}
.sbc-v2-tile{background:var(--v2-surface);border:1px solid var(--border);border-radius:clamp(12px,2vw,27px);min-width:0;min-height:230px;padding:clamp(20px,3vw,35px);display:flex;flex-direction:column;align-items:flex-start;box-shadow:0 17px 40px -35px #0008;transition:transform .2s ease}
.sbc-v2-tile:hover{transform:translateY(-4px)}.sbc-v2-num{font-weight:900;color:var(--v2-accent);font-size:.75rem;letter-spacing:.15em}
.sbc-v2-tile h3{font-size:clamp(1.4rem,2vw,2.2rem);line-height:1.08;margin:22px 0 12px}
.sbc-v2-tile p{margin:0 0 22px}.sbc-v2-tile a{margin-top:auto;font-weight:800;color:var(--v2-accent);text-decoration:none}
.sbc-v2-path{background:var(--v2-bg);color:var(--v2-ink);padding:clamp(70px,9vw,140px) 0}
.sbc-v2-path-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px}
.sbc-v2-path-card{border-top:2px solid currentColor;padding:24px 10px 0 0}
.sbc-v2-path-card>span{font-size:.75rem;font-weight:900;color:var(--v2-accent)}
.sbc-v2-path-card h3{font-size:clamp(1.6rem,2.4vw,2.4rem)}
.sbc-v2-questions-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(25px,6vw,100px)}
.sbc-v2-faq details{border-bottom:1px solid var(--border);padding:22px 0}
.sbc-v2-faq summary{cursor:pointer;font-weight:800;font-size:1.2rem}.sbc-v2-faq p{margin:16px 0 0}
.sbc-v2-conversion{padding:clamp(65px,8vw,130px) 0;background:var(--v2-ink);color:var(--v2-bg)}
.sbc-v2-conversion-grid{display:grid;grid-template-columns:2fr 1fr;gap:25px;align-items:end}
.sbc-v2-conversion .eyebrow{color:inherit;opacity:.7}.sbc-v2-conversion h2{max-width:17ch}
.sbc-v2-action{display:inline-flex;justify-content:space-between;gap:18px;padding:18px 22px;border-radius:50px;background:var(--v2-accent);color:var(--v2-bg);font-weight:800;text-decoration:none}
body[data-sbc-v2-direction="performance"] .sbc-v2-tile:first-child,body[data-sbc-v2-direction="craft"] .sbc-v2-tile:first-child{grid-column:span 2;min-height:285px;background:var(--v2-ink);color:var(--v2-bg)}
body[data-sbc-v2-direction="performance"] .sbc-v2-tile:first-child a,body[data-sbc-v2-direction="craft"] .sbc-v2-tile:first-child a{color:inherit}
body[data-sbc-v2-direction="atelier"] .sbc-v2-service-grid,body[data-sbc-v2-direction="editorial"] .sbc-v2-service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
body[data-sbc-v2-direction="atelier"] .sbc-v2-tile,body[data-sbc-v2-direction="editorial"] .sbc-v2-tile{border-radius:4px}
body[data-sbc-v2-direction="culinary"] .sbc-v2-tile{border-radius:28px 4px 28px 4px}
body[data-sbc-v2-direction="precision"] .sbc-v2-tile{border-radius:5px}
body[data-sbc-v2-direction="community"] .sbc-v2-tile:nth-child(even){background:var(--v2-bg)}
body[data-sbc-vibe="cinematic"]{--v2-bg:#0a1220;--v2-ink:#f8fafc;--v2-surface:#17243a;--v2-soft:#111c2d;--v2-accent:#e7aa65}
body[data-sbc-vibe="minimal"]{--v2-bg:#f8faf7;--v2-ink:#1b302a;--v2-surface:#fff;--v2-soft:#edf2ed;--v2-accent:#376e5b}
body[data-sbc-vibe="warm"]{--v2-bg:#fcf3e9;--v2-ink:#36271f;--v2-surface:#fffaf3;--v2-soft:#f1e0d1;--v2-accent:#a65b40}
body[data-sbc-service-layout="bento"] .sbc-v2-tile:first-child{grid-column:span 2}
body[data-sbc-service-layout="grid"] .sbc-v2-service-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
body[data-sbc-service-layout="grid"] .sbc-v2-tile:first-child{grid-column:auto;min-height:230px}
body[data-sbc-service-layout="editorial"] .sbc-v2-service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
body[data-sbc-service-layout="editorial"] .sbc-v2-tile{border-radius:3px}
body[data-sbc-hero-style="stacked"] .composed-hero h1{max-width:17ch}
body[data-sbc-hero-style="split"] .composed-hero .composition-art{border-radius:8px 75px 8px 75px}
body[data-sbc-hero-style="cinema"] .composed-hero{background:linear-gradient(120deg,#091220,#1b293f)!important;color:#fff}
body[data-sbc-hero-style="cinema"] .composed-hero .eyebrow{color:#f3b16b}
body[data-sbc-hero-style="cinema"] .composed-hero .btn{color:#1d2735;background:#f3b16b;border-color:#f3b16b}
@media(max-width:920px){.sbc-v2-service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:750px){.sbc-v2-fact-grid,.sbc-v2-path-grid,.sbc-v2-questions-grid,.sbc-v2-conversion-grid{grid-template-columns:1fr}.sbc-v2-service-grid,body[data-sbc-v2-direction] .sbc-v2-service-grid,body[data-sbc-service-layout] .sbc-v2-service-grid{grid-template-columns:1fr}.sbc-v2-tile,body[data-sbc-v2-direction] .sbc-v2-tile:first-child,body[data-sbc-service-layout] .sbc-v2-tile:first-child{grid-column:auto;min-height:0}.sbc-v2-fact{padding:12px 0}.sbc-v2-conversion-grid{align-items:start}.sbc-v2-action{justify-self:start}}
@media(prefers-reduced-motion:reduce){.sbc-v2-tile{transition:none}.sbc-v2-tile:hover{transform:none}}
`;
function upgradePrivateBundle({bundle,profile,designTokens}){
 verifiedProfile(profile);
 if(!bundle||bundle.publicationReady!==false||typeof bundle.files?.['index.html']!=='string'||typeof bundle.files?.['styles.css']!=='string')throw Error('INVALID_SITE_BUNDLE');
 const plan=buildPlan(profile,designTokens),direction=directions[plan.vertical];
 let html=bundle.files['index.html'];
 if(!html.includes('<main id="main">')||!html.includes('id="contact"'))throw Error('STUDIO_V2_COMPILER_STRUCTURE_MISMATCH');
 html=html.replace(/<body\s/,'<body data-sbc-studio-version="2" data-sbc-v2-direction="'+plan.direction+'" data-sbc-hero-style="'+plan.heroStyle+'" data-sbc-service-layout="'+plan.serviceLayout+'" ');
 html=html.replace('<main id="main">','<main id="main">'+verifiedFacts(profile));
 html=html.replace('<div class="composition-art">','<div class="composition-art">'+graphic(direction));
 const additions=serviceEdit(profile)+nextSteps()+questions(profile)+callToAction(profile);
 const contact='<section class="section contact composed-contact" id="contact">';
 if(!html.includes(contact))throw Error('STUDIO_V2_CONTACT_SECTION_MISSING');
 html=html.replace(contact,additions+contact);
 return {...bundle,files:{...bundle.files,'index.html':html,'styles.css':bundle.files['styles.css']+'\n'+styles+softHeadingContrastCSS(designTokens.palette)},publicationReady:false};
}
module.exports={buildPlan,upgradePrivateBundle,directions,VIBES,HERO_STYLES,SERVICE_LAYOUTS,resolveSoftSurfaceInk,contrastRatio};
