'use strict';
// Offline operator integration only. Never expose as an HTTP handler.
const {createHash}=require('node:crypto');
const {captureWebsite,inspectDocument,auditProspectBrand,normalizeTargetUrl}=require('../enterprise/creative-intelligence/prospect-brand-auditor.cjs');
const {suppressed,synthetic}=require('../enterprise/sbc-trusted-research-v1.cjs');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(v);
const keys=['title','description','viewport','h1','contactLink','form','structuredData','socialPreview','language','alternateSpanish'];
function eligible(l,t,i){if(!l||l.tenantRef!==t||l.leadId!==i||suppressed(l)||synthetic(l)||l.suppressed===true||l.isTestRecord===true||l.test===true||l.researchRejected===true||['deleted','archived'].includes(String(l.status||'').toLowerCase())||!['Verified','Sales Ready'].includes(l.verificationStatus))return null;try{return normalizeTargetUrl(l.websiteUrl);}catch{return null;}}
async function parseHtml(c){const {JSDOM}=require('jsdom');const d=new JSDOM(c.html,{contentType:'text/html',url:c.url});try{return inspectDocument(d.window.document);}finally{d.window.close();}}
function canonicalSignals(s){if(!s||typeof s!=='object'||Array.isArray(s)||!Object.keys(s).length||Object.keys(s).some(k=>!keys.includes(k)||typeof s[k]!=='boolean'))throw Error('INVALID_AUDIT_SIGNALS');return JSON.stringify(Object.fromEntries(keys.filter(k=>Object.hasOwn(s,k)).map(k=>[k,s[k]])));}
async function ingestLeadSnapshot({pool,tenantRef,leadId,loadLead,assertWriter,capture=captureWebsite,parse=parseHtml,now=Date.now}={}){
 if(!id(tenantRef)||!id(leadId)||typeof loadLead!=='function')throw Error('INVALID_AUDIT_SCOPE');
 const writer=async()=>{if(typeof assertWriter!=='function'||await assertWriter()!==true)throw Error('AUDIT_WRITER_REQUIRED');};
 await writer();const lead=await loadLead(tenantRef,leadId),url=eligible(lead,tenantRef,leadId);if(!url)return {status:'SKIPPED_INELIGIBLE',leadId};
 const c=await capture(url);if(!c||c.url!==url||c.status!==200||!Buffer.isBuffer(c.html)||!c.html.length||c.html.length>512*1024||typeof c.checkedAt!=='string'||!Number.isFinite(Date.parse(c.checkedAt))||new Date(c.checkedAt).toISOString()!==c.checkedAt)throw Error('INVALID_AUDIT_CAPTURE');
 const htmlSha256=createHash('sha256').update(c.html).digest('hex'),signals=canonicalSignals(await parse(c));
 const current=await loadLead(tenantRef,leadId);if(eligible(current,tenantRef,leadId)!==url)return {status:'SKIPPED_CHANGED',leadId};
 const a=auditProspectBrand(current,{tenantRef,now:now(),snapshot:{url,status:200,checkedAt:c.checkedAt,htmlSha256,signals:JSON.parse(signals)}});if(a.evidenceStatus!=='CAPTURE_REVIEW_REQUIRED')throw Error('INVALID_AUDIT_CAPTURE');
 const stamp=c.checkedAt.replace('T',' ').replace('Z','');await writer();
 try{const [r]=await pool.execute('INSERT INTO sbc_core_prospect_audit_snapshots (tenant_ref,lead_id,target_url,http_status,checked_at,html_sha256,signals_json) VALUES (?,?,?,?,?,?,?)',[tenantRef,leadId,url,200,stamp,htmlSha256,signals]);if(r.affectedRows!==1)throw Error('AUDIT_INSERT_UNCONFIRMED');return {status:'INGESTED',leadId,htmlSha256};}
 catch(e){if(e.code!=='ER_DUP_ENTRY'&&e.errno!==1062)throw e;const [rows]=await pool.execute('SELECT tenant_ref,lead_id,target_url,http_status,signals_json FROM sbc_core_prospect_audit_snapshots WHERE tenant_ref=? AND lead_id=? AND checked_at=? AND html_sha256=?',[tenantRef,leadId,stamp,htmlSha256]);const r=rows.length===1?rows[0]:null;if(!r||r.tenant_ref!==tenantRef||r.lead_id!==leadId||r.target_url!==url||r.http_status!==200||canonicalSignals(typeof r.signals_json==='string'?JSON.parse(r.signals_json):r.signals_json)!==signals)throw Error('AUDIT_SNAPSHOT_CONFLICT');return {status:'DUPLICATE_VERIFIED',leadId,htmlSha256};}
}
module.exports=Object.freeze({ingestLeadSnapshot});
