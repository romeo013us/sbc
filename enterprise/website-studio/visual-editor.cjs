'use strict';
// Visual Studio v1: bounded owner-controlled presentation overrides on PRIVATE drafts.
// Does NOT change verified facts, publish a site, permit arbitrary HTML or upload images.
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isRecord=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const keys=['headline','subheadline','density','photoUrl','photoAlt','rightsConfirmed'];
const densities=new Set(['original','airy','dense']);
const safeText=(raw,max)=>{
 if(typeof raw!=='string'||raw.length>max||/[<>\u0000-\u001f\u007f]/.test(raw))throw Error('INVALID_STUDIO_COPY');
 return raw.trim();
};
function mediaURL(s){
 if(!s)return '';
 if(typeof s!=='string'||s.length>400||/[\s<>"'\\]/.test(s))throw Error('INVALID_STUDIO_PHOTO');
 let u;try{u=new URL(s)}catch{throw Error('INVALID_STUDIO_PHOTO')}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port)throw Error('INVALID_STUDIO_PHOTO');
 if(!['images.unsplash.com','images.pexels.com'].includes(u.hostname))throw Error('INVALID_STUDIO_PHOTO');
 if(u.hostname==='images.unsplash.com'&&!/^\/photo-[a-zA-Z0-9-]+$/.test(u.pathname))throw Error('INVALID_STUDIO_PHOTO');
 if(u.hostname==='images.pexels.com'&&!/^\/photos\/[a-zA-Z0-9/_-]+\.(?:jpe?g|webp|png)$/.test(u.pathname))throw Error('INVALID_STUDIO_PHOTO');
 for(const [k,v] of u.searchParams){
  if(!['auto','fit','crop','w','h','q'].includes(k)||!/^[a-zA-Z0-9_-]{1,25}$/.test(v))throw Error('INVALID_STUDIO_PHOTO');
 }
 return u.href;
}
function normalizeVisual(raw={}){
 if(!isRecord(raw)||Object.keys(raw).some(key=>!keys.includes(key)))throw Error('INVALID_STUDIO_VISUAL');
 const headline=safeText(raw.headline??'',120),subheadline=safeText(raw.subheadline??'',280);
 const density=raw.density??'original';if(!densities.has(density))throw Error('INVALID_STUDIO_LAYOUT');
 const photoUrl=mediaURL(raw.photoUrl??'');
 const photoAlt=safeText(raw.photoAlt??'',180);
 if(raw.rightsConfirmed!==undefined&&typeof raw.rightsConfirmed!=='boolean')throw Error('INVALID_STUDIO_MEDIA_RIGHTS');
 const rightsConfirmed=raw.rightsConfirmed===true;
 if(photoUrl&&!rightsConfirmed)throw Error('STUDIO_MEDIA_RIGHTS_REQUIRED');
 if(photoUrl&&!photoAlt)throw Error('STUDIO_MEDIA_ALT_REQUIRED');
 if(!photoUrl&&photoAlt)throw Error('INVALID_STUDIO_PHOTO');
 return Object.freeze({headline,subheadline,density,photoUrl,photoAlt,rightsConfirmed});
}
function applyVisual(bundle,options){
 const v=normalizeVisual(options||{});
 if(!isRecord(bundle)||!isRecord(bundle.files)||typeof bundle.files['index.html']!=='string'||typeof bundle.files['styles.css']!=='string')throw Error('INVALID_SITE_BUNDLE');
 const files={...bundle.files};
 let html=files['index.html'];
 if(v.headline){
  // Only the primary composer hero, never an interior page, business identity or reviewed facts.
  const target=/(<section class="composed-hero[\s\S]*?<h1>)([\s\S]*?)(<\/h1>)/;
  if(!target.test(html))throw Error('STUDIO_HERO_NOT_FOUND');
  html=html.replace(target,(_all,start,_old,end)=>start+escapeHTML(v.headline)+end);
 }
 if(v.subheadline){
  const target=/(<section class="composed-hero[\s\S]*?<p class="hero-description">)([\s\S]*?)(<\/p>)/;
  if(!target.test(html))throw Error('STUDIO_HERO_NOT_FOUND');
  html=html.replace(target,(_all,start,_old,end)=>start+escapeHTML(v.subheadline)+end);
 }
 html=html.replace(/<body(\s|>)/,(_all,next)=>'<body class="sbc-layout-'+v.density+'"'+next);
 if(v.photoUrl){
  const feature='<figure class="sbc-approved-visual"><img loading="lazy" decoding="async" alt="'+escapeHTML(v.photoAlt)+'" src="'+escapeHTML(v.photoUrl)+'" width="1600" height="900"><figcaption>PHOTO PROVIDED FOR CONCEPT · Owner confirmed media usage rights; final client approval required.</figcaption></figure>';
  const hero=/<section class="composed-hero[\s\S]*?<\/section>/;
  if(!hero.test(html))throw Error('STUDIO_HERO_NOT_FOUND');
  html=html.replace(hero,m=>m+feature);
 }
 files['index.html']=html;
 files['styles.css']+='\n.sbc-layout-airy .composed-services{padding-block:130px}.sbc-layout-dense .composed-services{padding-block:46px}.sbc-layout-dense .service-composition{gap:12px}.sbc-approved-visual{margin:0;background:#101820;padding:24px max(24px,calc((100vw - 1160px)/2));color:white}.sbc-approved-visual img{display:block;width:100%;height:auto;max-height:520px;object-fit:cover;border-radius:12px}.sbc-approved-visual figcaption{font-size:.7rem;letter-spacing:.09em;padding:12px 0;line-height:1.5}@media(max-width:750px){.sbc-layout-airy .composed-services{padding-block:70px}.sbc-approved-visual{padding:18px}.sbc-approved-visual img{max-height:340px}}\n';
 return {...bundle,files,publicationReady:false};
}
module.exports={normalizeVisual,applyVisual,mediaURL};
