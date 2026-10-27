'use strict';

const crypto = require('crypto');
const E164 = /^\+[1-9][0-9]{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ALLOWED = new Set(['VERIFIED','OWNER_VERIFIED','SALES_READY']);

function norm(v){ return String(v ?? '').trim().toLowerCase(); }
function normPhone(v){ return String(v ?? '').replace(/[^0-9+]/g,''); }
function domain(v){ const m=norm(v).match(/^(?:https?:\/\/)?(?:www\.)?([^/]+)/); return m ? m[1].split(':')[0] : ''; }
function stableHash(v){ return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function ageHours(v, now=Date.now()) { const t=Date.parse(v); return Number.isFinite(t) ? Math.max(0,(now-t)/3600000) : Infinity; }

function validateLead(row, ctx={}) {
  const now=ctx.now ?? Date.now();
  const id=Number(row?.id||0);
  const business=String(row?.business_name||row?.businessName||'').trim();
  const contact=String(row?.contact_name||row?.contactName||'').trim();
  const email=norm(row?.email);
  const phone=normPhone(row?.phone_normalized||row?.phone);
  const website=String(row?.website||'').trim();
  const source=String(row?.source||'').trim();
  const status=String(row?.status||'').trim().toUpperCase();
  const createdAt=row?.created_at||row?.createdAt||null;
  const updatedAt=row?.updated_at||row?.updatedAt||null;
  const reasons=[];
  if(!id) reasons.push('missing_id');
  if(!business) reasons.push('missing_business_name');
  if(!source) reasons.push('missing_source');
  if(!createdAt || !Number.isFinite(Date.parse(createdAt))) reasons.push('invalid_created_at');
  if(!updatedAt || !Number.isFinite(Date.parse(updatedAt))) reasons.push('invalid_updated_at');
  if(!ALLOWED.has(status)) reasons.push('status_not_verified');
  const phoneE164=E164.test(phone);
  const emailValid=EMAIL.test(email);
  const fresh24h=ageHours(updatedAt,now)<=24;
  if(!phoneE164) reasons.push('phone_not_e164');
  if(!emailValid) reasons.push('email_invalid');
  if(!fresh24h) reasons.push('stale_over_24h');
  const contactable=phoneE164 || emailValid;
  if(!contactable) reasons.push('no_valid_contact');
  if(!website && !emailValid && !phoneE164) reasons.push('no_secondary_identity');
  const structuralScore = Math.max(0, Math.min(100,
    (business?20:0)+(source?15:0)+(status==='OWNER_VERIFIED'?20:status==='SALES_READY'?15:status==='VERIFIED'?10:0)+
    (emailValid?15:0)+(phoneE164?15:0)+(website?5:0)+(contact?5:0)+(fresh24h?5:0)
  ));
  let classification='RED';
  if(reasons.length===0) classification='GREEN';
  else if(business && source && contactable && (status==='OWNER_VERIFIED'||status==='SALES_READY'||status==='VERIFIED') && reasons.length<=2) classification='YELLOW';
  return {
    leadMeshId:id,businessName:business,contactName:contact,email,phone,website,industry:String(row?.industry||'').trim(),source,status,
    createdAt,updatedAt,ageHours:Number.isFinite(ageHours(updatedAt,now))?Number(ageHours(updatedAt,now).toFixed(2)):null,
    phoneE164,emailValid,fresh24h,contactable,structuralScore,classification,reasons,
    provenanceHash:stableHash({id,business,contact,email,phone,website,source,status,createdAt,updatedAt})
  };
}

function auditLeadMesh(rows, ctx={}) {
  const list=Array.isArray(rows)?rows:[];
  const normalized=list.map(r=>validateLead(r,ctx));
  const emailMap=new Map(), phoneMap=new Map(), domainMap=new Map(), businessMap=new Map();
  for(const x of normalized){
    for(const [map,key] of [[emailMap,x.email],[phoneMap,x.phone],[domainMap,domain(x.website)],[businessMap,norm(x.businessName)]]){
      if(!key) continue; const a=map.get(key)||[]; a.push(x.leadMeshId); map.set(key,a);
    }
  }
  for(const x of normalized){
    const duplicateKeys=[];
    if(x.email && (emailMap.get(x.email)||[]).length>1) duplicateKeys.push('email');
    if(x.phone && (phoneMap.get(x.phone)||[]).length>1) duplicateKeys.push('phone');
    const d=domain(x.website); if(d && (domainMap.get(d)||[]).length>1) duplicateKeys.push('website_domain');
    const b=norm(x.businessName); if(b && (businessMap.get(b)||[]).length>1) duplicateKeys.push('business_name');
    if(duplicateKeys.length){x.duplicates=duplicateKeys;x.reasons.push('duplicate_identity_candidate'); if(x.classification==='GREEN')x.classification='YELLOW';}
    else x.duplicates=[];
  }
  const counts={total:normalized.length,green:0,yellow:0,red:0,verifiedStatus:0,phoneE164:0,emailValid:0,fresh24h:0,duplicateCandidates:0};
  for(const x of normalized){counts[x.classification.toLowerCase()]++;if(ALLOWED.has(x.status))counts.verifiedStatus++;if(x.phoneE164)counts.phoneE164++;if(x.emailValid)counts.emailValid++;if(x.fresh24h)counts.fresh24h++;if(x.duplicates.length)counts.duplicateCandidates++;}
  return {ok:true,readOnly:true,source:'sbc_lead_mesh',counts,rows:normalized,policy:{green:'all required provenance/contact/freshness checks pass and no duplicate identity candidate',yellow:'actionable but requires owner review',red:'insufficient provenance or contact/identity evidence',promotionRequires:'GREEN + explicit owner approval + authoritative CRM recovery gate clear'}};
}

module.exports={E164,EMAIL,ALLOWED,validateLead,auditLeadMesh};
