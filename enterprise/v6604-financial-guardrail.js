'use strict';

const LIMIT_CENTS = 1_000_000;

function toCents(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new TypeError('Transaction amount must be a finite non-negative number.');
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 1e-7) {
    throw new TypeError('Transaction amount must be representable to two decimal places.');
  }
  return cents;
}

/**
 * Policy primitive only. Call from the authoritative server-side financial
 * mutation path; never trust client-supplied role, tenant, or signature claims.
 * verifyOwnerAuthorization must validate a server-issued challenge/signature
 * bound to tenant, amount, currency, action, expiry, and one-time nonce.
 */
async function enforceFinancialGuardrail({
  transaction,
  authenticatedActor,
  verifyOwnerAuthorization,
  writeAuditEvent
} = {}) {
  if (!transaction || typeof transaction.tenantId !== 'string' || !transaction.tenantId.trim()) {
    throw new TypeError('A server-resolved tenantId is required.');
  }
  const amountCents = toCents(transaction.amount);
  if (amountCents < LIMIT_CENTS) return { allowed: true, requiresOwnerApproval: false };

  if (typeof writeAuditEvent !== 'function') {
    throw new Error('Financial guardrail is not configured with an audit writer; failing closed.');
  }

  const ownerActor = authenticatedActor && authenticatedActor.role === 'OWNER' &&
    authenticatedActor.tenantId === transaction.tenantId;
  const verifierConfigured = typeof verifyOwnerAuthorization === 'function';
  let authorized = false;

  if (ownerActor && verifierConfigured && transaction.ownerAuthorization) {
    authorized = await verifyOwnerAuthorization({
      authorization: transaction.ownerAuthorization,
      tenantId: transaction.tenantId,
      amountCents,
      currency: transaction.currency,
      action: transaction.action,
      nonce: transaction.nonce
    }) === true;
  }

  if (!authorized) {
    await writeAuditEvent({
      type: 'FINANCIAL_MUTATION_BLOCKED',
      tenantId: transaction.tenantId,
      amountCents,
      reason: 'OWNER_AUTHORIZATION_REQUIRED',
      actorId: authenticatedActor && authenticatedActor.id ? String(authenticatedActor.id) : null
    });
    throw new Error('Financial mutation blocked: explicit verified owner authorization is required at or above $10,000.');
  }

  return { allowed: true, requiresOwnerApproval: true };
}

module.exports = { enforceFinancialGuardrail, toCents, LIMIT_CENTS };
