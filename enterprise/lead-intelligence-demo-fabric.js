'use strict';
const dns=require('dns').promises;
const net=require('net');
const crypto=require('crypto');

function id(prefix='li'){return `${prefix}_${crypto.randomUUID()}`;}
function clean(v,n=500){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function normalizeUrl(raw){let s=String(raw||'').trim();if(!s)return null;if(/^[a-z][a-z0-9+.-]*:\/\//i.test(s)&&!/^https?:\/\//i.test(s))return null;if(!/^https?:\/\//i.test(s))s='https://'+s;try{const u=new URL(s);if(!['http:','https:'].includes(u.protocol))return null;u.hash='';return u.toString()}catch{return null}}
function isPrivateIp(ip){if(!net.isIP(ip))return true;const parts=ip.includes(':')?null:ip.split('.').map(Number);if(parts){const [a,b]=parts;return a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||a===0||a>=224;}return /^::1$|^fc|^fd|^fe8|^fe9|^fea|^feb|^::ffff:10\.|^::ffff:192\.168\./i.test(ip)}
async function assertPublicHost(u){const host=u.hostname.toLowerCase();if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local'))throw new Error('Private/local targets are not allowed.');const addrs=await dns.lookup(host,{all:true}).catch(()=>[]);if(!addrs.length)throw new Error('Target host could not be resolved.');if(addrs.some(x=>isPrivateIp(x.address)))throw new Error('Target resolves to a private or reserved address.')}
function stripHtml(html){return clean(String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' '),12000)}
function attr(html,tag,name){const re=new RegExp(`<${tag}[^>]*\\b${name}=["']([^"']*)["'][^>]*>`,'i');return clean(html.match(re)?.[1]||'',500)}
function metaContent(html,name){const re=new RegExp(`<meta[^>]*\\bname=["']${name}["'][^>]*\\bcontent=["']([^"']*)["'][^>]*>|<meta[^>]*\\bcontent=["']([^"']*)["'][^>]*\\bname=["']${name}["'][^>]*>`,'i');const m=html.match(re);return clean(m?.[1]||m?.[2]||'',500)}
function allMatches(html,re,limit=20){const out=[];let m;while(out.length<limit&&(m=re.exec(html)))out.push(m[1]);return [...new Set(out.map(x=>clean(x,300)).filter(Boolean))]}
function parse(html,url){
 const text=stripHtml(html);
 const title=clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),180);
 const description=metaContent(html,'description');
 const headings=allMatches(html,/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi,30).map(x=>stripHtml(x,)).slice(0,20);
 const emails=allMatches(html,/mailto:([^"'?#>\s]+)/gi,10);
 const phones=allMatches(html,/(?:tel:|(?:href=["'][^"']*?))(\+?\d[\d\s().-]{7,}\d)/gi,10).map(x=>x.replace(/[^\d+]/g,''));
 const socials=[]; const hrefs=allMatches(html,/href=["'](https?:\/\/[^"']+)["']/gi,100); for(const h of hrefs){if(/facebook|instagram|linkedin|youtube|tiktok|x\.com|twitter/i.test(h))socials.push(h)}
 const images=(html.match(/<img\b/gi)||[]).length; const links=(html.match(/<a\b/gi)||[]).length;
 const viewport=/name=["']viewport["']/i.test(html); const https=url.startsWith('https://');
 const ctas=allMatches(html,/<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi,40).map(stripHtml).filter(x=>/call|book|quote|contact|schedule|request|buy|order|get started|learn more/i.test(x)).slice(0,12);
 const theme=metaContent(html,'theme-color');
 const gaps=[]; if(!title)gaps.push('missing_title'); if(!description)gaps.push('missing_meta_description'); if(!viewport)gaps.push('missing_mobile_viewport'); if(!https)gaps.push('not_https'); if(images===0)gaps.push('no_images_detected'); if(ctas.length===0)gaps.push('weak_or_missing_primary_cta'); if(headings.length===0)gaps.push('no_heading_structure');
 return {url,title,description,headings,emails,phones,socials:[...new Set(socials)].slice(0,10),images,links,viewport,https,themeColor:theme,ctas,textSample:text.slice(0,2500),gaps,contentBytes:Buffer.byteLength(html)};
}
async function auditWebsite(rawUrl,opts={}){
 const url=normalizeUrl(rawUrl); if(!url)throw new Error('A valid public website URL is required.'); await assertPublicHost(new URL(url));
 const timeout=Number(opts.timeoutMs||10000); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const r=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'SBC-Live-Business-Intelligence/1.0 (+public-site-audit)'}});
  const finalUrl=r.url||url; const html=await r.text(); if(html.length>2*1024*1024)throw new Error('Website response exceeds the public-audit size limit.');
  const parsed=parse(html,finalUrl); parsed.httpStatus=r.status; parsed.reachable=r.ok||r.status<500; parsed.checkedAt=new Date().toISOString(); return parsed;
 }finally{clearTimeout(timer)}
}
function buildBrief(input={},audit={}){
 const industry=clean(input.industry||'',100), businessName=clean(input.businessName||'',120), city=clean(input.city||'',100);
 const serviceHints=[...new Set([...(input.services||[]).map(x=>clean(x?.name||x,80)),...(audit.headings||[]).filter(x=>/service|repair|clean|tax|book|consult|design|install|therapy|menu|product/i.test(x)).slice(0,8)])].slice(0,8);
 const strengths=[]; const opportunities=[];
 if(audit.reachable){strengths.push('Public website is reachable'); if(audit.https)strengths.push('HTTPS detected'); if(audit.viewport)strengths.push('Mobile viewport detected'); if(audit.images>0)strengths.push(`${audit.images} image element${audit.images===1?'':'s'} detected`); if(audit.socials?.length)strengths.push('Social links detected');}
 for(const g of audit.gaps||[]) opportunities.push(g.replace(/_/g,' '));
 const styleText=`${industry}${businessName?' · '+businessName:''}${city?' · '+city:''}`;
 return {businessName,industry,city,sourceUrl:audit.url||'',websiteStatus:audit.reachable?'reachable':'unreachable',websiteAudit:audit,serviceHints,strengths,opportunities,designInputs:{businessName,industry,city,serviceHints,brandColor:audit.themeColor||'',tone:opportunities.length?'conversion-focused, modern and specific':'polished, trustworthy and industry-specific'},salesHook:opportunities.length?`Live website review for ${styleText}: ${opportunities.slice(0,3).join(', ')}.`:`Live website review found a functioning public presence for ${styleText}; build the demo around clearer conversion paths and stronger brand specificity.`,createdAt:new Date().toISOString()};
}

async function enrichBusiness(raw={}){
 const seed={businessName:clean(raw.businessName,160),contactName:clean(raw.contactName,160),email:clean(raw.email,320),phone:clean(raw.phone,80),website:normalizeUrl(raw.website),city:clean(raw.city,120),region:clean(raw.region||raw.state,80),industry:clean(raw.industry,120)};
 const candidates=[];
 if(seed.website)candidates.push(seed.website);
 if(seed.website){
  const u=new URL(seed.website); const base=`${u.origin}`;
  for(const path of ['/contact','/contact-us','/about','/about-us','/team','/our-team','/services','/locations']){
   try{const x=new URL(path,base).toString();if(!candidates.includes(x))candidates.push(x)}catch{}
  }
 }
 const pages=[]; const aggregate={emails:new Set(),phones:new Set(),socials:new Set(),addresses:new Set(),contactNames:new Set(),industries:new Set(),sourceUrls:[]};
 for(const url of candidates.slice(0,8)){
  try{
   const audit=await auditWebsite(url,{timeoutMs:7000});
   pages.push(audit); aggregate.sourceUrls.push(audit.url);
   (audit.emails||[]).forEach(x=>aggregate.emails.add(x.toLowerCase()));
   (audit.phones||[]).forEach(x=>aggregate.phones.add(x));
   (audit.socials||[]).forEach(x=>aggregate.socials.add(x));
   const htmlText=String(audit.textSample||'');
   const addr=[...htmlText.matchAll(/\b\d{1,6}\s+[A-Za-z0-9.'#& -]{3,80}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pkwy|Parkway|Hwy|Highway)\b[^\n]{0,100}/gi)].map(m=>clean(m[0],220));
   addr.forEach(x=>aggregate.addresses.add(x));
   const title=String(audit.title||'');
   if(title && !seed.businessName)seed.businessName=title.split(/[|·—-]/)[0].trim().slice(0,160);
   const industryHints=(audit.headings||[]).filter(x=>/salon|barber|restaurant|roof|plumb|electric|clean|law|legal|account|tax|real estate|insurance|auto|repair|construction|landscap|medical|dental|beauty|spa|fitness|consult|marketing|printing|photograph|catering|daycare|childcare|church|churches/i.test(x));
   industryHints.forEach(x=>aggregate.industries.add(x));
  }catch(e){pages.push({url,reachable:false,error:e.message})}
 }
 const firstReachable=pages.find(x=>x.reachable);
 const foundEmail=[...aggregate.emails][0]||seed.email||'';
 const foundPhone=[...aggregate.phones][0]||seed.phone||'';
 return {
  ok:true,seed,website:seed.website||firstReachable?.url||'',reachable:Boolean(firstReachable),
  email:foundEmail,emails:[...aggregate.emails].slice(0,10),phone:foundPhone,phones:[...aggregate.phones].slice(0,10),
  socials:[...aggregate.socials].slice(0,12),addresses:[...aggregate.addresses].slice(0,8),
  industryHints:[...aggregate.industries].slice(0,12),pages:pages.map(x=>({url:x.url,reachable:x.reachable,httpStatus:x.httpStatus,title:x.title,emails:x.emails,phones:x.phones,socials:x.socials,gaps:x.gaps,error:x.error||''})),
  sourceUrls:[...new Set(aggregate.sourceUrls)].slice(0,12),checkedAt:new Date().toISOString()
 };
}

async function discover(query,opts={}){
 const provider=String(opts.providerUrl||process.env.SBC_PROSPECT_PROVIDER_URL||'').trim(); if(!provider)return {ok:false,mode:'provider-gated',reason:'No prospect provider is configured. Use the existing SBC_PROSPECT_PROVIDER_URL slot when a compliant discovery provider is connected.',results:[]};
 const u=new URL(provider); u.searchParams.set('q',clean(query,300)); if(opts.city)u.searchParams.set('city',clean(opts.city,100)); if(opts.industry)u.searchParams.set('industry',clean(opts.industry,100));
 const r=await fetch(u,{headers:{'user-agent':'SBC-Lead-Intelligence/1.0'},signal:AbortSignal.timeout(Number(opts.timeoutMs||12000))}); if(!r.ok)throw new Error(`Prospect provider returned HTTP ${r.status}.`); const j=await r.json(); const rows=Array.isArray(j.results)?j.results:Array.isArray(j.leads)?j.leads:Array.isArray(j.data)?j.data:[];
 return {ok:true,mode:'provider',provider:new URL(provider).origin,count:rows.length,results:rows.slice(0,Math.min(100,Number(opts.limit||50)))};
}
module.exports={auditWebsite,buildBrief,discover,enrichBusiness,normalizeUrl,parse};
