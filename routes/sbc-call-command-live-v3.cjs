'use strict';
// Authenticated SBC account workflow + signed Twilio callback, no schema changes.
// Calls are NEVER placed by this module; only a human click from Voice SDK
// may request a one-time permit. MySQL is authoritative for all permits.
const {randomUUID}=require('node:crypto');
const {requireTenantContext}=require('../enterprise/tenant-context.cjs');
const {positiveTenantId}=require('../enterprise/repositories/customer-repository.cjs');
const V3=require('../enterprise/sbc-call-command-live-v3.cjs');
// Load the Twilio provider only inside signed callbacks: offline CRM tests
// and read-only account routes must never depend on a telephony SDK install.
const getTwilio=()=>{try{return require('twilio')}catch{return null}};
const TYPE='sbc_call_command_v3';
const ROOT='/api/v6606/crm/account-portfolios';
const WEB='/api/v6606/crm/call-command';
const fail=(res,status,code)=>res.status(status).json({ok:false,code});
const stamp=()=>new Date().toISOString().slice(0,19).replace('T',' ');
function safeId(s){const x=String(s||'');if(!x||x.length>80||!/^[A-Za-z0-9_.:-]+$/.test(x))throw Error('INVALID_ACCOUNT_ID');return x;}
function getTenant(req){
 const t=positiveTenantId(requireTenantContext().tenantId);
 for(const x of [req.tenantId,req.user?.tenantId]){
  if(x!==undefined&&x!==null&&positiveTenantId(x)!==t)throw Error('TENANT_MISMATCH');
 }return t;
}
function cachedAccount(ctx,row){
 return (ctx.db?.customers||[]).find(c=>String(c.id)===String(row.id)&&
  Number(c.tenantId??c.tenant_id)===Number(row.tenant_id));
}
async function transaction(pool,fn){
 const conn=await pool.getConnection();let active=false;
 try{await conn.beginTransaction();active=true;const out=await fn(conn);await conn.commit();active=false;return out}
 catch(e){if(active)try{await conn.rollback()}catch{}throw e}
 finally{try{conn.release()}catch{}}
}
const sqlAccount='SELECT id,phone,status,assigned_to,account_notes_json,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1';
async function account(conn,tenant,id,lock=false){
 const [r]=await conn.query(sqlAccount+(lock?' FOR UPDATE':''),[tenant,id]);
 return Array.isArray(r)?r[0]:null;
}
function userAllowed(ctx,req,row,tenant){
 return V3.validateActor(req.user,row,tenant,ctx.db?.users||[]);
}
function currentEvidence(ctx,row){
 const notes=V3.parseNotes(row);
 if(!notes)return {notes:null,cert:null};
 const cert=V3.authorizationRecord(notes,row);
 return {notes,cert};
}
function authorize(ctx,row,user,tenant,cfg){
 const cache=cachedAccount(ctx,row),ev=currentEvidence(ctx,row);
 const scoped=V3.evaluate({account:row,user,tenantId:tenant,cert:ev.cert,
  providerReady:cfg.configured,loggingReady:!ctx.recoveryRequired?.(),
  enabled:cfg.enabled,now:new Date(),suppressed:V3.isSuppressed(row,cache)});
 return {result:scoped,cert:ev.cert,notes:ev.notes};
}
function selectedContext(req,res,getContext,write=false){
 if(!req.user||!['owner','account_manager'].includes(req.user.role)||req.user.active===false){
  fail(res,403,'CALL_COMMAND_ROLE_REQUIRED');return null;
 }
 let tenant;try{tenant=getTenant(req)}catch{fail(res,403,'TENANT_CONTEXT_REQUIRED');return null}
 const ctx=getContext();
 if(!ctx.mysqlPool||typeof ctx.mysqlPool.getConnection!=='function'){
  fail(res,503,'CALL_COMMAND_MYSQL_REQUIRED');return null;
 }
 if(write&&(!ctx.recoveryRequired||ctx.recoveryRequired())){
  fail(res,423,'CALL_COMMAND_RECOVERY_LOCKED');return null;
 }
 return {ctx,tenant};
}
function configPublic(cfg){return {enabled:cfg.enabled,configured:cfg.configured,
  webhookUrl:cfg.origin?cfg.origin+WEB+'/twiml':'',ownerSetupRequired:!cfg.configured}};
function parseAttempt(row){
 try{const m=JSON.parse(row.meta_json);return m&&typeof m==='object'?m:null}catch{return null}
}
function validAttemptId(x){return /^ccv3_[a-f0-9]{32}$/.test(String(x||''));}
function signed(req,cfg){
 return V3.verifyTwilioForm(req,{authToken:cfg.authToken,
  origins:[cfg.origin],validateRequest:getTwilio()?.validateRequest});
}
function appendActivitySql(){return 'INSERT INTO sbc_activities (id,activity_type,message,meta_json,created_at,tenant_id) VALUES (?,?,?,?,?,?)'}
function register(app,{auth,getContext}){
 app.get(ROOT+'/:id/call-readiness',auth,async(req,res)=>{
  const x=selectedContext(req,res,getContext);if(!x)return;
  let conn;
  try{
   const id=safeId(req.params.id);conn=await x.ctx.mysqlPool.getConnection();
   const row=await account(conn,x.tenant,id);
   if(!row)return fail(res,404,'ACCOUNT_NOT_FOUND');
   if(!userAllowed(x.ctx,req,row,x.tenant))return fail(res,403,'ACCOUNT_NOT_ASSIGNED');
   const cfg=V3.settings(),a=authorize(x.ctx,row,req.user,x.tenant,cfg);
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,accountId:id,...a.result,authorizationExpiresAt:a.cert?.expiresAt||null,
    ...configPublic(cfg),liveCallAvailable:a.result.allowed});
  }catch{return fail(res,503,'CALL_READINESS_UNAVAILABLE')}
  finally{try{conn?.release()}catch{}}
 });
 // Only the owner can attest actual external DNC screening and legal basis.
 // This is an auditable human attestation, not an automatic DNC database lookup.
 app.post(ROOT+'/:id/call-authorization',auth,async(req,res)=>{
  const x=selectedContext(req,res,getContext,true);if(!x)return;
  if(req.user.role!=='owner')return fail(res,403,'OWNER_REQUIRED');
  const b=req.body||{},evidence=String(b.evidence||'').trim();
  const timezone=String(b.prospectTimeZone||'');
  let tzOk=false;try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format();tzOk=timezone.length<=65}catch{}
  if(b.phoneVerified!==true||b.dncChecked!==true||b.callingAuthorized!==true||
   b.consentOrLegalBasisVerified!==true||b.policyReviewed!==true||
   evidence.length<24||evidence.length>1200||!tzOk)
   return fail(res,400,'CALL_AUTHORIZATION_EVIDENCE_REQUIRED');
  try{
   const id=safeId(req.params.id);
   const cert=await transaction(x.ctx.mysqlPool,async conn=>{
    const row=await account(conn,x.tenant,id,true);
    if(!row)throw Error('ACCOUNT_NOT_FOUND');
    if(V3.isSuppressed(row,cachedAccount(x.ctx,row)))throw Error('CONTACT_SUPPRESSED');
    const phone=V3.phone(row.phone);
    if(!phone)throw Error('PHONE_INVALID');
    // Cross-account suppression must be checked against durable tenant CRM,
    // not just the current customer or an optionally hydrated memory cache.
    // Normalize common telephone punctuation inside MySQL for matching.
    const canonical='REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,\' \' ,\'\'),\'-\',\'\'),\'(\',\'\'),\')\',\'\'),\'+\',\'\'),\'.\',\'\')';
    const digits=phone.replace(/\\D/g,'');
    const candidates=[digits,digits.slice(-10)];
    const sql='SELECT id,phone,status,assigned_to,account_notes_json,tenant_id FROM sbc_customers '+
     'WHERE tenant_id=? AND id<>? AND '+canonical+' IN (?,?) LIMIT 501';
    const [matches]=await conn.query(sql,[x.tenant,id,...candidates]);
    if(!Array.isArray(matches)||matches.length>500)throw Error('DNC_PHONE_CHECK_INCOMPLETE');
    if(matches.some(other=>V3.phone(other.phone)===phone&&V3.isSuppressed(other,cachedAccount(x.ctx,other))))
      throw Error('DNC_PHONE_SUPPRESSED');
    const notes=V3.parseNotes(row);if(!notes)throw Error('ACCOUNT_NOTES_UNREADABLE');
    const now=new Date(),approvedAt=now.toISOString();
    const record={id:'cauth_'+randomUUID().replace(/-/g,''),kind:V3.authKind,
     phone,authorizedAt:approvedAt,expiresAt:new Date(now.getTime()+7*86400000).toISOString(),
     verifiedBy:String(req.user.id),phoneVerified:true,dncChecked:true,callingAuthorized:true,
     consentOrLegalBasisVerified:true,prospectTimeZone:timezone,
     evidence,policyReviewed:true};
    const updated=[record,...notes].slice(0,100);
    const [saved]=await conn.query('UPDATE sbc_customers SET account_notes_json=?,updated_at=? WHERE tenant_id=? AND id=?',
      [JSON.stringify(updated),stamp(),x.tenant,id]);
    if(saved?.affectedRows!==1)throw Error('CALL_AUTHORIZATION_NOT_DURABLE');
    await conn.query(appendActivitySql(),['act_'+randomUUID().replace(/-/g,''),'sbc_call_permission_review',
     'Owner documented an account calling authorization review',
     JSON.stringify({customerId:id,actorId:String(req.user.id),recordId:record.id,at:approvedAt}),
     stamp(),x.tenant]);
    return record;
   });
   return res.json({ok:true,durable:true,accountId:id,expiresAt:cert.expiresAt,phone:cert.phone,
    notice:'Owner-attested evidence recorded; legal/DNC screening must remain current.'});
  }catch(e){const code=String(e.message||'CALL_AUTHORIZATION_SAVE_FAILED');
   return fail(res,['CONTACT_SUPPRESSED','DNC_PHONE_SUPPRESSED'].includes(code)?409:503,code)}
 });
 app.post(ROOT+'/:id/call-revoke',auth,async(req,res)=>{
  const x=selectedContext(req,res,getContext,true);if(!x)return;
  if(req.user.role!=='owner')return fail(res,403,'OWNER_REQUIRED');
  try{
   const id=safeId(req.params.id);
   await transaction(x.ctx.mysqlPool,async conn=>{
    const row=await account(conn,x.tenant,id,true);if(!row)throw Error('ACCOUNT_NOT_FOUND');
    const notes=V3.parseNotes(row);if(!notes)throw Error('ACCOUNT_NOTES_UNREADABLE');
    const now=new Date().toISOString(),record={id:'crevoke_'+randomUUID().replace(/-/g,''),
     kind:V3.revokedKind,authorizedAt:now,verifiedBy:String(req.user.id)};
    const [saved]=await conn.query('UPDATE sbc_customers SET account_notes_json=?,updated_at=? WHERE tenant_id=? AND id=?',
      [JSON.stringify([record,...notes].slice(0,100)),stamp(),x.tenant,id]);
    if(saved?.affectedRows!==1)throw Error('REVOCATION_NOT_DURABLE');
    await conn.query(appendActivitySql(),['act_'+randomUUID().replace(/-/g,''),'sbc_call_permission_revoked',
     'Owner revoked account calling authorization',
     JSON.stringify({customerId:id,actorId:String(req.user.id),at:now}),stamp(),x.tenant]);
   });
   return res.json({ok:true,durable:true,revoked:true});
  }catch{return fail(res,503,'CALL_REVOCATION_FAILED')}
 });
 app.post(ROOT+'/:id/call-start',auth,async(req,res)=>{
  const x=selectedContext(req,res,getContext,true);if(!x)return;
  const requestId=String(req.body?.requestId||'');
  if(!/^[a-f0-9]{32}$/.test(requestId))return fail(res,400,'REQUEST_ID_REQUIRED');
  const cfg=V3.settings();
  if(!cfg.enabled||!cfg.configured)return fail(res,423,'CALL_COMMAND_NOT_CONFIGURED');
  try{
   const id=safeId(req.params.id),identity=V3.identityFor(x.tenant,req.user.id);
   const result=await transaction(x.ctx.mysqlPool,async conn=>{
    const row=await account(conn,x.tenant,id,true);
    if(!row)throw Error('ACCOUNT_NOT_FOUND');
    if(!userAllowed(x.ctx,req,row,x.tenant))throw Error('ACCOUNT_NOT_ASSIGNED');
    const evaluation=authorize(x.ctx,row,req.user,x.tenant,cfg);
    if(!evaluation.result.allowed)throw Error('CALL_PREFLIGHT_DENIED');
    // Check all recently prepared sessions for this actor/tenant. One live
    // preparation per worker, never two overlapping calls.
    const [recent]=await conn.query("SELECT id,meta_json FROM sbc_activities WHERE tenant_id=? AND activity_type=? AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE) ORDER BY created_at DESC LIMIT 250",
      [x.tenant,TYPE]);
    const now=Date.now();
    for(const item of recent||[]){
     const m=parseAttempt(item);if(!m||m.actorId!==String(req.user.id))continue;
     if(m.requestId===requestId&&m.customerId===id&&m.status==='PREPARED'&&
      Date.parse(m.expiresAt)>now)return {attemptId:item.id,identity,duplicate:true};
     // A started call remains active until a signed provider completion.
     // The short PREPARED token TTL must never unlock a DIALING session.
     if(m.status==='DIALING'||(m.status==='PREPARED'&&
      Date.parse(m.expiresAt)>now))throw Error('ANOTHER_CALL_SESSION_ACTIVE');
    }
    const attemptId='ccv3_'+randomUUID().replace(/-/g,'');
    const createdAt=new Date().toISOString();
    const meta={customerId:id,tenantId:x.tenant,actorId:String(req.user.id),identity,
     requestId,phone:V3.phone(row.phone),authorizationId:evaluation.cert.id,
     createdAt,expiresAt:new Date(Date.now()+120000).toISOString(),status:'PREPARED'};
    await conn.query(appendActivitySql(),[attemptId,TYPE,'SBC Call Command manual outbound attempt',
     JSON.stringify(meta),stamp(),x.tenant]);
    return {attemptId,identity,duplicate:false};
   });
   // Token returned only AFTER the one-use server record committed.
   const token=V3.voiceToken(cfg,result.identity);
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,durable:true,attemptId:result.attemptId,token,expiresIn:300,
    duplicate:result.duplicate,manualOnly:true});
  }catch(e){const code=String(e.message||'CALL_PREPARE_FAILED');
   return fail(res,code==='CALL_PREFLIGHT_DENIED'?403:code==='ANOTHER_CALL_SESSION_ACTIVE'?409:503,code)}
 });
 // Twilio signs every callback. This is the ONLY place that may return Dial.
 app.post(WEB+'/twiml',async(req,res)=>{
  const cfg=V3.settings();
  if(!cfg.enabled||!cfg.configured||!signed(req,cfg))return fail(res,403,'VOICE_WEBHOOK_NOT_AUTHORIZED');
  const attemptId=String(req.body?.AttemptId||''),from=String(req.body?.From||'');
  if(!validAttemptId(attemptId)||!/^client:sbc-cc-/.test(from)||
   String(req.body?.AccountSid||'')!==cfg.accountSid)return fail(res,403,'VOICE_ATTEMPT_INVALID');
  const ctx=getContext();
  if(!ctx.mysqlPool||!ctx.recoveryRequired||ctx.recoveryRequired())return fail(res,503,'VOICE_WRITER_LOCKED');
  try{
   const result=await transaction(ctx.mysqlPool,async conn=>{
    const [attempts]=await conn.query('SELECT id,meta_json,tenant_id FROM sbc_activities WHERE id=? AND activity_type=? LIMIT 1 FOR UPDATE',[attemptId,TYPE]);
    if(!Array.isArray(attempts)||attempts.length!==1)throw Error('UNKNOWN_CALL_ATTEMPT');
    const meta=parseAttempt(attempts[0]);
    if(!meta||meta.status!=='PREPARED'||Date.parse(meta.expiresAt)<=Date.now()||
     from!=='client:'+meta.identity||Number(meta.tenantId)!==Number(attempts[0].tenant_id))
     throw Error('CALL_ATTEMPT_EXPIRED_OR_USED');
    const row=await account(conn,meta.tenantId,meta.customerId,true);
    const user=(ctx.db?.users||[]).find(u=>String(u.id)===meta.actorId&&
      Number(u.tenantId??u.tenant_id)===Number(meta.tenantId));
    if(!row||!user||!V3.validateActor(user,row,meta.tenantId,ctx.db?.users||[]))
     throw Error('ACCOUNT_ROLE_CHANGED');
    const evaluation=authorize(ctx,row,user,meta.tenantId,cfg);
    if(!evaluation.result.allowed||V3.phone(row.phone)!==meta.phone||
     evaluation.cert?.id!==meta.authorizationId)throw Error('CALL_PERMISSION_CHANGED');
    const parentSid=String(req.body?.CallSid||'');
    if(!/^CA[a-f0-9]{32}$/i.test(parentSid))throw Error('PROVIDER_CALL_ID_MISSING');
    meta.status='DIALING';meta.parentCallSid=parentSid;meta.startedAt=new Date().toISOString();
    const [changed]=await conn.query('UPDATE sbc_activities SET meta_json=? WHERE tenant_id=? AND id=?',
      [JSON.stringify(meta),meta.tenantId,attemptId]);
    if(changed?.affectedRows!==1)throw Error('ATTEMPT_NOT_DURABLE');
    return {phone:meta.phone};
   });
   const statusUrl=cfg.origin+WEB+'/status?attempt='+encodeURIComponent(attemptId);
   return res.status(200).type('text/xml').send(V3.dialXml({phone:result.phone,from:cfg.callerId,statusUrl}));
  }catch{return res.status(403).type('text/xml').send('<Response><Reject/></Response>')}
 });
 // Signed provider events make account history authoritative even if browser exits.
 app.post(WEB+'/status',async(req,res)=>{
  const cfg=V3.settings();
  // Emergency stop disables new calls, not signed status callbacks from calls
  // already in progress; otherwise active sessions can remain locked forever.
  if(!cfg.configured||!signed(req,cfg))return fail(res,403,'VOICE_STATUS_NOT_AUTHORIZED');
  const attemptId=String(req.query?.attempt||''),providerStatus=String(req.body?.CallStatus||'').toLowerCase();
  const callSid=String(req.body?.CallSid||'');
  if(!validAttemptId(attemptId)||!['initiated','ringing','in-progress','completed','busy','failed','no-answer','canceled'].includes(providerStatus)||
    !/^CA[a-f0-9]{32}$/i.test(callSid)||String(req.body?.AccountSid||'')!==cfg.accountSid)
   return fail(res,400,'VOICE_STATUS_INVALID');
  const ctx=getContext();
  if(!ctx.mysqlPool||!ctx.recoveryRequired||ctx.recoveryRequired())return fail(res,503,'VOICE_WRITER_LOCKED');
  try{
   await transaction(ctx.mysqlPool,async conn=>{
    const [r]=await conn.query('SELECT id,meta_json,tenant_id FROM sbc_activities WHERE id=? AND activity_type=? LIMIT 1 FOR UPDATE',[attemptId,TYPE]);
    if(!Array.isArray(r)||r.length!==1)throw Error('ATTEMPT_NOT_FOUND');
    const meta=parseAttempt(r[0]);
    if(!meta||!['DIALING','COMPLETED'].includes(meta.status))throw Error('ATTEMPT_NOT_ACTIVE');
    if(meta.childCallSid&&meta.childCallSid!==callSid)throw Error('CALL_ID_MISMATCH');
    if(meta.status==='COMPLETED')return;
    meta.childCallSid=callSid;meta.providerStatus=providerStatus;
    meta.lastProviderEventAt=new Date().toISOString();
    if(['completed','busy','failed','no-answer','canceled'].includes(providerStatus)){
     meta.status='COMPLETED';meta.endedAt=meta.lastProviderEventAt;
    }
    const [updated]=await conn.query('UPDATE sbc_activities SET meta_json=? WHERE tenant_id=? AND id=?',
      [JSON.stringify(meta),meta.tenantId,attemptId]);
    if(updated?.affectedRows!==1)throw Error('CALL_STATUS_NOT_DURABLE');
   });
   return res.status(200).send('OK');
  }catch{return fail(res,503,'VOICE_STATUS_SAVE_UNCONFIRMED')}
 });
 app.get(ROOT+'/:id/call-history',auth,async(req,res)=>{
  const x=selectedContext(req,res,getContext);if(!x)return;let conn;
  try{
   const id=safeId(req.params.id);
   conn=await x.ctx.mysqlPool.getConnection();
   const row=await account(conn,x.tenant,id);
   if(!row)return fail(res,404,'ACCOUNT_NOT_FOUND');
   if(!userAllowed(x.ctx,req,row,x.tenant))return fail(res,403,'ACCOUNT_NOT_ASSIGNED');
   const [events]=await conn.query('SELECT id,meta_json,tenant_id FROM sbc_activities WHERE tenant_id=? AND activity_type=? ORDER BY created_at DESC LIMIT 500',
      [x.tenant,TYPE]);
   const history=(events||[]).map(e=>({id:e.id,...parseAttempt(e)}))
    .filter(m=>m.customerId===id&&Number(m.tenantId)===Number(x.tenant))
    .slice(0,25).map(m=>({attemptId:m.id,status:m.status,providerStatus:m.providerStatus||'',
     parentCallSid:m.parentCallSid||'',callSid:m.childCallSid||'',
     startedAt:m.startedAt||m.createdAt,endedAt:m.endedAt||'',
     actorId:m.actorId}));
   res.setHeader('Cache-Control','no-store');
   return res.json({ok:true,accountId:id,history,source:'SIGNED_TWILIO_AND_MYSQL'});
  }catch{return fail(res,503,'CALL_HISTORY_UNAVAILABLE')}
  finally{try{conn?.release()}catch{}}
 });
}
module.exports={register};
