'use strict';
/* SBC renewal dashboard, owner-only. Existing sbc_renewals table; no charges or automatic outreach. */
const crypto=require('node:crypto');
const POLICY=require('../enterprise/sbc-package-renewals-v20261115.cjs');
const PAYMENT=require('../enterprise/v6640-payment-evidence.cjs');
const asText=(x,max=300)=>String(x??'').trim().slice(0,max);
const tenantOf=x=>Number(x?.tenantId??x?.tenant_id);
function dateOnly(x){if(x instanceof Date)return x.toISOString().slice(0,10);const s=String(x||'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):''}
function jsonNotes(x){try{const n=JSON.parse(String(x||'{}'));return n&&typeof n==='object'&&!Array.isArray(n)?n:{}}catch{return {}}}
function show(row,today){
 const notes=jsonNotes(row.notes),meta=notes.sbcRenewal||null;
 const expiry=dateOnly(row.due_date??row.dueDate);
 let due={stage:'UNKNOWN',daysUntilDue:null,ownerReviewNeeded:true};
 if(expiry)try{due=POLICY.dueStage(expiry,today)}catch{}
 const history=Array.isArray(meta?.contacts)?meta.contacts:[];
 return {id:String(row.id),customerId:String(row.customer_id??row.customerId??''),customerName:String(row.customer_name??row.customerName??''),service:String(row.service),expiresOn:expiry,amount:Number(row.amount||0),status:String(row.status||'Upcoming'),due,
 sourceOrderId:meta?.orderId||'',packageCode:meta?.packageCode||'',providerReference:meta?.providerReference||'',
 providerAutoRenewState:meta?.providerAutoRenewState||'UNKNOWN',automaticCharge:false,
 verification:meta?'OWNER_ATTESTED_AND_SQUARE_EVIDENCE_RECORDED':'LEGACY_NEEDS_RECONCILIATION',
 lastContactedAt:history.at(-1)?.at||'',lastOutcome:history.at(-1)?.outcome||'',contacts:history};
}
function error(res,e){const code=asText(e?.code||e?.message||'RENEWAL_OPERATION_FAILED',100);const status=Number(e?.status)||(/TENANT|OWNER_REQUIRED/.test(code)?403:/REQUIRED|INVALID|UNKNOWN|NOT_PURCHASED/.test(code)?422:503);return res.status(status).json({ok:false,code,error:code})}
function register(app,{auth,getContext,tenantForRead}={}){
 if(!app||typeof auth!=='function'||typeof getContext!=='function'||typeof tenantForRead!=='function')throw Error('RENEWAL_ROUTE_DEPENDENCIES_REQUIRED');
 function gate(req){
  if(req?.user?.role!=='owner')throw Object.assign(Error('OWNER_REQUIRED'),{status:403});
  const tenant=Number(tenantForRead(req));
  if(!Number.isSafeInteger(tenant)||tenant<1)throw Object.assign(Error('TENANT_REQUIRED'),{status:403});
  const ctx=getContext();
  if(!ctx?.mysqlPool||typeof ctx.mysqlPool.getConnection!=='function')throw Object.assign(Error('AUTHORITATIVE_MYSQL_UNAVAILABLE'),{status:503});
  return {ctx,tenant};
 }
 function writer(ctx){if(typeof ctx.recoveryRequired!=='function'||ctx.recoveryRequired()!==false)throw Object.assign(Error('MYSQL_RECOVERY_WRITE_BLOCKED'),{status:423})}
 const today=()=>new Date().toISOString().slice(0,10);
 app.get('/api/owner/renewals/overview',auth,async(req,res)=>{
  try{
   const {ctx,tenant}=gate(req);
   const [rows]=await ctx.mysqlPool.query('SELECT id,customer_id,customer_name,service,due_date,amount,status,notes FROM sbc_renewals WHERE tenant_id=? ORDER BY due_date ASC LIMIT 1000',[tenant]);
   const renewals=(Array.isArray(rows)?rows:[]).map(r=>show(r,today()));
   const due=renewals.filter(r=>r.due.ownerReviewNeeded&&!['Paid','Cancelled','Declined'].includes(r.status));
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,readOnly:true,ownerApprovalRequired:true,noAutomaticCharges:true,asOf:today(),renewals,dueCount:due.length,overdueCount:due.filter(r=>r.due.daysUntilDue<0).length,needsVerification:renewals.filter(r=>r.verification!=='OWNER_ATTESTED_AND_SQUARE_EVIDENCE_RECORDED').length});
  }catch(e){return error(res,e)}
 });
 app.post('/api/owner/renewals/enroll',auth,async(req,res)=>{
  let conn,transaction=false;
  try{
   const {ctx,tenant}=gate(req);writer(ctx);
   const b=req.body||{};
   const customerId=asText(b.customerId,80),orderId=asText(b.orderId,80),service=asText(b.service,30),pkg=asText(b.packageCode,30);
   const providerReference=asText(b.providerReference,120),acknowledgement=asText(b.customerAcknowledgementEvidence,400);
   if(acknowledgement.length<10)throw Object.assign(Error('CUSTOMER_TERMS_EVIDENCE_REQUIRED'),{status:422});
   if(b.ownerApproved!==true||b.customerAcknowledgedTerms!==true||b.activationProofConfirmed!==true)throw Object.assign(Error('CUSTOMER_AND_OWNER_APPROVAL_REQUIRED'),{status:422});
   if(!['ENABLED','DISABLED','UNKNOWN'].includes(b.providerAutoRenewState))throw Object.assign(Error('PROVIDER_AUTO_RENEW_STATE_REQUIRED'),{status:422});
   const clean=POLICY.calcRenewal({tenantId:tenant,customerId,orderId,service,packageCode:pkg,activatedOn:asText(b.activatedOn,10),providerExpiresOn:asText(b.providerExpiresOn,10),providerReference,
   paymentProofConfirmed:true,activationProofConfirmed:true,customerAcknowledgedTerms:true,ownerApproved:true,securitySelected:b.securitySelected===true});
   const order=(Array.isArray(ctx.db?.orders)?ctx.db.orders:[]).find(o=>String(o.id)===orderId&&tenantOf(o)===tenant&&String(o.customerId)===customerId);
   if(!order||!PAYMENT.providerCapturedSquare(order))throw Object.assign(Error('VERIFIED_SQUARE_CAPTURE_REQUIRED'),{status:422});
   const digest=crypto.createHash('sha256').update([tenant,customerId,orderId,service].join('|')).digest('hex').slice(0,50);
   const renewalId='sbc_renew_'+digest;
   conn=await ctx.mysqlPool.getConnection();await conn.beginTransaction();transaction=true;
   const [orders]=await conn.query('SELECT id,customer_id,tenant_id FROM sbc_orders WHERE tenant_id=? AND id=? LIMIT 1',[tenant,orderId]);
   const [customers]=await conn.query('SELECT id,business_name,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1',[tenant,customerId]);
   if(!orders?.length||String(orders[0].customer_id??orders[0].customerId)!==customerId||!customers?.length)throw Object.assign(Error('AUTHORITATIVE_CUSTOMER_ORDER_LINK_NOT_FOUND'),{status:404});
   const [existing]=await conn.query('SELECT id,customer_id,customer_name,service,due_date,amount,status,notes FROM sbc_renewals WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[tenant,renewalId]);
   if(existing?.length){await conn.commit();transaction=false;return res.json({ok:true,idempotent:true,renewal:show(existing[0],today())})}
   const metadata={kind:'SBC_RENEWAL_V1',...clean,orderId,providerAutoRenewState:b.providerAutoRenewState,customerAcknowledgementEvidence:acknowledgement,ownerApprovedAt:new Date().toISOString(),contacts:[],customerRenewalAuthorized:false};
   const amount=clean.renewalAmountCents==null?0:clean.renewalAmountCents/100;
   const stamp=new Date().toISOString().slice(0,19).replace('T',' ');
   await conn.query('INSERT INTO sbc_renewals (id,customer_id,customer_name,service,due_date,amount,status,notes,created_at,updated_at,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[
   renewalId,customerId,asText(customers[0].business_name??customers[0].businessName,255),service,clean.expiresOn,amount,'Upcoming',JSON.stringify({sbcRenewal:metadata}),stamp,stamp,tenant]);
   const [saved]=await conn.query('SELECT id,customer_id,customer_name,service,due_date,amount,status,notes FROM sbc_renewals WHERE tenant_id=? AND id=? LIMIT 1',[tenant,renewalId]);
   if(saved?.length!==1)throw Object.assign(Error('RENEWAL_DURABLE_READBACK_FAILED'),{status:503});
   await conn.commit();transaction=false;return res.status(201).json({ok:true,durable:true,renewal:show(saved[0],today())});
  }catch(e){if(transaction&&conn)try{await conn.rollback()}catch{}return error(res,e)}
  finally{if(conn)try{conn.release()}catch{}}
 });
 app.post('/api/owner/renewals/contact',auth,async(req,res)=>{
  let conn,transaction=false;
  try{
   const {ctx,tenant}=gate(req);writer(ctx);
   const b=req.body||{},renewalId=asText(b.renewalId,80),channel=asText(b.channel,30),outcome=asText(b.outcome,30),note=asText(b.note,500),requestId=asText(b.clientRequestId,90);
   if(!['phone','email','sms','in_person'].includes(channel)||!['CONTACTED','FOLLOW_UP','DECLINED','NEEDS_APPROVAL'].includes(outcome)||note.length<5)
   throw Object.assign(Error('VALID_CONTACT_NOTE_REQUIRED'),{status:422});
   if(requestId&&!/^[A-Za-z0-9_-]{12,90}$/.test(requestId))throw Object.assign(Error('INVALID_CONTACT_REQUEST_ID'),{status:422});
   conn=await ctx.mysqlPool.getConnection();await conn.beginTransaction();transaction=true;
   const [rows]=await conn.query('SELECT id,customer_id,customer_name,service,due_date,amount,status,notes FROM sbc_renewals WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[tenant,renewalId]);
   if(!rows?.length)throw Object.assign(Error('RENEWAL_NOT_FOUND'),{status:404});
   const old=rows[0],notes=jsonNotes(old.notes),meta=notes.sbcRenewal;
   if(!meta||meta.kind!=='SBC_RENEWAL_V1')throw Object.assign(Error('LEGACY_RENEWAL_NEEDS_OWNER_RECONCILIATION'),{status:409});
   const contacts=Array.isArray(meta.contacts)?meta.contacts:[];
   if(requestId&&contacts.some(x=>x.clientRequestId===requestId)){await conn.commit();transaction=false;return res.json({ok:true,idempotent:true,renewal:show(old,today())})}
   const event={clientRequestId:requestId||crypto.randomUUID(),at:new Date().toISOString(),channel,outcome,note,recordedBy:'owner',messageSentBySystem:false};
   const updatedNotes={...notes,sbcRenewal:{...meta,contacts:[...contacts,event].slice(-40)}};
   const status=outcome==='DECLINED'?'Cancelled':outcome==='CONTACTED'?'Contacted':String(old.status||'Upcoming');
   const stamp=new Date().toISOString().slice(0,19).replace('T',' ');
   await conn.query('UPDATE sbc_renewals SET notes=?,status=?,updated_at=? WHERE tenant_id=? AND id=?',[JSON.stringify(updatedNotes),status,stamp,tenant,renewalId]);
   const [saved]=await conn.query('SELECT id,customer_id,customer_name,service,due_date,amount,status,notes FROM sbc_renewals WHERE tenant_id=? AND id=? LIMIT 1',[tenant,renewalId]);
   if(saved?.length!==1)throw Object.assign(Error('RENEWAL_CONTACT_READBACK_FAILED'),{status:503});
   await conn.commit();transaction=false;return res.json({ok:true,durable:true,renewal:show(saved[0],today())});
  }catch(e){if(transaction&&conn)try{await conn.rollback()}catch{}return error(res,e)}
  finally{if(conn)try{conn.release()}catch{}}
 });
 return {registered:true};
}
module.exports={register,show};
