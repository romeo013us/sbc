'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
const crypto = require('node:crypto');
const storage = new AsyncLocalStorage();
const TENANT_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
function normalizeTenantId(value) {
  const id = String(value ?? '').trim();
  if (!TENANT_ID.test(id)) throw Object.assign(new Error('VALID_TENANT_CONTEXT_REQUIRED'), { code: 'VALID_TENANT_CONTEXT_REQUIRED' });
  return id;
}
function runWithTenantContext({ tenantId, actorId, role, requestId, source = 'authenticated-session' }, callback) {
  if (typeof callback !== 'function') throw new TypeError('tenant context callback required');
  const context = Object.freeze({
    tenantId: normalizeTenantId(tenantId),
    actorId: String(actorId ?? '').trim() || 'unknown',
    role: String(role ?? '').trim() || 'unknown',
    requestId: String(requestId ?? '').trim() || crypto.randomUUID(),
    source: String(source),
    startedAt: new Date().toISOString()
  });
  return storage.run(context, callback);
}
function currentTenantContext() { return storage.getStore() || null; }
function requireTenantContext() {
  const context = currentTenantContext();
  if (!context?.tenantId) throw Object.assign(new Error('TENANT_CONTEXT_MISSING'), { code: 'TENANT_CONTEXT_MISSING' });
  return context;
}
// Resolver MUST derive identity from the authenticated server-side session/token; never trust raw tenant headers.
function createTenantContextMiddleware({ resolveTenantContext } = {}) {
  if (typeof resolveTenantContext !== 'function') throw new TypeError('resolveTenantContext must be supplied by the authenticated application');
  return function tenantContextMiddleware(req, res, next) {
    Promise.resolve().then(() => resolveTenantContext(req)).then(identity => {
      if (!identity || !identity.tenantId) return res.status(403).json({ ok: false, error: 'TENANT_CONTEXT_REQUIRED' });
      return runWithTenantContext({ ...identity, requestId: req.requestId || identity.requestId }, () => next());
    }).catch(error => {
      if (res.headersSent) return;
      if (error?.code === 'VALID_TENANT_CONTEXT_REQUIRED') return res.status(403).json({ ok: false, error: error.code });
      return next(error);
    });
  };
}
module.exports = { normalizeTenantId, runWithTenantContext, currentTenantContext, requireTenantContext, createTenantContextMiddleware };
