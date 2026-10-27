'use strict';
const RAILS = require('../enterprise/v566-scale-revenue-rails');
const { createCustomerRepository, positiveTenantId } = require('../enterprise/repositories/customer-repository.cjs');
const { requireTenantContext } = require('../enterprise/tenant-context.cjs');
const { revisionOfLead } = require('../enterprise/crm-revision-v6607.cjs');
// SBC_V6605_CRM_TENANT_BARRIER: authenticated AsyncLocalStorage is the only tenant authority.
function tenantForRead(req) {
  const tenant = positiveTenantId(requireTenantContext().tenantId);
  for (const supplied of [req?.tenantId, req?.user?.tenantId]) {
    if (supplied !== undefined && supplied !== null && positiveTenantId(supplied) !== tenant) {
      throw Object.assign(new Error('Tenant mismatch'), { code: 'TENANT_CONTEXT_MISMATCH' });
    }
  }
  return tenant;
}
function tenantBoundCustomer360(db, customerId, tenant) {
  const allowed = row => row && positiveTenantIdOrZero(row.tenantId ?? row.tenant_id) === tenant;
  const customers = Array.isArray(db?.customers) ? db.customers.filter(allowed) : [];
  if (!customers.some(row => String(row.id) === String(customerId))) return null;
  const scoped = { customers };
  for (const key of ['quotes', 'orders', 'renewals', 'activities', 'tasks']) {
    scoped[key] = Array.isArray(db?.[key]) ? db[key].filter(allowed) : [];
  }
  return RAILS.customer360(scoped, customerId);
}
function positiveTenantIdOrZero(input) {
  try { return positiveTenantId(input); } catch (_) { return 0; }
}

module.exports = function registerCRM(app, { auth, getContext }) {
  app.get('/api/v566/crm/customer-360/:id', auth, async (req, res) => {
    try {
      const ctx = getContext();
      const tenant = tenantForRead(req);
      const data = tenantBoundCustomer360(ctx.db, req.params.id, tenant);
      if (!data) return res.status(404).json({ ok: false, error: 'Customer not found.' });
      res.json({ ok: true, version: RAILS.VERSION, tenantId: tenant, data });
    } catch (e) {
      res.status(['TENANT_CONTEXT_MISSING','VALID_TENANT_CONTEXT_REQUIRED','TENANT_DATABASE_ID_INVALID','TENANT_CONTEXT_MISMATCH'].includes(e?.code) ? 403 : 400).json({ ok: false, error: 'Customer access could not be verified.' });
    }
  });

  app.get('/api/v566/crm/customer-360-relational/:id', auth, async (req, res) => {
    try {
      const ctx = getContext();
      const tenant = tenantForRead(req);

      if (!ctx.mysqlPool) {
        return res.json({
          ok: true,
          version: RAILS.VERSION,
          mode: 'memory-fallback',
          data: tenantBoundCustomer360(ctx.db, req.params.id, tenant)
        });
      }

      const [customers] = await RAILS.tenantQuery(
        ctx.mysqlPool,
        'SELECT id,business_name,contact_name,phone,email,status,source,website,industry,created_at,updated_at FROM sbc_customers WHERE id=? AND tenant_id=? LIMIT 1',
        [req.params.id, tenant],
        tenant, 'strict'
      );
      if (!customers[0]) return res.status(404).json({ ok: false, error: 'Customer not found.' });

      const [quotes] = await RAILS.tenantQuery(
        ctx.mysqlPool,
        'SELECT id,quote_number,status,total,created_at,updated_at FROM sbc_quotes WHERE customer_id=? AND tenant_id=? ORDER BY updated_at DESC',
        [req.params.id, tenant],
        tenant, 'strict'
      );

      const [orders] = await RAILS.tenantQuery(
        ctx.mysqlPool,
        'SELECT id,product,status,price,created_at,updated_at FROM sbc_orders WHERE customer_id=? AND tenant_id=? ORDER BY updated_at DESC',
        [req.params.id, tenant],
        tenant, 'strict'
      );

      let activities = [];
      try {
        const [rows] = await RAILS.tenantQuery(
          ctx.mysqlPool,
          "SELECT id,activity_type,message,created_at FROM sbc_activities WHERE tenant_id=? AND JSON_EXTRACT(meta_json, '$.customerId') = JSON_QUOTE(?) ORDER BY created_at DESC LIMIT 200",
          [tenant, req.params.id],
          tenant, 'strict'
        );
        activities = rows;
      } catch (_) {
        activities = [];
      }

      const lifetimeValue = orders
        .filter(x => ['Paid', 'Completed', 'Fulfilled', 'Won'].includes(String(x.status)))
        .reduce((sum, x) => sum + Number(x.price || 0), 0);

      res.json({
        ok: true,
        version: RAILS.VERSION,
        tenantId: tenant,
        data: { customer: customers[0], quotes, orders, activities, lifetimeValue }
      });
    } catch (e) {
      res.status(['TENANT_CONTEXT_MISSING','VALID_TENANT_CONTEXT_REQUIRED','TENANT_DATABASE_ID_INVALID','TENANT_CONTEXT_MISMATCH'].includes(e?.code) ? 403 : 503).json({ ok: false, error: 'CUSTOMER_360_READ_FAILED' });
    }
  });

  // V65.1.10 — Rebuilt Lead Workspace API. Reads remain tenant-scoped; writes are
  // direct, parameterized MySQL operations and fail closed while recovery is active.
  // Tenant identity is read only from the authenticated AsyncLocalStorage context in
  // customer-repository.cjs; no caller-supplied tenant header or tenant ID is trusted.
  app.get('/api/v6519/crm/leads', auth, async (req, res) => {
    try {
      const ctx = getContext();
      if (!ctx.mysqlPool) {
        return res.status(503).json({
          ok: false,
          code: 'LEAD_WORKSPACE_DATABASE_UNAVAILABLE',
          error: 'Lead workspace is read-only and requires the authoritative MySQL connection.'
        });
      }
      const limit = Math.max(1, Math.min(100, Math.trunc(Number(req.query.limit) || 50)));
      const offset = Math.max(0, Math.min(1000000, Math.trunc(Number(req.query.offset) || 0)));
      const status = typeof req.query.status === 'string' ? req.query.status.slice(0, 40) : null;
      const repository = createCustomerRepository({ pool: ctx.mysqlPool });
      const rows = await repository.list({ limit, offset, status });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        ok: true,
        version: '65.1.10',
        readOnly: true,
        limit,
        offset,
        returned: rows.length,
        hasMore: rows.length === limit,
        data: rows
      });
    } catch (error) {
      const code = String(error?.code || '');
      const statusCode = code === 'TENANT_CONTEXT_MISSING' || code === 'VALID_TENANT_CONTEXT_REQUIRED' ? 403 : 503;
      return res.status(statusCode).json({
        ok: false,
        code: code || 'LEAD_WORKSPACE_READ_FAILED',
        error: statusCode === 403 ? 'A validated authenticated tenant context is required.' : 'Lead records are temporarily unavailable; no data was changed.'
      });
    }
  });

  app.get('/api/v6519/crm/leads/:id', auth, async (req, res) => {
    try {
      const ctx = getContext();
      if (!ctx.mysqlPool) {
        return res.status(503).json({ ok: false, code: 'LEAD_WORKSPACE_DATABASE_UNAVAILABLE', error: 'Authoritative MySQL is unavailable.' });
      }
      const repository = createCustomerRepository({ pool: ctx.mysqlPool });
      const customer = await repository.findById(req.params.id);
      if (!customer) return res.status(404).json({ ok: false, code: 'LEAD_NOT_FOUND', error: 'Lead not found in the authenticated tenant.' });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ ok: true, version: '65.1.10', readOnly: true, data: { ...customer, revision: revisionOfLead(customer) } });
    } catch (error) {
      const code = String(error?.code || '');
      const statusCode = code === 'TENANT_CONTEXT_MISSING' || code === 'VALID_TENANT_CONTEXT_REQUIRED' ? 403 : 503;
      return res.status(statusCode).json({
        ok: false,
        code: code || 'LEAD_WORKSPACE_READ_FAILED',
        error: statusCode === 403 ? 'A validated authenticated tenant context is required.' : 'Lead record is temporarily unavailable; no data was changed.'
      });
    }
  });

  // V65.1.10 — direct CRM persistence modeled on the V55.18.0 lead-sync fix.
  // The global recovery-write guard runs before this route. This second check is
  // intentionally fail-closed so isolated tests or alternate mounting cannot bypass it.
  app.post('/api/v65110/crm/leads', auth, async (req, res) => {
    const ctx = getContext();
    const recoveryRequired = typeof ctx.recoveryRequired === 'function' ? ctx.recoveryRequired() : true;
    if (recoveryRequired) {
      return res.status(423).json({ ok: false, code: 'MYSQL_RECOVERY_REQUIRED', message: 'Lead writes remain disabled until authoritative database recovery is verified. No data was changed.' });
    }
    const role = String(req.user?.role || '');
    if (!['owner', 'lead_researcher', 'caller'].includes(role)) {
      return res.status(403).json({ ok: false, code: 'LEAD_WRITE_FORBIDDEN', message: 'Your role cannot create CRM leads.' });
    }
    if (!ctx.mysqlPool || typeof ctx.mysqlPool.getConnection !== 'function') {
      return res.status(503).json({ ok: false, code: 'MYSQL_UNAVAILABLE', message: 'Authoritative CRM storage is unavailable. No data was changed.' });
    }

    let conn = null;
    let transactionStarted = false;
    let leadLockHeld = false;
    let leadLockName = null;
    try {
      const tenantId = tenantForRead(req); // SBC_V6609_SAFE_LEAD_CREATE: only server-authenticated AsyncLocalStorage is authoritative.
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const clean = (value, max) => String(value ?? '').trim().slice(0, max);
      const businessName = clean(body.businessName ?? body.business_name ?? body.company, 255);
      if (!businessName) return res.status(400).json({ ok: false, code: 'BUSINESS_NAME_REQUIRED', message: 'Business name is required. No data was changed.' });
      const contactName = clean(body.contactName ?? body.contact_name, 255);
      const email = clean(body.email, 255).toLowerCase();
      const phone = clean(body.phone, 80);
      const website = clean(body.website, 500);
      const address = clean(body.address, 500);
      const industry = clean(body.industry, 120);
      const source = clean(body.source || 'SBC Lead Workspace', 100);
      const notes = clean(body.notes, 4000);
      const assignedTo = clean(body.assignedTo || req.user?.username || req.user?.name || '', 80);
      const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const crypto = require('node:crypto');
      const customerId = `sbc_lead_${crypto.randomUUID().replace(/-/g, '')}`;
      const activityId = `act_${crypto.randomUUID().replace(/-/g, '')}`;
      const leadIntelligence = { verificationStatus: 'Needs Verification', ownerVerified: false, salesReady: false, leadTemperature: '', createdByRole: role };

      conn = await ctx.mysqlPool.getConnection();
      await conn.ping();
      // Connection-scoped MySQL named mutex prevents simultaneous duplicate inserts
      // even when matching email/business/phone has no unique SQL index.
      // Only holds during one tenant's short duplicate-check + insert transaction.
      leadLockName = 'sbc_crm_create_tenant_' + tenantId;
      const [leadLockResult] = await conn.query('SELECT GET_LOCK(?, 6) AS acquired', [leadLockName]);
      if(Number(leadLockResult?.[0]?.acquired)!==1)throw Object.assign(new Error('LEAD_CREATE_BUSY'),{code:'LEAD_CREATE_BUSY'});
      leadLockHeld = true;
      await conn.beginTransaction();
      transactionStarted = true;
      const [duplicates] = await conn.query(
        `SELECT id, business_name FROM sbc_customers
          WHERE tenant_id = ? AND (
            (? <> '' AND LOWER(TRIM(email)) = LOWER(TRIM(?))) OR
            (LOWER(TRIM(business_name)) = LOWER(TRIM(?))) OR
            (? <> '' AND REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '') = ?)
          ) LIMIT 1 FOR UPDATE`,
        [tenantId, email, email, businessName, phone.replace(/[^0-9]/g, ''), phone.replace(/[^0-9]/g, '')]
      );
      if (Array.isArray(duplicates) && duplicates.length) {
        await conn.rollback();
        transactionStarted = false;
        return res.status(409).json({ ok: false, code: 'DUPLICATE_LEAD', duplicateId: String(duplicates[0].id), message: 'A matching lead already exists in this tenant. No new record was created.' });
      }

      await conn.query(
        `INSERT INTO sbc_customers
          (id,business_name,contact_name,phone,email,status,source,follow_up,notes,created_at,updated_at,website,address,industry,deal_value,website_status,assigned_to,account_notes_json,tenant_id,lead_intelligence_json)
         VALUES (?,?,?,?,?,'Lead',?,NULL,?,?,?,?,?,?,0.00,?,?,?,?,?)`,
        [customerId, businessName, contactName, phone, email, source, notes, stamp, stamp, website, address, industry, website ? 'Provided' : 'No Website', assignedTo, JSON.stringify([]), tenantId, JSON.stringify(leadIntelligence)]
      );
      const [verified] = await conn.query(
        'SELECT id,business_name,contact_name,email,phone,status,source,tenant_id FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1',
        [tenantId, customerId]
      );
      if (!Array.isArray(verified) || verified.length !== 1) throw Object.assign(new Error('LEAD_PERSISTENCE_VERIFICATION_FAILED'), { code: 'LEAD_PERSISTENCE_VERIFICATION_FAILED' });
      await conn.query(
        'INSERT INTO sbc_activities (id,activity_type,message,meta_json,created_at,tenant_id) VALUES (?,?,?,?,?,?)',
        [activityId, 'lead_created', `Lead created: ${businessName}`.slice(0, 500), JSON.stringify({ customerId, source, createdBy: String(req.user?.username || req.user?.name || 'authenticated-user'), requestId: String(req.requestId || '') }), stamp, tenantId]
      );
      await conn.commit();
      transactionStarted = false;

      // Refresh this worker's read cache only after the durable transaction succeeds.
      if (ctx.db && Array.isArray(ctx.db.customers) && !ctx.db.customers.some(row => String(row.id) === customerId)) {
        ctx.db.customers.unshift({ id: customerId, businessName, contactName, phone, email, status: 'Lead', source, followUp: '', notes, createdAt: stamp, updatedAt: stamp, website, address, industry, websiteStatus: website ? 'Provided' : 'No Website', assignedTo, tenantId, leadIntelligence });
      }
      if (typeof ctx.audit === 'function') {
        try { ctx.audit(req.user, 'lead_created_direct_mysql', `Created CRM lead ${businessName}`, { customerId, tenantId, source, requestId: req.requestId || null }); } catch (_) {}
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(201).json({ ok: true, version: '65.1.10', durable: true, id: customerId, tenantId, message: 'Lead saved to the authoritative CRM and verified.' });
    } catch (error) {
      if (conn && transactionStarted) { try { await conn.rollback(); } catch (_) {} }
      const code = String(error?.code || '');
      const statusCode = ['VALID_TENANT_CONTEXT_REQUIRED','TENANT_CONTEXT_MISSING','TENANT_CONTEXT_MISMATCH','TENANT_DATABASE_ID_INVALID'].includes(code) ? 403 : code === 'LEAD_CREATE_BUSY' ? 409 : 503;
      return res.status(statusCode).json({ ok: false, code: code || 'LEAD_WRITE_FAILED', message: statusCode === 403 ? 'A valid authenticated tenant context is required. No data was changed.' : 'Lead save could not be verified. The transaction was rolled back where possible; check CRM status before retrying.' });
    } finally {
      // Always relinquish the connection-scoped mutex *before* pool reuse.
      // On failed RELEASE_LOCK destroy the connection so MySQL cannot retain
      // the mutex in a pooled idle connection and stall future lead creation.
      let safeToPool = true;
      if(conn && leadLockHeld){
        try {
          const [released] = await conn.query('SELECT RELEASE_LOCK(?) AS released',[leadLockName]);
          if(Number(released?.[0]?.released)!==1)safeToPool=false;
        }catch(_){safeToPool=false;}
      }
      try {
        if(conn){if(safeToPool)conn.release();else conn.destroy();}
      } catch (_) {}
    }
  });
};
