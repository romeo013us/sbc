'use strict';

// V65.1.34: tenantless background work must fail closed without taking down
// the HTTP process. Preserve the existing fail-fast handler for every other error.
const MARKER = 'SBC_V65134_TENANT_REJECTION_GUARD';

function isMissingTenantContext(reason) {
  const code = reason && typeof reason === 'object' ? String(reason.code || '') : '';
  const message = reason && typeof reason === 'object' ? String(reason.message || '') : String(reason || '');
  return code === 'TENANT_CONTEXT_REQUIRED' || /\bTENANT_CONTEXT_REQUIRED\b/.test(message);
}

function installTenantRejectionGuard(proc = process, logger = console) {
  if (proc[MARKER]) return false;
  const originalOn = proc.on;
  const logged = new WeakSet();
  proc.on = function sbcGuardedOn(eventName, listener) {
    if (eventName !== 'unhandledRejection' || typeof listener !== 'function') {
      return originalOn.call(this, eventName, listener);
    }
    const wrapped = function sbcTenantContextFailClosed(reason, promise) {
      if (isMissingTenantContext(reason)) {
        if (reason && typeof reason === 'object') {
          if (!logged.has(reason)) {
            logged.add(reason);
            logger.error('[SBC TENANT CONTEXT GUARD] Tenant-dependent background operation rejected without tenant context; operation failed closed. No tenantless action was authorized. Stack:', reason.stack || String(reason));
          }
        } else {
          logger.error('[SBC TENANT CONTEXT GUARD] Tenant-dependent background operation rejected without tenant context; operation failed closed:', String(reason));
        }
        return;
      }
      return listener.call(this, reason, promise);
    };
    return originalOn.call(this, eventName, wrapped);
  };
  Object.defineProperty(proc, MARKER, { value: true, configurable: false, enumerable: false });
  return true;
}

module.exports = { installTenantRejectionGuard, isMissingTenantContext, MARKER };
