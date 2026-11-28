'use strict';
/* Owner-approved bulk research trust. Does not call any verification provider,
   send messages, make calls, create purchases or grant marketing consent. */
const TRUST=require('../enterprise/sbc-trusted-research-v1.cjs');
const PATH='/api/owner/trusted-leads';
function register(app,{auth,ownerOnly,getContext,tenantForRead,writer,audit}={}){
 if(!app||!auth||!ownerOnly||!getContext||!tenantForRead||!writer)throw Error('TRUSTED_LEADS_DEPENDENCIES_REQUIRED');
 const failure=(res,e)=>{
  const code=String(e?.code||e?.message||'TRUSTED_LEADS_UNAVAILABLE');
  const status=e?.status||(/TENANT_CONTEXT|ROLE_DENIED/.test(code)?403:/CONFIRMATION|LIMIT/.test(code)?422:/WRITER|RECOVERY/.test(code)?423:503);
  return res.status(status).json({ok:false,code:/^(TRUSTED_|TENANT_|WRITER_|RECOVERY_)/.test(code)?code:'TRUSTED_LEADS_UNAVAILABLE'});
 };
 function scoped(req,write=false){
  if(req?.user?.role!=='owner'||req.user.active===false)throw Object.assign(Error('TRUSTED_ROLE_DENIED'),{status:403});
  const tenant=TRUST.tenantId(tenantForRead(req));
  if(req.user.tenantId!=null&&Number(req.user.tenantId)!==tenant)
   throw Object.assign(Error('TRUSTED_TENANT_MISMATCH'),{status:403});
  const ctx=getContext();
  if(!Array.isArray(ctx?.db?.customers))throw Error('TRUSTED_CANONICAL_CRM_UNAVAILABLE');
  if(write){
   if(!ctx?.mysqlPool||typeof ctx.mysqlPool.getConnection!=='function')throw Error('TRUSTED_MYSQL_REQUIRED');
   if(typeof ctx.recoveryRequired!=='function'||ctx.recoveryRequired()!==false)
    throw Object.assign(Error('TRUSTED_RECOVERY_HOLD'),{status:423});
   if(ctx.canWrite?.()!==true)throw Object.assign(Error('TRUSTED_WRITER_UNAVAILABLE'),{status:423});
   writer();
  }
  return {tenant,ctx};
 }
 app.get(PATH+'/preview',auth,ownerOnly,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {tenant,ctx}=scoped(req);
   const report=TRUST.plan(ctx.db.customers,tenant);
   const {ids,...safe}=report;
   return res.json({ok:true,readOnly:true,...safe,approvedBasis:'OWNER_TRUSTED_HUMAN_RESEARCH',
    independentVerificationPerformed:false,automaticExternalCalls:false,automaticOutbound:false,
    databaseWritable:Boolean(ctx.mysqlPool)&&ctx.recoveryRequired?.()===false&&ctx.canWrite?.()===true});
  }catch(e){return failure(res,e)}
 });
 app.post(PATH+'/approve-batch',auth,ownerOnly,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   if(req.body?.confirm!=='OWNER_TRUSTED_ALL_EXISTING')
    throw Object.assign(Error('TRUSTED_CONFIRMATION_REQUIRED'),{status:422});
   const limit=req.body?.limit===undefined?80:Number(req.body.limit);
   if(!Number.isSafeInteger(limit)||limit<1||limit>100)
    throw Object.assign(Error('TRUSTED_LIMIT_INVALID'),{status:422});
   const {tenant,ctx}=scoped(req,true);
   const selected=TRUST.plan(ctx.db.customers,tenant).ids.slice(0,limit);
   const conn=await ctx.mysqlPool.getConnection();let open=false;
   const committed=[];
   try{
    await conn.beginTransaction();open=true;
    for(const id of selected){
     const live=ctx.db.customers.find(c=>String(c.id)===id&&Number(c.tenantId??c.tenant_id)===tenant);
     if(!live||TRUST.reason(live))continue;
     const [rows]=await conn.query('SELECT id,tenant_id,business_name,phone,email,status,notes,lead_intelligence_json FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[tenant,id]);
     if(rows.length!==1)continue;
     const row=rows[0];
     if(String(row.id)!==id||Number(row.tenant_id)!==tenant)continue;
     // The reviewed snapshot must still identify the same business and contact.
     if(String(row.business_name??'').trim()!==String(live.businessName??'').trim()||String(row.phone??'').trim()!==String(live.phone??'').trim()||String(row.email??'').trim()!==String(live.email??'').trim())continue;
     let intelligence={};
     try{intelligence=JSON.parse(row.lead_intelligence_json||'{}')}catch{throw Error('TRUSTED_PERSISTED_RESEARCH_INVALID')}
     if(!intelligence||typeof intelligence!=='object'||Array.isArray(intelligence))throw Error('TRUSTED_PERSISTED_RESEARCH_INVALID');
     const copy={...live,businessName:row.business_name??live.businessName,phone:row.phone??live.phone,
      email:row.email??live.email,status:row.status??live.status,notes:row.notes??live.notes,
      leadIntelligence:intelligence,verificationStatus:intelligence.verificationStatus||live.verificationStatus};
     if(TRUST.reason(copy))continue;
     const result=TRUST.trust(copy,{actorId:req.user.id,basis:'OWNER_EXISTING_BATCH'});
     if(!result.applied)continue;
     if(ctx.recoveryRequired()!==false)throw Object.assign(Error('TRUSTED_RECOVERY_HOLD'),{status:423});
     writer();
     const [update]=await conn.query('UPDATE sbc_customers SET lead_intelligence_json=?,updated_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND id=?',
      [JSON.stringify(copy.leadIntelligence),tenant,id]);
     if(update.affectedRows!==1)throw Error('TRUSTED_PERSISTENCE_FAILED');
     committed.push({live,intelligence:copy.leadIntelligence,at:copy.updatedAt});
    }
    if(ctx.recoveryRequired()!==false)throw Object.assign(Error('TRUSTED_RECOVERY_HOLD'),{status:423});
    writer();
    await conn.commit();open=false;
   }catch(e){if(open)try{await conn.rollback()}catch{}throw e}
   finally{try{conn.release()}catch{}}
   for(const {live,intelligence,at} of committed){
    live.leadIntelligence=intelligence;
    live.verificationStatus='Sales Ready';
    live.updatedAt=at;
    live.leadAssist={...(live.leadAssist||{}),status:'OWNER_TRUSTED_RESEARCH',approvedAt:at,approvedBy:String(req.user.id)};
   }
   // Earlier queued enrichment must not overwrite owner-trusted results.
   for(const job of ctx.db.leadAssistQueue||[]){
    if(committed.some(v=>String(v.live.id)===String(job.customerId))&&['QUEUED','PROCESSING'].includes(job.status))
     {job.status='SKIPPED';job.reason='OWNER_TRUSTED_RESEARCH';job.updatedAt=new Date().toISOString();}
   }
   try{audit?.(req.user,'owner_trusted_leads_bulk','Owner accepted researched CRM leads without third-party reverification',
    {tenantId:tenant,approved:committed.length,providerRequests:0,automaticOutreach:false});}catch{}
   const remaining=TRUST.plan(ctx.db.customers,tenant);
   return res.json({ok:true,approved:committed.length,remaining:remaining.approvable,
    skipped:remaining.skipped,tenantId:tenant,independentlyVerified:false,
    automaticOutreach:false,providerCalls:0,charges:0,persisted:true});
  }catch(e){return failure(res,e)}
 });
 return {ownerOnly:true,externalVerification:false,outbound:false};
}
module.exports={register};
