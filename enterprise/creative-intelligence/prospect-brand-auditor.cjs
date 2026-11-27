'use strict';
// Offline, evidence-only audit. Never connect from a request handler or mutate CRM state.
const net=require('node:net'),dns=require('node:dns/promises'),https=require('node:https'),tls=require('node:tls');
const {createHash}=require('node:crypto');
const MAX_BYTES=512*1024,MAX_MS=10000,MAX_AGE=24*60*60*1000;
const KEYS=Object.freeze(['title','description','viewport','h1','contactLink','form','structuredData','socialPreview','language','alternateSpanish']);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=code=>{throw Error(code);};
function normalizeTargetUrl(raw){
 if(typeof raw!=='string'||!raw.trim()||raw.length>1000||/[\x00-\x20\x7f\\]/.test(raw.trim()))fail('INVALID_TARGET');
 let u;try{u=new URL(raw.includes('://')?raw.trim():'https://'+raw.trim());}catch{fail('INVALID_TARGET');}
 const host=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||net.isIP(host)||host.startsWith('[')||host.length>253||!host.includes('.')||!/^[a-z0-9.-]+$/.test(host)||host.split('.').some(x=>!x||x.length>63||x.startsWith('-')||x.endsWith('-'))||/\.(?:local|internal|localhost|lan|home|test|invalid|example|onion|arpa)$/.test(host))fail('INVALID_TARGET');
 return u.href;
}
function isPublicIPv4(ip){
 if(net.isIP(ip)!==4)return false;
 const [a,b,c]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&(c===0||c===2))||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
async function resolveTarget(raw,resolver=dns.resolve4){
 const url=normalizeTargetUrl(raw),host=new URL(url).hostname,ips=await resolver(host);
 if(!Array.isArray(ips)||!ips.length||ips.length>32||ips.some(x=>!isPublicIPv4(x)))fail('BLOCKED_DNS');
 return {url,address:ips[0]};
}
async function captureWebsite(raw){
 const signal=AbortSignal.timeout(MAX_MS);let abort;
 const timed=new Promise((_,reject)=>{abort=()=>reject(Error('CAPTURE_TIMEOUT'));signal.addEventListener('abort',abort,{once:true});});
 try{
  const {url,address}=await Promise.race([resolveTarget(raw),timed]),u=new URL(url);signal.throwIfAborted();
  return await Promise.race([new Promise((resolve,reject)=>{
   // Connect to the vetted literal IP, retain original Host, SNI and certificate verification.
   const req=https.request({hostname:address,port:443,path:u.pathname,method:'GET',servername:u.hostname,checkServerIdentity:(_h,cert)=>tls.checkServerIdentity(u.hostname,cert),rejectUnauthorized:true,agent:false,family:4,signal,headers:{Host:u.hostname,'User-Agent':'SBC-Brand-Auditor/1.0 (+https://sbcmia.com)',Accept:'text/html','Accept-Encoding':'identity'}},res=>{
    const mime=String(res.headers['content-type']||'').split(';')[0].trim().toLowerCase(),encoding=String(res.headers['content-encoding']||'identity').toLowerCase();
    // Never follow redirects, decode compressed input, or interpret partial/error pages as complete evidence.
    if(res.statusCode!==200||mime!=='text/html'||encoding!=='identity'||Number(res.headers['content-length'])>MAX_BYTES){res.destroy();reject(Error('CAPTURE_UNAVAILABLE'));return;}
    const chunks=[];let count=0;res.on('data',b=>{count+=b.length;if(count>MAX_BYTES){res.destroy(Error('CAPTURE_LIMIT'));return;}chunks.push(b);});
    res.on('error',reject);res.on('aborted',()=>reject(Error('CAPTURE_INCOMPLETE')));res.on('end',()=>{if(!res.complete||!count){reject(Error('CAPTURE_INCOMPLETE'));return;}resolve({url,status:200,checkedAt:new Date().toISOString(),html:Buffer.concat(chunks)});});
   });req.on('error',reject);req.end();
  }),timed]);
 }finally{signal.removeEventListener('abort',abort);}
}
function inspectDocument(doc){
 // A trusted offline HTML parser supplies this DOM; no JS execution or external resources.
 const has=s=>Boolean(doc.querySelector(s)),nonempty=s=>Boolean(doc.querySelector(s)?.textContent?.trim());
 const meta=n=>[...doc.querySelectorAll('meta[name]')].some(m=>m.getAttribute('name').toLowerCase()===n&&Boolean(m.getAttribute('content')?.trim()));
 return {title:nonempty('title'),description:meta('description'),viewport:meta('viewport'),h1:nonempty('h1'),contactLink:[...doc.querySelectorAll('a[href]')].some(a=>/^(?:tel:|mailto:)/i.test(a.getAttribute('href').trim())),form:has('form'),structuredData:has('script[type="application/ld+json"]'),socialPreview:[...doc.querySelectorAll('meta[property]')].some(m=>/^og:(title|image)$/i.test(m.getAttribute('property'))&&Boolean(m.getAttribute('content')?.trim())),language:Boolean(doc.documentElement?.getAttribute('lang')?.trim()),alternateSpanish:[...doc.querySelectorAll('link[rel][hreflang],a[hreflang]')].some(x=>/^es(?:-|$)/i.test(x.getAttribute('hreflang'))&&Boolean(x.getAttribute('href')?.trim()))};
}
function auditProspectBrand(lead,{tenantRef,snapshot=null,now=Date.now()}={}){
 if(!id(tenantRef)||lead?.tenantRef!==tenantRef||!id(lead?.leadId)||typeof lead.businessName!=='string'||!lead.businessName.trim()||lead.businessName.length>160||/[\x00-\x1f\x7f]/.test(lead.businessName)||!Number.isFinite(now))fail('INVALID_LEAD_SCOPE');
 let url=null,status='WEBSITE_NOT_ON_FILE';if(lead.websiteUrl){try{url=normalizeTargetUrl(lead.websiteUrl);status='CAPTURE_UNAVAILABLE';}catch{status='TARGET_NOT_SUPPORTED';}}
 const stamp=Date.parse(snapshot?.checkedAt),valid=Boolean(url&&snapshot?.url===url&&snapshot.status===200&&hash(snapshot.htmlSha256)&&Number.isFinite(stamp)&&stamp<=now&&now-stamp<=MAX_AGE&&snapshot.signals&&typeof snapshot.signals==='object'&&!Array.isArray(snapshot.signals));
 if(valid)status='CAPTURE_REVIEW_REQUIRED';
 const checks=KEYS.map(key=>({key,result:valid&&Object.hasOwn(snapshot.signals,key)&&typeof snapshot.signals[key]==='boolean'?(snapshot.signals[key]?'detected':'not_detected'):'unknown'}));
 const absent=key=>checks.some(x=>x.key===key&&x.result==='not_detected'),findings=[];
 const add=(code,en,es)=>findings.push({code,findingEn:en,findingEs:es,source:{url,checkedAt:snapshot.checkedAt,htmlSha256:snapshot.htmlSha256}});
 if(absent('viewport'))add('VIEWPORT_ABSENT','No nonempty viewport meta tag was detected in the captured page HTML.','No se detectó una etiqueta meta viewport con contenido en el HTML revisado.');
 if(absent('contactLink')&&absent('form'))add('CONTACT_MARKUP_ABSENT','No telephone/email link or form was detected in the captured HTML; verify other contact or booking options manually.','No se detectó un enlace de teléfono/correo ni formulario en el HTML revisado; verifica otras opciones de contacto o reservas.');
 if(absent('title'))add('TITLE_ABSENT','No nonempty page title was detected in the captured HTML.','No se detectó un título de página con contenido en el HTML revisado.');
 if(absent('h1'))add('H1_ABSENT','No nonempty H1 heading was detected in the captured HTML.','No se detectó un encabezado H1 con contenido en el HTML revisado.');
 if(absent('description'))add('DESCRIPTION_ABSENT','No nonempty meta description was detected in the captured HTML.','No se detectó una meta descripción con contenido en el HTML revisado.');
 const websiteGaps=findings.some(f=>f.code==='VIEWPORT_ABSENT'||f.code==='CONTACT_MARKUP_ABSENT');
 const recommendedPackage=websiteGaps?{name:'Starter Website',startingPriceUsd:199,reason:'Discuss a website improvement or replacement; confirm current needs and scope first.'}:null;
 return {schemaVersion:1,tenantRef,leadId:lead.leadId,businessName:lead.businessName,websiteUrl:url,evidenceStatus:status,coverage:checks.filter(x=>x.result!=='unknown').length/KEYS.length,overallScore:null,checks,findings,recommendedPackage,salesBrief:{previewExists:false,proofPoints:findings.slice(0,3),openerEn:'Use the owner-approved SBC introduction. Ask permission to discuss the observed page markup before making recommendations.',openerEs:'Usa la introducción aprobada por SBC. Pide permiso para comentar lo observado antes de recomendar servicios.'},reviewRequired:true,automaticOutreach:false,verificationStatusChanged:false};
}
async function captureAndAudit(lead,tenantRef){
 // CLI-only: jsdom is a development dependency, scripts/resources remain disabled.
 const initial=auditProspectBrand(lead,{tenantRef});
 if(!initial.websiteUrl)return initial;
 let capture;try{capture=await captureWebsite(lead.websiteUrl);}catch{return auditProspectBrand(lead,{tenantRef});}
 const {JSDOM}=require('jsdom');const dom=new JSDOM(capture.html,{contentType:'text/html',url:capture.url});
 try{return auditProspectBrand(lead,{tenantRef,snapshot:{url:capture.url,checkedAt:capture.checkedAt,status:capture.status,htmlSha256:createHash('sha256').update(capture.html).digest('hex'),signals:inspectDocument(dom.window.document)}});}finally{dom.window.close();}
}
module.exports=Object.freeze({normalizeTargetUrl,isPublicIPv4,resolveTarget,captureWebsite,inspectDocument,auditProspectBrand,captureAndAudit});
