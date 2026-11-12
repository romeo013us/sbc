'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { prepare, persist } = require('../enterprise/integration/sbc-snapshot-tenants.cjs');
const { MARK, patchServer } = require('../scripts/v66-stage-snapshot-tenants.cjs');

const stamp = '2026-11-12 15:00:00';
const dates = { sqlDate: value => value || null, sqlDateTime: value => value || stamp, now: () => stamp };

test('prepares a same-tenant recovery census and derives ownership for linked legacy rows', () => {
  const input = {
    customers: [
      { id: 'legacy-owner' }, { id: 'retained-tombstone', status: 'Deleted', tenantId: 1 },
      { id: 'foreign-customer', tenantId: 2 }, { id: 3, tenant_id: '2' }, { id: 'legacy-owner', businessName: 'Latest duplicate' }
    ],
    quotes: [{ id: 'old-quote', customerId: 3 }],
    orders: [{ id: 'order', customerId: 'foreign-customer' }],
    renewals: [{ id: 'renewal', tenant_id: 2 }],
    activities: [{ id: 'activity', meta: { orderId: 'order' } }, { id: 'prior-owner-event', tenantId: 1, meta: { orderId: 'order' } }],
    megaOpsStore: { fulfillmentJobs: [{ id: 'job', orderId: 'order' }] },
    users: [{ id: 'staff', username: 'sbc-employee', tenantId: 2 }]
  };
  const { scope, sourceCounts } = prepare(input, 1);
  assert.deepEqual(sourceCounts, { customers: 1, quotes: 0, orders: 0, renewals: 0 });
  assert.equal(scope.customers.get('legacy-owner').row.businessName, 'Latest duplicate');
  for (const [table, id] of [['quotes','old-quote'], ['orders','order'], ['renewals','renewal'], ['activities','activity'], ['jobs','job'], ['users','staff']]) {
    assert.equal(scope[table].get(id).tenantId, 2);
  }
  assert.equal(scope.activities.get('prior-owner-event').tenantId, 1);
  assert.throws(() => prepare({ customers: [{ id: 'invalid', tenantId: true }] }, 1), { code: 'SNAPSHOT_TENANT_INVALID' });
  assert.throws(() => prepare({ customers: [{ id: 'mixed', tenantId: 1, tenant_id: 2 }] }, 1), { code: 'SNAPSHOT_TENANT_CONFLICT' });
  assert.throws(() => prepare({ customers: [{ id: 'shared', tenantId: 1 }, { id: 'shared', tenantId: 2 }] }, 1), { code: 'SNAPSHOT_TENANT_CONFLICT' });
});

test('pre-write census excludes only pending visible owner tombstones, not historical or foreign rows', async () => {
  const { pendingVisibleTombstones } = require('../enterprise/integration/sbc-snapshot-tenants.cjs');
  const { assessPersistenceSafety } = require('../enterprise/integration/sbc-persistence-safety.cjs');
  const currentRows = [
    { id: 'pending-delete', tenant_id: 1, status: 'Lead' },
    { id: 'already-deleted', tenant_id: 1, status: 'Deleted' },
    { id: 'foreign-delete', tenant_id: 2, status: 'Lead' }
  ];
  const queries = [];
  const conn = { async query(sql, [tenantId, ids]) {
    queries.push({ sql, tenantId, ids });
    assert.match(sql, /^SELECT id FROM sbc_(customers|quotes|orders|renewals) WHERE tenant_id=\? AND id IN \(\?\) AND COALESCE\(status,''\) <> 'Deleted'$/);
    return [currentRows.filter(row => row.tenant_id === tenantId && ids.includes(row.id) && row.status !== 'Deleted')];
  } };
  const snapshot = prepare({
    customers: [
      { id: 'pending-delete', tenantId: 1, status: 'Deleted' },
      { id: 'already-deleted', tenantId: 1, status: 'Deleted' },
      { id: 'phantom-delete', tenantId: 1, status: 'Deleted' },
      { id: 'foreign-delete', tenantId: 2, status: 'Deleted' }
    ]
  }, 1);
  const pending = await pendingVisibleTombstones(conn, snapshot, 1);
  assert.deepEqual(pending, { customers: 1, quotes: 0, orders: 0, renewals: 0 });
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].ids, ['pending-delete', 'already-deleted', 'phantom-delete']);
  assert.equal(assessPersistenceSafety({ customers: 1 }, snapshot.sourceCounts).ok, false);
  assert.equal(assessPersistenceSafety({ customers: 1 - pending.customers }, snapshot.sourceCounts).ok, true);
  assert.equal(assessPersistenceSafety({ customers: 12 }, { customers: 10 }).ok, false);
  assert.equal(assessPersistenceSafety({ customers: 12 - 2 }, { customers: 10 }).ok, true);
  assert.equal(assessPersistenceSafety({ customers: 12 - pending.customers }, { customers: 1 }).ok, false);
});

test('updates are locked and tenant-bound, tombstones survive, and new rows carry their tenant', async () => {
  const mutations = [];
  const mock = {
    async query(sql, params) {
      if (sql.startsWith('SELECT')) {
        assert.match(sql, /WHERE id IN \(\?\) FOR UPDATE$/);
        if (sql.includes('sbc_customers')) return [[{ id: 'deleted', tenant_id: 1, status: 'Deleted' }, { id: 'existing', tenant_id: 2, status: 'Lead' }]];
        if (sql.includes('sbc_workforce_users')) return [[{ id: 'staff', tenant_id: 2 }]];
        return [[]];
      }
      mutations.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
  };
  const db = {
    customers: [{ id: 'deleted', tenantId: 1 }, { id: 'existing', tenantId: 2 }, { id: 'new', tenantId: 3 }],
    orders: [{ id: 'order', customerId: 'existing' }],
    activities: [{ id: 'act', meta: { orderId: 'order' } }],
    megaOpsStore: { fulfillmentJobs: [{ id: 'job', orderId: 'order' }] },
    users: [{ id: 'staff', username: 'fixture-staff', tenantId: 2 }]
  };
  await persist(mock, prepare(db, 1), dates);
  assert.equal(mutations.length, 6);
  assert.match(mutations[0].sql, /^UPDATE sbc_customers SET .* WHERE id=\? AND tenant_id=\?$/);
  assert.deepEqual(mutations[0].params.slice(-2), ['existing', 2]);
  assert.doesNotMatch(mutations[0].sql, /SET tenant_id|created_at/);
  assert.deepEqual(mutations.slice(1, 5).map(x => x.params.slice(0, 2)), [['new',3], ['order',2], ['act',2], ['job',2]]);
  assert.equal(db.megaOpsStore.fulfillmentJobs[0].idempotencyKey, 'sbc:order:job');
  assert.match(mutations[5].sql, /^UPDATE sbc_workforce_users SET/);
  assert.doesNotMatch(mutations[5].sql, /username|password_hash/);
  assert(mutations.every(x => !x.sql.includes('ON DUPLICATE KEY UPDATE')));
});

test('a row owned by another tenant is refused before mutation', async () => {
  const projected = prepare({ customers: [{ id: 'known-row', tenantId: 2 }] }, 1);
  const conn = { async query(sql) {
    assert.match(sql, /^SELECT/);
    return [[{ id: 'known-row', tenant_id: 1, status: 'Lead' }]];
  } };
  await assert.rejects(persist(conn, projected, dates), { code: 'SNAPSHOT_TENANT_CONFLICT', table: 'sbc_customers' });
});

test('the compiled normal writer calls the scoped snapshot inside its existing transaction', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const compiled = patchServer(source);
  new vm.Script(compiled);
  assert(compiled.includes(MARK));
  assert.equal(patchServer(compiled), compiled);
  if (process.env.SBC_SNAPSHOT_TENANT_EXPECT_STAGED === 'YES') assert.equal(compiled, source);
  const writer = compiled.slice(compiled.indexOf('async function writeRelational('), compiled.indexOf('async function mysqlKeepalive()'));
  assert.match(writer, /const sourceCore=snapshotRows\.sourceCounts/);
  assert.match(writer, /await conn\.beginTransaction\(\);[\s\S]*await SNAPSHOT_TENANTS\.persist\(conn,snapshotRows,[\s\S]*await conn\.commit\(\);[\s\S]*await conn\.rollback\(\)/);
  assert.match(writer, /await SNAPSHOT_TENANTS\.pendingVisibleTombstones\(conn,snapshotRows,TENANT_DEFAULT_ID\)/);
  assert.match(writer, /assessPersistenceSafety\(reconciledVisibleCore,sourceCore\)/);
  assert.doesNotMatch(writer, /tenant_id=VALUES\(tenant_id\)/);
  assert.match(compiled, /fulfillmentJobs=durableJobs\.map\(r=>\(\{id:r\.id,tenantId:Number\(r\.tenant_id\)/);
  assert.match(compiled, /sourcePage:c0\.sourcePage,duplicate:true,contactChanged:false\},tenantId\)/);
  assert.match(compiled, /sourcePage:c0\.sourcePage,qualified:false\},tenantId\)/);
});

test('MySQL preserves row ownership, tombstones and uniqueness through commit and rollback', {
  skip: process.env.SBC_SNAPSHOT_TENANT_CI !== 'YES'
}, async () => {
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({ host: '127.0.0.1', user: 'root',
    password: process.env.SBC_V6682_CI_MYSQL_PASSWORD, database: 'sbc_v6682_ci' });
  try {
    await conn.query(`CREATE TEMPORARY TABLE sbc_customers (
      id VARCHAR(80) PRIMARY KEY, tenant_id BIGINT NOT NULL, business_name VARCHAR(255), contact_name VARCHAR(255),
      phone VARCHAR(80), email VARCHAR(255), status VARCHAR(40), source VARCHAR(100), follow_up DATE, notes TEXT,
      website VARCHAR(500), industry VARCHAR(120), website_status VARCHAR(80), assigned_to VARCHAR(80),
      account_notes_json LONGTEXT, lead_intelligence_json LONGTEXT, created_at DATETIME, updated_at DATETIME
    ) ENGINE=InnoDB`);
    await conn.query(`CREATE TEMPORARY TABLE sbc_quotes (
      id VARCHAR(80) PRIMARY KEY, tenant_id BIGINT NOT NULL, quote_number VARCHAR(80) NOT NULL UNIQUE,
      customer_id VARCHAR(80), customer_name VARCHAR(255), status VARCHAR(40), valid_until DATE, notes TEXT,
      items_json LONGTEXT, subtotal DECIMAL(12,2), discount DECIMAL(12,2), tax_rate DECIMAL(7,3), tax DECIMAL(12,2),
      total DECIMAL(12,2), payment_url TEXT, created_at DATETIME, updated_at DATETIME
    ) ENGINE=InnoDB`);
    await conn.query(`INSERT INTO sbc_customers (id,tenant_id,status,business_name) VALUES
      ('owner-row',1,'Lead','Owner before'),('other-row',2,'Lead','Other before'),('deleted-row',1,'Deleted','Deleted before')`);
    await conn.query("INSERT INTO sbc_quotes (id,tenant_id,quote_number,status) VALUES ('foreign-quote',2,'Q-1','Draft')");
    await conn.beginTransaction();
    await persist(conn, prepare({ customers: [
      { id: 'owner-row', tenantId: 1, businessName: 'Owner after' },
      { id: 'other-row', tenantId: 2, businessName: 'Other after' },
      { id: 'deleted-row', tenantId: 1, businessName: 'Stale data' },
      { id: 'new-row', tenantId: 2, businessName: 'New row' }
    ] }, 1), dates);
    await conn.commit();

    await conn.beginTransaction();
    await assert.rejects(persist(conn, prepare({ customers: [
      { id: 'owner-row', tenantId: 1, businessName: 'Rolled back' },
      { id: 'other-row', tenantId: 1, businessName: 'Foreign mutation' }
    ] }, 1), dates), { code: 'SNAPSHOT_TENANT_CONFLICT' });
    await conn.rollback();

    await conn.beginTransaction();
    await assert.rejects(persist(conn, prepare({ quotes: [{ id: 'wrong-quote', tenantId: 1, quoteNumber: 'Q-1' }] }, 1), dates), { code: 'ER_DUP_ENTRY' });
    await conn.rollback();
    const [customers] = await conn.query('SELECT id,tenant_id,status,business_name FROM sbc_customers ORDER BY id');
    assert.deepEqual(customers.map(r => [r.id, Number(r.tenant_id), r.status, r.business_name]), [
      ['deleted-row',1,'Deleted','Deleted before'], ['new-row',2,'Lead','New row'],
      ['other-row',2,'Lead','Other after'], ['owner-row',1,'Lead','Owner after']
    ]);
    const [quotes] = await conn.query('SELECT id,tenant_id FROM sbc_quotes');
    assert.deepEqual(quotes.map(r => [r.id, Number(r.tenant_id)]), [['foreign-quote',2]]);
  } finally {
    await conn.end();
  }
});
