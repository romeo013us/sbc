'use strict';
// Appointment booking for full, owner-approved website presentations.
// No SMS, email, AI, telephony, external calendar, or prospect outreach.
const {randomUUID}=require('node:crypto');
const {sameTenant,canOperate,publicReady}=require('./sbc-preview-sales-policy.cjs');
const dateIso=value=>{const time=new Date(String(value||''));return Number.isFinite(time.getTime())?time.toISOString():'';};
function prepare({customer,site,actor,startAt,confirmed=false,now=new Date().toISOString()}={}){
 if(!customer||!site||!actor||!sameTenant(customer,actor.tenantId)||!sameTenant(site,actor.tenantId))throw Error('TENANT_CONTEXT_REQUIRED');
 if(String(site.customerId||'')!==String(customer.id||''))throw Error('WEBSITE_CUSTOMER_MISMATCH');
 if(!publicReady(site,customer))throw Error('WEBSITE_NOT_APPROVED');
 if(!canOperate(customer,actor,actor.tenantId))throw Error('NOT_ASSIGNED');
 if(customer.doNotContact===true||customer.doNotCall===true||customer.salesSuppressed===true||String(customer.status).toLowerCase()==='do not call')throw Error('CONTACT_SUPPRESSED');
 if(confirmed!==true)throw Error('APPOINTMENT_CONFIRMATION_REQUIRED');
 const start=dateIso(startAt),reference=new Date(now).getTime(),startMs=new Date(start).getTime();
 if(!start||!Number.isFinite(reference)||!Number.isFinite(startMs)||startMs<reference+10*60000||startMs>reference+90*24*60*60000)throw Error('APPOINTMENT_INVALID_TIME');
 const end=new Date(startMs+10*60000).toISOString();
 return {id:'webappt_'+randomUUID(),tenantId:Number(actor.tenantId),customerId:String(customer.id),
 customerName:String(customer.businessName||customer.contactName||'Business').slice(0,120),
 websiteId:String(site.id),type:'WEBSITE_WALKTHROUGH',title:'Website walkthrough — '+String(customer.businessName||customer.contactName||'Business').slice(0,100),
 durationMinutes:10,startAt:start,endAt:end,assignedTo:String(actor.id),status:'Scheduled',
 location:'Video or phone — agree on details with the customer',notes:'Customer agreed to a 10-minute website walkthrough. No automatic invitations or messages sent.',
 createdAt:new Date(reference).toISOString(),updatedAt:new Date(reference).toISOString()};
}
function register(app,{auth,requireTenant,db,getStore,saveData,writerReady,now=()=>new Date().toISOString()}){
 const inflight=new Map();
 app.post('/api/website-production/appointments',auth,async(req,res)=>{
  if(!writerReady())return res.status(423).json({ok:false,code:'WEBSITE_APPOINTMENT_WRITER_UNAVAILABLE'});
  let tid;try{tid=Number(requireTenant(req));if(!Number.isSafeInteger(tid)||tid<1)throw Error('TENANT_CONTEXT_REQUIRED')}catch{return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'})}
  const c=(db.customers||[]).find(x=>String(x.id)===String(req.body?.customerId||'')&&sameTenant(x,tid));
  const d=(getStore().websiteDemos||[]).find(x=>String(x.id)===String(req.body?.websiteId||'')&&sameTenant(x,tid));
  if(!c||!d)return res.status(404).json({ok:false,code:'WEBSITE_OR_CUSTOMER_NOT_FOUND'});
  let a;try{a=prepare({customer:c,site:d,actor:req.user,startAt:req.body?.startAt,confirmed:req.body?.prospectConfirmed,now:now()})}
  catch(e){const code=String(e.message||e);return res.status(/NOT_ASSIGNED|TENANT_CONTEXT|CONTACT_SUPPRESSED/.test(code)?403:/WEBSITE_NOT_APPROVED|WEBSITE_CUSTOMER_MISMATCH/.test(code)?409:400).json({ok:false,code})}
  const key=[tid,a.customerId,a.websiteId,a.startAt].join('::');
  const existing=()=>db.appointments?.find(x=>Number(x.tenantId)===tid&&String(x.customerId)===a.customerId&&String(x.websiteId)===a.websiteId&&x.startAt===a.startAt&&x.status==='Scheduled');
  if(existing())return res.json({ok:true,existing:true,appointment:existing()});
  if(inflight.has(key))return res.json({ok:true,existing:true,appointment:await inflight.get(key)});
  const reserve=(async()=>{
    const clash=(db.appointments||[]).some(x=>String(x.assignedTo)===a.assignedTo&&x.status==='Scheduled'&&
      new Date(x.startAt).getTime()<new Date(a.endAt).getTime()&&new Date(x.endAt||x.startAt).getTime()>new Date(a.startAt).getTime());
    if(clash)throw Error('APPOINTMENT_TIME_UNAVAILABLE');
    const prior=db.appointments||[];
    db.appointments=[a,...prior];
    try{
      const result=await saveData();
      if(result?.skipped===true)throw Error('APPOINTMENT_NOT_DURABLE');
      return a;
    }catch(e){db.appointments=prior;throw e}
  })();
  inflight.set(key,reserve);
  try{const appointment=await reserve;return res.status(201).json({ok:true,appointment})}
  catch(e){return res.status(e.message==='APPOINTMENT_TIME_UNAVAILABLE'?409:503).json({ok:false,code:String(e.message||'APPOINTMENT_SAVE_FAILED')})}
  finally{inflight.delete(key)}
 });
}
module.exports={prepare,register};
