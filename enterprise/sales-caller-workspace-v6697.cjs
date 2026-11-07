'use strict';
/* SBC Spanish Sales Workspace: pure projection, no persistence or token elevation. */
const {cleanPhone, isSuppressed}=(()=>{
 const cleanPhone=value=>{
   let v=String(value??'').trim().replace(/[\s().-]/g,'');
   if(/^\d{10}$/.test(v))v='+1'+v;
   if(/^1\d{10}$/.test(v))v='+'+v;
   return /^\+[1-9]\d{7,14}$/.test(v)?v:'';
 };
 const isSuppressed=c=>Boolean(c?.doNotContact===true||c?.salesSuppressed===true||c?.isSuppressed===true||
   ['dnc','do not call','do not contact','opt out','unsubscribe','lost','customer'].includes(String(c?.status||'').trim().toLowerCase()));
 return {cleanPhone,isSuppressed};
})();
function safeTenantId(value){
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>0?n:0;
}
function targetUser(users,actor,previewUserId,tenantId){
 const t=safeTenantId(tenantId),owner=String(actor?.role)==='owner';
 if(!t)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{status:403});
 if(!owner&&previewUserId)throw Object.assign(new Error('ROLE_ACCESS_DENIED'),{status:403});
 if(owner){
  if(!previewUserId)throw Object.assign(new Error('PREVIEW_USER_ID_REQUIRED'),{status:400});
  const u=(users||[]).find(x=>String(x.id)===String(previewUserId) && x.active!==false&&safeTenantId(x.tenantId??x.tenant_id)===t);
  if(!u||!['caller','lead_researcher'].includes(String(u.role)))throw Object.assign(new Error('WORKER_NOT_FOUND'),{status:404});
  return {user:u,preview:true};
 }
 if(!['caller','lead_researcher'].includes(String(actor?.role))||safeTenantId(actor?.tenantId??actor?.tenant_id)!==t)
  throw Object.assign(new Error('ROLE_ACCESS_DENIED'),{status:403});
 return {user:actor,preview:false};
}
function projectAssigned(customers,user,tenantId){
 const t=safeTenantId(tenantId);
 return (customers||[]).filter(c=>String(c.assignedTo||'')===String(user.id) && safeTenantId(c.tenantId??c.tenant_id)===t)
 .map(c=>({
  id:String(c.id||''),businessName:String(c.businessName||'').slice(0,220),
  contactName:String(c.contactName||'').slice(0,160),phone:String(c.phone||'').slice(0,80),
  email:String(c.email||'').slice(0,250),website:String(c.website||'').slice(0,300),
  industry:String(c.industry||c.businessCategory||'').slice(0,100),city:String(c.city||'').slice(0,100),
  status:String(c.status||'Lead').slice(0,70),verificationStatus:String(c.verificationStatus||'').slice(0,80),
  leadTemperature:String(c.leadTemperature||'').slice(0,30),assignedTo:String(c.assignedTo||''),
  nextAction:String(c.nextAction||'').slice(0,500),
  followUpAt:String(c.followUpAt||'').slice(0,40),
  canCall:!!cleanPhone(c.phone) && !isSuppressed(c),reason:isSuppressed(c)?'SUPPRESSED_OR_NOT_A_PROSPECT':!cleanPhone(c.phone)?'MISSING_VALID_PHONE':'',
 }))
 .sort((a,b)=>String(a.businessName).localeCompare(String(b.businessName))).slice(0,500);
}
function projectResearch(customers,user,tenantId){
 const t=safeTenantId(tenantId);
 return (customers||[]).filter(c=>{
  if(safeTenantId(c.tenantId??c.tenant_id)!==t)return false;
  const status=String(c.status||'Lead').trim().toLowerCase();
  return String(c.assignedTo||'')===String(user.id)&&!['customer','lost','dnc','duplicate','closed'].includes(status);
 }).map(c=>({id:String(c.id||''),businessName:String(c.businessName||'').slice(0,220),
  phone:String(c.phone||'').slice(0,80),verificationStatus:String(c.verificationStatus||'').slice(0,80),
  leadAssistStatus:String(c.leadAssistStatus||'').slice(0,100),source:String(c.source||'').slice(0,150),
  needsAttention:['owner review','needs verification','rework required','needs correction'].includes(String(c.verificationStatus||'').toLowerCase()) ||
   ['NEEDS_HUMAN_REVIEW','FAILED','REWORK_REQUIRED'].includes(String(c.leadAssistStatus||''))}))
 .sort((a,b)=>Number(b.needsAttention)-Number(a.needsAttention)).slice(0,500);
}
function workspace({users,actor,previewUserId,tenantId,customers,reports,timeEntries,certifications,onboarding,training,canLiveCall}){
 const {user,preview}=targetUser(users,actor,previewUserId,tenantId);
 const role=String(user.role);
 const isCaller=role==='caller';
 const leads=isCaller?projectAssigned(customers,user,tenantId):projectResearch(customers,user,tenantId);
 const calls=isCaller?(reports||[]).filter(r=>String(r.callerId)===String(user.id)).slice(0,50).map(r=>({
  id:String(r.id||''),customerId:String(r.customerId||''),outcome:String(r.outcome||'').slice(0,140),
  notes:String(r.notes||'').slice(0,500),createdAt:String(r.createdAt||'').slice(0,60),
  callbackAt:String(r.callbackAt||'').slice(0,60),status:String(r.status||'').slice(0,50)
 })):[];
 const time=(timeEntries||[]).filter(x=>String(x.userId)===String(user.id)).slice(0,30).map(x=>({
  clockIn:x.clockIn||'',clockOut:x.clockOut||'',mode:x.mode||'',id:x.id||''
 }));
 const cert=certifications?.[user.id]||{};
 const onb=onboarding?.[user.id]||{};
 return {ok:true,preview,readOnly:preview,role,user:{id:String(user.id),username:String(user.username||''),name:String(user.name||''),role},
  leads,calls,time,certification:{status:String(cert.status||'Not Started')},
  onboarding:{status:String(onb.status||'Not Started')},canLiveCall:isCaller&&Boolean(canLiveCall(user)),
  metrics:{assigned:leads.length,callable:leads.filter(x=>x.canCall).length,needsAttention:leads.filter(x=>x.needsAttention).length}};
}
module.exports={cleanPhone,isSuppressed,safeTenantId,targetUser,projectAssigned,projectResearch,workspace};
