'use strict';

/**
 * V56.2 reusable business-state contracts.
 * Presentation layers may consume these contracts; V55/V56 operational engines remain authoritative.
 */
const crypto = require('crypto');

const VERSION = '56.2.0';
const TENANT_NAMESPACE = 'sbc.tenant.v1';
const PROTECTED_ACTIONS = new Set([
  'refund', 'money_transfer', 'credential_change', 'permanent_delete',
  'destructive_infrastructure', 'production_secret_rotation'
]);

function normalizeTenantId(value, fallback = 1) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function tenantScope({ tenantId, customerId = null, userId = null, role = 'customer' } = {}) {
  return {
    namespace: TENANT_NAMESPACE,
    tenantId: normalizeTenantId(tenantId),
    customerId: customerId == null ? null : String(customerId),
    userId: userId == null ? null : String(userId),
    role: String(role || 'customer')
  };
}

function canExecute(action, role = 'customer') {
  const a = String(action || '').toLowerCase();
  if (PROTECTED_ACTIONS.has(a)) return role === 'owner';
  return ['owner', 'manager', 'operator'].includes(String(role).toLowerCase());
}

function eventEnvelope({ eventType, tenantId, customerId, payload = {}, source = 'command-center', risk = 'normal', requiresHuman = false }) {
  const issuedAt = new Date().toISOString();
  const body = { schema: 'sbc.business-event.v1', eventType, tenantId: normalizeTenantId(tenantId), customerId: customerId == null ? null : String(customerId), source, risk, requiresHuman: Boolean(requiresHuman), issuedAt, payload };
  const canonical = JSON.stringify(body);
  body.eventId = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  return body;
}

function capabilityMatrix(role = 'customer') {
  const r = String(role || 'customer').toLowerCase();
  return {
    tenantIsolation: true,
    ingestion: true,
    funnelAnalytics: true,
    marketingFactory: true,
    subscriptionRecovery: true,
    workerReady: true,
    predictiveGuardrails: true,
    procurement: r === 'owner' || r === 'manager',
    providerCredentials: r === 'owner',
    protectedMoneyActions: r === 'owner',
    autonomousExecution: ['owner', 'manager', 'operator'].includes(r)
  };
}

module.exports = { VERSION, normalizeTenantId, tenantScope, canExecute, eventEnvelope, capabilityMatrix, PROTECTED_ACTIONS };
