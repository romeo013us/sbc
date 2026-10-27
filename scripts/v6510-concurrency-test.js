'use strict';
const assert = require('assert');
const { AgentWorkerRuntime } = require('../workers/agent-worker-runtime');

function mockPool() {
  const state = { queue: [{ id: 1, status: 'pending', priority: 1, event_type: 'lead.refresh', payload: {} }], locked: false, calls: [] };
  const connection = () => ({
    async beginTransaction() { state.calls.push('begin'); },
    async execute(sql, params = []) {
      const q = sql.toLowerCase(); state.calls.push(q.includes('for update') ? 'select-for-update' : q.startsWith('update') ? 'update' : 'select');
      if (q.includes('global_emergency_kill_switch')) return [[{ setting_value: 1 }]];
      if (q.includes('from sbc_agent_event_bus')) {
        if (state.locked || !state.queue.some(x => x.status === 'pending')) return [[]];
        state.locked = true;
        return [[{ ...state.queue.find(x => x.status === 'pending') }]];
      }
      if (q.startsWith('update sbc_agent_event_bus') && q.includes("status='processing'")) {
        const row = state.queue.find(x => x.id === params[0] && x.status === 'pending');
        if (!row) return [{ affectedRows: 0 }];
        row.status = 'processing'; return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
    async commit() { state.calls.push('commit'); state.locked = false; },
    async rollback() { state.calls.push('rollback'); state.locked = false; },
    release() { state.calls.push('release'); }
  });
  return { state, async getConnection() { return connection(); }, async execute() { return [{ affectedRows: 1 }]; } };
}

(async () => {
  const lockedPool = mockPool();
  const locked = new AgentWorkerRuntime(() => lockedPool, { workerId: 'test-locked' });
  assert.deepStrictEqual(await locked.executeNextWorkerTask(), { status: 'RECOVERY_LOCKED', readOnly: true });
  assert.strictEqual(lockedPool.state.calls.length, 0, 'recovery lock must prevent all DB queue operations');

  const pool = mockPool();
  const runtime = new AgentWorkerRuntime(() => pool, { recoveryRequired: () => false, workerId: 'test-worker' });
  const claims = await Promise.all([runtime.claimNextTask(pool), runtime.claimNextTask(pool)]);
  assert.strictEqual(claims.filter(x => x.status === 'CLAIMED').length, 1, 'only one concurrent worker may claim the pending row');
  assert(claims.some(x => x.status === 'IDLE'), 'the competing worker must skip the locked row');
  assert(pool.state.calls.includes('begin') && pool.state.calls.includes('select-for-update') && pool.state.calls.includes('commit') && pool.state.calls.includes('release'));
  console.log('V65.1.26 CONCURRENCY HOTFIX TEST: PASS');
  console.log('checks=recovery-fail-closed,transactional-claim,concurrent-claim-exclusivity');
})().catch(e => { console.error(e); process.exit(1); });
