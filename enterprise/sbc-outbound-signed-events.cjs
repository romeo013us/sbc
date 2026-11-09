'use strict';
/* Signed SendGrid event webhook only. All event records must be cryptographically
 * verified on ORIGINAL request bytes before any CRM mutation.
 */
const crypto=require('node:crypto');
const LEDGER=require('./sbc-outreach-consent-ledger.cjs');
const norm=v=>String(v||'').trim();
const tenant=v=>Number(v?.tenantId??v?.tenant_id);
function keyFrom(raw){
 const s=norm(raw);
 if(!s)return null;
 if(s.startsWith('-----BEGIN PUBLIC KEY-----'))return crypto.createPublicKey(s);
 const bytes=Buffer.from(s,'base64');
 if(bytes.length<45)throw Error('SIGNING_KEY_INVALID');
 return crypto.createPublicKey({key:bytes,format:'der',type:'spki'});
}
function verified(raw,headers,env=process.env,now=Date.now()){
 if(!Buffer.isBuffer(raw)||raw.length===0||raw.length>1024*1024)return false;
 const signature=norm(headers?.signature),timestamp=norm(headers?.timestamp);
 if(!/^\d{10}$/.test(timestamp)||!signature)return false;
 const stamp=Number(timestamp)*1000;
 if(!Number.isSafeInteger(stamp)||Math.abs(stamp-now)>3600000)return false;
 try{
  const key=keyFrom(env.SBC_SENDGRID_EVENT_PUBLIC_KEY);
  if(!key)return false;
  return crypto.verify('sha256',Buffer.concat([Buffer.from(timestamp),raw]),key,
   Buffer.from(signature,'base64'));
 }catch{return false}
}
function apply(db,events){
 if(!Array.isArray(events)||events.length>200)throw Error('EVENT_BATCH_INVALID');
 const tasks=db.tasks||[],contacts=db.customers||[],changed=[],undo=[];
 const snapshot=(x,keys)=>{const values={};for(const k of keys)values[k]={present:Object.hasOwn(x,k),value:x[k]};
  undo.push(()=>{for(const k of keys){if(values[k].present)x[k]=values[k].value;else delete x[k]}})};
 for(const e of events){
  if(!e||typeof e!=='object')continue;
  const taskId=norm(e.sbc_task_id||e.custom_args?.sbc_task_id);
  const tenantId=Number(e.sbc_tenant_id||e.custom_args?.sbc_tenant_id);
  if(!taskId||!Number.isSafeInteger(tenantId)||tenantId<1)continue;
  const t=tasks.find(x=>norm(x.id)===taskId&&tenant(x)===tenantId&&x.type==='SBC Next-Day Call');
  if(!t||!t.outboundEmailStatus)continue;
  const c=contacts.find(x=>norm(x.id)===norm(t.customerId)&&tenant(x)===tenantId);
  if(!c||norm(c.email).toLowerCase()!==norm(e.email).toLowerCase())continue;
  const event=norm(e.event).toLowerCase(),allowed=['delivered','bounce','dropped','blocked','spamreport','unsubscribe','group_unsubscribe','deferred','processed'];
  if(!allowed.includes(event))continue;
  const eventId=norm(e.sg_event_id)||crypto.createHash('sha256').update(JSON.stringify(e)).digest('hex');
  const seen=Array.isArray(t.outboundEmailEventIds)?t.outboundEmailEventIds:[];
  if(seen.includes(eventId))continue;
  snapshot(t,['outboundEmailEventIds','outboundEmailStatus','outboundEmailLastEventAt']);
  t.outboundEmailEventIds=[...seen,eventId].slice(-32);
  t.outboundEmailLastEventAt=new Date().toISOString();
  if(['bounce','dropped','blocked','spamreport','unsubscribe','group_unsubscribe'].includes(event)){
   if(!LEDGER.outbound(c).emailUnsubscribed){
    snapshot(c,['leadIntelligence']);
    LEDGER.suppress(c,{reason:'SENDGRID_'+event.toUpperCase()});
   }
   t.outboundEmailStatus='PROVIDER_'+event.toUpperCase()+'_SUPPRESSED';
  }else if(event==='delivered'&&!t.outboundEmailStatus.includes('SUPPRESSED')){
   t.outboundEmailStatus='DELIVERED_PROVIDER_VERIFIED';
  }else if(event==='deferred'&&t.outboundEmailStatus==='PROVIDER_ACCEPTED_NOT_DELIVERED'){
   t.outboundEmailStatus='DEFERRED_PROVIDER';
  }
  changed.push({taskId:t.id,event});
 }
 return {changed,undo:()=>undo.reverse().forEach(fn=>fn())};
}
module.exports={verified,apply};
