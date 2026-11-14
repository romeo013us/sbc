'use strict';
/* SBC research-to-account-care lifecycle. The authoritative CRM is read-only here.
 * Research corrections and handoffs have their own tenant-scoped durability and
 * never overwrite sbc_customers.assigned_to, verification status, or call outcomes.
 */
const crypto=require('node:crypto');
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const str=(x,n=1000)=>String(x??'').trim().slice(0,n);
function fail(code){throw Object.assign(new Error(code),{code});}
function actor(v){const tenantId=Number(v?.tenantId),id=str(v?.id,120),role=str(v?.role,60);
 if(!Number.isSafeInteger(tenantId)||tenantId<1||!id||!role)fail('AUTHENTICATED_CONTEXT_REQUIRED');
 return {tenantId,id,role};}
const isSuppressed=c=>c.doNotContact===true||c.salesSuppressed===true||c.isSuppressed===true||['dnc','do not call','do not contact','opt out','unsubscribed','duplicate','lost','closed'].includes(str(c.status).toLowerCase());
const isReady=c=>c.leadAssistStatus==='AUTO_VERIFIED'||['verified','research complete','research-complete'].includes(str(c.verificationStatus).toLowerCase());
function createHandoffService({repository,clock=()=>new Date()}={}){
 if(!repository||typeof repository.customer!=='function'||typeof repository.createHandoff!=='function'||typeof repository.returnFeedback!=='function'||typeof repository.assignment!=='function')throw new TypeError('HANDOFF_DURABLE_REPOSITORY_REQUIRED');
 const timestamp=()=>new Date(clock()).toISOString();
 async function worker(a,requiredRole){const w=await repository.worker(a.tenantId,a.id);
  if(!w||w.active===false||String(w.role)!==requiredRole)fail(requiredRole==='lead_researcher'?'RESEARCHER_INACTIVE':'MANAGER_INVALID');return w;}
 async function researcher(input){const a=actor(input);if(a.role!=='lead_researcher')fail('RESEARCH_ROLE_REQUIRED');const w=await worker(a,'lead_researcher');return {a,w};}
 function owner(input){const a=actor(input);if(a.role!=='owner')fail('OWNER_REQUIRED');return a;}
 async function audit(a,action,id){await repository.audit({id:crypto.randomUUID(),tenantId:a.tenantId,actorId:a.id,role:a.role,action,entityId:id,at:timestamp()});}
 async function submit(input,{customerId,summary}={}){
  const {a,w}=await researcher(input),id=str(customerId,120),note=str(summary,2000);
  if(!id||note.length<5)fail('RESEARCH_SUMMARY_REQUIRED');
  const c=await repository.customer(a.tenantId,id);if(!c)fail('CUSTOMER_NOT_FOUND');
  if(isSuppressed(c))fail('SUPPRESSED_ACCOUNT');
  if(![a.id,str(w.username,120)].includes(str(c.assignedTo??c.assigned_to,120)))fail('RESEARCHER_NOT_ASSIGNED');
  if(!isReady(c))fail('RESEARCH_NOT_READY');
  const previous=await repository.handoffForCustomer(a.tenantId,id);if(previous)return clone(previous);
  const handoff={id:crypto.randomUUID(),tenantId:a.tenantId,customerId:id,researcherId:a.id,
   managerId:null,status:'READY_FOR_REVIEW',summary:note,createdAt:timestamp(),updatedAt:timestamp(),retryNotBefore:null};
  const saved=await repository.createHandoff(handoff);
  await audit(a,'RESEARCH_HANDOFF_SUBMITTED',saved.id);return clone(saved);
 }
 async function queue(input){const a=actor(input);if(a.role!=='owner'&&a.role!=='account_manager')fail('ACCOUNT_ACCESS_DENIED');
  if(a.role==='account_manager')await worker(a,'account_manager');
  const rows=await repository.handoffs(a.tenantId);
  if(a.role==='owner')return clone(rows);
  const active=[];for(const h of rows){const current=await repository.assignment(a.tenantId,h.customerId);
   if(current&&String(current.managerId)===a.id)active.push({...h,managerId:a.id});}
  return clone(active);}
 async function researchQueue(input){const {a}=await researcher(input);
  return clone((await repository.feedbackForResearcher(a.tenantId,a.id)).filter(x=>x.status==='OPEN'));}
 async function assign(input,{handoffId,managerId}={}){
  const a=owner(input),id=str(handoffId,120),mid=str(managerId,120);
  const h=await repository.handoff(a.tenantId,id);if(!h)fail('HANDOFF_NOT_FOUND');
  if(h.status!=='READY_FOR_REVIEW')fail('HANDOFF_ALREADY_ASSIGNED');
  const w=await repository.worker(a.tenantId,mid);
  if(!w||w.active===false||w.role!=='account_manager')fail('MANAGER_INVALID');
  const changed=await repository.changeHandoff(a.tenantId,id,'READY_FOR_REVIEW','ASSIGNED',{managerId:mid,updatedAt:timestamp()});
  if(!changed)fail('HANDOFF_CHANGED_CONCURRENTLY');
  await audit(a,'RESEARCH_HANDOFF_ASSIGNED',id);return clone(changed);
 }
 async function returnForResearch(input,{handoffId,issue,reason}={}){
  const a=actor(input),id=str(handoffId,120),code=str(issue,40),note=str(reason,2000);
  if(a.role!=='account_manager')fail('ACCOUNT_ACCESS_DENIED');await worker(a,'account_manager');
  const h=await repository.handoff(a.tenantId,id);
  const current=h?await repository.assignment(a.tenantId,h.customerId):null;
  if(!h||!current||String(current.managerId)!==a.id)fail('ACCOUNT_ACCESS_DENIED');
  if(h.status==='NEEDS_OWNER_REVIEW')fail('OWNER_REVIEW_REQUIRED');
  if(h.status!=='ASSIGNED')fail('RESEARCH_ALREADY_RETURNED');
  if(!['BAD_NUMBER','INCORRECT_BUSINESS','MISSING_CONTACT','SOURCE_CONFLICT'].includes(code)||note.length<10)fail('RESEARCH_FEEDBACK_INVALID');
  const retryNotBefore=code==='BAD_NUMBER'?new Date(new Date(clock()).getTime()+15*86400000).toISOString():null;
  const feedback={id:crypto.randomUUID(),tenantId:a.tenantId,handoffId:id,customerId:h.customerId,
   researcherId:h.researcherId,managerId:a.id,issue:code,reason:note,status:'OPEN',
   createdAt:timestamp(),resolvedAt:null,retryNotBefore,action:null,resolutionNote:null};
  const saved=await repository.returnFeedback(h,feedback,timestamp());
  if(!saved)fail('HANDOFF_CHANGED_CONCURRENTLY');await audit(a,'RESEARCH_FEEDBACK_RETURNED',id);return clone(saved);
 }
 async function resolve(input,{feedbackId,action,note,evidenceUrl}={}){
  const {a}=await researcher(input),id=str(feedbackId,120),decision=str(action,30),detail=str(note,2000),url=str(evidenceUrl,1500);
  const fb=await repository.feedback(a.tenantId,id);if(!fb||fb.researcherId!==a.id)fail('RESEARCH_FEEDBACK_NOT_FOUND');
  if(fb.status!=='OPEN')fail('FEEDBACK_ALREADY_RESOLVED');
  if(!['RESOLVED','ESCALATED'].includes(decision)||detail.length<15)fail('RESEARCH_EVIDENCE_REQUIRED');
  if(decision==='RESOLVED'&&!url&&!/source|verified|public|website|directory|business|record|confirmed/i.test(detail))fail('RESEARCH_EVIDENCE_REQUIRED');
  if(url){let u;try{u=new URL(url)}catch{fail('RESEARCH_EVIDENCE_REQUIRED')}if(u.protocol!=='https:')fail('RESEARCH_EVIDENCE_REQUIRED')}
  const changed=await repository.resolveFeedback(fb,{status:decision,action:decision,resolutionNote:detail,evidenceUrl:url,resolvedAt:timestamp()});
  if(!changed)fail('FEEDBACK_CHANGED_CONCURRENTLY');await audit(a,'RESEARCH_FEEDBACK_'+decision,id);return clone(changed);
 }
 async function summary(input){const a=owner(input);const rows=await repository.handoffs(a.tenantId),count=status=>rows.filter(h=>h.status===status).length;
  return {tenantId:a.tenantId,counts:{ready:count('READY_FOR_REVIEW'),assigned:count('ASSIGNED'),returned:count('RESEARCH_RETURNED'),ownerReview:count('NEEDS_OWNER_REVIEW')},paidSalesVerified:false,revenueAttributed:null};}
 return {submit,queue,researchQueue,assign,returnForResearch,resolve,summary};
}
function createMemoryHandoffRepository({customers=[],workers=[]}={}){
 const data=clone(customers),staff=clone(workers),handoffs=new Map(),feedbacks=new Map(),assignments=new Map(),audits=[];
 const key=(t,id)=>`${t}:${id}`;
 const repo={audits,
  setAccountManager(t,cid,managerId){assignments.set(key(t,cid),{tenantId:Number(t),customerId:String(cid),managerId:String(managerId)});},
  async assignment(t,cid){return clone(assignments.get(key(t,cid))||null);},
  disableWorker(t,id){const w=staff.find(x=>x.tenantId===Number(t)&&x.id===id);if(w)w.active=false;},
  async customer(t,id){return clone(data.find(x=>x.tenantId===Number(t)&&String(x.id)===String(id))||null);},
  async worker(t,id){return clone(staff.find(x=>x.tenantId===Number(t)&&String(x.id)===String(id))||null);},
  async handoffForCustomer(t,cid){return clone([...handoffs.values()].find(h=>h.tenantId===Number(t)&&h.customerId===cid)||null);},
  async handoff(t,id){return clone(handoffs.get(key(t,id))||null);},
  async handoffs(t){return clone([...handoffs.values()].filter(x=>x.tenantId===Number(t)));},
  async createHandoff(row){const old=await repo.handoffForCustomer(row.tenantId,row.customerId);if(old)return old;handoffs.set(key(row.tenantId,row.id),clone(row));return clone(row);},
  async changeHandoff(t,id,old,status,updates={}){const h=handoffs.get(key(t,id));if(!h||h.status!==old)return null;const updated={...h,...clone(updates),status};handoffs.set(key(t,id),updated);if(old==='READY_FOR_REVIEW'&&status==='ASSIGNED')repo.setAccountManager(t,h.customerId,updates.managerId);return clone(updated);},
  async feedback(t,id){return clone(feedbacks.get(key(t,id))||null);},
  async feedbackForResearcher(t,id){return clone([...feedbacks.values()].filter(x=>x.tenantId===Number(t)&&x.researcherId===id));},
  async returnFeedback(h,fb,stamp){const row=await repo.changeHandoff(h.tenantId,h.id,'ASSIGNED','RESEARCH_RETURNED',{retryNotBefore:fb.retryNotBefore,updatedAt:stamp,managerId:fb.managerId});if(!row)return null;feedbacks.set(key(fb.tenantId,fb.id),clone(fb));return clone(fb);},
  async resolveFeedback(fb,updates){const r=feedbacks.get(key(fb.tenantId,fb.id));if(!r||r.status!=='OPEN')return null;const changed={...r,...clone(updates)};feedbacks.set(key(fb.tenantId,fb.id),changed);
   const status=updates.status==='ESCALATED'?'NEEDS_OWNER_REVIEW':'ASSIGNED';
   await repo.changeHandoff(fb.tenantId,fb.handoffId,'RESEARCH_RETURNED',status,{updatedAt:updates.resolvedAt});return clone(changed);},
  async audit(row){audits.push(clone(row));}
 };return repo;
}
module.exports={createHandoffService,createMemoryHandoffRepository,isSuppressed,isReady};
