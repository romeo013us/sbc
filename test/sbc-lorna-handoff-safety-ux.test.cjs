'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isSuppressed,
  createHandoffService,
  createMemoryHandoffRepository
} = require('../enterprise/sbc-lorna-handoff-v1.cjs');

const owner = { tenantId: 1, id: 'owner', role: 'owner' };
const lorna = { tenantId: 1, id: 'lorna', role: 'lead_researcher' };
const manager = { tenantId: 1, id: 'manager', role: 'account_manager' };

function fixture(customer = {}) {
  const repository = createMemoryHandoffRepository({
    customers: [{
      tenantId: 1, id: 'c1', businessName: '119th Barber Shop',
      status: 'Lead', assignedTo: 'lorna', leadAssistStatus: 'AUTO_VERIFIED',
      ...customer
    }],
    workers: [
      { tenantId: 1, id: 'lorna', username: 'lorna', role: 'lead_researcher', active: true },
      { tenantId: 1, id: 'manager', role: 'account_manager', active: true }
    ]
  });
  const service = createHandoffService({ repository, clock: () => new Date('2026-11-17T15:00:00Z') });
  return { repository, service };
}

test('all existing Do Not Call and bad-number representations block Lorna handoff', async () => {
  const cases = [
    { doNotCall: true },
    { do_not_call: true },
    { doNotContact: true },
    { salesSuppressed: true },
    { status: 'Bad Number' },
    { status: 'Wrong Number' },
    { status: 'Opt Out' },
    { status: 'DNC' }
  ];
  for (const flags of cases) {
    assert.equal(isSuppressed({ status: 'Lead', ...flags }), true, JSON.stringify(flags));
    const { service } = fixture(flags);
    await assert.rejects(
      service.submit(lorna, { customerId: 'c1', summary: 'Research completed against listing.' }),
      /SUPPRESSED_ACCOUNT/,
      JSON.stringify(flags)
    );
  }
  assert.equal(isSuppressed({ status: 'Lead' }), false);
});

test('a newly suppressed CRM account disappears from the manager handoff queue without erasing owner audit history', async () => {
  const { repository, service } = fixture();
  const handoff = await service.submit(lorna, { customerId: 'c1', summary: 'Verified business research.' });
  await service.assign(owner, { handoffId: handoff.id, managerId: 'manager' });
  assert.equal((await service.queue(manager)).length, 1);
  const originalCustomer = repository.customer.bind(repository);
  repository.customer = async (tenantId, id) => {
    const record = await originalCustomer(tenantId, id);
    return record ? { ...record, doNotCall: true } : null;
  };
  assert.deepEqual(await service.queue(manager), []);
  assert.equal((await service.queue(owner)).length, 1);
});

test('Lorna correction queue shows verified CRM business name alongside the original stable account ID', async () => {
  const { service } = fixture();
  const handoff = await service.submit(lorna, { customerId: 'c1', summary: 'Verified business research.' });
  await service.assign(owner, { handoffId: handoff.id, managerId: 'manager' });
  await service.returnForResearch(manager, {
    handoffId: handoff.id, issue: 'BAD_NUMBER',
    reason: 'Disconnected number; request verified research correction.'
  });
  const [task] = await service.researchQueue(lorna);
  assert.equal(task.businessName, '119th Barber Shop');
  assert.equal(task.customerId, 'c1');
  assert.equal(task.status, 'OPEN');
});

test('missing business name is labeled unknown instead of inventing a customer name', async () => {
  const { service } = fixture({ businessName: '' });
  const handoff = await service.submit(lorna, { customerId: 'c1', summary: 'Verified business research.' });
  await service.assign(owner, { handoffId: handoff.id, managerId: 'manager' });
  await service.returnForResearch(manager, {
    handoffId: handoff.id, issue: 'SOURCE_CONFLICT',
    reason: 'Public listings do not match the prior research record.'
  });
  const [task] = await service.researchQueue(lorna);
  assert.equal(task.businessName, null);
  assert.equal(task.customerId, 'c1');
});

test('returned bad-number work stays with Lorna even after 15 days until research is resolved', async () => {
  const { repository, service } = fixture();
  const handoff = await service.submit(lorna, { customerId: 'c1', summary: 'Verified original listing.' });
  await service.assign(owner, { handoffId: handoff.id, managerId: 'manager' });
  await service.returnForResearch(manager, {
    handoffId: handoff.id, issue: 'BAD_NUMBER', reason: 'Disconnected number requires replacement research.'
  });
  const afterHold = createHandoffService({
    repository, clock: () => new Date('2026-12-05T15:00:00Z')
  });
  assert.equal((await afterHold.researchQueue(lorna)).length, 1);
  assert.deepEqual(await afterHold.queue(manager), [], 'a time delay is not proof research was completed');
  assert.equal((await afterHold.queue(owner))[0].status, 'RESEARCH_RETURNED');
});

test('escalated source conflicts remain owner-only rather than returning to manager daily work', async () => {
  const { service } = fixture();
  const handoff = await service.submit(lorna, { customerId: 'c1', summary: 'Verified original listing.' });
  await service.assign(owner, { handoffId: handoff.id, managerId: 'manager' });
  const feedback = await service.returnForResearch(manager, {
    handoffId: handoff.id, issue: 'SOURCE_CONFLICT', reason: 'Conflicting public contact listings need owner review.'
  });
  await service.resolve(lorna, {
    feedbackId: feedback.id, action: 'ESCALATED',
    note: 'Unable to resolve conflicting source details with verified evidence.'
  });
  assert.deepEqual(await service.queue(manager), [], 'owner review must not be treated as active account care');
  assert.equal((await service.queue(owner))[0].status, 'NEEDS_OWNER_REVIEW');
});
