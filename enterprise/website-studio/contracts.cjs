'use strict';
// Pure validation at the compiler trust boundary. The caller must obtain
// verified_profile from an owner-authorized CRM read, never raw lead research.
const fail=(reason)=>{throw Error(reason);};
const record=(value)=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,permitted)=>Object.keys(value).every(key=>permitted.includes(key));
const string=(s,n=180)=>typeof s==='string'&&s.trim().length>0&&s.length<=n&&!/[\u0000-\u001f\u007f]/.test(s);
const optional=(s,n=180)=>s===null||s===undefined||s===''||string(s,n);
const validURL=(s)=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}};
function verifiedProfile(p){
 if(!record(p)||!keys(p,['schemaVersion','business','services','reviews','contact','verification'])||p.schemaVersion!==1)fail('INVALID_VERIFIED_PROFILE');
 const b=p.business;
 if(!record(b)||!keys(b,['name','category','city','region'])||!string(b.name,120)||!string(b.category,90)||!optional(b.city,90)||!optional(b.region,60))fail('INVALID_VERIFIED_PROFILE');
 if(!Array.isArray(p.services)||p.services.length>12||p.services.some(s=>!record(s)||!keys(s,['name','description','provenance'])||!string(s.name,90)||!optional(s.description,280)||
   (s.provenance!==undefined&&(!record(s.provenance)||!keys(s.provenance,['kind','source_url'])||!['owner_confirmed','approved_signal'].includes(s.provenance.kind)||
     (s.provenance.kind==='approved_signal'&&!validURL(s.provenance.source_url))||
     (s.provenance.source_url!==undefined&&!validURL(s.provenance.source_url))))))fail('INVALID_VERIFIED_PROFILE');
 if(!Array.isArray(p.reviews)||p.reviews.length>10||p.reviews.some(r=>!record(r)||!keys(r,['quote','attribution','approved','source_url'])||!string(r.quote,350)||!string(r.attribution,120)||typeof r.approved!=='boolean'||
     (r.source_url!==undefined&&!validURL(r.source_url))))fail('INVALID_VERIFIED_PROFILE');
 const c=p.contact;
 if(!record(c)||!keys(c,['phone','email'])||!optional(c.phone,32)||!optional(c.email,160)||
   (c.phone&& !/^\+?[0-9() .-]{10,25}$/.test(c.phone))||
   (c.email&& !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.email)))fail('INVALID_VERIFIED_PROFILE');
 const v=p.verification;
 if(!record(v)||!keys(v,['approvedBy','approvedAt'])||!string(v.approvedBy,100)||!string(v.approvedAt,40)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v.approvedAt)||Number.isNaN(Date.parse(v.approvedAt)))fail('INVALID_VERIFIED_PROFILE');
 return p;
}
function designTokens(t){
 if(!record(t)||!keys(t,['schemaVersion','identity','palette','typography','shape'])||t.schemaVersion!==1||!record(t.identity)||!keys(t.identity,['vertical','variant','mood'])||
 !string(t.identity.vertical,40)||!string(t.identity.variant,40)||!string(t.identity.mood,70)||!record(t.palette)||
 !keys(t.palette,['background','surface','ink','accent','soft','border'])||Object.values(t.palette).some(x=>typeof x!=='string'||!/^#[0-9a-f]{6}$/i.test(x))||
 !record(t.typography)||!keys(t.typography,['display','body'])||!['system-ui','Georgia'].includes(t.typography.display)||t.typography.body!=='system-ui'||
 !record(t.shape)||!keys(t.shape,['radius','shadow'])||!['12px','16px','20px'].includes(t.shape.radius)||!['soft','crisp'].includes(t.shape.shadow))fail('INVALID_DESIGN_TOKENS');
 return t;
}
const types=['hero','services','socialProof','quoteRequest','contact','cta'];
function layoutAst(a){
 if(!record(a)||!keys(a,['schemaVersion','kind','sections'])||a.schemaVersion!==1||a.kind!=='SBCStaticSite'||!Array.isArray(a.sections)||a.sections.length<2||a.sections.length>10)fail('INVALID_LAYOUT_AST');
 if(a.sections.some(s=>!record(s)||!keys(s,['type','title','description','items','layout'])||!types.includes(s.type)||!string(s.title,180)||!optional(s.description,450)||
    (s.layout!==undefined&&!['grid','bento','stack'].includes(s.layout))||
    (s.items!==undefined&&(!Array.isArray(s.items)||s.items.length>12||s.items.some(i=>!record(i)||!keys(i,['title','description','attribution'])||!string(i.title,160)||!optional(i.description,450)||!optional(i.attribution,120))))))fail('INVALID_LAYOUT_AST');
 if(a.sections[0].type!=='hero'||!a.sections.some(s=>s.type==='contact'))fail('INVALID_LAYOUT_AST');
 return a;
}
module.exports={verifiedProfile,designTokens,layoutAst,validURL,record,string};
