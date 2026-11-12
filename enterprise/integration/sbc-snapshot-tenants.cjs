'use strict';

const CORE = ['customers', 'quotes', 'orders', 'renewals'];
const LOCK_BATCH = 250;

function fail(code, table) {
  throw Object.assign(Error(code), { code, table });
}

function tenant(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^[1-9]\d*$/.test(String(value)) ||
      !Number.isSafeInteger(Number(value))) fail('SNAPSHOT_TENANT_INVALID');
  return Number(value);
}

function scopedRows(rows, fallback) {
  const scoped = new Map();
  for (const row of rows || []) {
    const id = typeof row?.id === 'string' || Number.isSafeInteger(row?.id) ? String(row.id) : '';
    if (!id.trim()) fail('SNAPSHOT_ROW_ID_REQUIRED');
    const tenantId = tenant(row.tenantId ?? row.tenant_id ?? fallback(row));
    if (row.tenant_id != null && tenant(row.tenant_id) !== tenantId) fail('SNAPSHOT_TENANT_CONFLICT');
    const previous = scoped.get(id);
    if (previous && previous.tenantId !== tenantId) fail('SNAPSHOT_TENANT_CONFLICT');
    scoped.set(id, { row, id, tenantId });
  }
  return scoped;
}

function prepare(db, defaultTenantId) {
  const owner = tenant(defaultTenantId);
  const customers = scopedRows(db.customers, () => owner);
  const byCustomer = row => customers.get(String(row.customerId ?? ''))?.tenantId ?? owner;
  const orders = scopedRows(db.orders, byCustomer);
  const byOrder = row => orders.get(String(row.orderId ?? ''))?.tenantId ?? byCustomer(row);
  const scope = {
    customers, orders,
    quotes: scopedRows(db.quotes, byCustomer),
    renewals: scopedRows(db.renewals, byCustomer),
    activities: scopedRows((db.activities || []).slice(0, 200), row => byOrder(row.meta || {})),
    jobs: scopedRows((db.megaOpsStore?.fulfillmentJobs || db.settings?.megaOps?.fulfillmentJobs || []).slice(0, 5000), byOrder),
    users: scopedRows((db.users || []).filter(row => String(row.username || '').toLowerCase() !== 'owner' && row.role !== 'demo'), () => owner)
  };
  const sourceCounts = Object.fromEntries(CORE.map(name => [name, [...scope[name].values()]
    .filter(record => record.tenantId === owner && !deleted(record.row.status)).length]));
  return { scope, sourceCounts };
}

function deleted(status) {
  return String(status || '').trim().toLowerCase() === 'deleted';
}

// Reconcile deliberate soft deletes in memory against rows that MySQL still
// counts as visible before the transaction. Persisted tombstones, missing IDs,
// and other tenants never offset the recovery guard.
async function pendingVisibleTombstones(conn, { scope }, defaultTenantId) {
  const owner = tenant(defaultTenantId);
  const counts = Object.fromEntries(CORE.map(name => [name, 0]));
  for (const name of CORE) {
    const ids = [...scope[name].values()]
      .filter(({ row, tenantId }) => tenantId === owner && deleted(row.status))
      .map(({ id }) => id);
    for (let offset = 0; offset < ids.length; offset += LOCK_BATCH) {
      const batch = ids.slice(offset, offset + LOCK_BATCH);
      const [visible] = await conn.query(
        'SELECT id FROM sbc_' + name + " WHERE tenant_id=? AND id IN (?) AND COALESCE(status,'') <> 'Deleted'",
        [owner, batch]
      );
      counts[name] += visible.length;
    }
  }
  return counts;
}

async function persistTable(conn, table, records, columnsFor, { tombstones = false, immutable = ['created_at'] } = {}) {
  const rows = [...records.values()];
  for (let offset = 0; offset < rows.length; offset += LOCK_BATCH) {
    const batch = rows.slice(offset, offset + LOCK_BATCH);
    // The tables and column names come from persist(), never request data.
    // Lock existing PKs and use strict INSERTs for missing rows. A racing
    // insert or alternate unique-key conflict aborts the surrounding transaction.
    const [stored] = await conn.query(
      `SELECT id, tenant_id${tombstones ? ', status' : ''} FROM ${table} WHERE id IN (?) FOR UPDATE`,
      [batch.map(record => record.id)]
    );
    const existing = new Map(stored.map(row => [row.id, row]));
    for (const { id, tenantId, row } of batch) {
      const persisted = existing.get(id);
      if (persisted && tenant(persisted.tenant_id) !== tenantId) fail('SNAPSHOT_TENANT_CONFLICT', table);
      if (tombstones && persisted && deleted(persisted.status)) continue;
      const values = columnsFor(row);
      if (!persisted) {
        const columns = ['id', 'tenant_id', ...Object.keys(values)];
        await conn.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          [id, tenantId, ...Object.values(values)]);
        continue;
      }
      const updates = Object.entries(values).filter(([column]) => !immutable.includes(column) &&
        (column !== 'password_hash' || values.password_hash !== ''));
      await conn.query(`UPDATE ${table} SET ${updates.map(([column]) => `${column}=?`).join(', ')} WHERE id=? AND tenant_id=?`,
        [...updates.map(([, value]) => value), id, tenantId]);
    }
  }
}

async function persist(conn, { scope }, { sqlDate, sqlDateTime, now }) {
  await persistTable(conn, 'sbc_customers', scope.customers, c => ({
    business_name: c.businessName || '', contact_name: c.contactName || '', phone: c.phone || '', email: c.email || '',
    status: c.status || 'Lead', source: c.source || 'Walk-in', follow_up: sqlDate(c.followUp), notes: c.notes || '',
    website: c.website || '', industry: c.industry || '', website_status: c.websiteStatus || '', assigned_to: c.assignedTo || '',
    account_notes_json: JSON.stringify(c.accountNotes || []), lead_intelligence_json: JSON.stringify(c.leadIntelligence || {}),
    created_at: sqlDateTime(c.createdAt), updated_at: sqlDateTime(c.updatedAt)
  }), { tombstones: true });
  await persistTable(conn, 'sbc_quotes', scope.quotes, q => ({
    quote_number: q.quoteNumber, customer_id: q.customerId || '', customer_name: q.customerName || '', status: q.status || 'Draft',
    valid_until: sqlDate(q.validUntil), notes: q.notes || '', items_json: JSON.stringify(q.items || []), subtotal: q.subtotal || 0,
    discount: q.discount || 0, tax_rate: q.taxRate || 0, tax: q.tax || 0, total: q.total || 0, payment_url: q.paymentUrl || '',
    created_at: sqlDateTime(q.createdAt), updated_at: sqlDateTime(q.updatedAt)
  }), { tombstones: true });
  await persistTable(conn, 'sbc_orders', scope.orders, o => ({
    customer_id: o.customerId || '', customer_name: o.customerName || '', product: o.product || '', quantity: o.quantity || 1,
    status: o.status || 'New', fulfillment_status: o.fulfillmentStatus || 'Not Started',
    fulfillment_updated_at: o.fulfillmentUpdatedAt ? sqlDateTime(o.fulfillmentUpdatedAt) : null,
    cost: o.cost || 0, price: o.price || 0, notes: o.notes || '', created_at: sqlDateTime(o.createdAt), updated_at: sqlDateTime(o.updatedAt)
  }), { tombstones: true });
  await persistTable(conn, 'sbc_renewals', scope.renewals, r => ({
    customer_id: r.customerId || '', customer_name: r.customerName || '', service: r.service || '', due_date: sqlDate(r.dueDate),
    amount: r.amount || 0, status: r.status || 'Upcoming', notes: r.notes || '', created_at: sqlDateTime(r.createdAt), updated_at: sqlDateTime(r.updatedAt)
  }), { tombstones: true });
  await persistTable(conn, 'sbc_activities', scope.activities, a => ({
    activity_type: a.type || 'system', message: a.message || '', meta_json: JSON.stringify(a.meta || {}), created_at: sqlDateTime(a.createdAt)
  }), { immutable: [] });
  await persistTable(conn, 'sbc_fulfillment_jobs', scope.jobs, j => {
    j.idempotencyKey ||= `sbc:${j.orderId || 'order'}:${j.itemId || j.id}`;
    return {
    order_id: j.orderId || '', customer_id: j.customerId || '', customer_name: j.customerName || '', item_id: j.itemId || '', product: j.product || '',
    quantity: Number(j.quantity || 1), vendor: j.vendor || 'internal', status: j.status || 'ready', vendor_status: j.vendorStatus || '',
    vendor_order_number: j.vendorOrderNumber || '', tracking_number: j.trackingNumber || '', cost: Number(j.cost || 0), value: Number(j.value || 0),
    requirements_json: JSON.stringify(j.requirements || {}), attempts: Number(j.attempts || 0), last_error: j.lastError || '',
    idempotency_key: j.idempotencyKey,
    claimed_at: j.claimedAt ? sqlDateTime(j.claimedAt) : null, processing_started_at: j.processingStartedAt ? sqlDateTime(j.processingStartedAt) : null,
    lease_until: j.leaseUntil ? sqlDateTime(j.leaseUntil) : null, next_attempt_at: j.nextAttemptAt ? sqlDateTime(j.nextAttemptAt) : null,
    created_at: sqlDateTime(j.createdAt), updated_at: sqlDateTime(j.updatedAt)
    };
  });
  await persistTable(conn, 'sbc_workforce_users', scope.users, u => ({
    username: u.username || '', name: u.name || '', email: u.email || u.profile?.email || '', role: u.role || 'caller',
    active: u.active === false ? 0 : 1, must_change_password: u.mustChangePassword ? 1 : 0, password_hash: u.passwordHash || '',
    expires_at: u.expiresAt || null, created_at: sqlDateTime(u.createdAt || now()), updated_at: sqlDateTime(u.updatedAt || now())
  }), { immutable: ['created_at', 'username'] });
}

module.exports = { prepare, persist, pendingVisibleTombstones };
