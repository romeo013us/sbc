'use strict';
/* Customer-directed intake only: never use answers as verified claims, payment proof or publication approval. */
const {randomBytes,createHash}=require('node:crypto');
const TYPE=new Set(['WEBSITE','BUSINESS_CARDS']);
const STYLE=new Set(['modern','bold','minimal','luxury','playful','classic','professional','not_sure']);
const SIDES=new Set(['single','double','not_sure']);
const ORIENT=new Set(['horizontal','vertical','not_sure']);
const FINISH=new Set(['matte','gloss','soft_touch','not_sure']);
const PAGES=new Set(['home','about','services','gallery','contact','faq','reviews','booking','shop','other']);
const FEATURES=new Set(['contact_form','quote_request','booking','gallery','map','social_links','online_store','multilingual','not_sure']);
const MAX_BODY=20000;
const clean=(x,n=500)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
const invalid=(message)=>{const e=new Error(message);e.code=message;throw e;};
const requireType=t=>TYPE.has(String(t))?String(t):invalid('INVALID_REQUEST_TYPE');
function email(x){const v=clean(x,200);if(v&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))invalid('INVALID_EMAIL');return v;}
function url(x){const v=clean(x,600);if(!v)return '';let parsed;
 try{parsed=new URL(v)}catch{invalid('HTTPS_REFERENCE_REQUIRED')}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||!parsed.hostname||parsed.hostname==='localhost'||
  /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|::1$)/.test(parsed.hostname))invalid('HTTPS_REFERENCE_REQUIRED');
 return parsed.href;
}
function color(x,fallback=''){const v=clean(x,10).toLowerCase();if(!v)return fallback;if(!/^#[a-f0-9]{6}$/.test(v))invalid('INVALID_COLOR');return v;}
function list(v,allowed,max=10){const raw=Array.isArray(v)?v:typeof v==='string'?[v]:[];return [...new Set(raw.map(x=>clean(x,80)).filter(Boolean))].slice(0,max).filter(x=>allowed.has(x));}
function generateToken(){return randomBytes(32).toString('hex')}
const validToken=t=>typeof t==='string'&&/^[0-9a-f]{64}$/.test(t);
function hashToken(t){if(!validToken(t))invalid('INVALID_REQUEST_TOKEN');return createHash('sha256').update(t,'utf8').digest('hex')}
function normalize(kind,raw){
 requireType(kind);
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getPrototypeOf(raw)!==Object.prototype)invalid('INVALID_REQUEST_BODY');
 if(JSON.stringify(raw).length>MAX_BODY)invalid('REQUEST_TOO_LARGE');
 if(raw.consent!==true)invalid('CONFIRMATION_REQUIRED');
 const businessName=clean(raw.businessName,160),contactName=clean(raw.contactName,120),contactEmail=email(raw.contactEmail),
  contactPhone=clean(raw.contactPhone,40);
 if(businessName.length<2||contactName.length<2)invalid('BUSINESS_AND_CONTACT_REQUIRED');
 if(!contactEmail&&!contactPhone)invalid('CONTACT_REQUIRED');
 if(!STYLE.has(String(raw.style||'not_sure')))invalid('INVALID_STYLE');
 const links=Array.isArray(raw.referenceUrls)?raw.referenceUrls:typeof raw.referenceUrls==='string'?raw.referenceUrls.split(/[\n,]/):[];
 if(links.length>5)invalid('TOO_MANY_REFERENCES');
 const referenceUrls=links.filter(x=>clean(x)).map(url);
 const common={kind,businessName,contactName,contactEmail,contactPhone,
  preferredContact:['email','phone','text','either'].includes(String(raw.preferredContact))?String(raw.preferredContact):'either',
  summary:clean(raw.summary,1500),style:String(raw.style||'not_sure'),
  primaryColor:color(raw.primaryColor,'#1f3655'),secondaryColor:color(raw.secondaryColor,'#fbbf24'),
  colorNotes:clean(raw.colorNotes,500),
  referenceUrls,logoUrl:url(raw.logoUrl||''),imageUrl:url(raw.imageUrl||''),
  notes:clean(raw.notes,2000),requestedDate:clean(raw.requestedDate,30),
  consent:true,paymentCollected:false,publicationApproved:false,
  source:'CUSTOMER_SELF_SUBMITTED_UNVERIFIED'};
 if(kind==='WEBSITE'){
  return {...common,services:clean(raw.services,2000),audience:clean(raw.audience,600),
   existingWebsite:url(raw.existingWebsite||''),domain:clean(raw.domain,180),pages:list(raw.pages,PAGES,10),
   features:list(raw.features,FEATURES,9),callToAction:clean(raw.callToAction,250),
   contentReadiness:['ready','some','need_help'].includes(String(raw.contentReadiness))?String(raw.contentReadiness):'need_help'};
 }
 const qty=Number(raw.quantity);
 if(!Number.isSafeInteger(qty)||qty<0||qty>100000)invalid('INVALID_PRINT_QUANTITY');
 const sides=String(raw.sides||'not_sure'),orientation=String(raw.orientation||'not_sure'),finish=String(raw.finish||'not_sure');
 if(!SIDES.has(sides)||!ORIENT.has(orientation)||!FINISH.has(finish))invalid('INVALID_PRINT_OPTIONS');
 const printedName=clean(raw.printedName,160);
 if(printedName.length<2)invalid('PRINTED_NAME_REQUIRED');
 return {...common,printedName,printedTitle:clean(raw.printedTitle,120),printedPhone:clean(raw.printedPhone,80),
  printedEmail:email(raw.printedEmail||''),printedAddress:clean(raw.printedAddress,500),
  printedWebsite:clean(raw.printedWebsite,180),tagline:clean(raw.tagline,200),
  quantity:qty,sides,orientation,finish,qrUrl:url(raw.qrUrl||''),
  specialInstructions:clean(raw.specialInstructions,1500)};
}
module.exports={normalize,generateToken,hashToken,validToken,requireType,url,MAX_BODY};
