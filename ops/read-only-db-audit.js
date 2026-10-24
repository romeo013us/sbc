'use strict';

// SBC OS read-only live database audit. This file intentionally issues SELECT only.
// It returns aggregate counts/status/tenant distributions, never customer-level rows.
// Run with the app's existing DB_* environment variables; do not place credentials in args.
const TABLES = [
  'sbc_customers',
  'sbc_orders',
  'sbc_renewals',
  'sbc_lead_mesh',
  'sbc_idempotency_keys',
  'sbc_request_idempotency',
  'sbc_checkout_event_ledger',
  'sbc_checkout_webhook_inbox'
];
const STATUS_TABLES = [
  'sbc_idempotency_keys',
  'sbc_request_idempotency',
  'sbc_checkout_event_ledger',
  'sbc_checkout_webhook_inbox'
];
const CORE_TENANT_TABLES = ['sbc_customers', 'sbc_orders', 'sbc_renewals'];

async function auditDatabase(db) {
  if (!db || typeof db.query !== 'function') throw new TypeError('A mysql2-compatible query connection is required.');

  const [contextRows] = await db.query('SELECT DATABASE() AS selected_database, NOW() AS checked_at');
  const database = contextRows && contextRows[0] ? contextRows[0] : {};
  if (!database.selected_database) throw new Error('No database selected; refusing to continue.');

  const placeholders = TABLES.map(() => '?').join(', ');
  const [tableRows] = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${placeholders}) ORDER BY table_name`,
    TABLES
  );
  const present = new Set((tableRows || []).map(row => String(row.table_name)));
  const results = {
    audit_version: '1.0.0',
    database: database.selected_database,
    checked_at: database.checked_at,
    table_counts: {},
    tenant_distribution: {},
    status_distribution: {},
    duplicate_idempotency_key_groups: null,
    warnings: []
  };

  for (const table of TABLES) {
    if (!present.has(table)) {
      results.table_counts[table] = null;
      results.warnings.push(`Missing table: ${table}`);
      continue;
    }
    // Identifiers come only from the fixed allowlist above.
    const [countRows] = await db.query(`SELECT COUNT(*) AS row_count FROM ${table}`);
    results.table_counts[table] = Number(countRows?.[0]?.row_count ?? 0);
  }

  const presentCore = CORE_TENANT_TABLES.filter(t => present.has(t));
  if (presentCore.length) {
    const [columns] = await db.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND column_name = 'tenant_id' AND table_name IN (${presentCore.map(() => '?').join(', ')})`,
      presentCore
    );
    const tenantTables = new Set((columns || []).map(row => String(row.table_name)));
    for (const table of presentCore) {
      if (!tenantTables.has(table)) {
        results.warnings.push(`No tenant_id column found: ${table}`);
        continue;
      }
      const [rows] = await db.query(`SELECT CAST(tenant_id AS CHAR) AS tenant_id, COUNT(*) AS row_count FROM ${table} GROUP BY tenant_id ORDER BY tenant_id`);
      results.tenant_distribution[table] = rows.map(row => ({
        tenant_id: row.tenant_id === null ? null : String(row.tenant_id),
        row_count: Number(row.row_count)
      }));
    }
  }

  const presentStatus = STATUS_TABLES.filter(t => present.has(t));
  if (presentStatus.length) {
    const [columns] = await db.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND column_name = 'status' AND table_name IN (${presentStatus.map(() => '?').join(', ')})`,
      presentStatus
    );
    const statusTables = new Set((columns || []).map(row => String(row.table_name)));
    for (const table of presentStatus) {
      if (!statusTables.has(table)) {
        results.warnings.push(`No status column found: ${table}`);
        continue;
      }
      const [rows] = await db.query(`SELECT CAST(status AS CHAR) AS state, COUNT(*) AS row_count FROM ${table} GROUP BY status ORDER BY state`);
      results.status_distribution[table] = rows.map(row => ({
        state: row.state === null ? null : String(row.state),
        row_count: Number(row.row_count)
      }));
    }
  }

  if (present.has('sbc_checkout_event_ledger')) {
    const [columns] = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sbc_checkout_event_ledger' AND column_name = 'idempotency_key'"
    );
    if ((columns || []).length) {
      const [duplicates] = await db.query(
        'SELECT COUNT(*) AS duplicate_groups FROM (SELECT idempotency_key FROM sbc_checkout_event_ledger GROUP BY idempotency_key HAVING COUNT(*) > 1) AS duplicate_keys'
      );
      results.duplicate_idempotency_key_groups = Number(duplicates?.[0]?.duplicate_groups ?? 0);
    } else {
      results.warnings.push('No idempotency_key column found: sbc_checkout_event_ledger');
    }
  }


  // V66 incident evidence: aggregate orders by timestamp and origin, never return customer/order rows.
  // Only identifiers discovered in information_schema and the literal allowlist are interpolated.
  results.order_incident = { hourly: [], source: [], status: [], duplicate_idempotency_groups: null, warnings: [] };
  if (present.has('sbc_orders')) {
    const allowed=['created_at','createdAt','created_on','source','status','idempotency_key'];
    const [orderColumns] = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'sbc_orders' AND column_name IN (${allowed.map(() => '?').join(', ')})`, allowed);
    const available=new Set((orderColumns||[]).map(v=>String(v.column_name)));
    const stamp=['created_at','createdAt','created_on'].find(key=>available.has(key));
    if (stamp) {
      const [hourly] = await db.query(
        `SELECT DATE_FORMAT(${stamp}, '%Y-%m-%d %H:00') AS hour_bucket, COUNT(*) AS row_count FROM sbc_orders WHERE ${stamp} >= NOW() - INTERVAL 72 HOUR GROUP BY hour_bucket ORDER BY hour_bucket DESC LIMIT 72`);
      results.order_incident.hourly=(hourly||[]).map(row=>({hour:row.hour_bucket===null?null:String(row.hour_bucket),count:Number(row.row_count)}));
    } else results.order_incident.warnings.push('No known creation timestamp column on sbc_orders; cannot establish when rows were created.');
    for(const key of ['source','status']){
      if(!available.has(key)){results.order_incident.warnings.push('No '+key+' column on sbc_orders');continue;}
      const [groups] = await db.query(`SELECT CAST(${key} AS CHAR) AS group_name, COUNT(*) AS row_count FROM sbc_orders GROUP BY ${key} ORDER BY row_count DESC LIMIT 50`);
      results.order_incident[key]=(groups||[]).map(row=>({value:row.group_name===null?null:String(row.group_name).slice(0,80),count:Number(row.row_count)}));
    }
    if(available.has('idempotency_key')){
      const [groups]=await db.query('SELECT COUNT(*) AS duplicate_groups FROM (SELECT idempotency_key FROM sbc_orders WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key HAVING COUNT(*) > 1) AS duplicate_order_keys');
      results.order_incident.duplicate_idempotency_groups=Number(groups?.[0]?.duplicate_groups??0);
    }
  }

  results.safety = {
    query_mode: 'SELECT-only',
    customer_level_data_returned: false,
    data_changed: false,
    recovery_gate_changed: false
  };
  return results;
}

async function main() {
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    process.stderr.write(`SBC DB audit not run; missing environment variables: ${missing.join(', ')}\\n`);
    process.exitCode = 2;
    return;
  }
  const mysql = require('mysql2/promise');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectTimeout: 10000,
    enableKeepAlive: false,
    multipleStatements: false
  });
  try {
    const report = await auditDatabase(connection);
    process.stdout.write(JSON.stringify(report, null, 2) + '\\n');
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`SBC DB audit failed safely: ${error.message}\\n`);
    process.exitCode = 1;
  });
}
module.exports = { auditDatabase, TABLES };
