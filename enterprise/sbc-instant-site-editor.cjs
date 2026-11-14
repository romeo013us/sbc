'use strict';
/* SBC native website editor: bounded, deterministic, versioned draft changes.
 * No AI/API costs. Owner approval, customer publication and DNS are separate.
 */
const FIELDS=Object.freeze({
 headline:130,subheadline:280,about:1200
});
const OPTIONAL=Object.freeze(['headline','subheadline','about','services','themeVariant','showGallery','showVideo','showFaq']);
const text=(value,max)=>{
 if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
   throw Error('INVALID_SITE_CONTENT');
 return value.trim();
};
function normalize(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('INVALID_SITE_CONTENT');
 for(const key of Object.keys(raw))if(!OPTIONAL.includes(key))throw Error('UNSUPPORTED_SITE_FIELD');
 const out={};
 for(const [key,max] of Object.entries(FIELDS))out[key]=key in raw?text(raw[key],max):'';
 if('services' in raw){
  if(!Array.isArray(raw.services)||raw.services.length>6)throw Error('INVALID_SITE_CONTENT');
  out.services=raw.services.map(v=>text(v,90)).filter(Boolean);
 }else out.services=[];
 if('themeVariant' in raw){
  if(!Number.isInteger(raw.themeVariant)||raw.themeVariant<0||raw.themeVariant>3)throw Error('INVALID_SITE_CONTENT');
  out.themeVariant=raw.themeVariant;
 }else out.themeVariant=0;
 for(const name of ['showGallery','showVideo','showFaq']){
  if(name in raw && typeof raw[name]!=='boolean')throw Error('INVALID_SITE_CONTENT');
  out[name]=name in raw?raw[name]:true;
 }
 return Object.freeze(out);
}
function version(site){
 const n=site?.siteEditsVersion??0;
 if(!Number.isSafeInteger(n)||n<0)throw Error('INVALID_SITE_VERSION');
 return n;
}
function apply(site,body){
 if(!site||typeof site!=='object')throw Error('SITE_NOT_FOUND');
 if(site.archived===true)throw Error('SITE_ARCHIVED');
 if(site.status==='Approved')throw Error('APPROVED_SITE_LOCKED');
 if(site.status!=='Draft'&&site.status!=='Pending')throw Error('SITE_NOT_EDITABLE');
 if(!body||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<0)
   throw Error('INVALID_SITE_VERSION');
 if(body.expectedVersion!==version(site))throw Error('STALE_SITE_VERSION');
 const edits=normalize(body.siteEdits);
 return {...site,siteEdits:edits,siteEditsVersion:version(site)+1,
  siteEditedAt:new Date().toISOString()};
}
function view(site){
 return {id:String(site.id),customerId:String(site.customerId||''),status:String(site.status||''),
  offerTier:site.offerTier==='starter'?'starter':'essentials',siteEdits:site.siteEdits||{},
  siteEditsVersion:version(site)};
}
module.exports={normalize,version,apply,view};
