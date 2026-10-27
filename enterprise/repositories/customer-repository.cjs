'use strict';

const { requireTenantContext } = require('../tenant-context.cjs');

function positiveTenantId(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw Object.assign(new Error('TENANT_DATABASE_ID_INVALID'), { code: 'TENANT_DATABASE_ID_INVALID' });
  }
  return n;
}

/**
 * Read-only, tenant-scoped Customer 360 repository.
 * Tenant identity comes only from the authenticated AsyncLocalStorage context.
 * Caller-supplied tenant IDs are intentionally not accepted by public methods.
 * This repository fails closed if the DB schema lacks tenant_id or the query fails.
 */
function createCustomerRepository({ pool } = {}) {
  if (!pool || typeof pool.execute !== 'function') throw new TypeError('mysql-compatible pool.execute required');

  async function findById(customerId) {
    const ctx = requireTenantContext();
    const tenantId = positiveTenantId(ctx.tenantId);
    const id = String(customerId ?? '').trim();
    if (!id || id.length > 80) throw Object.assign(new Error('CUSTOMER_ID_INVALID'), { code: 'CUSTOMER_ID_INVALID' });
    const [rows] = await pool.execute(
      `SELECT id, business_name, contact_name, phone, email, status, source, follow_up, notes, created_at, updated_at
         FROM sbc_customers
        WHERE tenant_id = ? AND id = ?
        LIMIT 1`,
      [tenantId, id]
    );
    return Array.isArray(rows) ? (rows[0] || null) : null;
  }

  async function list({ limit = 25, offset = 0, status = null } = {}) {
    const ctx = requireTenantContext();
    const tenantId = positiveTenantId(ctx.tenantId);
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 25)));
    const safeOffset = Math.max(0, Math.min(1000000, Math.trunc(Number(offset) || 0)));
    const statusValue = status == null || String(status).trim() === '' ? null : String(status).trim().slice(0, 40);
    const sql = statusValue
      ? `SELECT id, business_name, contact_name, phone, email, status, source, follow_up, created_at, updated_at
           FROM sbc_customers WHERE tenant_id = ? AND status = ?
          ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?`
      : `SELECT id, business_name, contact_name, phone, email, status, source, follow_up, created_at, updated_at
           FROM sbc_customers WHERE tenant_id = ?
          ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?`;
    const params = statusValue ? [tenantId, statusValue, safeLimit, safeOffset] : [tenantId, safeLimit, safeOffset];
    const [rows] = await pool.execute(sql, params);
    return Array.isArray(rows) ? rows : [];
  }

  return Object.freeze({ findById, list });
}

module.exports = { createCustomerRepository, positiveTenantId };
