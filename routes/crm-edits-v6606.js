'use strict';
const crypto=require('node:crypto');
const {requireTenantContext}=require('../enterprise/tenant-context.cjs');
const {positiveTenantId}=require('../enterprise/repositories/customer-repository.cjs');
const {revisionOfLead}=require('../enterprise/crm-revision-v6607.cjs');
// SBC_V6607_LEAD_REVISION_GUARD
const FIELDS=Object.freeze({contactName:['contact_name',255],phone:['phone',80],email:['email',255],status:['status',40],notes:['notes',4000]});
const STATUS=new Set(['Lead','Prospect','Contacted','Follow Up','Qualified','Interested','Not Interested','Appointment Set','Customer','Not Qualified','Do Not Call','Lost']);
const deny=(res,status,code)=>res.status(status).json({ok:false,code});
function tenantFor(req){
 const context=requireTenantContext();
 const tenant=positiveTenantId(context.tenantId);
 for(const value of [req?.tenantId,req?.user?.tenantId]){
  if(value!==undefined&&value!==null&&positiveTenantId(value)!==tenant)
   throw Object.assign(new Error('TENANT_CONTEXT_MISMATCH'),{code:'TENANT_CONTEXT_MISMATCH'});
 }
 return tenant;
}
module.exports=function registerLeadEdits(app,{auth,getContext}){
 if(typeof app.patch!=='function')throw Error('PATCH route registration required');
 app.patch('/api/v6606/crm/leads/:id',auth,async(req,res)=>{
  const ctx=getContext();
  // Never treat an absent recovery guard as "recovered".
  if(typeof ctx.recoveryRequired!=='function'||ctx.recoveryRequired())
   return deny(res,423,'MYSQL_RECOVERY_REQUIRED');
  const role=String(req.user?.role||'');
  if(!['owner','lead_researcher','caller'].includes(role))return deny(res,403,'LEAD_EDIT_FORBIDDEN');
  if(!ctx.mysqlPool||typeof ctx.mysqlPool.getConnection!=='function')return deny(res,503,'MYSQL_UNAVAILABLE');
  let tenant,id,edits;
  try{
   tenant=tenantFor(req);
   id=String(req.params?.id||'').trim();
   if(!id||id.length>80)throw Object.assign(new Error('CUSTOMER_ID_INVALID'),{code:'CUSTOMER_ID_INVALID'});
   const body=req.body;
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.getPrototypeOf(body)!==Object.prototype)
    throw Object.assign(new Error('INVALID_EDIT_BODY'),{code:'INVALID_EDIT_BODY'});
   const keys=Object.keys(body).filter(key=>key!=='revision');
   if(typeof body.revision!=='string'||!(/^[a-f0-9]{64}$/).test(body.revision))throw Object.assign(new Error('LEAD_REVISION_REQUIRED'),{code:'LEAD_REVISION_REQUIRED'});
   if(!keys.length)throw Object.assign(new Error('EMPTY_EDIT'),{code:'EMPTY_EDIT'});
   if(keys.some(key=>!Object.hasOwn(FIELDS,key)))throw Object.assign(new Error('UNAPPROVED_EDIT_FIELD'),{code:'UNAPPROVED_EDIT_FIELD'});
   edits=keys.map(key=>{
    const [column,max]=FIELDS[key];
    if(typeof body[key]!=='string'||body[key].length>max)throw Object.assign(new Error('INVALID_EDIT_VALUE'),{code:'INVALID_EDIT_VALUE'});
    const value=body[key].trim();
    if(key==='status'&&!STATUS.has(value))throw Object.assign(new Error('INVALID_LEAD_STATUS'),{code:'INVALID_LEAD_STATUS'});
    if(key==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Object.assign(new Error('INVALID_EMAIL'),{code:'INVALID_EMAIL'});
    return {key,column,value:key==='email'?value.toLowerCase():value};
   });
  }catch(e){
   const forbidden=['TENANT_CONTEXT_MISSING','VALID_TENANT_CONTEXT_REQUIRED','TENANT_DATABASE_ID_INVALID','TENANT_CONTEXT_MISMATCH'].includes(e.code);
   return deny(res,forbidden?403:400,e.code||'INVALID_LEAD_EDIT');
  }
  let conn=null,tx=false;
  try{
   conn=await ctx.mysqlPool.getConnection();
   await conn.beginTransaction();tx=true;
   const [matched]=await conn.query('SELECT id,assigned_to,contact_name,phone,email,status,notes,updated_at FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[tenant,id]);
   if(!Array.isArray(matched)||matched.length!==1){
    await conn.rollback();tx=false;return deny(res,404,'LEAD_NOT_FOUND');
   }
   if(revisionOfLead(matched[0])!==req.body.revision){
    await conn.rollback();tx=false;return deny(res,409,'LEAD_STALE_REVISION');
   }
   const actor=String(req.user?.username||req.user?.name||'').trim();
   if(role==='caller'&&(!actor||String(matched[0].assigned_to||'').trim()!==actor)){
    await conn.rollback();tx=false;return deny(res,403,'LEAD_ASSIGNMENT_REQUIRED');
   }
   const stamp=new Date().toISOString().slice(0,19).replace('T',' ');
   const params=[...edits.map(x=>x.value),stamp,tenant,id];
   const sql='UPDATE sbc_customers SET '+edits.map(x=>x.column+'=?').join(', ')+', updated_at=? WHERE tenant_id=? AND id=?';
   const [updated]=await conn.query(sql,params);
   if(updated?.affectedRows!==1)throw Error('LEAD_EDIT_NOT_PERSISTED');
   const [verified]=await conn.query(
    'SELECT id,tenant_id,contact_name,phone,email,status,notes,updated_at FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1',[tenant,id]
   );
   if(!Array.isArray(verified)||verified.length!==1||Number(verified[0].tenant_id)!==tenant)
    throw Error('LEAD_EDIT_READBACK_FAILED');
   for(const edit of edits){if(String(verified[0][edit.column]??'')!==edit.value)throw Error('LEAD_EDIT_READBACK_MISMATCH');}
   const activityId='act_'+crypto.randomUUID().replace(/-/g,'');
   await conn.query('INSERT INTO sbc_activities (id,activity_type,message,meta_json,created_at,tenant_id) VALUES (?,?,?,?,?,?)',[
    activityId,'lead_updated','CRM lead updated',
    JSON.stringify({customerId:id,changedFields:edits.map(x=>x.key),actor:actor||'authenticated-user',requestId:String(req.requestId||'')}),stamp,tenant
   ]);
   await conn.commit();tx=false;
   const existing=Array.isArray(ctx.db?.customers)?ctx.db.customers.find(c=>String(c.id)===id&&Number(c.tenantId??c.tenant_id)===tenant):null;
   if(existing){
    for(const edit of edits){existing[edit.key]=edit.value;existing[edit.column]=edit.value;}
    existing.updatedAt=stamp;
   }
   try{ctx.audit?.(req.user,'lead_updated_direct_mysql','CRM lead updated',{customerId:id,tenantId:tenant,fields:edits.map(x=>x.key),requestId:req.requestId||null});}catch(_){}
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,durable:true,tenantId:tenant,id,data:{...verified[0],revision:revisionOfLead(verified[0])},updatedFields:edits.map(x=>x.key)});
  }catch(error){
   if(conn&&tx)try{await conn.rollback();}catch(_){}
   return deny(res,503,'LEAD_EDIT_FAILED');
  }finally{try{conn?.release();}catch(_){}}
 });
};
