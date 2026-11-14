'use strict';
/* MySQL adapter for Lorna -> account-manager handoff. Separate additive tables.
 * Requires a real transactional writer. All updates use tenant/status CAS guards.
 * No DDL, no cron, no writes on import, and NO sbc_customers mutations.
 */
const dateSql=v=>v?new Date(v).toISOString().slice(0,23).replace('T',' '):null;
const dateIso=v=>v?new Date(v).toISOString():null;
function createMysqlHandoffRepository({pool,lookupCustomer,lookupWorker}={}){
 if(!pool||typeof pool.query!=='function'||typeof pool.getConnection!=='function')throw new TypeError('TRANSACTIONAL_MYSQL_WRITER_REQUIRED');
 if(typeof lookupCustomer!=='function'||typeof lookupWorker!=='function')throw new TypeError('TENANT_SCOPED_CRM_AND_WORKER_LOOKUPS_REQUIRED');
 const run=(q,args)=>pool.query(q,args);
 const handoffRow=r=>r&&({id:String(r.id),tenantId:Number(r.tenant_id),customerId:String(r.customer_id),researcherId:String(r.researcher_id),managerId:r.manager_id||null,
  status:r.status,summary:r.summary,createdAt:dateIso(r.created_at),updatedAt:dateIso(r.updated_at),retryNotBefore:dateIso(r.retry_not_before)});
 const feedbackRow=r=>r&&({id:String(r.id),tenantId:Number(r.tenant_id),handoffId:String(r.handoff_id),customerId:String(r.customer_id),researcherId:String(r.researcher_id),managerId:String(r.manager_id),
  issue:r.issue,reason:r.reason,status:r.status,createdAt:dateIso(r.created_at),resolvedAt:dateIso(r.resolved_at),retryNotBefore:dateIso(r.retry_not_before),action:r.resolution_action||null,resolutionNote:r.resolution_note||null,evidenceUrl:r.evidence_url||''});
 async function transact(fn){const conn=await pool.getConnection();let begun=false;
  try{await conn.beginTransaction();begun=true;const result=await fn(conn);await conn.commit();begun=false;return result;}
  catch(e){if(begun){try{await conn.rollback();}catch{}}throw e}finally{conn.release()}}
 const api={
  async customer(t,id){const r=await lookupCustomer(t,id);return r&&Number(r.tenantId??r.tenant_id)===Number(t)?r:null},
  async worker(t,id){const r=await lookupWorker(t,id);return r&&Number(r.tenantId??r.tenant_id)===Number(t)?r:null},
  async assignment(t,cid){const [rows]=await run('SELECT manager_id FROM sbc_account_ownership_v1 WHERE tenant_id=? AND customer_id=? LIMIT 1',[t,cid]);return rows[0]?{tenantId:Number(t),customerId:String(cid),managerId:String(rows[0].manager_id)}:null;},
  async handoff(t,id){const [rows]=await run('SELECT * FROM sbc_lead_handoffs_v1 WHERE tenant_id=? AND id=? LIMIT 1',[t,id]);return handoffRow(rows[0]);},
  async handoffForCustomer(t,id){const [rows]=await run('SELECT * FROM sbc_lead_handoffs_v1 WHERE tenant_id=? AND customer_id=? LIMIT 1',[t,id]);return handoffRow(rows[0]);},
  async handoffs(t){const [rows]=await run('SELECT * FROM sbc_lead_handoffs_v1 WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 2500',[t]);return rows.map(handoffRow);},
  async createHandoff(r){
   try{await run('INSERT INTO sbc_lead_handoffs_v1 (tenant_id,id,customer_id,researcher_id,manager_id,status,summary,created_at,updated_at,retry_not_before) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [r.tenantId,r.id,r.customerId,r.researcherId,r.managerId,r.status,r.summary,dateSql(r.createdAt),dateSql(r.updatedAt),dateSql(r.retryNotBefore)]);
   }catch(e){if(e?.code!=='ER_DUP_ENTRY')throw e;}
   const saved=await api.handoffForCustomer(r.tenantId,r.customerId);if(!saved)throw Error('HANDOFF_WRITE_UNVERIFIED');return saved;
  },
  async changeHandoff(t,id,old,status,updates={}){
   const transitions=['ASSIGNED','RESEARCH_RETURNED','NEEDS_OWNER_REVIEW','READY_FOR_REVIEW'];if(!transitions.includes(status))throw Error('HANDOFF_STATUS_INVALID');
   const fields=['status=?'],args=[status];for(const [field,col] of Object.entries({managerId:'manager_id',updatedAt:'updated_at',retryNotBefore:'retry_not_before'})){
    if(Object.hasOwn(updates,field)){fields.push(col+'=?');args.push(field==='updatedAt'||field==='retryNotBefore'?dateSql(updates[field]):updates[field]);}}
   const did=await transact(async conn=>{
    const [existing]=await conn.query('SELECT customer_id,researcher_id FROM sbc_lead_handoffs_v1 WHERE tenant_id=? AND id=? AND status=? FOR UPDATE',[t,id,old]);
    if(!Array.isArray(existing)||existing.length!==1)return false;
    const [result]=await conn.query('UPDATE sbc_lead_handoffs_v1 SET '+fields.join(',')+' WHERE tenant_id=? AND id=? AND status=?',[...args,t,id,old]);
    if(result.affectedRows!==1)throw Error('HANDOFF_TRANSACTION_CAS_FAILED');
    if(old==='READY_FOR_REVIEW'&&status==='ASSIGNED'){
     if(!updates.managerId)throw Error('MANAGER_ID_REQUIRED');
     await conn.query('INSERT INTO sbc_account_ownership_v1(tenant_id,customer_id,manager_id,assigned_by,updated_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE manager_id=VALUES(manager_id),assigned_by=VALUES(assigned_by),updated_at=VALUES(updated_at)',
      [t,existing[0].customer_id,updates.managerId,'owner-handoff',dateSql(updates.updatedAt)]);
    }
    return true;
   });
   return did?api.handoff(t,id):null;
  },
  async feedback(t,id){const [rows]=await run('SELECT * FROM sbc_research_feedback_v1 WHERE tenant_id=? AND id=? LIMIT 1',[t,id]);return feedbackRow(rows[0]);},
  async feedbackForResearcher(t,id){const [rows]=await run('SELECT * FROM sbc_research_feedback_v1 WHERE tenant_id=? AND researcher_id=? ORDER BY created_at DESC LIMIT 1000',[t,id]);return rows.map(feedbackRow);},
  async returnFeedback(h,fb,stamp){
   const saved=await transact(async conn=>{
    const [result]=await conn.query("UPDATE sbc_lead_handoffs_v1 h INNER JOIN sbc_account_ownership_v1 o ON o.tenant_id=h.tenant_id AND o.customer_id=h.customer_id SET h.status='RESEARCH_RETURNED',h.retry_not_before=?,h.updated_at=?,h.manager_id=? WHERE h.tenant_id=? AND h.id=? AND h.status='ASSIGNED' AND o.manager_id=?",
     [dateSql(fb.retryNotBefore),dateSql(stamp),fb.managerId,h.tenantId,h.id,fb.managerId]);
    if(result.affectedRows!==1)return false;
    await conn.query('INSERT INTO sbc_research_feedback_v1 (tenant_id,id,handoff_id,customer_id,researcher_id,manager_id,issue,reason,status,created_at,resolved_at,retry_not_before,resolution_action,resolution_note,evidence_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
     [fb.tenantId,fb.id,fb.handoffId,fb.customerId,fb.researcherId,fb.managerId,fb.issue,fb.reason,fb.status,dateSql(fb.createdAt),null,dateSql(fb.retryNotBefore),null,null,'']);
    return true;
   });return saved?api.feedback(fb.tenantId,fb.id):null;
  },
  async resolveFeedback(fb,u){
   const status=u.status==='ESCALATED'?'NEEDS_OWNER_REVIEW':'ASSIGNED';
   const saved=await transact(async conn=>{
    const [done]=await conn.query("UPDATE sbc_research_feedback_v1 SET status=?,resolution_action=?,resolution_note=?,evidence_url=?,resolved_at=? WHERE tenant_id=? AND id=? AND status='OPEN' AND researcher_id=?",
     [u.status,u.action,u.resolutionNote,u.evidenceUrl||'',dateSql(u.resolvedAt),fb.tenantId,fb.id,fb.researcherId]);
    if(done.affectedRows!==1)return false;
    const [h]=await conn.query("UPDATE sbc_lead_handoffs_v1 SET status=?,updated_at=? WHERE tenant_id=? AND id=? AND status='RESEARCH_RETURNED' AND researcher_id=?",
     [status,dateSql(u.resolvedAt),fb.tenantId,fb.handoffId,fb.researcherId]);
    if(h.affectedRows!==1)throw Error('HANDOFF_FEEDBACK_STATE_MISMATCH');return true;
   });return saved?api.feedback(fb.tenantId,fb.id):null;
  },
  async audit(ev){await run('INSERT INTO sbc_lead_handoff_audit_v1 (tenant_id,id,actor_id,actor_role,action,entity_id,created_at) VALUES(?,?,?,?,?,?,?)',
   [ev.tenantId,ev.id,ev.actorId,ev.role,ev.action,ev.entityId,dateSql(ev.at)]);}
 };return api;
}
module.exports={createMysqlHandoffRepository};
