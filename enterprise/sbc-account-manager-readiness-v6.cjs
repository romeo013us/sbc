'use strict';
/**
 * SBC Account Manager Launch Readiness V6
 * Read-only reconciliation between canonical CRM customer assignments and
 * the independently permissioned Account/Social ownership table.
 * This is a diagnostic, never a license to grant access, migrate rows or contact customers.
 */
const MAX_ROWS=5000;
const VALID_ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
function assertRows(rows,tenantId,kind){
 if(!Array.isArray(rows)||rows.length>MAX_ROWS)throw Error('READINESS_'+kind+'_INCOMPLETE');
 const seen=new Set();
 for(const r of rows){
  const id=String(kind==='CRM'?r?.id:r?.customer_id||'');
  if(!VALID_ID.test(id)||!Number.isSafeInteger(Number(r.tenant_id))||Number(r.tenant_id)!==tenantId||
   seen.has(id))throw Error('READINESS_'+kind+'_INVALID');
  seen.add(id);
 }
}
function analyze({crmRows,socialRows,users,tenantId,observedAt=Date.now()}={}){
 const tid=Number(tenantId);
 if(!Number.isSafeInteger(tid)||tid<1||!Number.isFinite(Number(observedAt))||!Array.isArray(users))
  throw Error('READINESS_CONTEXT_INVALID');
 assertRows(crmRows,tid,'CRM');assertRows(socialRows,tid,'SOCIAL');
 const activeManagers=new Map(),callers=new Set();
 for(const user of users){
  if(!user||Number(user.tenantId??user.tenant_id)!==tid||!VALID_ID.test(String(user.id||'')))continue;
  const role=String(user.role||'');
  if(role==='account_manager'&&user.active!==false)activeManagers.set(String(user.id),user);
  if(role==='caller')callers.add(String(user.id));
 }
 const crm=new Map(),social=new Map();
 const result={
  schema:'SBC_ACCOUNT_MANAGER_LAUNCH_READINESS_V6',status:'UNVERIFIED',
  observedAt:new Date(Number(observedAt)).toISOString(),
  crm:{total:crmRows.length,unassigned:0,activeAccountManagerAssigned:0,legacyCallerAssigned:0,invalidAssignee:0},
  social:{total:socialRows.length,aligned:0,ownerMismatch:0,unlinkedAccount:0,danglingAccount:0,missingForManager:0,invalidSocialManager:0},
  workforce:{activeAccountManagers:activeManagers.size},
  issues:[],autoCorrections:0,socialAccessGranted:false,productionReady:false,
  caveat:'Read-only snapshot. Account/Social permissions are independent. A matching assignment is not proof of authorized social access or production readiness.'
 };
 const push=(code,count,description,ids)=>{
  if(count>0)result.issues.push({code,count,description,sampleAccountIds:ids.slice(0,10)});
 };
 const legacy=[],invalid=[],unassigned=[];
 for(const row of crmRows){
  const id=String(row.id),manager=String(row.assigned_to??'').trim();
  crm.set(id,{...row,manager});
  if(!manager){result.crm.unassigned++;unassigned.push(id)}
  else if(activeManagers.has(manager))result.crm.activeAccountManagerAssigned++;
  else if(callers.has(manager)){result.crm.legacyCallerAssigned++;legacy.push(id)}
  else{result.crm.invalidAssignee++;invalid.push(id)}
 }
 const mismatch=[],unlinked=[],dangling=[],invalidSocial=[],missing=[];
 for(const row of socialRows){
  const cid=String(row.customer_id),mid=String(row.manager_id??'').trim();
  social.set(cid,mid);
  if(!mid||!activeManagers.has(mid)){
   result.social.invalidSocialManager++;invalidSocial.push(cid);
  }
  const customer=crm.get(cid);
  if(!customer){result.social.danglingAccount++;dangling.push(cid);continue}
  if(!customer.manager){result.social.unlinkedAccount++;unlinked.push(cid)}
  if(customer.manager!==mid){result.social.ownerMismatch++;mismatch.push(cid)}
  else result.social.aligned++;
 }
 for(const [id,customer] of crm){
  if(activeManagers.has(customer.manager)&&!social.has(id)){
   result.social.missingForManager++;missing.push(id);
  }
 }
 push('LEGACY_CALLER_ACCOUNTS',result.crm.legacyCallerAssigned,'Existing caller-owned accounts require owner-managed transfer; retain prior CRM history.',legacy);
 push('INACTIVE_OR_UNKNOWN_MANAGER',result.crm.invalidAssignee,'Some CRM accounts reference inactive, foreign-tenant or unknown workers.',invalid);
 push('SOCIAL_ASSIGNMENT_DRIFT',result.social.ownerMismatch,'CRM and Account/Social managers disagree. Do not grant access automatically.',mismatch);
 push('SOCIAL_ACCESS_WITHOUT_CRM_OWNER',result.social.unlinkedAccount,'A social assignment exists where CRM account ownership is empty.',unlinked);
 push('SOCIAL_DANGLING_ACCOUNT',result.social.danglingAccount,'Social ownership points to an account absent from this tenant CRM snapshot.',dangling);
 push('SOCIAL_MISSING_FOR_ASSIGNED_MANAGER',result.social.missingForManager,'A CRM assigned account has no Account/Social ownership. Do not infer social permission.',missing);
 push('SOCIAL_OWNER_NOT_ACTIVE_MANAGER',result.social.invalidSocialManager,'The social owner is not an active account_manager in this tenant.',invalidSocial);
 result.status=result.issues.length?'ACTION_REQUIRED':
  result.crm.total===0&&result.social.total===0?'UNVERIFIED':'ALIGNED';
 result.recommendation=result.status==='ACTION_REQUIRED'?
  'Owner review of assignment differences required before any social-workspace access or role transfer.':
  result.status==='ALIGNED'?'Ownership IDs align in this read-only snapshot; verify real staff authorization separately.':
   'No account rows were returned. Verify database coverage and current staff before assessing readiness.';
 return result;
}
module.exports=analyze;
