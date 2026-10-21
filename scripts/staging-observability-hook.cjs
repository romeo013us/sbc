'use strict';

/**
 * SBC staging-only observability helpers.
 *
 * This module is deliberately NOT imported by bootstrap.js or server.js.
 * Call installTimerAudit() before application modules are loaded in an isolated
 * test/staging process, and call observePool(pool) only for a staging pool.
 *
 * Safety contract:
 * - Requires SBC_STAGING_DIAGNOSTICS=1.
 * - Refuses NODE_ENV=production.
 * - Never logs SQL text, credentials, tenant IDs, request headers, or payloads.
 * - Does not change query results, retry behavior, lease state, or recovery gates.
 */
const { performance } = require('node:perf_hooks');

function assertStagingOptIn() {
  if (process.env.SBC_STAGING_DIAGNOSTICS !== '1') {
    throw new Error('[SBC STAGING OBSERVABILITY] Refusing to start: set SBC_STAGING_DIAGNOSTICS=1 explicitly.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[SBC STAGING OBSERVABILITY] Refusing NODE_ENV=production.');
  }
}

function emit(event, fields = {}) {
  // Keep emitted fields intentionally allow-listed and free of request/query data.
  console.log('[SBC_STAGING_OBSERVABILITY] ' + JSON.stringify({
    at: new Date().toISOString(),
    event,
    pid: process.pid,
    ...fields
  }));
}

function installTimerAudit({ sampleEveryMs = 60000 } = {}) {
  assertStagingOptIn();
  if (globalThis.__sbcStagingTimerAuditInstalled) {
    return { installed: false, reason: 'already-installed' };
  }
  globalThis.__sbcStagingTimerAuditInstalled = true;

  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  const originalClearInterval = global.clearInterval;
  const originalClearTimeout = global.clearTimeout;
  const timers = new Map();
  let nextId = 1;

  function register(kind, original, callback, delay, args) {
    const id = nextId++;
    const stack = new Error('timer registration').stack
      .split('\n').slice(2, 8).join('\n');
    const entry = {
      id,
      kind,
      delayMs: Number.isFinite(Number(delay)) ? Number(delay) : null,
      registeredAt: new Date().toISOString(),
      stack
    };
    const wrapped = typeof callback === 'function'
      ? function (...callbackArgs) {
          entry.lastFiredAt = new Date().toISOString();
          entry.fireCount = (entry.fireCount || 0) + 1;
          return callback.apply(this, callbackArgs);
        }
      : callback;
    const handle = original(wrapped, delay, ...args);
    timers.set(handle, entry);
    return handle;
  }

  global.setInterval = function (callback, delay, ...args) {
    return register('interval', originalSetInterval, callback, delay, args);
  };
  global.setTimeout = function (callback, delay, ...args) {
    return register('timeout', originalSetTimeout, callback, delay, args);
  };
  global.clearInterval = function (handle) {
    timers.delete(handle);
    return originalClearInterval(handle);
  };
  global.clearTimeout = function (handle) {
    timers.delete(handle);
    return originalClearTimeout(handle);
  };

  const snapshot = () => {
    const active = [...timers.values()].map(({ stack, ...safe }) => safe);
    emit('timer_snapshot', {
      activeTrackedTimers: active.length,
      intervals: active.filter(t => t.kind === 'interval').length,
      timeouts: active.filter(t => t.kind === 'timeout').length,
      registrations: active
    });
  };
  const reportHandle = originalSetInterval(snapshot, sampleEveryMs);
  emit('timer_audit_installed', { sampleEveryMs });

  return {
    installed: true,
    snapshot,
    restore() {
      global.setInterval = originalSetInterval;
      global.setTimeout = originalSetTimeout;
      global.clearInterval = originalClearInterval;
      global.clearTimeout = originalClearTimeout;
      originalClearInterval(reportHandle);
      timers.clear();
      delete globalThis.__sbcStagingTimerAuditInstalled;
      emit('timer_audit_restored');
    }
  };
}

function observePool(pool, { slowAcquireMs = 100, slowQueryMs = 500 } = {}) {
  assertStagingOptIn();
  if (!pool || typeof pool.getConnection !== 'function') {
    throw new TypeError('observePool requires a mysql2 pool with getConnection().');
  }
  if (pool.__sbcStagingPoolObserved) {
    return { installed: false, reason: 'already-installed' };
  }
  Object.defineProperty(pool, '__sbcStagingPoolObserved', { value: true });

  const originalGetConnection = pool.getConnection.bind(pool);
  pool.getConnection = function (...args) {
    const started = performance.now();
    return originalGetConnection(...args).then(connection => {
      const durationMs = Math.round((performance.now() - started) * 100) / 100;
      emit('pool_acquire', {
        durationMs,
        slow: durationMs >= slowAcquireMs,
        outcome: 'acquired'
      });
      return connection;
    }, error => {
      const durationMs = Math.round((performance.now() - started) * 100) / 100;
      emit('pool_acquire', {
        durationMs,
        slow: durationMs >= slowAcquireMs,
        outcome: 'error',
        errorCode: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
      });
      throw error;
    });
  };

  // This wrapper observes completion duration only. It never records SQL text or values.
  if (typeof pool.query === 'function') {
    const originalQuery = pool.query.bind(pool);
    pool.query = function (...args) {
      const started = performance.now();
      const result = originalQuery(...args);
      if (result && typeof result.then === 'function') {
        return result.then(value => {
          const durationMs = Math.round((performance.now() - started) * 100) / 100;
          if (durationMs >= slowQueryMs) emit('pool_query_slow', { durationMs, outcome: 'success' });
          return value;
        }, error => {
          const durationMs = Math.round((performance.now() - started) * 100) / 100;
          emit('pool_query_slow', {
            durationMs,
            outcome: 'error',
            errorCode: typeof error?.code === 'string' ? error.code : 'UNKNOWN'
          });
          throw error;
        });
      }
      return result;
    };
  }

  emit('pool_observer_installed', { slowAcquireMs, slowQueryMs });
  return { installed: true };
}

function recordTenantContextRejection({ operation = 'unknown', origin = 'unknown' } = {}) {
  assertStagingOptIn();
  emit('tenant_context_rejection', {
    operation: String(operation).slice(0, 80),
    origin: String(origin).slice(0, 120)
  });
}

module.exports = { installTimerAudit, observePool, recordTenantContextRejection };
