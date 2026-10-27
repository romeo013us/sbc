'use strict';
const crypto = require('crypto');

const VERSION = '56.13.1';
const MAX_ROWS = 250000;
const MAX_SCORE = 100;

function clean(v, n=240){ return String(v ?? '').trim().slice(0,n); }
function digits(v){ return String(v||'').replace(/\D/g,''); }
function normalizePhone(v){
  const raw=clean(v,40); const d=digits(raw);
  if(d.length===10)return '+1'+d;
  if(d.length===11 && d.startsWith('1'))return '+'+d;
  if(raw.startsWith('+') && d.length>=8 && d.length<=15)return '+'+d;
  return raw;
}
function normalizeEmail(v){return clean(v,180).toLowerCase();}
function normalizeWebsite(v){
  const raw=clean(v,300); if(!raw)return '';
  return /^https?:\/\//i.test(raw)?raw:`https://${raw}`;
}
function headerKey(v){return clean(v,100).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
function pick(row, aliases){
  for(const alias of aliases){const k=headerKey(alias); if(Object.prototype.hasOwnProperty.call(row,k) && clean(row[k])) return row[k];}
  return '';
}
const FIELDS={
  businessName:['business_name','business name','company_name','company name','company','business','name'],
  contactName:['contact_name','contact name','contact','owner_name','owner name','decision_maker','decision maker'],
  phone:['phone','phone_number','phone number','mobile','telephone'],
  email:['email','email_address','email address','e_mail'],
  website:['website','web_site','url','domain'],
  industry:['industry','category','type','type industry','type / industry'],
  address:['address','street','street_address','street address'],
  city:['city','town'],
  region:['state','region','state_province','state province'],
  zip:['zip','zipcode','postal_code','postal code'],
  source:['source','lead_source','lead source','list_source','list source']
};
function rowsFromArrays(rows){
  const input=Array.isArray(rows)?rows:[];
  if(!input.length)return [];
  if(input[0] && !Array.isArray(input[0]) && typeof input[0]==='object') return input.map(x=>({...x}));
  const first=input[0]||[];
  const headerish=first.map(headerKey);
  const recognized=Object.values(FIELDS).flat().map(headerKey).filter(x=>headerish.includes(x)).length;
  if(recognized<2){
    return input.map(r=>({businessName:r?.[0]||'',phone:r?.[1]||'',email:r?.[2]||'',source:'Lorna Spreadsheet'}));
  }
  const objects=[];
  for(const raw of input.slice(1)){
    const obj={}; headerish.forEach((k,i)=>{obj[k]=raw?.[i]??''});
    const mapped={}; for(const [field,aliases] of Object.entries(FIELDS)) mapped[field]=clean(pick(obj,aliases));
    objects.push(mapped);
  }
  return objects;
}
function scoreLead(c){
  let score=0;
  if(clean(c.businessName).length>=2)score+=20;
  if(clean(c.contactName))score+=15;
  if(normalizePhone(c.phone) && digits(c.phone).length>=10)score+=20;
  if(normalizeEmail(c.email) && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(c.email)))score+=15;
  if(clean(c.website))score+=10;
  if(clean(c.industry))score+=5;
  if(clean(c.city))score+=5;
  if(clean(c.zip))score+=5;
  if(clean(c.address))score+=5;
  return Math.min(MAX_SCORE,score);
}
function temperature(score){return score>=80?'hot':score>=55?'warm':'cold';}
function dedupeKey(c){
  const email=normalizeEmail(c.email); const phone=digits(c.phone); const business=clean(c.businessName).toLowerCase().replace(/[^a-z0-9]+/g,' ');
  return crypto.createHash('sha256').update(`${business}|${phone}|${email}`).digest('hex');
}
function enrichRows(rows,{batchId,source='Lorna Spreadsheet'}={}){
  const mapped=rowsFromArrays(rows), seen=new Set(), leads=[], counts={received:mapped.length,accepted:0,duplicates:0,invalid:0,hot:0,warm:0,cold:0,quarantine:0};
  for(const raw of mapped){
    const c={
      businessName:clean(raw.businessName||raw.company_name||raw.company), contactName:clean(raw.contactName),
      phone:normalizePhone(raw.phone), email:normalizeEmail(raw.email), website:normalizeWebsite(raw.website),
      industry:clean(raw.industry,120), address:clean(raw.address,300), city:clean(raw.city,100), region:clean(raw.region,100), zip:clean(raw.zip,30),
      source:clean(raw.source||source,120)
    };
    if(!c.businessName || (!c.phone && !c.email)){counts.invalid++;continue;}
    c.dedupeKey=dedupeKey(c); if(seen.has(c.dedupeKey)){counts.duplicates++;continue;} seen.add(c.dedupeKey);
    c.leadScore=scoreLead(c); c.leadTemperature=temperature(c.leadScore); c.intakeDisposition=c.leadTemperature==='cold'?'QUARANTINE':'CRM'; c.quarantineReason=c.leadTemperature==='cold'?'LOW_QUALITY_SCORE_BELOW_55':''; c.status='Lead'; c.verificationStatus='Needs Verification';
    c.pipelineStage='Qualifying'; c.intakeBatchId=clean(batchId,100); c.intakeSource=clean(source,120); c.ingestTimestamp=new Date().toISOString();
    c.leadIntelligence={score:c.leadScore,temperature:c.leadTemperature,source:'SBC_SPREADSHEET_ENRICHMENT_V56.13.1',scoredAt:c.ingestTimestamp,signals:{business:Boolean(c.businessName),contact:Boolean(c.contactName),phone:Boolean(c.phone),email:Boolean(c.email),website:Boolean(c.website),industry:Boolean(c.industry),location:Boolean(c.city||c.zip)}};
    counts.accepted++; counts[c.leadTemperature]++; if(c.intakeDisposition==='QUARANTINE')counts.quarantine++; leads.push(c);
  }
  return {version:VERSION,batchId,source,leads,counts};
}
function mergeIntoCustomers(customers, leads){
  const arr=Array.isArray(customers)?customers:[]; const byEmail=new Map(), byPhone=new Map(), byBusiness=new Map();
  for(const c of arr){if(c.email)byEmail.set(normalizeEmail(c.email),c);const p=digits(c.phone);if(p)byPhone.set(p,c);const b=clean(c.businessName).toLowerCase();if(b)byBusiness.set(b,c);}
  let added=0,updated=0,duplicates=0;
  for(const lead of leads){
    const existing=byEmail.get(normalizeEmail(lead.email))||byPhone.get(digits(lead.phone))||byBusiness.get(clean(lead.businessName).toLowerCase());
    if(existing){
      duplicates++;
      if(!existing.contactName&&lead.contactName)existing.contactName=lead.contactName;
      if(!existing.email&&lead.email)existing.email=lead.email;
      if(!existing.phone&&lead.phone)existing.phone=lead.phone;
      if(!existing.website&&lead.website)existing.website=lead.website;
      if(!existing.industry&&lead.industry)existing.industry=lead.industry;
      existing.leadScore=Math.max(Number(existing.leadScore||0),Number(lead.leadScore||0));
      existing.leadTemperature=Number(existing.leadScore||0)>=80?'hot':Number(existing.leadScore||0)>=55?'warm':String(existing.leadTemperature||'cold');
      existing.updatedAt=new Date().toISOString(); updated++; continue;
    }
    const customer={id:'lead_'+crypto.randomBytes(8).toString('hex'),...lead,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    arr.push(customer); added++;
    if(customer.email)byEmail.set(normalizeEmail(customer.email),customer); if(customer.phone)byPhone.set(digits(customer.phone),customer); if(customer.businessName)byBusiness.set(clean(customer.businessName).toLowerCase(),customer);
  }
  return {customers:arr,added,updated,duplicates};
}
module.exports={VERSION,MAX_ROWS,rowsFromArrays,scoreLead,temperature,dedupeKey,enrichRows,mergeIntoCustomers,normalizePhone,normalizeEmail};
