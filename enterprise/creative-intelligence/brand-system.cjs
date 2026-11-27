'use strict';
// SBC's independent evidence rubric and draft compiler. No valuation or publication authority.
const {createHash}=require('node:crypto');
const FACTORS=Object.freeze(['clarity','alignment','customerInsight','responsiveness','distinctiveness','consistency','participation','presence','trust','affinity']);
const fail=code=>{throw Error('INVALID_'+code);};
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const text=(x,max)=>typeof x==='string'&&x.trim()===x&&x.length>0&&x.length<=max&&!/[\x00-\x1f\x7f]/.test(x);
function date(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
function source(s){try{const u=new URL(s);return text(s,1000)&&u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
function auditBrand(observations){
 if(!plain(observations)||Object.keys(observations).some(k=>!FACTORS.includes(k)))fail('BRAND_OBSERVATIONS');
 const factors=FACTORS.map(factor=>{if(!Object.hasOwn(observations,factor))return {factor,score:null,result:'unknown'};const e=observations[factor];if(!exact(e,['result','source','observedAt','note'])||!['pass','fail'].includes(e.result)||!source(e.source)||!date(e.observedAt)||!text(e.note,500))fail('BRAND_EVIDENCE');return {factor,score:e.result==='pass'?10:0,result:e.result,source:e.source,observedAt:e.observedAt,note:e.note};});
 const rated=factors.filter(f=>f.score!==null);return {method:'SBC documented-observation rubric v1',coverage:rated.length/FACTORS.length,overallScore:rated.length===FACTORS.length?rated.reduce((s,f)=>s+f.score,0)/FACTORS.length:null,factors,gaps:factors.filter(f=>f.result==='fail').map(f=>f.factor),valuation:null,publicationReady:false};
}
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
function compileBrandSystem(input,tenantRef){
 if(!exact(input,['tenantRef','name','positioning','tagline','palette','logoSha256','voice'])||typeof tenantRef!=='string'||!/^[A-Za-z0-9:_-]{1,160}$/.test(tenantRef)||input.tenantRef!==tenantRef||!text(input.name,120)||!text(input.positioning,280)||!text(input.tagline,120)||typeof input.logoSha256!=='string'||!/^[a-f0-9]{64}$/.test(input.logoSha256)||!Array.isArray(input.voice)||input.voice.length!==3||!input.voice.every(v=>text(v,50)))fail('BRAND_CONTRACT');
 const keys=['primary','accent','surface','ink'];if(!exact(input.palette,keys)||keys.some(k=>typeof input.palette[k]!=='string'||!/^#[a-f0-9]{6}$/i.test(input.palette[k])))fail('BRAND_PALETTE');
 const palette=Object.fromEntries(keys.map(k=>[k,input.palette[k].toUpperCase()]));const inkContrast=contrast(palette.ink,palette.surface);if(inkContrast<4.5)fail('BRAND_CONTRAST');const primaryContrast=contrast('#FFFFFF',palette.primary);if(primaryContrast<4.5)fail('BRAND_CONTRAST');
 const accentInk=contrast('#000000',palette.accent)>=contrast('#FFFFFF',palette.accent)?'#000000':'#FFFFFF';
 const contract={schemaVersion:1,tenantRef,name:input.name,positioning:input.positioning,tagline:input.tagline,palette,logoSha256:input.logoSha256,voice:[...input.voice],accentInk};const css=':root{'+keys.map(k=>'--brand-'+k+':'+palette[k]).join(';')+';--brand-accent-ink:'+accentInk+';--brand-primary-ink:#FFFFFF;}';
 return {...contract,css,digest:createHash('sha256').update(JSON.stringify(contract)).digest('hex'),publicationReady:false};
}
function campaignDrafts(day){
 if(!date(day))fail('CAMPAIGN_DATE');
 const draft=(id,label,headline,detail,cta,alt,palette='midnight')=>({id,label,headline,detail,cta,alt,palette,kind:'template-image',format:'square',publicationReady:false,requiresOriginalLogo:true});
 if(day==='2026-11-26')return [draft('thanksgiving-idea','Thanksgiving conversation','What business would you start with $10,000?','Hypothetical question, not a giveaway. Tell us your business idea or introduce your existing company.','Share your idea','Entrepreneurship discussion graphic asking what business you would start with a hypothetical $10,000.')];
 if(day==='2026-11-27')return [draft('black-friday-invest','Black Friday: invest in yourself','BLACK FRIDAY: INVEST IN YOURSELF','Your business deserves a website, too. Explore website design, branding and digital visibility with SBC.','Discuss your website','Black Friday graphic inviting small business owners to invest in their digital presence.','ink'),draft('black-friday-growth','Black Friday: growth conversation','What is stopping your business from growing?','Website, branding, local visibility or all three? Tell us what your business needs next.','Talk business','Black Friday business growth question highlighting websites, branding and local visibility.')];
 return [draft('owner-spotlight','Small business spotlight','What does your business do?','Introduce your business, who you serve and what makes you different. Let us celebrate local entrepreneurship.','Share your business','Community spotlight graphic inviting owners to introduce their businesses.'),draft('website-audit','Website conversation','Would your website win your next customer?','Think about mobile experience, clear contact details and your strongest service. Which would you improve?','Discuss your website','Website discussion graphic about mobile design and clear customer contact options.'),draft('brand-growth','Brand recognition','What do people remember about your brand?','A recognizable identity starts with a consistent message and customer experience. What is your brand known for?','Talk branding','Brand recognition question inviting business owners to describe their identity.')];
}
module.exports=Object.freeze({FACTORS,auditBrand,compileBrandSystem,campaignDrafts});
