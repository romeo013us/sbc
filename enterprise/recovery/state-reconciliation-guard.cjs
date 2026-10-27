'use strict';
const crypto = require('node:crypto');

function canonicalHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
/**
 * Fail-closed verifier. The caller supplies authoritative count/hash readers and a durable lock writer.
 * It never repairs data and never unlocks automatically. A missing reader or lock-writer failure is a failure.
 */
function createStateReconciliationGuard({ readAuthoritative, readProjection, engageLock, logger = console } = {}) {
  for (const [name, fn] of Object.entries({ readAuthoritative, readProjection, engageLock })) {
    if (typeof fn !== 'function') throw new TypeError(`${name} callback required`);
  }
  let lastResult = null;
  async function verify({ tenantId, scope = 'crm-core' } = {}) {
    const tenant = String(tenantId || '').trim();
    if (!tenant) throw new Error('TENANT_ID_REQUIRED');
    try {
      const [authoritative, projection] = await Promise.all([
        readAuthoritative({ tenantId: tenant, scope }),
        readProjection({ tenantId: tenant, scope })
      ]);
      if (!authoritative || !projection || !Number.isFinite(Number(authoritative.rowCount)) || !Number.isFinite(Number(projection.rowCount))) {
        throw new Error('RECONCILIATION_SOURCE_INCOMPLETE');
      }
      if ((!authoritative.hash && authoritative.canonicalRows === undefined) || (!projection.hash && projection.canonicalRows === undefined)) throw new Error('RECONCILIATION_HASH_REQUIRED');
      const aHash = authoritative.hash || canonicalHash(authoritative.canonicalRows);
      const pHash = projection.hash || canonicalHash(projection.canonicalRows);
      const matched = Number(authoritative.rowCount) === Number(projection.rowCount) && aHash === pHash;
      const result = { ok: matched, tenantId: tenant, scope, authoritativeCount: Number(authoritative.rowCount), projectionCount: Number(projection.rowCount), authoritativeHash: aHash, projectionHash: pHash, checkedAt: new Date().toISOString(), lockEngaged: !matched };
      if (!matched) {
        await engageLock({ tenantId: tenant, reason: 'STATE_RECONCILIATION_MISMATCH', evidence: result });
        logger.error?.('[SBC STATE GUARD] mismatch detected; recovery lock engaged', { tenantId: tenant, scope, authoritativeCount: result.authoritativeCount, projectionCount: result.projectionCount });
      }
      lastResult = Object.freeze(result);
      return lastResult;
    } catch (error) {
      // Unknown state is unsafe state. Attempt to engage the lock before surfacing the failure.
      try { await engageLock({ tenantId: tenant, reason: 'STATE_RECONCILIATION_UNAVAILABLE', evidence: { message: String(error?.message || error) } }); }
      catch (lockError) { logger.error?.('[SBC STATE GUARD] unable to persist emergency lock', { message: String(lockError?.message || lockError) }); }
      lastResult = Object.freeze({ ok: false, tenantId: tenant, scope, error: String(error?.message || error), lockEngaged: true, checkedAt: new Date().toISOString() });
      return lastResult;
    }
  }
  return { verify, status: () => lastResult };
}
module.exports = { canonicalHash, createStateReconciliationGuard };
