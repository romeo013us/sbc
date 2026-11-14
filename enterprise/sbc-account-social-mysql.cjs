'use strict';
/* MySQL2 adapter: manual migrations; no DDL or production writes at import time.
 * Reads customers/workers through existing Command Center authenticated tenant
 * repositories (injected functions), preventing a second CRM truth source.
 * Connection pool must point at the approved writer, never Preview.
 */
const crypto=require('node:crypto');
const parseDate=v=>v?new Date(v).toISOString():null;
const dateSql=v=>v?new Date(v).toISOString().slice(0,23).replace('T',' '):null;
function createMysqlRepository({pool,lookupCustomer,lookupWorker}={}){
 if(!pool||typeof pool.query!=='function')throw new TypeError('mysql2 promise pool required');
 if(typeof lookupCustomer!=='function'||typeof lookupWorker!=='function')throw new TypeError('tenant-scoped existing CRM and workforce readers required');
 const exec=(sql,params)=>pool.query(sql,params);
 const postRow=r=>r&&({id:r.id,tenantId:Number(r.tenant_id),customerId:r.customer_id,channelId:r.channel_id,
  platform:r.platform,body:r.body,mediaUrl:r.media_url,ctaUrl:r.cta_url,status:r.status,
  approvedAt:parseDate(r.approved_at),approvedBy:r.approved_by,scheduledAt:parseDate(r.scheduled_at),remoteId:r.remote_id,
  createdBy:r.created_by,createdAt:parseDate(r.created_at),publishedAt:parseDate(r.published_at),attempts:Number(r.attempts),failureCode:r.failure_code});
 const channelRow=r=>r&&({id:r.id,tenantId:Number(r.tenant_id),customerId:r.customer_id,platform:r.platform,
  providerAccountId:r.provider_account_id,secretRef:r.secret_ref,status:r.status,createdAt:parseDate(r.created_at),verifiedAt:parseDate(r.verified_at)});
 const api={
  async customer(t,id){const c=await lookupCustomer(t,id);return c&&Number(c.tenantId??c.tenant_id)===Number(t)?c:null;},
  async worker(t,id){const w=await lookupWorker(t,id);return w&&Number(w.tenantId??w.tenant_id)===Number(t)?w:null;},
  async assignment(t,id){const [rows]=await exec('SELECT tenant_id,customer_id,manager_id,assigned_by,updated_at FROM sbc_account_ownership_v1 WHERE tenant_id=? AND customer_id=? LIMIT 1',[t,id]);return rows[0]?{tenantId:Number(t),customerId:rows[0].customer_id,managerId:rows[0].manager_id,assignedBy:rows[0].assigned_by,updatedAt:parseDate(rows[0].updated_at)}:null;},
  async assignments(t){const [rows]=await exec('SELECT tenant_id,customer_id,manager_id,assigned_by,updated_at FROM sbc_account_ownership_v1 WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 2000',[t]);return rows.map(r=>({tenantId:Number(t),customerId:r.customer_id,managerId:r.manager_id,assignedBy:r.assigned_by,updatedAt:parseDate(r.updated_at)}));},
  async saveAssignment(r){await exec('INSERT INTO sbc_account_ownership_v1(tenant_id,customer_id,manager_id,assigned_by,updated_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE manager_id=VALUES(manager_id),assigned_by=VALUES(assigned_by),updated_at=VALUES(updated_at)',[r.tenantId,r.customerId,r.managerId,r.assignedBy,dateSql(r.updatedAt)]);},
  async insertInteraction(r){await exec('INSERT INTO sbc_account_interactions_v1(tenant_id,id,customer_id,kind,summary,created_by,created_at) VALUES(?,?,?,?,?,?,?)',[r.tenantId,r.id,r.customerId,r.kind,r.summary,r.createdBy,dateSql(r.createdAt)]);},
  async interactions(t,id){const [rows]=await exec('SELECT id,kind,summary,created_by,created_at FROM sbc_account_interactions_v1 WHERE tenant_id=? AND customer_id=? ORDER BY created_at DESC LIMIT 50',[t,id]);return rows.map(r=>({id:r.id,tenantId:Number(t),customerId:id,kind:r.kind,summary:r.summary,createdBy:r.created_by,createdAt:parseDate(r.created_at)}));},
  async insertChannel(r){await exec('INSERT INTO sbc_social_channels_v1(tenant_id,id,customer_id,platform,provider_account_id,secret_ref,status,created_at,verified_at) VALUES(?,?,?,?,?,?,?,?,?)',[r.tenantId,r.id,r.customerId,r.platform,r.providerAccountId,r.secretRef,r.status,dateSql(r.createdAt),dateSql(r.verifiedAt)]);},
  async saveChannel(r){await exec('UPDATE sbc_social_channels_v1 SET status=?,verified_at=? WHERE tenant_id=? AND id=?',[r.status,dateSql(r.verifiedAt),r.tenantId,r.id]);},
  async channel(t,id){const [rows]=await exec('SELECT * FROM sbc_social_channels_v1 WHERE tenant_id=? AND id=? LIMIT 1',[t,id]);return channelRow(rows[0]);},
  async channels(t,id){const [rows]=await exec('SELECT * FROM sbc_social_channels_v1 WHERE tenant_id=? AND customer_id=? ORDER BY created_at DESC LIMIT 50',[t,id]);return rows.map(channelRow);},
  async insertPost(p){await exec('INSERT INTO sbc_social_posts_v1(tenant_id,id,customer_id,channel_id,platform,body,media_url,cta_url,status,approved_at,approved_by,scheduled_at,remote_id,created_by,created_at,published_at,attempts,failure_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[p.tenantId,p.id,p.customerId,p.channelId,p.platform,p.body,p.mediaUrl,p.ctaUrl,p.status,dateSql(p.approvedAt),p.approvedBy,dateSql(p.scheduledAt),p.remoteId,p.createdBy,dateSql(p.createdAt),dateSql(p.publishedAt),p.attempts,p.failureCode||null]);},
  async post(t,id){const [rows]=await exec('SELECT * FROM sbc_social_posts_v1 WHERE tenant_id=? AND id=? LIMIT 1',[t,id]);return postRow(rows[0]);},
  async postsForCustomer(t,id){const [rows]=await exec('SELECT * FROM sbc_social_posts_v1 WHERE tenant_id=? AND customer_id=? ORDER BY created_at DESC LIMIT 500',[t,id]);return rows.map(postRow);},
  async updatePostStatus(t,id,expected,status,updates={}){
   const fields=['status=?'],params=[status];
   for(const [k,col] of Object.entries({approvedAt:'approved_at',approvedBy:'approved_by',scheduledAt:'scheduled_at',remoteId:'remote_id',publishedAt:'published_at',attempts:'attempts',failureCode:'failure_code'})){
    if(Object.hasOwn(updates,k)){fields.push(col+'=?');params.push(['approvedAt','scheduledAt','publishedAt'].includes(k)?dateSql(updates[k]):updates[k]);}
   }
   const [result]=await exec('UPDATE sbc_social_posts_v1 SET '+fields.join(',')+' WHERE tenant_id=? AND id=? AND status=?',[...params,t,id,expected]);
   return result.affectedRows===1?api.post(t,id):null;
  },
  async claimDue(t,at,max){
   const [rows]=await exec("SELECT id FROM sbc_social_posts_v1 WHERE tenant_id=? AND status='SCHEDULED' AND approved_at IS NOT NULL AND scheduled_at<=? ORDER BY scheduled_at ASC LIMIT ?",[t,dateSql(at),max]);
   const claimed=[];for(const r of rows){
    // A single conditional UPDATE is a DB-level compare-and-set across workers.
    const [result]=await exec("UPDATE sbc_social_posts_v1 SET status='PUBLISHING',attempts=attempts+1 WHERE tenant_id=? AND id=? AND status='SCHEDULED' AND approved_at IS NOT NULL AND scheduled_at<=?",[t,r.id,dateSql(at)]);
    if(result.affectedRows===1){const p=await api.post(t,r.id);if(p)claimed.push(p);}
   }return claimed;
  },
  async appendAudit(e){await exec('INSERT INTO sbc_account_social_audit_v1(tenant_id,id,actor_id,actor_role,action,entity_id,created_at) VALUES(?,?,?,?,?,?,?)',[e.tenantId,crypto.randomUUID(),e.actorId,e.actorRole,e.action,e.entityId,dateSql(e.at)]);}
 };return api;
}
module.exports={createMysqlRepository};
