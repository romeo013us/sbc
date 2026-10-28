'use strict';
/** Durable, opt-in Office Box paid handoff outbox for the Command Center.
 * This is a library: no automatic worker, no startup hook, no schema mutation.
 * Call enqueue ONLY from an authoritative server-side verified settled payment.
 * Call dispatchOne ONLY from the approved Published single-writer scheduler.
 */
const crypto=require('node:crypto');
const {buildPaidHandoff,signPaidHandoff}=require('../enterprise/office-box-paid-handoff.cjs');
const {makeActiveEntitlement,signActiveEntitlement}=require('./office-box-activation-client.cjs');
const TABLE='sbc_office_box_outbox';
const errorCode=error=>{
 const s=String(error?.code||error?.name||'DELIVERY_REJECTED').toUpperCase().replace(/[^A-Z0-9_]/g,'').slice(0,48);
 return s||'DELIVERY_REJECTED';
};
function validateTarget(value){
 const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||
    u.hostname==='localhost'||u.hostname.endsWith('.localhost'))
  throw Error('OFFICE_BOX_HTTPS_ORIGIN_REQUIRED');
 return u.origin;
}
function createOutbox({pool,receiverOrigin,secret,enabled=false,publishedWriter=false,transport=globalThis.fetch,leaseSeconds=90,maxAttempts=6}={}){
 if(!pool||typeof pool.getConnection!=='function'||typeof pool.execute!=='function')throw Error('OFFICE_BOX_PERSISTENT_MYSQL_REQUIRED');
 if(!Number.isSafeInteger(leaseSeconds)||leaseSeconds<15||leaseSeconds>300||
   !Number.isSafeInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)throw Error('OFFICE_BOX_RETRY_POLICY_INVALID');
 // The URL, secret and transport must be present only when actually sending.
 function permit(){
  if(!enabled||!publishedWriter)throw Error('OFFICE_BOX_OUTBOX_PUBLISHED_WRITER_ONLY');
  if(typeof secret!=='string'||secret.length<32||typeof transport!=='function')throw Error('OFFICE_BOX_DISPATCH_CREDENTIALS_REQUIRED');
  return validateTarget(receiverOrigin);
 }
 async function writeEvent(event,eventId,orderId,customerId,eventType){
  const [r]=await pool.execute(`INSERT IGNORE INTO ${TABLE}
   (event_id,order_id,customer_id,event_type,payload_json,status,attempts,next_attempt_at,created_at,updated_at)
   VALUES (?,?,?,?,?,'PENDING',0,UTC_TIMESTAMP(),UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
   [eventId,orderId,customerId,eventType,JSON.stringify(event)]);
  return {eventId,created:Number(r?.affectedRows||0)===1};
 }
 async function enqueue(verifiedPayment){
  if(!enabled||!publishedWriter)throw Error('OFFICE_BOX_OUTBOX_PUBLISHED_WRITER_ONLY');
  const event=buildPaidHandoff(verifiedPayment);
  return writeEvent(event,event.correlationId,event.payload.orderId,event.customerId,event.eventType);
 }
 async function enqueueActiveEntitlement({paidEvent,activationResponse,verifiedAt}={}){
  if(!enabled||!publishedWriter)throw Error('OFFICE_BOX_OUTBOX_PUBLISHED_WRITER_ONLY');
  const event=makeActiveEntitlement({paidEvent,activationResponse,verifiedAt});
  return writeEvent(event,event.eventId,event.orderId,event.customerId,event.schema);
 }
 async function claim(){
  const cx=await pool.getConnection();
  try{
   await cx.beginTransaction();
   const [rows]=await cx.query(`SELECT event_id,payload_json,attempts FROM ${TABLE}
    WHERE (status='PENDING' AND next_attempt_at<=UTC_TIMESTAMP())
       OR (status='IN_FLIGHT' AND lease_until<UTC_TIMESTAMP())
    ORDER BY created_at,event_id LIMIT 1 FOR UPDATE SKIP LOCKED`);
   const row=rows[0];
   if(!row){await cx.commit();return null}
   const leaseOwner=crypto.randomUUID();
   await cx.query(`UPDATE ${TABLE} SET status='IN_FLIGHT',attempts=attempts+1,
    lease_owner=?,lease_until=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),updated_at=UTC_TIMESTAMP()
    WHERE event_id=?`,[leaseOwner,leaseSeconds,row.event_id]);
   await cx.commit();
   return {...row,attempts:Number(row.attempts||0)+1,leaseOwner};
  }catch(e){try{await cx.rollback()}catch{}throw e}finally{cx.release()}
 }
 async function dispatchOne(){
  const origin=permit();
  const row=await claim();
  if(!row)return {status:'EMPTY'};
  let success=false,status=null,code='UNKNOWN';
  try{
   const event=typeof row.payload_json==='string'?JSON.parse(row.payload_json):row.payload_json;
   const handoff=event?.eventType==='customer.subscription.paid'&&event.correlationId===row.event_id;
   const entitlement=event?.schema==='sbc.office-box.entitlement.v1'&&event.status==='ACTIVE'&&event.eventId===row.event_id;
   if(!handoff&&!entitlement)
    throw Object.assign(Error('INVALID_QUEUE_PAYLOAD'),{code:'INVALID_QUEUE_PAYLOAD'});
   const signed=handoff?signPaidHandoff(event,secret):signActiveEntitlement(event,secret);
   const response=await transport(origin+signed.path,{
    method:'POST',headers:signed.headers,body:signed.body,signal:AbortSignal.timeout(Math.min((leaseSeconds-5)*1000,30000))
   });
   status=response?.status||null;
   if(status!==200)throw Object.assign(Error('REMOTE_REJECTED'),{code:'OFFICE_BOX_RESPONSE_NOT_ACCEPTED'});
   const json=await response.json();
   const ack=handoff?json?.data:json;
   if(json?.ok!==true||!(ack?.accepted===true||ack?.duplicate===true)||
      (handoff&&ack.correlationId&&ack.correlationId!==row.event_id))
    throw Object.assign(Error('REMOTE_ACK_INVALID'),{code:'OFFICE_BOX_ACK_MISMATCH'});
   success=true;
  }catch(e){code=errorCode(e)}
  const delay=Math.min(3600,30*Math.pow(2,Math.min(row.attempts-1,8)));
  if(success){
   const [result]=await pool.execute(`UPDATE ${TABLE} SET status='DELIVERED',acked_at=UTC_TIMESTAMP(),
     lease_owner=NULL,lease_until=NULL,last_http_status=?,last_error_code=NULL,updated_at=UTC_TIMESTAMP()
     WHERE event_id=? AND status='IN_FLIGHT' AND lease_owner=?`,[status,row.event_id,row.leaseOwner]);
   if(result?.affectedRows!==1)throw Error('OFFICE_BOX_OUTBOX_LEASE_LOST');
   return {status:'DELIVERED',eventId:row.event_id,attempts:row.attempts};
  }
  const dead=row.attempts>=maxAttempts;
  const [result]=await pool.execute(`UPDATE ${TABLE} SET status=?,lease_owner=NULL,lease_until=NULL,
   next_attempt_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),last_http_status=?,
   last_error_code=?,updated_at=UTC_TIMESTAMP()
   WHERE event_id=? AND status='IN_FLIGHT' AND lease_owner=?`,
   [dead?'DEAD':'PENDING',delay,status,code,row.event_id,row.leaseOwner]);
  if(result?.affectedRows!==1)throw Error('OFFICE_BOX_OUTBOX_LEASE_LOST');
  return {status:dead?'DEAD':'RETRY_SCHEDULED',eventId:row.event_id,attempts:row.attempts,reason:code};
 }
 return {enqueue,enqueueActiveEntitlement,dispatchOne};
}
module.exports={createOutbox,validateTarget};
