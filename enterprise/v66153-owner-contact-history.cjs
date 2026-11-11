'use strict';
/* SBC V66.153 · owner-only customer contact history (read-only, no AI/provider I/O).
 * A provider-accepted email is NOT recipient delivery; an SMS submission is NOT
 * confirmation of delivery; a call report is NOT proof of reaching a customer.
 */
const BAD=/[\u0000-\u001f\u007f-\u009f\ufffd]/u;
const clean=(v,max=150,fallback='')=>{
 const s=String(v??'').trim();
 return s&&!BAD.test(s)?s.slice(0,max):fallback;
};
const when=v=>{const n=new Date(v).getTime();return Number.isFinite(n)?n:null;};
const info=v=>{if(v&&typeof v==='object'&&!Array.isArray(v))return v;
 if(typeof v==='string'){try{const j=JSON.parse(v);return j&&typeof j==='object'&&!Array.isArray(j)?j:{}}catch{}}
 return {};};
const suppressed=c=>Boolean(c&&(c.doNotContact===true||c.doNotCall===true||c.salesSuppressed===true||
 c.isSuppressed===true||c.smsOptOut===true||c.sbcSmsOptOut===true||c.emailUnsubscribed===true||
 ['dnc','do not call','do not contact','opt out','unsubscribe','lost','duplicate'].includes(
 String(c.status||'').trim().toLowerCase())));
const CHANNELS=['email','sms','call'];
function summarize({tenantId,customers,activities,callLogs,callReports,now=Date.now(),hours=168,sqlTruncated=false}={}){
 const tid=Number(tenantId),span=Number(hours),end=Number(now);
 if(!Number.isSafeInteger(tid)||tid<1)throw Error('CONTACT_HISTORY_TENANT_REQUIRED');
 if(![168,720,2160].includes(span))throw Error('CONTACT_HISTORY_WINDOW_INVALID');
 if(!Array.isArray(customers)||!Array.isArray(activities)||!Array.isArray(callLogs)||!Array.isArray(callReports))
  throw Error('CONTACT_HISTORY_AUTHORITATIVE_SOURCES_REQUIRED');
 if(!Number.isFinite(end)||end<=0)throw Error('CONTACT_HISTORY_CLOCK_INVALID');
 const start=end-span*3600000;
 const people=new Map(customers.filter(c=>Number(c?.tenantId??c?.tenant_id)===tid&&c?.id).map(c=>[
  String(c.id),{name:clean(c.businessName??c.business_name??c.contactName,'160','CRM name unavailable'),record:c}
 ]));
 const events=[],dedup=new Set();
 function add({channel,id,customerId,at,label,evidence}){
  const client=people.get(String(customerId||'')),ts=when(at),key=String(channel)+':'+String(id);
  if(!client||ts===null||ts<start||ts>end||!CHANNELS.includes(channel)||dedup.has(key))return;
  dedup.add(key);
  events.push({channel,customerId:String(customerId),name:client.name,
   at:new Date(ts).toISOString(),label:clean(label,90,'Recorded event'),
   evidence:clean(evidence,180,'Status requires review')});
 }
 const callLogIds=new Set(callLogs.map(x=>String(x?.id||'')).filter(Boolean));
 const reportIds=new Set(callReports.map(x=>String(x?.id||'')).filter(Boolean));
 for(const a of activities){
  if(Number(a?.tenant_id??a?.tenantId)!==tid)continue;
  const channel=String(a.activity_type??a.type??'').toLowerCase(),meta=info(a.meta_json??a.meta);
  if(!CHANNELS.includes(channel))continue;
  if(channel==='call'&&(callLogIds.has(String(meta.callLogId||''))||reportIds.has(String(meta.callReportId||''))))continue;
  const evidence=channel==='email'?'SMTP accepted; recipient delivery not independently confirmed':
   channel==='sms'?(meta.deliveryConfirmed===true?'Provider reports delivered':'Twilio accepted/submitted; delivery not confirmed'):
   'Call activity recorded; connection not independently confirmed';
  add({channel,id:'activity:'+String(a.id||''),customerId:meta.customerId,at:a.created_at??a.createdAt,
    label:channel==='email'?'Email accepted by SMTP':channel==='sms'?
      (meta.deliveryConfirmed===true?'SMS reported delivered':'SMS submitted to Twilio'):'Call activity recorded',
    evidence});
 }
 for(const log of callLogs){
  const id=clean(log?.id,100),status=String(log?.status||'').toLowerCase();
  if(!id)continue;
  add({channel:'call',id:'log:'+id,customerId:log.customerId,at:log.endedAt||log.updatedAt||log.startedAt||log.createdAt,
    label:'Call '+(status==='completed'?'completed':clean(status,40,'attempt recorded')),
    evidence:status==='completed'?'Provider marked call complete; customer conversation not proven':
      'Call attempt/status recorded; verify disposition before another attempt'});
 }
 for(const report of callReports){
  const id=clean(report?.id,100);if(!id)continue;
  add({channel:'call',id:'report:'+id,customerId:report.customerId,at:report.createdAt,
    label:'Call report submitted',
    evidence:'Employee disposition recorded; not independent proof of a connected call'});
 }
 events.sort((a,b)=>when(b.at)-when(a.at)||a.customerId.localeCompare(b.customerId)||a.channel.localeCompare(b.channel));
 const groups=new Map();
 for(const e of events){
  let p=groups.get(e.customerId);
  if(!p){const c=people.get(e.customerId);p={customerId:e.customerId,name:c.name,
    suppressed:suppressed(c.record),lastAt:e.at,latest:{email:null,sms:null,call:null},events:[]};
   groups.set(e.customerId,p);}
  if(!p.latest[e.channel])p.latest[e.channel]={at:e.at,label:e.label,evidence:e.evidence};
  if(p.events.length<10)p.events.push({channel:e.channel,at:e.at,label:e.label,evidence:e.evidence});
 }
 const all=[...groups.values()].sort((a,b)=>when(b.lastAt)-when(a.lastAt)||a.name.localeCompare(b.name));
 for(const p of all){
  p.reviewAfter=p.suppressed?null:new Date(when(p.lastAt)+7*86400000).toISOString();
  p.reviewMeaning=p.suppressed?'Do not recontact without approved suppression review':
    'Planning reminder only; check consent, DNC, previous replies and business hours';
 }
 const counts=Object.fromEntries(CHANNELS.map(k=>[k,events.filter(e=>e.channel===k).length]));
 return {ok:true,readOnly:true,modelCreditsUsed:0,noNewMessages:true,
  window:{hours:span,since:new Date(start).toISOString(),until:new Date(end).toISOString()},
  counts,contactsWithRecordedEvents:all.length,
  contacts:all.slice(0,100),eventsExamined:events.length,displayLimit:100,
  truncated:sqlTruncated||all.length>100,
  warnings:[
   'Email evidence records SMTP acceptance, not recipient inbox delivery.',
   'SMS provider acceptance does not prove delivery unless explicitly recorded as delivered.',
   'Call logs and reports do not prove a decision-maker answered or that a sale happened.',
   'Contact review dates are suggestions only. No automatic retries or permission to contact are created.',
   ...(sqlTruncated?['The SQL activity query reached its limit; older actions may be omitted.']:[]),
   ...(all.length>100?['Only the 100 most recently contacted CRM records are displayed.']:[])
  ]};
}
module.exports={summarize,suppressed};
