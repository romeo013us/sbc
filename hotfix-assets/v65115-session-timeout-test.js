'use strict';
const assert = require('node:assert/strict');
const { createSessionStore } = require('../enterprise/session-store');

(async () => {
  let livePool = null;
  const sql = [];
  const fakePool = {
    async query(statement, params = []) {
      const text = typeof statement === 'string' ? statement : statement.sql;
      sql.push(text);
      if (/^SELECT user_id FROM sbc_sessions/.test(text)) return [[{ user_id: String(params[1]) }], []];
      if (/^SELECT role FROM sbc_session_bindings/.test(text)) return [[{ role: 'owner' }], []];
      if (/^SELECT user_id,UNIX_TIMESTAMP/.test(text)) return [[], []];
      return [{ affectedRows: 1 }, []];
    }
  };
  const store = createSessionStore({
    sessionSecret: 'v65115-test-secret',
    mysqlPool: null,
    getMysqlPool: () => livePool,
    getRedisClient: () => null,
    isRedisReady: () => false,
    getUsers: () => [{ id: 'owner-1', username: 'owner', role: 'owner', active: true }],
    logger: { warn() {} }
  });
  const session = store.makeSession({ id: 'owner-1', role: 'owner', tenantId: 1 });
  const before = await store.persistSession(session.token, session.record);
  assert.equal(before.durable, false, 'no session may be issued without a durable store');
  livePool = fakePool;
  const after = await store.persistSession(session.token, session.record);
  assert.equal(after.mysql, true, 'late-bound MySQL pool should be used');
  assert.equal(after.durable, true, 'confirmed MySQL write/read-back is durable');
  assert(sql.some(x => /^INSERT INTO sbc_sessions/.test(x)));
  assert(sql.some(x => /^SELECT user_id FROM sbc_sessions/.test(x)));
  console.log('V65.1.15 durable-session checks: 5/5 PASS');
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
