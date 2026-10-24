'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { auditDatabase } = require('./read-only-db-audit');

function fakeDb() {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT DATABASE()')) return [[{ selected_database: 'sbc_test', checked_at: '2026-10-11 12:00:00' }]];
      if (sql.includes('information_schema.tables')) return [[
        'sbc_customers', 'sbc_orders', 'sbc_renewals', 'sbc_lead_mesh',
        'sbc_idempotency_keys', 'sbc_request_idempotency',
        'sbc_checkout_event_ledger', 'sbc_checkout_webhook_inbox'
      ].map(table_name => ({ table_name }))];
      if (sql.includes('information_schema.columns') && sql.includes("table_name = 'sbc_orders'")) return [[
        {column_name:'created_at'},{column_name:'source'},{column_name:'status'},{column_name:'idempotency_key'}
      ]];
      if (sql.includes('DATE_FORMAT(created_at')) return [[{hour_bucket:'2026-10-24 19:00',row_count:76}]];
      if (sql.includes('FROM sbc_orders GROUP BY source')) return [[{group_name:'automation',row_count:76}]];
      if (sql.includes('FROM sbc_orders GROUP BY status')) return [[{group_name:'draft',row_count:76}]];
      if (sql.includes('duplicate_order_keys')) return [[{duplicate_groups:0}]];
      if (sql.includes('information_schema.columns') && sql.includes("column_name = 'tenant_id'")) return [[
        { table_name: 'sbc_customers' }, { table_name: 'sbc_orders' }, { table_name: 'sbc_renewals' }
      ]];
      if (sql.includes('information_schema.columns') && sql.includes("column_name = 'status'")) return [[
        { table_name: 'sbc_idempotency_keys' }, { table_name: 'sbc_request_idempotency' },
        { table_name: 'sbc_checkout_event_ledger' }, { table_name: 'sbc_checkout_webhook_inbox' }
      ]];
      if (sql.includes("table_name = 'sbc_checkout_event_ledger'")) return [[{ column_name: 'idempotency_key' }]];
      if (sql.startsWith('SELECT COUNT(*) AS row_count')) return [[{ row_count: '7' }]];
      if (sql.includes('GROUP BY tenant_id')) return [[{ tenant_id: '1', row_count: '7' }]];
      if (sql.includes('GROUP BY status')) return [[{ state: 'complete', row_count: '2' }]];
      if (sql.includes('duplicate_groups')) return [[{ duplicate_groups: '0' }]];
      throw new Error('Unexpected query in test: ' + sql);
    }
  };
}

test('audit returns aggregate report and issues only SELECT statements', async () => {
  const db = fakeDb();
  const report = await auditDatabase(db);
  assert.equal(report.database, 'sbc_test');
  assert.equal(report.table_counts.sbc_customers, 7);
  assert.equal(report.tenant_distribution.sbc_customers[0].tenant_id, '1');
  assert.equal(report.duplicate_idempotency_key_groups, 0);
  assert.equal(report.order_incident.hourly[0].count,76);
  assert.equal(report.order_incident.source[0].value,'automation');
  assert.equal(report.order_incident.duplicate_idempotency_groups,0);
  assert.equal(report.safety.data_changed, false);
  assert.ok(db.calls.every(call => /^SELECT\b/i.test(call.sql.trim())), 'every query must be SELECT-only');
});

test('audit refuses to continue without a selected database', async () => {
  const db = { query: async () => [[{ selected_database: null }]] };
  await assert.rejects(() => auditDatabase(db), /No database selected/);
});
