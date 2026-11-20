'use strict';
/* SBC Account Portfolios V1 — owner-controlled, persistent CRM account ownership.
 * Future hires/assignments use account_manager; existing caller assignments are historical and retained.
 */
const {randomUUID,createHash}=require('node:crypto');
const {requireTenantContext}=require('../enterprise/tenant-context.cjs');
const {positiveTenantId}=require('../enterprise/repositories/customer-repository.cjs');
const AccountManagerReadiness=require('../enterprise/sbc-account-manager-readiness-v6.cjs');
const SBCVoicePreflightV2=require('../enterprise/sbc-call-command-voice-preflight-v2.cjs');
const STATUS_BLOCKED=new Set(['do not call','do not contact','dnc','opt out','unsubscribe','lost','bad number','wrong number','deleted']);
const fail=(res,status,code)=>res.status(status).json({ok:false,code});
function safeTenant(req){
 const tenant=positiveTenantId(requireTenantContext().tenantId);
 for(const v of [req.tenantId,req.user?.tenantId]){
  if(v!==undefined&&v!==null&&positiveTenantId(v)!==tenant)throw Error('TENANT_CONTEXT_MISMATCH');
 }
 return tenant;
}
function safeId(value){
 const id=String(value||'').trim();
 if(!id||id.length>80||!/^[\w.:-]+$/.test(id))throw Error('ACCOUNT_ID_INVALID');
 return id;
}
function manager(ctx,id,tenant){
 const m=(ctx.db?.users||[]).find(u=>String(u.id)===id);
 if(!m||m.active===false||m.role!=='account_manager')throw Error('MANAGER_NOT_ACTIVE');
 if(positiveTenantId(m.tenantId??m.tenant_id)!==tenant)throw Error('MANAGER_TENANT_FORBIDDEN');
 return m;
}
function validateDueDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('FOLLOW_UP_DATE_INVALID');
 const t=Date.parse(value+'T00:00:00.000Z');
 if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==value)throw Error('FOLLOW_UP_DATE_INVALID');
 if(t<Date.now()-86400000||t>Date.now()+366*86400000*3)throw Error('FOLLOW_UP_DATE_INVALID');
 return value;
}
const stamp=()=>new Date().toISOString().slice(0,19).replace('T',' ');
function eventData(id,type,message,meta,tenant){
 const at=stamp();return {sql:'INSERT INTO sbc_activities (id,activity_type,message,meta_json,created_at,tenant_id) VALUES (?,?,?,?,?,?)',
  params:['act_'+randomUUID().replace(/-/g,''),type,message,JSON.stringify({customerId:id,...meta}),at,tenant]};
}
async function withTx(ctx,callback){
 const conn=await ctx.mysqlPool.getConnection();
 let inTx=false;
 try{
  await conn.beginTransaction();inTx=true;
  const value=await callback(conn);
  if(value?.status&&value.status!==200){await conn.rollback();inTx=false;return value;}
  if(value?.readOnly===true){await conn.rollback();inTx=false;return value;}
  await conn.commit();inTx=false;
  return value;
 }catch(error){
  if(inTx)try{await conn.rollback();}catch(_){}
  throw error;
 }finally{try{conn.release()}catch(_){}}
}
function register(app,{auth,getContext}){
 const context=(req,res,write=false)=>{
  const ctx=getContext();
  if(!req.user||!['owner','caller','account_manager'].includes(req.user.role))return {denied:fail(res,403,'ACCOUNT_ACCESS_DENIED')};
  let tenant;
  try{tenant=safeTenant(req)}catch(_){return {denied:fail(res,403,'TENANT_CONTEXT_REQUIRED')}}
  if(write&&(typeof ctx.recoveryRequired!=='function'||ctx.recoveryRequired()))
   return {denied:fail(res,423,'MYSQL_RECOVERY_REQUIRED')};
  if(!ctx.mysqlPool||typeof ctx.mysqlPool.getConnection!=='function')
   return {denied:fail(res,503,'MYSQL_UNAVAILABLE')};
  return {ctx,tenant};
 };

 // Authoritative CRM ownership view for Account Manager workstations.
 // It deliberately does not grant Social Studio or telephony privileges.
 app.get('/api/v6606/crm/account-portfolios/mine',auth,async(req,res)=>{
  const x=context(req,res);if(x.denied)return;
  if(!['account_manager','caller'].includes(req.user.role)||req.user.active===false)
   return fail(res,403,'ACCOUNT_MANAGER_SESSION_REQUIRED');
  const uid=String(req.user.id||'');
  const u=(x.ctx.db?.users||[]).find(row=>String(row.id)===uid&&
   Number(row.tenantId??row.tenant_id)===x.tenant&&row.role===req.user.role&&row.active!==false);
  if(!u)return fail(res,403,'ACCOUNT_MANAGER_SESSION_REQUIRED');
  let conn;
  try{
   conn=await x.ctx.mysqlPool.getConnection();
   const [records]=await conn.query(
    "SELECT id,business_name,phone,status,assigned_to,follow_up,tenant_id FROM sbc_customers WHERE tenant_id=? AND assigned_to=? AND COALESCE(status,'') <> 'Deleted' ORDER BY created_at DESC,id ASC LIMIT 500",
    [x.tenant,uid]);
   if(!Array.isArray(records)||records.some(row=>Number(row.tenant_id)!==x.tenant||
    String(row.assigned_to||'')!==uid))throw Error('CRM_ACCOUNT_ASSIGNMENT_MISMATCH');
   const accounts=records.map(row=>{
    const cached=(x.ctx.db?.customers||[]).find(c=>String(c.id)===String(row.id)&&
     Number(c.tenantId??c.tenant_id)===x.tenant);
    const doNotContact=STATUS_BLOCKED.has(String(row.status||'').trim().toLowerCase())||
     cached?.doNotContact===true||cached?.doNotCall===true||cached?.salesSuppressed===true;
    return {id:String(row.id),businessName:String(row.business_name||'').slice(0,220),
     phone:String(row.phone||'').slice(0,80),status:String(row.status||'').slice(0,60),
     managerId:uid,followUp:row.follow_up||null,doNotContact,
     timeline:[]};
   });
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,data:{tenantId:x.tenant,accounts,source:'AUTHORITATIVE_CRM_ASSIGNMENT',
    socialPermissionsNotInferred:true,legacyCallerReadOnly:req.user.role==='caller'}});
  }catch{return fail(res,503,'ACCOUNT_PORTFOLIO_MINE_UNAVAILABLE')}
  finally{try{conn?.release()}catch(_){}}
 });

 // V2 authenticated preflight: read-only. No Twilio tokens or outbound calls.
 app.get('/api/v6606/crm/account-portfolios/:id/call-preflight',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const x=context(req,res);if(x.denied)return;
  if(!['owner','account_manager'].includes(req.user.role)||req.user.active===false)
   return fail(res,403,'CALL_COMMAND_ROLE_DENIED');
  let id;try{id=safeId(req.params.id)}catch{return fail(res,400,'ACCOUNT_ID_INVALID')}
  let conn;
  try{
   conn=await x.ctx.mysqlPool.getConnection();
   const [rows]=await conn.query(
    'SELECT id,phone,status,assigned_to,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1',
    [x.tenant,id]);
   if(!Array.isArray(rows)||rows.length!==1)return fail(res,404,'ACCOUNT_NOT_FOUND');
   const row=rows[0],actor=String(req.user.id||'');
   if(req.user.role==='account_manager'){
    const staff=(x.ctx.db?.users||[]).find(u=>String(u.id)===actor&&
     Number(u.tenantId??u.tenant_id)===x.tenant&&u.role==='account_manager'&&u.active!==false);
    if(!staff||String(row.assigned_to||'')!==actor)return fail(res,403,'ACCOUNT_NOT_ASSIGNED');
   }
   const cached=(x.ctx.db?.customers||[]).find(c=>String(c.id)===id&&
    Number(c.tenantId??c.tenant_id)===x.tenant);
   // The CRM currently lacks authoritative outreach-consent / DNC screening
   // records. Never infer them from untrusted browser fields or a phone number.
   const flags={doNotContact:cached?.doNotContact===true,
    doNotCall:cached?.doNotCall===true,salesSuppressed:cached?.salesSuppressed===true};
   const result=SBCVoicePreflightV2.preflight({account:row,user:req.user,tenantId:x.tenant,flags});
   return res.json({...result,accountId:id,verified:false,
    nextStep:'Complete server-verified calling authorization, DNC screening, time zone and Twilio/logging integration.'});
  }catch{return fail(res,503,'CALL_PREFLIGHT_UNAVAILABLE')}
  finally{try{conn?.release()}catch{}}
 });

 // V6 owner-only evidence: compares independent CRM vs Social ownership.
 // Never mutates staff, customers, social permissions, products or orders.
 app.get('/api/v6606/crm/account-portfolios/launch-readiness',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const x=context(req,res);if(x.denied)return;
  if(req.user.role!=='owner'||req.user.active===false)
   return fail(res,403,'OWNER_REQUIRED');
  let conn;
  try{
   conn=await x.ctx.mysqlPool.getConnection();
   const [crmRows]=await conn.query(
    'SELECT id,assigned_to,status,tenant_id FROM sbc_customers WHERE tenant_id=? ORDER BY id ASC LIMIT ?',
    [x.tenant,5001]);
   const [socialRows]=await conn.query(
    'SELECT customer_id,manager_id,tenant_id FROM sbc_account_ownership_v1 WHERE tenant_id=? ORDER BY customer_id ASC LIMIT ?',
    [x.tenant,5001]);
   const audit=AccountManagerReadiness({
    crmRows,socialRows,users:x.ctx.db?.users||[],tenantId:x.tenant,observedAt:Date.now()
   });
   return res.json({ok:true,audit,readOnly:true,source:'LIVE_CRM_AND_SOCIAL_DB_SNAPSHOT',
    permission:'OWNER_ONLY',writes:0});
  }catch{return fail(res,503,'ACCOUNT_MANAGER_READINESS_UNAVAILABLE')}
  finally{try{conn?.release()}catch(_){ }}
 });
 app.get('/api/v6606/crm/account-portfolios/summary',auth,async(req,res)=>{
  const x=context(req,res);
  if(x.denied)return;
  if(req.user.role!=='owner')return fail(res,403,'OWNER_REQUIRED');
  let conn;
  try{
   conn=await x.ctx.mysqlPool.getConnection();
   const [records]=await conn.query("SELECT COALESCE(assigned_to,'') AS manager_id,status,COUNT(*) AS account_count,SUM(CASE WHEN follow_up < CURDATE() THEN 1 ELSE 0 END) AS overdue_count FROM sbc_customers WHERE tenant_id=? GROUP BY assigned_to,status",[x.tenant]);
   if(!Array.isArray(records))throw Error('PORTFOLIO_DB_READ_FAILED');
   const summary=new Map(),users=(x.ctx.db?.users||[]).filter(u=>(u.role==='account_manager'||u.role==='caller')&&u.active!==false&&Number(u.tenantId??u.tenant_id)===x.tenant);
   
   for(const u of users)summary.set(String(u.id),{id:String(u.id),name:(u.role==='caller'?'Legacy Sales Caller — ':'')+String(u.name||u.username||u.id).slice(0,130),accounts:0,customers:0,prospects:0,overdue:0});
   let unassigned=0;
   for(const c of records){
    const id=String(c.manager_id||'');
    const count=Number(c.account_count||0),overdue=Number(c.overdue_count||0);
    if(!id){unassigned+=count;continue;}
    if(!summary.has(id))summary.set(id,{id,name:'Inactive or historical account manager',accounts:0,customers:0,prospects:0,overdue:0});
    const m=summary.get(id);
    m.accounts+=count;if(String(c.status||'').toLowerCase()==='customer')m.customers+=count;else m.prospects+=count;
    m.overdue+=overdue;
   }
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,managers:[...summary.values()].sort((a,b)=>a.name.localeCompare(b.name)),unassigned,total:unassigned+[...summary.values()].reduce((n,m)=>n+m.accounts,0),readOnly:true});
  }catch(_){return fail(res,503,'PORTFOLIO_SUMMARY_UNAVAILABLE')}
  finally{try{conn?.release()}catch(_){}}
 });
 app.post('/api/v6606/crm/account-portfolios/assign-batch',auth,async(req,res)=>{
  const x=context(req,res,true);if(x.denied)return;
  if(req.user.role!=='owner')return fail(res,403,'OWNER_REQUIRED');
  let target,ids,amount;
  try{
   if(!req.body||typeof req.body!=='object'||Array.isArray(req.body))throw Error('INVALID_ASSIGNMENT');
   target=manager(x.ctx,safeId(req.body.managerId),x.tenant);
   if(req.body.accountIds!==undefined){
    if(!Array.isArray(req.body.accountIds)||!req.body.accountIds.length||req.body.accountIds.length>100)throw Error('INVALID_BATCH_SIZE');
    ids=req.body.accountIds.map(safeId);
    if(new Set(ids).size!==ids.length)throw Error('DUPLICATE_ACCOUNT_ID');
    amount=ids.length;
   }else{
    amount=Number(req.body.amount??25);
    if(!Number.isInteger(amount)||amount<1||amount>100)throw Error('INVALID_BATCH_SIZE');
   }
  }catch(e){
   const code=String(e.message||e);
   return fail(res,/TENANT_FORBIDDEN/.test(code)?403:400,code);
  }
  try{
   const result=await withTx(x.ctx,async conn=>{
    let selected;
    if(ids){
     const holders=ids.map(()=>'?').join(',');
     [selected]=await conn.query('SELECT id,assigned_to,status,follow_up,tenant_id FROM sbc_customers WHERE tenant_id=? AND id IN ('+holders+') ORDER BY id ASC FOR UPDATE',[x.tenant,...ids]);
     if(!Array.isArray(selected)||selected.length!==ids.length)return {status:404,code:'ACCOUNT_NOT_FOUND'};
    }else{
     [selected]=await conn.query("SELECT id,assigned_to,status,follow_up,tenant_id FROM sbc_customers WHERE tenant_id=? AND (assigned_to IS NULL OR assigned_to='') AND LOWER(TRIM(status)) NOT IN ('lost','do not call','do not contact','dnc','opt out','unsubscribe','bad number','wrong number','deleted') ORDER BY created_at ASC,id ASC LIMIT ? FOR UPDATE",[x.tenant,amount]);
    }
    if(!Array.isArray(selected))throw Error('ACCOUNT_DB_READ_FAILED');
    if(selected.some(c=>String(c.assigned_to||'')!==''))return {status:409,code:'ACCOUNT_ALREADY_ASSIGNED'};
    if(selected.some(c=>STATUS_BLOCKED.has(String(c.status||'').toLowerCase())))return {status:409,code:'ACCOUNT_CONTACT_SUPPRESSED'};
    const at=stamp();
    for(const c of selected){
     const [updated]=await conn.query("UPDATE sbc_customers SET assigned_to=?,updated_at=? WHERE tenant_id=? AND id=? AND (assigned_to IS NULL OR assigned_to='')",[String(target.id),at,x.tenant,String(c.id),null]);
     if(updated?.affectedRows!==1)throw Error('ACCOUNT_ASSIGNMENT_READBACK_FAILED');
     const event=eventData(String(c.id),'account_assigned','SBC account assigned to manager',
      {fromManagerId:'',toManagerId:String(target.id),actorId:String(req.user.id||''),assignedAt:at},x.tenant);
     await conn.query(event.sql,event.params);
    }
    return {status:200,assigned:selected.length,ids:selected.map(c=>String(c.id)),managerId:String(target.id),managerName:String(target.name||target.username||target.id)};
   });
   if(result.status!==200)return fail(res,result.status,result.code);
   for(const c of x.ctx.db?.customers||[]){
    if(result.ids.includes(String(c.id))&&Number(c.tenantId??c.tenant_id)===x.tenant){
     c.assignedTo=result.managerId;c.assignedToName=result.managerName;
    }
   }
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,durable:true,assigned:result.assigned,accountIds:result.ids,managerId:result.managerId,managerName:result.managerName});
  }catch(_){return fail(res,503,'ACCOUNT_ASSIGNMENT_FAILED')}
 });
 app.post('/api/v6606/crm/account-portfolios/:id/transfer',auth,async(req,res)=>{
  const x=context(req,res,true);if(x.denied)return;
  if(req.user.role!=='owner')return fail(res,403,'OWNER_REQUIRED');
  let id,target,expected,reason;
  try{
   id=safeId(req.params.id);target=manager(x.ctx,safeId(req.body?.managerId),x.tenant);
   expected=safeId(req.body?.expectedManagerId);
   reason=String(req.body?.reason||'').trim();
   if(reason.length<12||reason.length>500)throw Error('TRANSFER_REASON_REQUIRED');
   if(expected===String(target.id))throw Error('ACCOUNT_MANAGER_UNCHANGED');
  }catch(e){const code=String(e.message||e);return fail(res,/TENANT_FORBIDDEN/.test(code)?403:400,code)}
  try{
   const result=await withTx(x.ctx,async conn=>{
    const [rows]=await conn.query('SELECT id,assigned_to,status,follow_up,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[x.tenant,id]);
    if(!Array.isArray(rows)||rows.length!==1)return {status:404,code:'ACCOUNT_NOT_FOUND'};
    if(String(rows[0].assigned_to||'')!==expected)return {status:409,code:'ACCOUNT_MANAGER_CHANGED'};
    const at=stamp();
    const [updated]=await conn.query('UPDATE sbc_customers SET assigned_to=?,updated_at=? WHERE tenant_id=? AND id=? AND assigned_to=?',[String(target.id),at,x.tenant,id,expected]);
    if(updated?.affectedRows!==1)throw Error('ACCOUNT_TRANSFER_READBACK_FAILED');
    const event=eventData(id,'account_transferred','SBC account manager transferred',
     {fromManagerId:expected,toManagerId:String(target.id),reason,actorId:String(req.user.id||''),transferredAt:at},x.tenant);
    await conn.query(event.sql,event.params);
    return {status:200,managerId:String(target.id),managerName:String(target.name||target.username||target.id)};
   });
   if(result.status!==200)return fail(res,result.status,result.code);
   const c=(x.ctx.db?.customers||[]).find(c=>String(c.id)===id&&Number(c.tenantId??c.tenant_id)===x.tenant);
   if(c){c.assignedTo=result.managerId;c.assignedToName=result.managerName}
   return res.json({ok:true,durable:true,id,managerId:result.managerId,fromManagerId:expected});
  }catch(_){return fail(res,503,'ACCOUNT_TRANSFER_FAILED')}
 });
 app.post('/api/v6606/crm/account-portfolios/:id/follow-up',auth,async(req,res)=>{
  const x=context(req,res,true);if(x.denied)return;
  let id,dueDate,purpose;
  try{
   id=safeId(req.params.id);dueDate=validateDueDate(req.body?.dueDate);
   purpose=String(req.body?.purpose||'').trim();
   if(purpose.length<12||purpose.length>500)throw Error('FOLLOW_UP_PURPOSE_REQUIRED');
  }catch(e){return fail(res,400,String(e.message||e))}
  try{
   const result=await withTx(x.ctx,async conn=>{
    const [rows]=await conn.query('SELECT id,assigned_to,status,follow_up,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[x.tenant,id]);
    if(!Array.isArray(rows)||rows.length!==1)return {status:404,code:'ACCOUNT_NOT_FOUND'};
    const c=rows[0],assigned=String(c.assigned_to||'');
    if(req.user.role!=='owner'&&assigned!==String(req.user.id||''))return {status:403,code:'ACCOUNT_NOT_ASSIGNED'};
    if(STATUS_BLOCKED.has(String(c.status||'').toLowerCase()))return {status:409,code:'ACCOUNT_CONTACT_SUPPRESSED'};
    const cached=(x.ctx.db?.customers||[]).find(z=>String(z.id)===id&&Number(z.tenantId??z.tenant_id)===x.tenant);
    if(cached&&(cached.doNotContact||cached.salesSuppressed||cached.doNotCall))return {status:409,code:'ACCOUNT_CONTACT_SUPPRESSED'};
    const at=stamp();
    const [updated]=await conn.query('UPDATE sbc_customers SET follow_up=?,updated_at=? WHERE tenant_id=? AND id=? AND assigned_to=?',[dueDate,at,x.tenant,id,assigned]);
    if(updated?.affectedRows!==1)throw Error('FOLLOW_UP_SAVE_FAILED');
    const event=eventData(id,'account_follow_up_scheduled','Account manager scheduled a follow-up',
      {dueDate,purpose,assignedTo:assigned,actorId:String(req.user.id||''),scheduledAt:at},x.tenant);
    await conn.query(event.sql,event.params);
    return {status:200,assignedTo:assigned};
   });
   if(result.status!==200)return fail(res,result.status,result.code);
   const c=(x.ctx.db?.customers||[]).find(z=>String(z.id)===id&&Number(z.tenantId??z.tenant_id)===x.tenant);
   if(c){c.followUp=dueDate;c.followUpAt=dueDate}
   return res.json({ok:true,durable:true,id,followUp:dueDate,purpose,assignedTo:result.assignedTo,contactSent:false});
  }catch(_){return fail(res,503,'FOLLOW_UP_SAVE_FAILED')}
 });
 app.get('/api/v6606/crm/account-portfolios/:id/history',auth,async(req,res)=>{
  const x=context(req,res);
  if(x.denied)return;
  let id;try{id=safeId(req.params.id)}catch(e){return fail(res,400,String(e.message||e))}
  let conn;
  try{
   conn=await x.ctx.mysqlPool.getConnection();
   const [rows]=await conn.query('SELECT id,assigned_to,status,follow_up,account_notes_json,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1',[x.tenant,id]);
   if(!Array.isArray(rows)||rows.length!==1)return fail(res,404,'ACCOUNT_NOT_FOUND');
   const c=rows[0];
   if(req.user.role!=='owner'&&String(c.assigned_to||'')!==String(req.user.id||''))return fail(res,403,'ACCOUNT_NOT_ASSIGNED');
   let notes;
   try{notes=c.account_notes_json?JSON.parse(c.account_notes_json):[]}
   catch(_){return fail(res,503,'ACCOUNT_NOTES_UNREADABLE')}
   if(!Array.isArray(notes))return fail(res,503,'ACCOUNT_NOTES_UNREADABLE');
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,id,assignedTo:String(c.assigned_to||''),status:String(c.status||''),
    followUp:c.follow_up||null,
    notes:notes.filter(n=>n&&typeof n==='object').slice(0,25).map(n=>({
      id:String(n.id||''),authorName:String(n.authorName||'SBC team').slice(0,160),
      createdAt:String(n.createdAt||'').slice(0,45),note:String(n.note||'').slice(0,3000)
    }))});
  }catch(_){return fail(res,503,'ACCOUNT_HISTORY_UNAVAILABLE')}
  finally{try{conn?.release()}catch(_){}}
 });
 app.post('/api/v6606/crm/account-portfolios/:id/note',auth,async(req,res)=>{
  const x=context(req,res,true);if(x.denied)return;
  let id,note;
  try{
   id=safeId(req.params.id);
   if(typeof req.body?.note!=='string')throw Error('ACCOUNT_NOTE_REQUIRED');
   note=req.body.note.trim();
   if(note.length<12||note.length>3000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note))
    throw Error('ACCOUNT_NOTE_INVALID');
  }catch(e){return fail(res,400,String(e.message||e))}
  try{
   const result=await withTx(x.ctx,async conn=>{
    const [records]=await conn.query('SELECT id,assigned_to,status,follow_up,account_notes_json,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[x.tenant,id]);
    if(!Array.isArray(records)||records.length!==1)return {status:404,code:'ACCOUNT_NOT_FOUND'};
    const assigned=String(records[0].assigned_to||'');
    if(req.user.role!=='owner'&&assigned!==String(req.user.id||''))return {status:403,code:'ACCOUNT_NOT_ASSIGNED'};
    let previous;
    try{previous=records[0].account_notes_json?JSON.parse(records[0].account_notes_json):[]}
    catch(_){throw Error('ACCOUNT_NOTES_UNREADABLE')}
    if(!Array.isArray(previous)||previous.some(x=>!x||typeof x!=='object'))throw Error('ACCOUNT_NOTES_UNREADABLE');
    const createdAt=new Date().toISOString();
    const record={
      id:'anote_'+randomUUID().replace(/-/g,''),customerId:id,
      authorId:String(req.user.id||''),authorName:String(req.user.name||req.user.username||'SBC Account Manager').slice(0,160),
      note,createdAt
    };
    const notes=[record,...previous].slice(0,100),at=stamp();
    const [saved]=await conn.query('UPDATE sbc_customers SET account_notes_json=?,updated_at=? WHERE tenant_id=? AND id=? AND assigned_to=?',[JSON.stringify(notes),at,x.tenant,id,assigned]);
    if(saved?.affectedRows!==1)throw Error('ACCOUNT_NOTE_NOT_PERSISTED');
    const ev=eventData(id,'account_note','Account manager recorded an account interaction',
      {noteId:record.id,actorId:record.authorId,assignedTo:assigned,createdAt},x.tenant);
    await conn.query(ev.sql,ev.params);
    return {status:200,record,notes};
   });
   if(result.status!==200)return fail(res,result.status,result.code);
   const c=(x.ctx.db?.customers||[]).find(c=>String(c.id)===id&&Number(c.tenantId??c.tenant_id)===x.tenant);
   if(c)c.accountNotes=result.notes;
   return res.json({ok:true,durable:true,id,note:result.record,contactSent:false});
  }catch(_){return fail(res,503,'ACCOUNT_NOTE_SAVE_FAILED')}
 });
 // V7 one-step account outcome: owner or *currently assigned* Account Manager.
 // This records a manually reported interaction. It does not dial, text, email,
 // create a quote, change social permissions, or automatically contact customers.
 app.post('/api/v6606/crm/account-portfolios/:id/interaction',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const x=context(req,res,true);if(x.denied)return;
  if(!['owner','account_manager'].includes(req.user.role)||req.user.active===false)
   return fail(res,403,'ACCOUNT_MANAGER_ROLE_REQUIRED');
  let id,requestId,outcome,note,dueDate=null,fingerprint;
  try{
   id=safeId(req.params.id);
   requestId=String(req.body?.requestId||'');
   if(!/^sbc-action-[a-f0-9]{32}$/.test(requestId))throw Error('ACCOUNT_INTERACTION_REQUEST_INVALID');
   outcome=String(req.body?.outcome||'');
   if(!['CONNECTED','NO_ANSWER','FOLLOW_UP_REQUESTED','BAD_NUMBER','DO_NOT_CONTACT'].includes(outcome))
    throw Error('ACCOUNT_OUTCOME_INVALID');
   if(typeof req.body?.note!=='string')throw Error('ACCOUNT_INTERACTION_NOTE_REQUIRED');
   note=req.body.note.trim();
   if(note.length<12||note.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note))
    throw Error('ACCOUNT_INTERACTION_NOTE_INVALID');
   if(req.body?.dueDate!==undefined&&req.body?.dueDate!==null&&req.body?.dueDate!==''){
    if(!['CONNECTED','FOLLOW_UP_REQUESTED'].includes(outcome))throw Error('ACCOUNT_OUTCOME_DATE_FORBIDDEN');
    dueDate=validateDueDate(req.body.dueDate);
   }
   if(outcome==='FOLLOW_UP_REQUESTED'&&!dueDate)throw Error('ACCOUNT_FOLLOW_UP_DATE_REQUIRED');
   fingerprint=createHash('sha256').update(JSON.stringify([outcome,note,dueDate])).digest('hex');
  }catch(error){return fail(res,400,String(error.message||error))}
  try{
   const result=await withTx(x.ctx,async conn=>{
    const [records]=await conn.query(
     'SELECT id,assigned_to,status,follow_up,account_notes_json,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',
     [x.tenant,id]);
    if(!Array.isArray(records)||records.length!==1)return {status:404,code:'ACCOUNT_NOT_FOUND'};
    const c=records[0],assigned=String(c.assigned_to||''),actor=String(req.user.id||'');
    if(req.user.role!=='owner'){
     const worker=(x.ctx.db?.users||[]).find(u=>String(u.id)===actor&&
      Number(u.tenantId??u.tenant_id)===x.tenant&&u.role==='account_manager'&&u.active!==false);
     if(!worker||assigned!==actor)return {status:403,code:'ACCOUNT_NOT_ASSIGNED'};
    }
    let previous;
    try{previous=c.account_notes_json?JSON.parse(c.account_notes_json):[]}
    catch{return {status:503,code:'ACCOUNT_NOTES_UNREADABLE'}}
    if(!Array.isArray(previous)||previous.some(n=>!n||typeof n!=='object'))
     return {status:503,code:'ACCOUNT_NOTES_UNREADABLE'};
    const prior=previous.find(n=>n.requestId===requestId);
    if(prior){
     if(prior.fingerprint!==fingerprint)return {status:409,code:'ACCOUNT_INTERACTION_IDEMPOTENCY_CONFLICT'};
     return {status:200,readOnly:true,duplicate:true,outcome:prior.outcome,accountStatus:String(c.status||''),
      followUp:c.follow_up||null,researchRequired:prior.outcome==='BAD_NUMBER'};
    }
    const cached=(x.ctx.db?.customers||[]).find(z=>String(z.id)===id&&
     Number(z.tenantId??z.tenant_id)===x.tenant);
    if(STATUS_BLOCKED.has(String(c.status||'').trim().toLowerCase())||
     cached?.doNotContact===true||cached?.doNotCall===true||cached?.salesSuppressed===true)
     return {status:409,code:'ACCOUNT_CONTACT_SUPPRESSED'};
    const nextStatus=outcome==='DO_NOT_CONTACT'?'Do Not Call':
     outcome==='BAD_NUMBER'?'Bad Number':String(c.status||'');
    const nextDue=['DO_NOT_CONTACT','BAD_NUMBER'].includes(outcome)?null:(dueDate||c.follow_up||null);
    const now=new Date(),createdAt=now.toISOString();
    const retryNotBefore=outcome==='BAD_NUMBER'?new Date(now.getTime()+15*86400000).toISOString().slice(0,10):null;
    const record={id:'anote_'+randomUUID().replace(/-/g,''),customerId:id,
     requestId,fingerprint,outcome,createdAt,authorId:actor,
     authorName:String(req.user.name||req.user.username||'SBC Account Manager').slice(0,160),
     note,followUp:dueDate,retryNotBefore,source:'MANUAL_MANAGER_REPORTED'};
    const notes=[record,...previous].slice(0,100),at=stamp();
    const [saved]=await conn.query(
     'UPDATE sbc_customers SET account_notes_json=?,status=?,follow_up=?,updated_at=? WHERE tenant_id=? AND id=? AND assigned_to=?',
     [JSON.stringify(notes),nextStatus,nextDue,at,x.tenant,id,assigned]);
    if(saved?.affectedRows!==1)throw Error('ACCOUNT_INTERACTION_NOT_PERSISTED');
    const activity=eventData(id,'account_manual_interaction','Account Manager manually recorded interaction outcome',
     {requestId,recordId:record.id,outcome,followUp:dueDate,assignedTo:assigned,
      actorId:actor,createdAt,retryNotBefore,manualEntry:true,contactSent:false,phoneCallPlaced:false},
     x.tenant);
    await conn.query(activity.sql,activity.params);
    return {status:200,duplicate:false,record,notes,outcome,accountStatus:nextStatus,
     followUp:nextDue,researchRequired:outcome==='BAD_NUMBER',retryNotBefore};
   });
   if(result.status!==200)return fail(res,result.status,result.code);
   if(!result.duplicate){
    const cached=(x.ctx.db?.customers||[]).find(c=>String(c.id)===id&&
     Number(c.tenantId??c.tenant_id)===x.tenant);
    if(cached){
     cached.status=result.accountStatus;cached.followUp=result.followUp;cached.followUpAt=result.followUp;
     cached.accountNotes=result.notes;
     if(result.outcome==='DO_NOT_CONTACT')cached.doNotContact=true;
     if(result.outcome==='BAD_NUMBER')cached.salesSuppressed=true;
    }
   }
   return res.json({ok:true,durable:true,duplicate:result.duplicate,id,
    outcome:result.outcome,status:result.accountStatus,followUp:result.followUp,
    researchRequired:result.researchRequired,retryNotBefore:result.retryNotBefore||null,
    contactSent:false,phoneCallPlaced:false,autoRetryScheduled:false});
  }catch{return fail(res,503,'ACCOUNT_INTERACTION_SAVE_FAILED')}
 });

}
module.exports=register;
