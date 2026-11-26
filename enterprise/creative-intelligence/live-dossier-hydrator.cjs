'use strict';
// Read-only cache access. No network capture, CRM write or outreach in request handlers.
const {buildAccountSalesDossier}=require('./account-sales-dossier.cjs');
const {suppressed,synthetic}=require('../sbc-trusted-research-v1.cjs');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(v);
const SQL="SELECT tenant_ref,lead_id,target_url,http_status,CONCAT(LEFT(DATE_FORMAT(checked_at,'%Y-%m-%dT%H:%i:%s.%f'),23),'Z') AS checked_at,html_sha256,signals_json FROM sbc_core_prospect_audit_snapshots WHERE tenant_ref=? AND lead_id=? ORDER BY checked_at DESC,html_sha256 DESC LIMIT 1";
async function readAuditSnapshot(pool,tenantRef,leadId){
 if(!id(tenantRef)||!id(leadId))throw Error('INVALID_HYDRATION_SCOPE');
 const [rows]=await pool.execute({sql:SQL,timeout:2000},[tenantRef,leadId]);
 if(!Array.isArray(rows)||rows.length!==1)return null;
 const r=rows[0];if(r.tenant_ref!==tenantRef||r.lead_id!==leadId||typeof r.checked_at!=='string'||!Number.isFinite(Date.parse(r.checked_at))||new Date(r.checked_at).toISOString()!==r.checked_at)return null;
 let signals;try{signals=typeof r.signals_json==='string'?(r.signals_json.length<=4096?JSON.parse(r.signals_json):null):r.signals_json;}catch{return null;}
 if(!signals||typeof signals!=='object'||Array.isArray(signals)||Object.keys(signals).length>10||Object.values(signals).some(v=>typeof v!=='boolean'))return null;
 return {url:r.target_url,status:r.http_status,checkedAt:r.checked_at,htmlSha256:r.html_sha256,signals};
}
function scopedLead(customer,tenantId){return {...customer,tenantRef:'sbc:'+tenantId,leadId:String(customer.id),websiteUrl:customer.website||''};}
function shouldRead(lead,row){return !suppressed(lead)&&!synthetic(lead)&&lead.suppressed!==true&&(row.callAllowed===true||row.stage==='APPOINTMENT_BOOKED');}
function buildCachedDossier(customer,tenantId,row,snapshot,now){const lead=scopedLead(customer,tenantId);return buildAccountSalesDossier({tenantRef:lead.tenantRef,lead,auditSnapshot:shouldRead(lead,row)?snapshot:null,now});}
let pool;
async function configuredSnapshotReader(tenantRef,leadId){
 if(process.env.SBC_DOSSIER_CACHE_ENABLED!=='1')return null;
 // Provision an explicitly read-only database user; do not fall back to application writer credentials.
 const e=process.env;if(!e.SBC_DOSSIER_DB_HOST||!e.SBC_DOSSIER_DB_USER||!e.SBC_DOSSIER_DB_PASSWORD||!e.SBC_DOSSIER_DB_NAME)throw Error('DOSSIER_CACHE_NOT_CONFIGURED');
 if(!pool)pool=require('mysql2/promise').createPool({host:e.SBC_DOSSIER_DB_HOST,user:e.SBC_DOSSIER_DB_USER,password:e.SBC_DOSSIER_DB_PASSWORD,database:e.SBC_DOSSIER_DB_NAME,port:3306,connectionLimit:1,waitForConnections:false,connectTimeout:2000,timezone:'Z',ssl:{rejectUnauthorized:true}});
 return readAuditSnapshot(pool,tenantRef,leadId);
}
module.exports={readAuditSnapshot,scopedLead,shouldRead,buildCachedDossier,configuredSnapshotReader};
