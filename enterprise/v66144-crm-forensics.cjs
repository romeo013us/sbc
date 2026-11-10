'use strict';
/* Owner-only forensic view: read current tenant-scoped CRM/paid-order projections,
 * flag suspect text, and expose reconciliation targets WITHOUT mutating anything.
 */
const AUDIT=require('./v66126-crm-audit-preview.cjs');
const {invalidFields}=require('./crm-text-integrity-v66140.cjs');
const suspicious=c=>AUDIT.suspicious(c)||invalidFields(c).length>0;
const {providerCapturedSquare,proofFields}=require('./v6640-payment-evidence.cjs');
const norm=v=>String(v??'').normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu,' ');
const dig=v=>String(v??'').replace(/\D/g,'');
function error(code){throw Object.assign(new Error(code),{code,status:422});}
function tenant(n){const k=Number(n);if(!Number.isSafeInteger(k)||k<1)error('TENANT_REQUIRED');return k;}
function date(s){
 if(s===undefined||s===null||s==='')return null;
 const x=Date.parse(String(s));if(!Number.isFinite(x))error('DATE_FILTER_INVALID');return x;
}
function stamp(v){const x=Date.parse(String(v||''));return Number.isFinite(x)?x:0;}
function notes(o){try{const x=JSON.parse(String(o?.notes||''));return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return {}}}
function creator(c){return String(c?.createdByName||c?.createdBy||c?.created_by_name||c?.created_by||c?.addedBy||c?.createdByUserId||'').slice(0,120);}
function sources(c){return [String(c?.source||''),creator(c)].filter(Boolean);}
function matchingCustomer(c,q,qdigits){
 if(!q)return true;
 const fields=[c.id,c.businessName,c.contactName,c.email,c.phone,c.source,creator(c)];
 if(fields.some(v=>norm(v).includes(q)))return true;
 if(qdigits.length>=4&&dig(c.phone).endsWith(qdigits))return true;
 return false;
}
function matchingOrder(o,q){
 if(!q)return false;
 const n=notes(o),proof=proofFields(o);
 const searchable=[o.id,o.customerId,o.customerName,o.product,proof.id,proof.order,proof.link,
   n.externalPaymentReference,n.paymentReference,n.squarePaymentId,n.squareOrderId,n.squarePaymentLinkId];
 return searchable.some(v=>norm(v).includes(q));
}
function inspect({customers=[],orders=[],tenantId,query='',source='',createdBy='',status='',from='',to='',limit=30,offset=0}={}){
 const tid=tenant(tenantId);
 const q=norm(query).slice(0,150),qdigits=dig(q);
 const filterStatus=norm(status),filterSource=norm(source),filterCreator=norm(createdBy);
 const since=date(from),until=date(to);
 if(since!==null&&until!==null&&since>until)error('DATE_RANGE_INVALID');
 const cap=Math.min(50,Math.max(1,Math.trunc(Number(limit)||30)));
 const skip=Math.min(10000,Math.max(0,Math.trunc(Number(offset)||0)));
 const all=(Array.isArray(customers)?customers:[]).filter(c=>c&&Number(c.tenantId??c.tenant_id)===tid);
 const buyerOrders=(Array.isArray(orders)?orders:[]).filter(o=>o&&Number(o.tenantId??o.tenant_id)===tid);
 const linked=new Map();
 for(const o of buyerOrders){const k=String(o.customerId||'');if(k){if(!linked.has(k))linked.set(k,[]);linked.get(k).push(o)}}
 const suspiciousRows=all.filter(suspicious);
 const rowIds=new Set(all.map(c=>String(c.id)));
 const orphanOrders=buyerOrders.filter(o=>o.customerId&&!rowIds.has(String(o.customerId)));
 const candidates=all.filter(c=>{
  if(filterStatus&&norm(c.status)!==filterStatus)return false;
  if(filterSource&&!norm(c.source).includes(filterSource))return false;
  if(filterCreator&&!norm(creator(c)).includes(filterCreator))return false;
  const at=stamp(c.createdAt??c.created_at);
  if(since!==null&&at<since)return false;
  if(until!==null&&at>until)return false;
  return matchingCustomer(c,q,qdigits)||
   (linked.get(String(c.id))||[]).some(o=>matchingOrder(o,q));
 }).sort((a,b)=>stamp(b.createdAt??b.created_at)-stamp(a.createdAt??a.created_at)||
  stamp(b.updatedAt??b.updated_at)-stamp(a.updatedAt??a.updated_at)||
  String(a.id).localeCompare(String(b.id)));
 const page=candidates.slice(skip,skip+cap).map(c=>{
  const entries=linked.get(String(c.id))||[];
  const bad=suspicious(c);
  return {id:String(c.id||''),businessName:bad?'[Review text integrity]':String(c.businessName||'').slice(0,160),
   contactName:bad?'[Review text integrity]':String(c.contactName||'').slice(0,120),email:bad?'[Review text integrity]':String(c.email||'').slice(0,180),
   phoneLast4:dig(c.phone).slice(-4),status:String(c.status||''),
   source:String(c.source||''),createdBy:creator(c),createdAt:String(c.createdAt||c.created_at||''),
   updatedAt:String(c.updatedAt||c.updated_at||''),suspiciousText:bad,
   reviewStatus:bad?'CORRUPT_TEXT_HOLD':'REVIEW_REQUIRED',
   linkedOrderCount:entries.length,recordedSquareCaptureCount:entries.filter(providerCapturedSquare).length,
   orderIds:entries.map(o=>String(o.id)).slice(0,12)};
 });
 const matchedOrphans=q?orphanOrders.filter(o=>matchingOrder(o,q)).slice(0,20).map(o=>({
  orderId:String(o.id||''),customerId:String(o.customerId||''),orderLabel:String(o.product||'').slice(0,140),
  recordedSquareCapture:providerCapturedSquare(o)})):[];
 return {ok:true,readOnly:true,noRecordsChanged:true,tenantId:tid,scope:'TENANT_ONLY',
  searchedAllStatuses:!filterStatus,totalTenantCustomers:all.length,totalTenantOrders:buyerOrders.length,
  suspiciousTextRecords:suspiciousRows.length,suspiciousIds:suspiciousRows.map(c=>String(c.id)).filter(Boolean).slice(0,50),
  orphanOrderCount:orphanOrders.length,matchedOrphanOrders:matchedOrphans,
  pagination:{limit:cap,offset:skip,totalMatches:candidates.length,hasMore:skip+cap<candidates.length},
  rows:page,notFoundInCurrentProjection:!!q&&candidates.length===0&&matchedOrphans.length===0,
  paymentCaveat:'Square capture is SBC-stored evidence; not independent processor or bank verification.',
  action:'Review immutable backup, actor history and provider receipts before any recovery. This endpoint never restores, merges, creates or contacts records.'};
}
module.exports={inspect,suspicious,creator,matchingCustomer,matchingOrder};
