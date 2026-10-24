'use strict';

const assert = require('node:assert/strict');
const { enforceFinancialGuardrail, toCents } = require('./v6604-financial-guardrail');

(async () => {
  assert.equal(toCents('9999.99'), 999999);
  let audited = 0;
  const base = {
    transaction: { tenantId: 'tenant-a', amount: 10000, currency: 'USD', action: 'transfer', nonce: 'n-1', ownerAuthorization: { challengeId: 'test-challenge', signature: 'test-signature' } },
    authenticatedActor: { id: 'owner-1', role: 'OWNER', tenantId: 'tenant-a' },
    writeAuditEvent: async event => { audited++; assert.equal(event.reason, 'OWNER_AUTHORIZATION_REQUIRED'); }
  };
  await assert.rejects(enforceFinancialGuardrail(base), /explicit verified owner authorization/);
  assert.equal(audited, 1, 'blocked high-value attempt is audited');
  await assert.rejects(enforceFinancialGuardrail({
    ...base,
    verifyOwnerAuthorization: async () => true,
    authenticatedActor: { id: 'user-2', role: 'OWNER', tenantId: 'tenant-b' },
    writeAuditEvent: base.writeAuditEvent
  }), /explicit verified owner authorization/);
  const allowed = await enforceFinancialGuardrail({
    ...base,
    verifyOwnerAuthorization: async input => input.amountCents === 1000000 && input.tenantId === 'tenant-a'
  });
  assert.equal(allowed.allowed, true);
  assert.equal((await enforceFinancialGuardrail({
    transaction: { tenantId: 'tenant-a', amount: 9999.99 },
    authenticatedActor: { role: 'AI', tenantId: 'tenant-a' }
  })).allowed, true);
  await assert.rejects(enforceFinancialGuardrail({
    transaction: { tenantId: 'tenant-a', amount: 10000 },
    authenticatedActor: { role: 'OWNER', tenantId: 'tenant-a' },
    verifyOwnerAuthorization: async () => true
  }), /audit writer/);
  console.log('SBC V6604 financial guardrail tests: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
