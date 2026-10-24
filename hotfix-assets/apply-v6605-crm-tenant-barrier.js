'use strict';
// P1: remove tenant-blind in-memory Customer 360 lookups.
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_V6605_CRM_TENANT_BARRIER';
function replaceExactly(source, before, after, expected, name) {
  const count = source.split(before).length - 1;
  if (count !== expected) throw new Error(`${MARKER}: ${name}: expected ${expected} anchors; found ${count}`);
  return source.split(before).join(after);
}
function apply(root) {
  const file = path.join(root, 'routes', 'crm.js');
  const original = fs.readFileSync(file, 'utf8');
  if (original.includes(MARKER)) return { marker: MARKER, changed: false };
  let source = replaceExactly(original,
    "const { createCustomerRepository, positiveTenantId } = require('../enterprise/repositories/customer-repository.cjs');",
    `const { createCustomerRepository, positiveTenantId } = require('../enterprise/repositories/customer-repository.cjs');
const { requireTenantContext } = require('../enterprise/tenant-context.cjs');
// ${MARKER}: authenticated AsyncLocalStorage is the only tenant authority.
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
}`,
    1, 'repository import');
  source = replaceExactly(source, 'const tenant = RAILS.tenantIdForRequest(req);', 'const tenant = tenantForRead(req);', 2, 'CRM read tenant');
  source = replaceExactly(source, 'RAILS.customer360(ctx.db, req.params.id)', 'tenantBoundCustomer360(ctx.db, req.params.id, tenant)', 2, 'memory lookup');
  source = replaceExactly(source, "        'strict'\n", "        tenant, 'strict'\n", 4, 'relational tenant query');
  source = replaceExactly(source,
    'res.status(400).json({ ok: false, error: e.message });',
    "res.status(['TENANT_CONTEXT_MISSING','VALID_TENANT_CONTEXT_REQUIRED','TENANT_DATABASE_ID_INVALID','TENANT_CONTEXT_MISMATCH'].includes(e?.code) ? 403 : 400).json({ ok: false, error: 'Customer access could not be verified.' });",
    1, 'memory read fail closed');
  source = replaceExactly(source,
    "res.status(400).json({ ok: false, error: 'CUSTOMER_360_READ_FAILED' });",
    "res.status(['TENANT_CONTEXT_MISSING','VALID_TENANT_CONTEXT_REQUIRED','TENANT_DATABASE_ID_INVALID','TENANT_CONTEXT_MISMATCH'].includes(e?.code) ? 403 : 503).json({ ok: false, error: 'CUSTOMER_360_READ_FAILED' });",
    1, 'relational read fail closed');
  fs.writeFileSync(file, source);
  const testFile = path.join(root,'scripts','v6605-crm-tenant-barrier-test.js');
  fs.mkdirSync(path.dirname(testFile),{recursive:true});
  fs.copyFileSync(path.join(__dirname,'v6605-crm-tenant-barrier-test.js'),testFile);
  return { marker: MARKER, changed: true };
}
module.exports = { apply, MARKER };
