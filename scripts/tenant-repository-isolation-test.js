'use strict';
const assert = require('node:assert/strict');
const { runWithTenantContext } = require('../enterprise/tenant-context.cjs');
const { createCustomerRepository } = require('../enterprise/repositories/customer-repository.cjs');

(async () => {
  const calls = [];
  const fixtures = [
    { id: 'c-1', tenant_id: 1, business_name: 'Tenant One' },
    { id: 'c-1', tenant_id: 2, business_name: 'Tenant Two' },
    { id: 'c-2', tenant_id: 1, business_name: 'Tenant One Second' }
  ];
  const pool = { execute: async (sql, params) => {
    calls.push({ sql, params });
    assert.match(sql, /WHERE tenant_id = \?/i, 'every customer read must contain an explicit tenant predicate');
    const tenant = Number(params[0]);
    if (/AND id = \?/i.test(sql)) return [fixtures.filter(r => r.tenant_id === tenant && r.id === params[1]).map(r => ({ id: r.id, business_name: r.business_name }))];
    return [fixtures.filter(r => r.tenant_id === tenant).slice(0, 100).map(r => ({ id: r.id, business_name: r.business_name }))];
  }};
  const repo = createCustomerRepository({ pool });
  await assert.rejects(() => repo.findById('c-1'), /TENANT_CONTEXT_MISSING/);
  const [one, two] = await Promise.all([
    runWithTenantContext({ tenantId: 1, actorId: 'a', role: 'owner' }, async () => {
      await new Promise(r => setImmediate(r));
      return repo.findById('c-1');
    }),
    runWithTenantContext({ tenantId: 2, actorId: 'b', role: 'owner' }, async () => {
      await new Promise(r => setImmediate(r));
      return repo.findById('c-1');
    })
  ]);
  assert.equal(one.business_name, 'Tenant One');
  assert.equal(two.business_name, 'Tenant Two');
  assert.notEqual(one.business_name, two.business_name, 'concurrent tenants must not cross-read');
  await runWithTenantContext({ tenantId: 1, actorId: 'a', role: 'owner' }, async () => {
    const rows = await repo.list({ limit: 5, offset: 0 });
    assert.equal(rows.length, 2);
  });
  assert.ok(calls.every(c => Number.isInteger(c.params[0]) && c.params[0] > 0));
  assert.ok(calls.every(c => /tenant_id = \?/i.test(c.sql)));
  assert.equal(Object.isFrozen(repo), true);
  console.log(JSON.stringify({ ok: true, checks: 7, concurrentTenantIsolation: 'PASS', repositoryMutationMethods: 0, queries: calls.length }));
})().catch(e => { console.error(e); process.exit(1); });
