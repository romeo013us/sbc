'use strict';
const crypto = require('node:crypto');
const { requireTenantContext } = require('./tenant-context.cjs');
function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}
function createTenantAuditLedger({ pool, clock = () => new Date() } = {}) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('pool.query required');
  async function append({ action, resourceType, resourceId = null, outcome, reasonCode = null, metadata = null } = {}) {
    const ctx = requireTenantContext();
    if (!['ALLOW','DENY','ERROR'].includes(outcome)) throw new Error('AUDIT_OUTCOME_INVALID');
    if (!action || !resourceType) throw new Error('AUDIT_ACTION_AND_RESOURCE_REQUIRED');
    const evidenceHash = crypto.createHash('sha256').update(stableJson({tenantId:ctx.tenantId,actorId:ctx.actorId,role:ctx.role,action,resourceType,resourceId,outcome,reasonCode,metadata})).digest('hex');
    const auditId = crypto.randomUUID();
    await pool.query(`INSERT INTO sbc_tenant_audit_ledger
      (audit_id,tenant_id,actor_id,actor_role,action,resource_type,resource_id,request_id,outcome,reason_code,evidence_hash,metadata_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [auditId,ctx.tenantId,ctx.actorId,ctx.role,String(action),String(resourceType),resourceId,ctx.requestId,outcome,reasonCode,evidenceHash,metadata===null?null:JSON.stringify(metadata),clock()]);
    return { auditId, tenantId:ctx.tenantId, evidenceHash };
  }
  return { append };
}
module.exports = { stableJson, createTenantAuditLedger };
