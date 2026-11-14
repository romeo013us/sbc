'use strict';
// SBC Studio V4: deterministic private concept features. No network, AI,
// background tasks, customer publication, user-supplied HTML or arbitrary CSS.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function whiteContrast(color){
 const triplet=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
 const rgb=triplet.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return 1.05/(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]+.05);
}
function normalizeBrand(raw){
 if(raw===undefined||raw===null||record(raw)&&(Object.keys(raw).length===0||(raw.enabled===false&&Object.keys(raw).length===1)))return {enabled:false};
 if(!record(raw)||Object.keys(raw).some(k=>!['enabled','primary','accent','ownerConfirmed'].includes(k)))throw Error('INVALID_STUDIO_BRAND');
 const {primary,accent,ownerConfirmed}=raw;
 if(typeof primary!=='string'||typeof accent!=='string'||!/^#[0-9a-fA-F]{6}$/.test(primary)||!/^#[0-9a-fA-F]{6}$/.test(accent)||ownerConfirmed!==true||
    whiteContrast(primary)<4.5||whiteContrast(accent)<4.5)throw Error('INVALID_STUDIO_BRAND');
 return Object.freeze({enabled:true,primary:primary.toUpperCase(),accent:accent.toUpperCase(),ownerConfirmed:true});
}
function approvedUrl(value){
 if(typeof value!=='string'||value.length>350||/[<>"'\s\\]/.test(value))return '';
 let u;try{u=new URL(value)}catch{return ''}
 if(u.protocol!=='https:'||u.hostname!=='res.cloudinary.com'||u.username||u.password||u.port||u.search||u.hash)return '';
 if(!/^\/[a-zA-Z0-9_-]{2,64}\/image\/upload\/(?:v[0-9]{1,16}\/)?[a-zA-Z0-9/_-]{1,155}\.(?:jpg|jpeg|png|webp)$/.test(u.pathname))return '';
 return u.href;
}
function safeCopy(value,max){
 return typeof value==='string'&&value.trim()&&value.length<=max&&!/[<>\u0000-\u001f\u007f]/.test(value)?value.trim():null;
}
function normalizeComparison(raw){
 if(raw===undefined||raw===null||record(raw)&&(Object.keys(raw).length===0||(raw.enabled===false&&Object.keys(raw).length===1)))return {enabled:false};
 const fields=['enabled','title','beforeUrl','afterUrl','beforeAlt','afterAlt','rightsConfirmed','actualWorkConfirmed'];
 if(!record(raw)||Object.keys(raw).some(x=>!fields.includes(x)))throw Error('INVALID_STUDIO_COMPARISON');
 const urls=[approvedUrl(raw.beforeUrl),approvedUrl(raw.afterUrl)];
 const title=safeCopy(raw.title,110),beforeAlt=safeCopy(raw.beforeAlt,180),afterAlt=safeCopy(raw.afterAlt,180);
 if(!title||!urls.every(Boolean)||urls[0]===urls[1]||!beforeAlt||!afterAlt||
    raw.rightsConfirmed!==true||raw.actualWorkConfirmed!==true)throw Error('INVALID_STUDIO_COMPARISON');
 return Object.freeze({enabled:true,title,beforeUrl:urls[0],afterUrl:urls[1],
  beforeAlt,afterAlt,rightsConfirmed:true,actualWorkConfirmed:true});
}
const comparisonCss=[
 '.sbc-v4-comparison{padding:clamp(55px,8vw,110px) 0;background:var(--v2-soft);color:var(--v2-ink)}',
 '.sbc-v4-comparison .sbc-v4-heading{max-width:55ch;margin-bottom:32px}',
 '.sbc-v4-comparison .sbc-v4-view{position:relative;aspect-ratio:16/10;overflow:hidden;border-radius:clamp(12px,2vw,24px);background:#17263a;isolation:isolate}',
 '.sbc-v4-view img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
 '.sbc-v4-view .sbc-v4-after{clip-path:inset(0 calc(100% - var(--sbc-compare,50%)) 0 0)}',
 '.sbc-v4-view:after{content:"";position:absolute;top:0;bottom:0;left:var(--sbc-compare,50%);width:3px;background:white;box-shadow:0 0 0 1px #0005;transform:translateX(-50%);pointer-events:none}',
 '.sbc-v4-labels{display:flex;justify-content:space-between;gap:20px;margin:15px 0;font-weight:800}',
 '.sbc-v4-range{width:100%;min-height:44px;accent-color:var(--v2-accent)}',
 '.sbc-v4-caption{font-size:.82rem;max-width:72ch;margin:16px 0 0}',
 '@media(max-width:750px){.sbc-v4-view{aspect-ratio:4/5}.sbc-v4-comparison{padding:56px 0}}',
 '@media(prefers-reduced-motion:reduce){.sbc-v4-view img{transition:none}}'
].join('\n');
function applyV4(bundle,brand,comparison){
 const files={...bundle.files};
 let html=files['index.html'],css=files['styles.css'],js=files['site.js'];
 if(brand.enabled){
  css+='\nbody[data-sbc-studio-version="2"]{--ink:'+brand.primary+';--v2-ink:'+brand.primary+
   ';--accent:'+brand.accent+';--v2-accent:'+brand.accent+'}\n';
  html=html.replace(/<body(\s|>)/,'<body data-sbc-v4-brand="approved"$1');
 }
 if(comparison.enabled){
  const target='<section class="section contact composed-contact" id="contact">';
  if(!html.includes(target))throw Error('STUDIO_V4_CONTACT_NOT_FOUND');
  const section='<section class="sbc-v4-comparison" data-sbc-v4-comparison aria-label="Before and after project photos">'+
    '<div class="wrap"><div class="sbc-v4-heading"><p class="eyebrow">REAL PROJECT · OWNER-VERIFIED</p>'+
    '<h2>'+esc(comparison.title)+'</h2><p>Photos from an actual customer project, confirmed by the business owner. Individual outcomes may vary.</p></div>'+
    '<div class="sbc-v4-view" style="--sbc-compare:50%">'+
    '<img src="'+esc(comparison.beforeUrl)+'" alt="'+esc(comparison.beforeAlt)+'" width="1600" height="1000" loading="lazy" decoding="async">'+
    '<img class="sbc-v4-after" src="'+esc(comparison.afterUrl)+'" alt="'+esc(comparison.afterAlt)+'" width="1600" height="1000" loading="lazy" decoding="async">'+
    '</div><div class="sbc-v4-labels"><span>Before</span><span>After</span></div>'+
    '<label for="sbc-v4-range">Compare these photos</label>'+
    '<input id="sbc-v4-range" class="sbc-v4-range" type="range" min="0" max="100" step="1" value="50" aria-label="Compare before and after images">'+
    '<p class="sbc-v4-caption">Owner-attested actual customer project. Rights and consent are reviewed before any public use. This private design does not send information or submit a form.</p>'+
    '</div></section>';
  html=html.replace(target,section+target);
  css+='\n'+comparisonCss;
  js+='\n;(()=>{for(const section of document.querySelectorAll("[data-sbc-v4-comparison]")){' +
      'const control=section.querySelector("input[type=range]"),view=section.querySelector(".sbc-v4-view");'+
      'if(!control||!view)continue;control.addEventListener("input",()=>{'+
      'view.style.setProperty("--sbc-compare",String(Math.min(100,Math.max(0,Number(control.value)||0)))+"%")})}})();\n';
 }
 return {...bundle,files:{...files,'index.html':html,'styles.css':css,'site.js':js},publicationReady:false};
}
module.exports={normalizeBrand,normalizeComparison,applyV4};
