'use strict';
const crypto = require('crypto');

class LeadIngestionEngine {
  constructor(poolProvider) { this.poolProvider = poolProvider; }
  static normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }
  static normalizePhone(v) { return String(v || '').trim().replace(/[^\d+]/g, ''); }
  async ingestLeadRow(rawRow = {}, tenantId) {
    if (!tenantId) throw new Error('TENANT_REQUIRED');
    const companyName = String(rawRow.company_name ?? rawRow.businessName ?? '').trim();
    const contactEmail = LeadIngestionEngine.normalizeEmail(rawRow.email);
    const contactPhone = LeadIngestionEngine.normalizePhone(rawRow.phone);
    if (!companyName || !contactEmail || !contactPhone) {
      const pool = this.poolProvider?.();
      if (pool) await pool.execute(
        'INSERT INTO sbc_lead_quarantine (tenant_id, raw_payload, quarantine_reason, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())',
        [tenantId, JSON.stringify(rawRow), 'INVALID_OR_MISSING_CRITICAL_FIELDS']
      );
      return { status:'QUARANTINED', reason:'INVALID_OR_MISSING_CRITICAL_FIELDS' };
    }
    const canonical = JSON.stringify({tenantId, companyName, contactEmail, contactPhone});
    const idempotencyKey = crypto.createHash('sha256').update(canonical).digest('hex');
    const pool = this.poolProvider?.();
    if (!pool) return {status:'COMMITTED', persisted:false, idempotencyKey};
    try {
      await pool.execute(
        `INSERT INTO sbc_agent_event_bus
         (event_type, aggregate_type, aggregate_id, source_agent, payload, idempotency_key, status, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        ['lead.verified','prospect',contactEmail,'lead_factory_worker',
         JSON.stringify({companyName,email:contactEmail,phone:contactPhone,tenantId}),
         idempotencyKey,'pending',3]
      );
      return {status:'COMMITTED', persisted:true, idempotencyKey};
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return {status:'REJECTED_DUPLICATE', idempotencyKey};
      throw e;
    }
  }
}
module.exports = {LeadIngestionEngine};
