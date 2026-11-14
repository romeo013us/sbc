'use strict';
/*
 * SBC Account + Social domain, V1: no automatic server mounting, secrets, network,
 * marketing spend, migrations, or background timers. Repository injection is
 * required; memory repository is only a deterministic test/demo adapter.
 * Production must use a durable adapter with atomic claim() and scoped writes.
 */
const crypto=require('node:crypto');
const PLATFORMS=new Set(['facebook','instagram']);
const ROLES=new Set(['owner','account_manager']);
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const str=(value,max)=>String(value??'').trim().slice(0,max);
function fail(code){throw Object.assign(new Error(code),{code});}
function context(actor){
 const t=Number(actor?.tenantId),id=str(actor?.id,120),role=str(actor?.role,60);
 if(!Number.isSafeInteger(t)||t<1||!id||!role)fail('AUTHENTICATED_CONTEXT_REQUIRED');
 return {tenantId:t,id,role};
}
function owner(actor){const a=context(actor);if(a.role!=='owner')fail('OWNER_REQUIRED');return a;}
function system(actor){const a=context(actor);if(a.role!=='system')fail('SYSTEM_ROLE_REQUIRED');return a;}
function httpsUrl(value,required=false){
 const s=str(value,2048);
 if(!s){if(required)fail('INSTAGRAM_HTTPS_MEDIA_REQUIRED');return '';}
 try{const u=new URL(s);if(u.protocol!=='https:'||!u.hostname||u.username||u.password||/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[::1\])/.test(u.hostname))fail('HTTPS_PUBLIC_URL_REQUIRED');return s;}catch(e){if(e.code){if(required)fail('INSTAGRAM_HTTPS_MEDIA_REQUIRED');throw e;}if(required)fail('INSTAGRAM_HTTPS_MEDIA_REQUIRED');fail('HTTPS_PUBLIC_URL_REQUIRED');}
}
function createService({repository,provider,clock=()=>new Date(),publishingEnabled=false,writerReady=()=>false}={}){
 if(!repository||typeof repository.customer!=='function'||typeof repository.claimDue!=='function')throw new TypeError('durable repository contract required');
 if(!provider||typeof provider.verify!=='function'||typeof provider.publish!=='function')throw new TypeError('provider adapters required');
 const instant=()=>new Date(clock()).toISOString();
 async function checkAccess(a,customerId){
  const customer=await repository.customer(a.tenantId,customerId);
  if(!customer)fail('ACCOUNT_ACCESS_DENIED');
  if(a.role==='owner')return customer;
  if(a.role!=='account_manager')fail('ACCOUNT_ACCESS_DENIED');
  const assigned=await repository.assignment(a.tenantId,customerId);
  if(!assigned||String(assigned.managerId)!==a.id)fail('ACCOUNT_ACCESS_DENIED');
  const worker=await repository.worker(a.tenantId,a.id);
  if(!worker||worker.active===false||String(worker.role)!=='account_manager')fail('ACCOUNT_ACCESS_DENIED');
  return customer;
 }
 async function audit(a,action,entity){await repository.appendAudit({tenantId:a.tenantId,actorId:a.id,actorRole:a.role,action,entityId:String(entity),at:instant()});}
 async function assign(actor,{customerId,managerId}={}){
  const a=owner(actor),cid=str(customerId,120),mid=str(managerId,120);
  if(!cid||!mid)fail('INVALID_ACCOUNT_ASSIGNMENT');
  if(!await repository.customer(a.tenantId,cid))fail('CUSTOMER_NOT_FOUND');
  const user=await repository.worker(a.tenantId,mid);
  if(!user||user.active===false||String(user.role)!=='account_manager')fail('MANAGER_INVALID');
  const row={tenantId:a.tenantId,customerId:cid,managerId:mid,assignedBy:a.id,updatedAt:instant()};
  await repository.saveAssignment(row);await audit(a,'ACCOUNT_ASSIGNED',cid);return clone(row);
 }
 async function portfolio(actor){
  const a=context(actor);if(!ROLES.has(a.role))fail('ACCOUNT_ACCESS_DENIED');
  const rows=await repository.assignments(a.tenantId);
  const accounts=[];
  for(const row of rows){if(a.role!=='owner'&&String(row.managerId)!==a.id)continue;
   if(a.role!=='owner'){const worker=await repository.worker(a.tenantId,a.id);if(!worker||worker.active===false||String(worker.role)!=='account_manager')continue;}
   const c=await repository.customer(a.tenantId,row.customerId);if(!c)continue;
   const events=await repository.interactions(a.tenantId,row.customerId);
   accounts.push({id:String(c.id),businessName:str(c.businessName||c.name,220),status:str(c.status,60),managerId:String(row.managerId),phone:str(c.phone,80),doNotContact:Boolean(c.doNotContact||events.some(e=>e.kind==='do_not_contact')),
    timeline:events.map(e=>({id:e.id,kind:e.kind,summary:e.summary,createdAt:e.createdAt})).slice(-50).reverse()});
  }
  return {tenantId:a.tenantId,accounts,counts:{assigned:accounts.length,needsAttention:accounts.filter(c=>c.doNotContact).length}};
 }
 async function logInteraction(actor,{customerId,kind,summary}={}){
  const a=context(actor),cid=str(customerId,120);await checkAccess(a,cid);
  const k=str(kind,30),s=str(summary,2000);
  if(!['call','email','sms','meeting','note','follow_up','do_not_contact'].includes(k)||!s)fail('INVALID_ACCOUNT_ACTIVITY');
  const ev={id:crypto.randomUUID(),tenantId:a.tenantId,customerId:cid,kind:k,summary:s,createdBy:a.id,createdAt:instant()};
  await repository.insertInteraction(ev);await audit(a,'ACCOUNT_ACTIVITY',cid);return clone(ev);
 }
 async function connectChannel(actor,{customerId,platform,providerAccountId,secretRef}={}){
  const a=owner(actor),cid=str(customerId,120),p=str(platform,30).toLowerCase(),pid=str(providerAccountId,200),ref=str(secretRef,200);
  if(!await repository.customer(a.tenantId,cid))fail('CUSTOMER_NOT_FOUND');
  if(!PLATFORMS.has(p)||!pid)fail('INVALID_SOCIAL_CHANNEL');
  if(!/^vault:[a-zA-Z0-9_./:-]{3,180}$/.test(ref))fail('SECRET_REFERENCE_REQUIRED');
  const row={id:crypto.randomUUID(),tenantId:a.tenantId,customerId:cid,platform:p,providerAccountId:pid,secretRef:ref,status:'UNVERIFIED',createdAt:instant(),verifiedAt:null};
  await repository.insertChannel(row);await audit(a,'SOCIAL_CONNECTION_REGISTERED',row.id);return publicChannel(row);
 }
 function publicChannel(row){const {secretRef,...rest}=row;return clone(rest);}
 async function channels(actor,customerId){const a=context(actor);await checkAccess(a,customerId);return (await repository.channels(a.tenantId,customerId)).map(publicChannel);}
 async function verifyChannel(actor,channelId){
  const a=owner(actor),ch=await repository.channel(a.tenantId,channelId);if(!ch)fail('CHANNEL_NOT_FOUND');
  const v=await provider.verify({tenantId:a.tenantId,customerId:ch.customerId,platform:ch.platform,providerAccountId:ch.providerAccountId,secretRef:ch.secretRef});
  if(!v||v.verified!==true||String(v.providerAccountId)!==ch.providerAccountId)fail('PROVIDER_ID_MISMATCH');
  const row={...ch,status:'VERIFIED',verifiedAt:instant()};await repository.saveChannel(row);await audit(a,'SOCIAL_CONNECTION_VERIFIED',ch.id);return publicChannel(row);
 }
 async function draftPost(actor,{channelId,body,mediaUrl='',ctaUrl=''}={}){
  const a=context(actor),ch=await repository.channel(a.tenantId,channelId);
  if(!ch)fail('CHANNEL_NOT_FOUND');await checkAccess(a,ch.customerId);
  const content=str(body,5000);if(!content)fail('EMPTY_POST');
  const media=httpsUrl(mediaUrl, ch.platform==='instagram');const cta=httpsUrl(ctaUrl);
  const post={id:crypto.randomUUID(),tenantId:a.tenantId,customerId:ch.customerId,channelId:ch.id,platform:ch.platform,body:content,mediaUrl:media,ctaUrl:cta,status:'DRAFT',approvedAt:null,approvedBy:null,scheduledAt:null,remoteId:null,createdBy:a.id,createdAt:instant(),attempts:0};
  await repository.insertPost(post);await audit(a,'SOCIAL_DRAFT_CREATED',post.id);return clone(post);
 }
 async function posts(actor,customerId){const a=context(actor);await checkAccess(a,customerId);
  return clone(await repository.postsForCustomer(a.tenantId,str(customerId,120)));}
 async function getPost(actor,postId){
  const a=context(actor),post=await repository.post(a.tenantId,postId);
  if(!post)fail('POST_NOT_FOUND');await checkAccess(a,post.customerId);return clone(post);
 }
 async function transition(actor,postId,expected,status,updates={},ownerRequired=false){
  const a=ownerRequired?owner(actor):context(actor),p=await repository.post(a.tenantId,postId);
  if(!p)fail('POST_NOT_FOUND');await checkAccess(a,p.customerId);
  if(p.status!==expected)fail('INVALID_POST_TRANSITION');
  const row=await repository.updatePostStatus(a.tenantId,postId,expected,status,updates);
  if(!row)fail('POST_CHANGED_CONCURRENTLY');await audit(a,'SOCIAL_'+status,postId);return clone(row);
 }
 const submitPost=(actor,id)=>transition(actor,id,'DRAFT','PENDING_APPROVAL');
 const approvePost=(actor,id)=>transition(actor,id,'PENDING_APPROVAL','APPROVED',{approvedAt:instant(),approvedBy:context(actor).id},true);
 async function schedulePost(actor,id,at){
  const a=owner(actor),post=await repository.post(a.tenantId,id);
  if(!post)fail('POST_NOT_FOUND');if(post.status!=='APPROVED')fail('INVALID_POST_TRANSITION');
  const ch=await repository.channel(a.tenantId,post.channelId);
  if(!ch||ch.status!=='VERIFIED'||ch.customerId!==post.customerId||ch.platform!==post.platform)fail('CHANNEL_NOT_VERIFIED');
  if(typeof at!=='string'||!/\d{4}-\d\d-\d\dT\d\d:\d\d/.test(at)||!/Z$|[+-]\d\d:\d\d$/.test(at)||!Number.isFinite(Date.parse(at))||Date.parse(at)<=Date.parse(instant()))fail('FUTURE_SCHEDULE_REQUIRED');
  return transition(a,id,'APPROVED','SCHEDULED',{scheduledAt:new Date(at).toISOString()},true);
 }
 async function publishDue(actor,{at,max=5}={}){
  const a=system(actor);
  if(!publishingEnabled)fail('PUBLISHING_DISABLED');if(!writerReady())fail('WRITER_NOT_READY');
  const time=at?new Date(at):new Date(clock());if(!Number.isFinite(time.getTime()))fail('INVALID_TIMESTAMP');
  const limit=Math.max(1,Math.min(5,Number(max)||5));
  // claimDue MUST atomically move SCHEDULED -> PUBLISHING in the durable DB.
  const claimed=await repository.claimDue(a.tenantId,time.toISOString(),limit);
  const results=[];
  for(const post of claimed){
   const ch=await repository.channel(a.tenantId,post.channelId);
   if(!post.approvedAt||!ch||ch.status!=='VERIFIED'||ch.customerId!==post.customerId||ch.platform!==post.platform){
    await repository.updatePostStatus(a.tenantId,post.id,'PUBLISHING','NEEDS_RECONCILIATION',{failureCode:'PUBLISH_GUARD_REJECTED'});
    await audit(a,'SOCIAL_PUBLISH_REJECTED',post.id);results.push({id:post.id,status:'NEEDS_RECONCILIATION'});continue;
   }
   try{
    const remote=await provider.publish({tenantId:a.tenantId,customerId:post.customerId,post:clone(post),channel:{...ch},idempotencyKey:crypto.createHash('sha256').update('sbc:v1:'+a.tenantId+':'+post.id).digest('hex')});
    if(!remote?.id)throw Error('PROVIDER_CONFIRMATION_MISSING');
    await repository.updatePostStatus(a.tenantId,post.id,'PUBLISHING','PUBLISHED',{remoteId:str(remote.id,255),publishedAt:instant()});
    await audit(a,'SOCIAL_PUBLISHED',post.id);results.push({id:post.id,status:'PUBLISHED'});
   }catch(_error){
    // A timeout may be a success at Meta. Fail closed: no blind retry.
    await repository.updatePostStatus(a.tenantId,post.id,'PUBLISHING','NEEDS_RECONCILIATION',{failureCode:'REMOTE_OUTCOME_UNKNOWN'});
    await audit(a,'SOCIAL_PUBLISH_OUTCOME_UNKNOWN',post.id);results.push({id:post.id,status:'NEEDS_RECONCILIATION'});
   }
  }
  return {processed:claimed.length,results};
 }
 return {assign,portfolio,logInteraction,connectChannel,channels,verifyChannel,draftPost,posts,getPost,submitPost,approvePost,schedulePost,publishDue};
}
// Test/demo adapter ONLY. Use a MySQL repository for any production feature.
function createMemoryRepository({customers=[],users=[]}={}){
 const cl=clone(customers),ul=clone(users),assignments=new Map(),interaction=[],channel=new Map(),posts=new Map(),audit=[];
 const key=(tid,id)=>String(tid)+':'+String(id);
 const repo={audit,
  disableWorker(t,id){const x=ul.find(u=>u.tenantId===Number(t)&&String(u.id)===String(id));if(x)x.active=false;},
  async customer(t,id){return clone(cl.find(x=>x.tenantId===Number(t)&&String(x.id)===String(id))||null)},
  async worker(t,id){return clone(ul.find(x=>x.tenantId===Number(t)&&String(x.id)===String(id))||null)},
  async assignment(t,id){return clone(assignments.get(key(t,id))||null)},
  async assignments(t){return clone([...assignments.values()].filter(x=>x.tenantId===Number(t)))},
  async saveAssignment(row){assignments.set(key(row.tenantId,row.customerId),clone(row))},
  async insertInteraction(row){interaction.push(clone(row))},
  async interactions(t,id){return clone(interaction.filter(x=>x.tenantId===Number(t)&&String(x.customerId)===String(id)))},
  async insertChannel(row){channel.set(key(row.tenantId,row.id),clone(row))},
  async saveChannel(row){channel.set(key(row.tenantId,row.id),clone(row))},
  async channel(t,id){return clone(channel.get(key(t,id))||null)},
  async channels(t,id){return clone([...channel.values()].filter(x=>x.tenantId===Number(t)&&x.customerId===String(id)))},
  async insertPost(row){posts.set(key(row.tenantId,row.id),clone(row))},
  async post(t,id){return clone(posts.get(key(t,id))||null)},
  async postsForCustomer(t,id){return clone([...posts.values()].filter(x=>x.tenantId===Number(t)&&x.customerId===String(id)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,500));},
  async updatePostStatus(t,id,expected,status,updates={}){const k=key(t,id),p=posts.get(k);if(!p||p.status!==expected)return null;const changed={...p,...clone(updates),status};posts.set(k,changed);return clone(changed)},
  async claimDue(t,at,max){const claimed=[];for(const p of posts.values()){
   if(p.tenantId!==Number(t)||p.status!=='SCHEDULED'||!p.approvedAt||p.scheduledAt>at)continue;
   const row=await repo.updatePostStatus(t,p.id,'SCHEDULED','PUBLISHING',{attempts:Number(p.attempts)+1});if(row)claimed.push(row);
   if(claimed.length>=max)break;
  }return claimed;},
  async appendAudit(ev){audit.push(clone(ev))}
 };return repo;
}
module.exports={createService,createMemoryRepository};
