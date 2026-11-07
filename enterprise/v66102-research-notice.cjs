'use strict';
/* SBC V66.102 — durable, reversible-by-new-evidence lead correction notices.
 * Dismissing a notice NEVER deletes, modifies or merges customer identity.
 * A new correction, automated failure or changed source reopens it.
 */
const crypto=require('node:crypto');
const invalid=v=>/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ufffd]/.test(String(v||''))||/xl\/(?:workbook|styles)\.xml|\[Content_Types\]\.xml/i.test(String(v||''));
const value=v=>String(v||'').trim();
const status=c=>String(c?.leadAssist?.status||c?.leadIntelligence?.autoVerificationStatus||'NOT_CHECKED');
const checkedAt=c=>String(c?.leadAssist?.checkedAt||c?.leadIntelligence?.autoVerificationCheckedAt||'');
function fingerprint(c){
 const fields=[c?.businessName,c?.contactName,c?.phone,c?.email,c?.website,c?.industry,c?.city,c?.zip,c?.notes,c?.source,
 c?.verificationSource,c?.leadIntelligence?.researchSource,c?.verificationStatus,status(c),checkedAt(c)];
 return crypto.createHash('sha256').update(JSON.stringify(fields.map(value))).digest('hex');
}
function eligible(c){
 if(!c)return {ok:false,reason:'LEAD_NOT_FOUND'};
 if([c.businessName,c.contactName,c.phone,c.email,c.notes].some(invalid))return {ok:false,reason:'UNREADABLE_LEAD_FIELDS'};
 const name=value(c.businessName);
 const phone=value(c.phone).replace(/\D/g,'');
 const email=value(c.email);
 const website=value(c.website);
 const source=value(c.verificationSource||c.leadIntelligence?.researchSource||c.researchSource||'');
 if(name.length<2)return {ok:false,reason:'BUSINESS_NAME_REQUIRED'};
 if(!((phone.length===10||phone.length===11&&phone[0]==='1')||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/^https?:\/\/[^\s.]+\.[^\s]+/i.test(website)))
  return {ok:false,reason:'VALID_CONTACT_REQUIRED'};
 if(source.length<4||/^(lead research|csv import|bulk import|unknown|not verified)$/i.test(source))
  return {ok:false,reason:'VERIFIED_RESEARCH_SOURCE_REQUIRED'};
 return {ok:true,reason:'READY_TO_DISMISS'};
}
function resolved(c){
 if(!eligible(c).ok)return false;
 const note=c?.leadIntelligence?.researchNotice;
 return Boolean(note&&note.status==='resolved'&&note.fingerprint===fingerprint(c));
}
function markResolved(c,userId,at){
 const proof=eligible(c);
 if(!proof.ok)throw new Error(proof.reason);
 const when=String(at||new Date().toISOString());
 const note={status:'resolved',fingerprint:fingerprint(c),resolvedAt:when,resolvedBy:String(userId||'').slice(0,120),
  verificationStatus:value(c.verificationStatus).slice(0,80),checkedAt:checkedAt(c).slice(0,70)};
 return note;
}
module.exports={invalid,fingerprint,eligible,resolved,markResolved};
