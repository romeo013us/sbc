'use strict';
/* SBC Sales P0/P1 — permissioned booking, read-only revenue queue, safe reminder previews.
 * No outbound calls, emails, texts, paid actions or public reschedule tokens are sent here.
 * The appointment booking authority is the existing CRM + serialized MySQL saveData().
 */
const {createHash}=require('node:crypto');
const {undo}=require('./sbc-owned-state-rollback.cjs');
const snapshot=v=>JSON.parse(JSON.stringify(v||[]));
const VALID_ROLES=new Set(['owner','account_manager']);
const DO_NOT_CONTACT=/^(?:dnc|do not call|do not contact|not interested|opt.?out|unsubscribe|lost|bad number|wrong number)$/i;
const ZOOM_TITLE='10-minute SBC website preview';
function tenantId(r){const n=Number(r?.tenantId??r?.tenant_id);return Number.isSafeInteger(n)&&n>0?n:0;}
function permittedRole(actor,tid){return Boolean(actor&&VALID_ROLES.has(String(actor.role))&&actor.active!==false&&tenantId(actor)===tenantId({tenantId:tid}));}
function sameTenant(row,tid){return tenantId(row)===tenantId({tenantId:tid});}
function accessible(customer,actor,tid){return permittedRole(actor,tid)&&sameTenant(customer,tid)&&(actor.role==='owner'||String(customer.assignedTo||customer.assigned_to||'')===String(actor.id));}
function suppressed(customer){return customer?.doNotContact===true||customer?.doNotCall===true||customer?.salesSuppressed===true||customer?.isSuppressed===true||DO_NOT_CONTACT.test(String(customer?.status||'').trim());}
function isoDate(value){const n=Date.parse(value);return Number.isFinite(n)?n:NaN;}
function dateAt(value){const n=isoDate(value);return Number.isFinite(n)?new Date(n).toISOString():'';}
function etDay(value){const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'';}
function validateBooking(fields,{isNew=true,at=Date.now()}={}){
 const allowed=['customerId','title','startAt','endAt','location','notes','status'];
 for(const key of Object.keys(fields||{}))if(!allowed.includes(key))throw Error('APPOINTMENT_UNEXPECTED_FIELD');
 const customerId=String(fields?.customerId||'').trim(),title=String(fields?.title||'').trim();
 const start=isoDate(fields?.startAt),end=isoDate(fields?.endAt);
 if(!customerId||customerId.length>120)throw Error('CUSTOMER_REQUIRED');
 if(!title||title.length>160)throw Error('INVALID_APPOINTMENT_TITLE');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>24*3600000)throw Error('INVALID_APPOINTMENT_TIME');
 if(isNew&&start<at-60000)throw Error('APPOINTMENT_MUST_BE_FUTURE');
 const status=isNew?'Scheduled':String(fields?.status||'');
 if(!['Scheduled','Completed','Cancelled'].includes(status)||isNew&&fields?.status&&fields.status!=='Scheduled')throw Error('INVALID_APPOINTMENT_STATUS');
 return {customerId,title,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),
  location:String(fields?.location||'').trim().slice(0,255),notes:String(fields?.notes||'').trim().slice(0,3000),status};
}
function sameAssigneeConflict(records,newAppt,customer,actor,tid,excludeId=''){
 const assigned=String(customer.assignedTo||customer.assigned_to||actor.id);
 const start=isoDate(newAppt.startAt),end=isoDate(newAppt.endAt);
 return (records||[]).some(a=>sameTenant(a,tid)&&String(a.id)!==String(excludeId)&&a.status==='Scheduled'&&
  String(a.assignedTo||a.createdBy||'')===assigned&&
  Number.isFinite(isoDate(a.startAt))&&Number.isFinite(isoDate(a.endAt))&&
  start<isoDate(a.endAt)&&end>isoDate(a.startAt));
}
function authorizedCustomers({customers=[],actor,tenantId:tid}){
 if(!permittedRole(actor,tid))throw Error('NOT_AUTHORIZED');
 return (customers||[]).filter(x=>accessible(x,actor,tid));
}
function latestMeeting(appointments,customer,tid){
 return (appointments||[]).filter(a=>sameTenant(a,tid)&&String(a.customerId)===String(customer.id)&&a.status==='Scheduled'&&Number.isFinite(isoDate(a.startAt)))
  .sort((a,b)=>isoDate(a.startAt)-isoDate(b.startAt));
}
function followUpDue(c,callLogs,nowDate){
 const relevant=(callLogs||[]).filter(x=>String(x.customerId)===String(c.id)&&sameTenant(x,c.tenantId)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 const latest=relevant[0]||{};
 const candidates=[latest.followUpAt,latest.callbackAt,c.followUpAt,c.followUp,c.nextFollowUp];
 const dates=candidates.map(x=>String(x||'').trim()).filter(Boolean);
 if(!dates.length)return '';
 const best=dates[0];
 const due=/^\d{4}-\d{2}-\d{2}$/.test(best)?best:dateAt(best);
 if(!due)return '';
 const d=due.length===10?due:etDay(due);
 return d&&d<=etDay(nowDate)?due:'';
}
function projectActions({customers=[],appointments=[],callLogs=[],actor,tenantId:tid,now=new Date().toISOString(),limit=80}={}){
 const n=isoDate(now);if(!Number.isFinite(n))throw Error('INVALID_NOW');
 const permitted=authorizedCustomers({customers,actor,tenantId:tid});const rows=[];
 for(const c of permitted){
  if(suppressed(c)||c.isTestRecord===true||['deleted','duplicate','archived'].includes(String(c.status||'').toLowerCase()))continue;
  const last=(callLogs||[]).filter(log=>sameTenant(log,tid)&&String(log.customerId)===String(c.id))
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
  if(DO_NOT_CONTACT.test(String(last?.outcome||last?.kind||'').trim()))continue;
  const meetings=latestMeeting(appointments,c,tid),past=meetings.find(a=>isoDate(a.endAt||a.startAt)<n-60*60*1000),future=meetings.find(a=>isoDate(a.startAt)>=n);
  const base={customerId:String(c.id),businessName:String(c.businessName||c.contactName||'Business').slice(0,140),assignedTo:String(c.assignedTo||''),outboundTriggered:false};
  if(past){rows.push({...base,type:'MEETING_REVIEW',priority:0,dueAt:past.startAt,appointmentId:String(past.id),title:'Review past meeting',nextAction:'Verify attendance and outcome. Do not assume a no-show; reschedule only if the customer requests it.'});continue;}
  const due=followUpDue(c,callLogs,n);
  if(due){rows.push({...base,type:'DUE_CALLBACK',priority:1,dueAt:due,appointmentId:'',title:'Due callback',nextAction:'Review prior notes, permissions and suppression before a manual follow-up.'});continue;}
  if(future&&isoDate(future.startAt)<=n+48*3600000){rows.push({...base,type:'MEETING_PREP',priority:2,dueAt:future.startAt,appointmentId:String(future.id),title:'Prepare upcoming 10-minute Zoom',nextAction:'Prepare the approved private website concept and confirm the real meeting link.'});continue;}
  // Verified research gaps are outreach opportunities, NOT evidence of purchase intent.
  const research=c.leadIntelligence?.researchBrief||{};
  const verified=['Sales Ready','Verified'].includes(String(c.verificationStatus||''))&&c.researchRejected!==true;
  const websiteGap=research.websitePresence==='not_found';
  const googlePresence=research.googleBusinessPresence==='found';
  if(verified&&websiteGap&&googlePresence){rows.push({...base,type:'RESEARCHED_LEAD',priority:3,dueAt:'',appointmentId:'',title:'Research-backed website opportunity',nextAction:'Review evidence and calling permissions; make a manual discovery call. Buying intent is not confirmed.'});}
 }
 rows.sort((a,b)=>a.priority-b.priority||String(a.dueAt||'').localeCompare(String(b.dueAt||''))||a.businessName.localeCompare(b.businessName));
 const capped=Math.max(1,Math.min(200,Number(limit)||80));
 return {ok:true,generatedAt:new Date(n).toISOString(),total:rows.length,rows:rows.slice(0,capped),
  counts:{meetingReviews:rows.filter(x=>x.type==='MEETING_REVIEW').length,dueCallbacks:rows.filter(x=>x.type==='DUE_CALLBACK').length,meetingPrep:rows.filter(x=>x.type==='MEETING_PREP').length,newResearchLeads:rows.filter(x=>x.type==='RESEARCHED_LEAD').length},
  safety:{automaticOutreach:false,paidTransactions:false,notes:'Read-only suggested actions. Check real contact restrictions before any outreach.'}};
}
function safeMeetingLink(raw){try{const url=new URL(String(raw||'').trim());if(url.protocol!=='https:')return '';const h=url.hostname.toLowerCase();if(['zoom.us','us02web.zoom.us','us04web.zoom.us','meet.google.com','teams.microsoft.com'].includes(h)||h.endsWith('.zoom.us'))return url.href.slice(0,255)}catch{}return ''}
function reminderCandidates({customers=[],appointments=[],actor,tenantId:tid,now=new Date().toISOString()}={}){
 const at=isoDate(now);if(!Number.isFinite(at))throw Error('INVALID_NOW');
 const permitted=authorizedCustomers({customers,actor,tenantId:tid});const byId=new Map(permitted.map(c=>[String(c.id),c]));const rows=[];
 for(const a of appointments){if(!sameTenant(a,tid)||a.status!=='Scheduled')continue;
  const c=byId.get(String(a.customerId));if(!c||suppressed(c))continue;
  const start=isoDate(a.startAt);if(!Number.isFinite(start)||start<at)continue;
  const link=safeMeetingLink(a.meetingUrl||a.location);if(!link)continue;
  for(const hours of [24,1]){
   const target=start-hours*3600000;if(Math.abs(at-target)>15*60000)continue;
   for(const channel of ['email','sms']){
    const consent=c.appointmentReminderConsent?.[channel];
    if(consent?.verified!==true||!consent.source||!Number.isFinite(isoDate(consent.timestamp)))continue;
    const targetValue=channel==='email'?String(c.email||'').trim():String(c.phone||'').trim();
    if(channel==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(targetValue))continue;
    if(channel==='sms'&&!/^\+1[0-9]{10}$/.test(targetValue))continue;
    const key=createHash('sha256').update(`${tid}|${a.id}|${a.startAt}|${channel}|${hours}`).digest('hex');
    rows.push({appointmentId:String(a.id),customerId:String(c.id),channel,kind:`${hours}h`,status:'DRAFT_ONLY',sendEnabled:false,idempotencyKey:key,scheduledFor:new Date(target).toISOString(),hasConfirmedMeetingLink:true,requiresConsent:true});
   }
  }
 }
 return {ok:true,sendEnabled:false,mode:'PREVIEW_ONLY',rows,reason:'Provider dispatch and consent audit must be verified before enabling customer messages.'};
}
function register(app,{auth,requireTenant,db,save,writerReady=()=>false,id,now=()=>new Date().toISOString(),addActivity=()=>{},serialize:sharedSerialize}={}){
 let tail=Promise.resolve();
 const serialize=sharedSerialize||(fn=>{const work=tail.then(fn);tail=work.catch(()=>{});return work});
 const scope=(req,res)=>{
  let tid=0;try{tid=tenantId({tenantId:requireTenant(req)})}catch{}
  if(!tid||!permittedRole(req.user,tid)){res.status(403).json({ok:false,code:'NOT_AUTHORIZED'});return 0}
  return tid;
 };
 const getCustomer=(cid,actor,tid)=>(db.customers||[]).find(c=>String(c.id)===String(cid)&&accessible(c,actor,tid));
 const getAppointment=(aid,actor,tid)=>{const a=(db.appointments||[]).find(x=>String(x.id)===String(aid)&&sameTenant(x,tid));const c=a&&getCustomer(a.customerId,actor,tid);return c?{a,c}:null};
 const unavailable=(res)=>res.status(423).json({ok:false,code:'WRITER_UNAVAILABLE'});
 const respondError=(res,e)=>{const code=String(e?.message||e);return res.status(/UNEXPECTED_FIELD|INVALID_|CUSTOMER_REQUIRED|APPOINTMENT_MUST/.test(code)?400:503).json({ok:false,code})};
 app.get('/api/sbc/sales/actions/today',auth,(req,res)=>{const tid=scope(req,res);if(!tid)return;res.set('Cache-Control','private, no-store');try{res.json(projectActions({customers:db.customers||[],appointments:db.appointments||[],callLogs:db.callLogs||[],actor:req.user,tenantId:tid,now:now(),limit:req.query.limit||80}))}catch(e){respondError(res,e)}});
 app.get('/api/sbc/sales/reminders/preview',auth,(req,res)=>{const tid=scope(req,res);if(!tid)return;res.set('Cache-Control','private, no-store');try{res.json(reminderCandidates({customers:db.customers||[],appointments:db.appointments||[],actor:req.user,tenantId:tid,now:now()}))}catch(e){respondError(res,e)}});
 app.get('/api/appointments',auth,(req,res)=>{const tid=scope(req,res);if(!tid)return;const cid=String(req.query.customerId||'');const c=getCustomer(cid,req.user,tid);if(!c)return res.status(404).json({ok:false,code:'ACCOUNT_NOT_FOUND'});res.set('Cache-Control','private, no-store');return res.json({ok:true,appointments:(db.appointments||[]).filter(a=>sameTenant(a,tid)&&String(a.customerId)===cid).sort((a,b)=>String(a.startAt).localeCompare(String(b.startAt))).map(a=>({...a}))})});
 app.post('/api/appointments',auth,async(req,res)=>serialize(async()=>{
  const tid=scope(req,res);if(!tid)return;if(!writerReady())return unavailable(res);
  let b;try{b=validateBooking(req.body,{isNew:true,at:isoDate(now())})}catch(e){return respondError(res,e)}
  const c=getCustomer(b.customerId,req.user,tid);if(!c)return res.status(404).json({ok:false,code:'ACCOUNT_NOT_FOUND'});if(suppressed(c))return res.status(403).json({ok:false,code:'CONTACT_SUPPRESSED'});
  // Idempotent double-click: same account + slot + actor has one appointment.
  const existing=(db.appointments||[]).find(a=>sameTenant(a,tid)&&String(a.customerId)===b.customerId&&String(a.startAt)===b.startAt&&a.status==='Scheduled'&&a.title===b.title);
  if(existing)return res.status(200).json({ok:true,existing:true,durable:true,appointment:existing});
  if(sameAssigneeConflict(db.appointments,b,c,req.user,tid))return res.status(409).json({ok:false,code:'APPOINTMENT_SLOT_CONFLICT'});
  const rec={...b,id:id('appt'),tenantId:tid,customerName:String(c.businessName||c.contactName||''),
   assignedTo:String(c.assignedTo||c.assigned_to||req.user.id),createdBy:String(req.user.id),createdAt:now(),updatedAt:now()};
  const before=snapshot(db.appointments),previousActivities=snapshot(db.activities);db.appointments=[rec,...(db.appointments||[])];let changed;
  try{
   addActivity('appointment',`Scheduled ${rec.title} with ${rec.customerName}`,{appointmentId:rec.id,customerId:rec.customerId},tid);
   changed={appointments:snapshot(db.appointments),activities:snapshot(db.activities)};
   const saved=await save();if(saved?.skipped===true||saved?.ok===false||saved?.persisted===false)throw Error('APPOINTMENT_NOT_DURABLE');
   return res.status(201).json({ok:true,durable:true,appointment:rec,reminders:'DRAFT_ONLY_NO_MESSAGES_SENT'});
  }catch(e){db.appointments=undo(before,changed?.appointments||snapshot(db.appointments),db.appointments);db.activities=undo(previousActivities,changed?.activities||snapshot(db.activities),db.activities||[]);return res.status(503).json({ok:false,code:'APPOINTMENT_NOT_COMMITTED'})}
 }));
 app.put('/api/appointments/:id',auth,async(req,res)=>serialize(async()=>{
  const tid=scope(req,res);if(!tid)return;if(!writerReady())return unavailable(res);
  const found=getAppointment(req.params.id,req.user,tid);if(!found)return res.status(404).json({ok:false,code:'APPOINTMENT_NOT_FOUND'});
  let next;try{next=validateBooking(req.body,{isNew:false,at:isoDate(now())})}catch(e){return respondError(res,e)}
  if(next.customerId!==String(found.a.customerId))return res.status(403).json({ok:false,code:'APPOINTMENT_ACCOUNT_LOCKED'});
  if(suppressed(found.c)&&next.status!=='Cancelled')return res.status(403).json({ok:false,code:'CONTACT_SUPPRESSED'});
  if(next.status==='Scheduled'&&sameAssigneeConflict(db.appointments,next,found.c,req.user,tid,found.a.id))
   return res.status(409).json({ok:false,code:'APPOINTMENT_SLOT_CONFLICT'});
  if(next.status==='Scheduled'&&isoDate(next.startAt)<isoDate(now())-60000)return res.status(400).json({ok:false,code:'APPOINTMENT_MUST_BE_FUTURE'});
  const old=JSON.parse(JSON.stringify(found.a)),previousActivities=snapshot(db.activities),previousTasks=snapshot(db.tasks);let changed;
  Object.assign(found.a,next,{tenantId:tid,assignedTo:String(found.c.assignedTo||found.c.assigned_to||req.user.id),updatedBy:String(req.user.id),updatedAt:now()});
  if(next.startAt!==old.startAt&&next.status==='Scheduled')found.a.scheduleConfirmedAt=now();
  if(found.a.rescheduleRequest&&next.startAt!==old.startAt){
   found.a.rescheduleRequest={...found.a.rescheduleRequest,status:'Confirmed',confirmedAt:now()};
   for(const t of db.tasks||[])if(sameTenant(t,tid)&&t.journeyTaskKey==='reschedule:'+found.a.id)t.status='Completed';
  }
  try{
   addActivity('appointment',`Updated ${next.title} with ${found.c.businessName||found.c.contactName||'account'}`,{appointmentId:found.a.id,customerId:found.c.id,status:next.status},tid);
   changed={appointment:JSON.parse(JSON.stringify(found.a)),activities:snapshot(db.activities),tasks:snapshot(db.tasks)};
   const saved=await save();if(saved?.skipped===true||saved?.ok===false||saved?.persisted===false)throw Error('APPOINTMENT_NOT_DURABLE');
   return res.json({ok:true,durable:true,appointment:found.a,reminders:'DRAFT_ONLY_NO_MESSAGES_SENT'});
  }catch(e){const live=(db.appointments||[]).find(a=>a.id===old.id&&sameTenant(a,tid));if(live){const restored=undo(old,changed?.appointment||found.a,live);Object.keys(live).forEach(k=>delete live[k]);Object.assign(live,restored)}db.tasks=undo(previousTasks,changed?.tasks||snapshot(db.tasks),db.tasks||[]);db.activities=undo(previousActivities,changed?.activities||snapshot(db.activities),db.activities||[]);return res.status(503).json({ok:false,code:'APPOINTMENT_NOT_COMMITTED'})}
 }));
 // Cancellation is a reversible update; hard deletion remains owner-only, and
 // deleted appointment history is intentionally not available to account managers.
 app.delete('/api/appointments/:id',auth,async(req,res)=>serialize(async()=>{
  const tid=scope(req,res);if(!tid)return;if(req.user.role!=='owner')return res.status(403).json({ok:false,code:'OWNER_REQUIRED'});
  if(!writerReady())return unavailable(res);const found=getAppointment(req.params.id,req.user,tid);if(!found)return res.status(404).json({ok:false,code:'APPOINTMENT_NOT_FOUND'});
  const prev=snapshot(db.appointments);db.appointments=db.appointments.filter(a=>a!==found.a);const changed=snapshot(db.appointments);
  try{const result=await save();if(result?.skipped===true||result?.ok===false||result?.persisted===false)throw Error('NOT_DURABLE');return res.json({ok:true,durable:true})}catch{db.appointments=undo(prev,changed,db.appointments);return res.status(503).json({ok:false,code:'APPOINTMENT_NOT_COMMITTED'})}
 }));
 return {registered:true};
}
module.exports=Object.freeze({tenantId,permittedRole,sameTenant,accessible,suppressed,sameAssigneeConflict,validateBooking,projectActions,reminderCandidates,safeMeetingLink,register});
