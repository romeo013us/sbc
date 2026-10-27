'use strict';
const dns=require('dns').promises;
const crypto=require('crypto');
function clean(v,n=500){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function normEmail(v){return clean(v,320).toLowerCase()}
function normPhone(v){const d=String(v||'').replace(/\D/g,''); return d.length===11&&d.startsWith('1')?'+'+d:'+'+d}
function domainOf(urlOrEmail){const s=String(urlOrEmail||'').trim().toLowerCase(); if(s.includes('@'))return s.split('@').pop(); try{return new URL(/^https?:\/\//i.test(s)?s:'https://'+s).hostname.replace(/^www\./,'')}catch{return ''}}
function scoreLead(c,evidence={}){
  const checks=[]; const has=v=>Boolean(String(v||'').trim());
  const fields=[['businessName',c.businessName],['contactName',c.contactName],['phone',c.phone],['email',c.email],['website',c.website],['address',c.address||c.city],['industry',c.industry]];
  for(const [k,v] of fields)checks.push({field:k,ok:has(v)});
  const sources=Number(evidence.sourceCount||0); const corroboration=Number(evidence.corroboration||0);
  const completeness=Math.round(checks.filter(x=>x.ok).length/checks.length*100);
  const evidenceScore=Math.min(100,sources*10+corroboration*15);
  const contactScore=(has(c.email)?35:0)+(has(c.phone)?35:0)+(has(c.website)?15:0)+(has(c.contactName)?15:0);
  const score=Math.min(100,Math.round(completeness*.35+evidenceScore*.25+contactScore*.40));
  const confidence=score>=85?'HIGH':score>=65?'MEDIUM':'LOW';
  return {score,confidence,completeness,evidenceScore,contactScore,missing:checks.filter(x=>!x.ok).map(x=>x.field)};
}
async function mx(domain){if(!domain)return false;try{const r=await dns.resolveMx(domain);return Array.isArray(r)&&r.length>0}catch{return false}}
async function fetchJson(url,opts={}){const r=await fetch(url,{...opts,signal:AbortSignal.timeout(Number(opts.timeoutMs||12000))});let j={};try{j=await r.json()}catch{};if(!r.ok)throw new Error(`HTTP ${r.status}`);return j}
async function googlePlaces(seed,key){if(!key)return {provider:'google_places',configured:false,results:[]};const q=[seed.businessName,seed.city,seed.region].filter(Boolean).join(', ');if(!q)return {provider:'google_places',configured:true,results:[]};const fields='places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus,places.primaryType,places.primaryTypeDisplayName';const j=await fetchJson('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':fields},body:JSON.stringify({textQuery:q,maxResultCount:3,languageCode:'en'})});return {provider:'google_places',configured:true,results:(j.places||[]).slice(0,3)} }
async function hunterDomain(domain,key){if(!key||!domain)return {provider:'hunter',configured:Boolean(key),emails:[]};const j=await fetchJson(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(key)}`);const emails=(j.data?.emails||[]).map(x=>({value:normEmail(x.value),type:x.type||'',confidence:Number(x.confidence||0),firstName:x.first_name||'',lastName:x.last_name||'',position:x.position||'',sources:(x.sources||[]).map(s=>s.uri||s.url||'').filter(Boolean)})).filter(x=>x.value);return {provider:'hunter',configured:true,emails:emails.slice(0,20),pattern:j.data?.pattern||''}}
async function hunterVerify(email,key){if(!key||!email)return null;try{const j=await fetchJson(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(key)}`);return {email,status:j.data?.status||'unknown',score:Number(j.data?.score||0),result:j.data?.result||'',regexp:j.data?.regexp,webmail:j.data?.webmail,disposable:j.data?.disposable,acceptAll:j.data?.accept_all,sources:j.data?.sources||[]}}catch(e){return {email,status:'error',error:e.message}}}
async function apolloOrg(domain,key){if(!key||!domain)return null;try{const j=await fetchJson(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`,{headers:{'x-api-key':key,'Cache-Control':'no-cache'}});return j.organization||null}catch{return null}}
async function apolloPerson(seed,key){if(!key||!seed.contactName||!seed.businessName)return null;try{const body={organization_name:seed.businessName,person_name:seed.contactName};if(seed.website)body.domain=domainOf(seed.website);const j=await fetchJson('https://api.apollo.io/api/v1/people/match',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'Cache-Control':'no-cache'},body:JSON.stringify(body)});const p=j.person||null;if(!p)return null;return {name:p.name||'',title:p.title||'',email:p.email||'',organization:p.organization?.name||'',city:p.city||'',state:p.state||'',linkedinUrl:p.linkedin_url||'',matchConfidence:p.match_confidence||''}}catch{return null}}
async function twilioPhone(phone,creds){if(!phone||!creds?.accountSid||!creds?.authToken)return null;try{const url=`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(normPhone(phone))}`;const basic=Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');const j=await fetchJson(url,{headers:{Authorization:`Basic ${basic}`}});return {valid:j.valid===true,phoneNumber:j.phoneNumber||'',nationalFormat:j.nationalFormat||'',countryCode:j.countryCode||'',validationErrors:j.validationErrors||[]}}catch(e){return {valid:false,error:e.message}}}
async function run(raw,opts={}){
 const seed={businessName:clean(raw.businessName,180),contactName:clean(raw.contactName,180),email:normEmail(raw.email),phone:clean(raw.phone,80),website:clean(raw.website,500),city:clean(raw.city,120),region:clean(raw.region||raw.state,80),industry:clean(raw.industry,120),address:clean(raw.address,240)};
 const publicResearch=opts.publicResearch||null;
 const google=await googlePlaces(seed,opts.googleApiKey).catch(e=>({provider:'google_places',configured:true,error:e.message,results:[]}));
 const g=google.results?.[0]||{};
 const orgDomain=domainOf(seed.website||g.websiteUri||'');
 const hunter=await hunterDomain(orgDomain,opts.hunterApiKey).catch(e=>({provider:'hunter',configured:true,error:e.message,emails:[]}));
 const hunterEmails=hunter.emails||[];
 const emailCandidates=[seed.email,...(publicResearch?.emails||[]),...hunterEmails.map(x=>x.value)].map(normEmail).filter(Boolean);
 const uniqueEmails=[...new Set(emailCandidates)].slice(0,10);
 const verifications=[];
 if(opts.hunterApiKey){for(const email of uniqueEmails.slice(0,5))verifications.push(await hunterVerify(email,opts.hunterApiKey));}
 const apOrg=await apolloOrg(orgDomain,opts.apolloApiKey);
 const apPerson=await apolloPerson({...seed,businessName:seed.businessName||g.displayName?.text||''},opts.apolloApiKey);
 const tw=await twilioPhone(seed.phone||g.nationalPhoneNumber,opts.twilio);
 const selectedEmail=(verifications.find(x=>x?.status==='valid')?.email)||hunterEmails.find(x=>x.confidence>=90)?.value||publicResearch?.emails?.[0]||seed.email||'';
 const selectedPhone=tw?.valid?(tw.phoneNumber||seed.phone||g.nationalPhoneNumber||''):(g.nationalPhoneNumber||seed.phone||'');
 const selectedWebsite=seed.website||g.websiteUri||publicResearch?.website||'';
 const selectedContact=seed.contactName||hunterEmails.find(x=>x.firstName||x.lastName)?.firstName&&`${hunterEmails.find(x=>x.firstName||x.lastName)?.firstName||''} ${hunterEmails.find(x=>x.firstName||x.lastName)?.lastName||''}`.trim()||apPerson?.name||'';
 const selectedAddress=seed.address||g.formattedAddress||publicResearch?.addresses?.[0]||'';
 const selectedIndustry=seed.industry||g.primaryTypeDisplayName?.text||apOrg?.industry||publicResearch?.industryHints?.[0]||'';
 const merged={...seed,email:selectedEmail,phone:selectedPhone,website:selectedWebsite,contactName:selectedContact,address:selectedAddress,industry:selectedIndustry,city:seed.city||g.shortFormattedAddress||apOrg?.city||''};
 const sourceCount=[publicResearch?.sourceUrls?.length||0,google.results?.length||0,hunterEmails.length,apOrg?1:0,apPerson?1:0,tw?1:0].filter(Boolean).length;
 const corroboration=[g.displayName?.text,g.websiteUri,g.nationalPhoneNumber,g.formattedAddress,publicResearch?.emails?.length,hunterEmails.length,apOrg?.name,apPerson?.name].filter(Boolean).length;
 const score=scoreLead(merged,{sourceCount,corroboration});
 const emailMx=merged.email?await mx(domainOf(merged.email)):false;
 const hard={businessMatch:Boolean(g.displayName?.text||publicResearch?.businessName),emailFormat:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(merged.email||''),emailMx,phoneValid:tw?tw.valid:Boolean(merged.phone),website:Boolean(merged.website),address:Boolean(merged.address)};
 const autoVerify=Boolean(merged.businessName&&((hard.emailFormat&&hard.emailMx)||hard.phoneValid)&&hard.website&&(score.confidence!=='LOW'));
 return {ok:true,checkedAt:new Date().toISOString(),merged,score,hard,autoVerify,providers:{google_places:google,hunter,apollo:{organization:apOrg,person:apPerson},twilio_lookup:tw},emailCandidates:uniqueEmails,emailVerifications:verifications,publicResearch:publicResearch||null,evidence:{sourceCount,corroboration},note:'Business/professional public-source research. Provider results are evidence, not identity proof. Human review remains available.'};
}
module.exports={run,scoreLead,domainOf,normEmail,normPhone};
