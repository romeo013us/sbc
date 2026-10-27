// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V46.4 Fortress Runtime
 * Bounded async ingress, HMAC admission control, idempotency, adaptive concurrency,
 * durable event handoff, and automatic encrypted operational snapshots.
 */
const crypto = require('crypto');

function createV464Fortress({ ultra, logger = console } = {}) {
  if (!ultra) throw new Error('V46.4 requires the V46.3 ultra infrastructure layer');
  const seen = new Map();
  const seenTtlMs = Math.max(30000, Number(process.env.SBC_V464_IDEMPOTENCY_TTL_MS || 15 * 60 * 1000));
  const maxSeen = Math.max(1000, Number(process.env.SBC_V464_IDEMPOTENCY_MAX || 20000));
  const maxBodyBytes = Math.max(1024, Number(process.env.SBC_V464_MAX_BODY_BYTES || 1024 * 1024));
  const timestampWindowMs = Math.max(5000, Number(process.env.SBC_V464_HMAC_WINDOW_MS || 5 * 60 * 1000));
  const secretFor = (topic) => {
    const normalized = String(topic || 'unknown').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    return process.env[`SBC_GATEWAY_SECRET_${normalized}`] || process.env.SBC_GATEWAY_SECRET || process.env.SBC_WEBHOOK_SECRET || '';
  };

  function cleanupSeen() {
    const now = Date.now();
    for (const [k, v] of seen) if (v.expiresAt <= now) seen.delete(k);
    while (seen.size > maxSeen) seen.delete(seen.keys().next().value);
  }
  setInterval(cleanupSeen, Math.min(seenTtlMs, 60000)).unref?.();

  function canonicalBody(raw) { return Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw ?? ''), 'utf8'); }

  function verifyIngress({ topic, rawBody, signature, timestamp, idempotencyKey }) {
    const body = canonicalBody(rawBody);
    if (body.length > maxBodyBytes) return { ok: false, status: 413, reason: 'payload-too-large' };
    const secret = secretFor(topic);
    if (!secret) return { ok: false, status: 503, reason: 'gateway-secret-not-configured' };
    const ts = Number(timestamp);
    const timestampMs = String(timestamp).length >= 13 ? ts : ts * 1000;
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > timestampWindowMs) return { ok: false, status: 401, reason: 'stale-or-invalid-timestamp' };
    const supplied = String(signature || '').replace(/^sha256=/i, '').trim();
    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${idempotencyKey}.`).update(body).digest('hex');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return { ok: false, status: 403, reason: 'invalid-signature' };
    return { ok: true };
  }

  function remember(tenantId, topic, key) {
    cleanupSeen();
    const id = `${String(__sbcRequireTenantId(tenantId))}:${String(topic)}:${String(key)}`;
    const existing = seen.get(id);
    if (existing && existing.expiresAt > Date.now()) return { duplicate: true, id };
    seen.set(id, { expiresAt: Date.now() + seenTtlMs });
    return { duplicate: false, id };
  }

  async function admit({ tenantId = 1, topic, rawBody, signature, timestamp, idempotencyKey, meta = {} }) {
    const key = String(idempotencyKey || '').trim();
    if (!key || key.length > 180) return { ok: false, status: 400, reason: 'invalid-idempotency-key' };
    const check = verifyIngress({ topic, rawBody, signature, timestamp, idempotencyKey: key });
    if (!check.ok) return check;
    const idem = remember(tenantId, topic, key);
    if (idem.duplicate) return { ok: true, duplicate: true, accepted: true, requestId: key };

    let body;
    try { body = JSON.parse(canonicalBody(rawBody).toString('utf8') || '{}'); }
    catch { return { ok: false, status: 400, reason: 'invalid-json' }; }

    const resource = ultra.resourcePolicy();
    const dispatchConcurrency = Math.max(1, Math.min(16, resource.recommendedConcurrency));
    const event = { tenantId, topic: String(topic).slice(0, 120), idempotencyKey: key, body, meta, receivedAt: new Date().toISOString(), resourceMode: resource.mode };
    try {
      // Durable handoff is intentionally awaited only for the persistence write;
      // provider/business processing is never performed on the request thread.
      const queued = await ultra.publish('gateway.ingress.v464', event);
      return { ok: true, accepted: true, duplicate: false, backend: queued.backend, requestId: key, dispatchConcurrency };
    } catch (e) {
      seen.delete(`${String(__sbcRequireTenantId(tenantId))}:${String(topic)}:${key}`);
      logger.warn('[V46.4] ingress persistence failed:', e.message);
      return { ok: false, status: 503, reason: 'durable-handoff-unavailable' };
    }
  }

  function adaptivePolicy() {
    const resource = ultra.resourcePolicy();
    return {
      ...resource,
      gatewayMode: resource.mode === 'EMERGENCY' ? 'ADMISSION_THROTTLE' : resource.mode === 'THROTTLE' ? 'BOUNDED' : 'BURST_READY',
      maxIngressBodyBytes: maxBodyBytes,
      hmacWindowMs: timestampWindowMs,
      idempotencyTtlMs: seenTtlMs
    };
  }

  async function startStateSync({ scope = 'operational', getState, intervalMs } = {}) {
    if (typeof getState !== 'function') throw new Error('getState callback is required');
    const every = Math.max(1000, Number(intervalMs || process.env.SBC_V464_STATE_SYNC_MS || ultra.stateIntervalMs || 5000));
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try { await ultra.persistStateSnapshot(scope, await getState()); }
      catch (e) { logger.warn('[V46.4] automatic state snapshot failed:', e.message); }
      finally { busy = false; }
    };
    await tick();
    const timer = setInterval(tick, every); timer.unref?.();
    return { everyMs: every, stop: () => clearInterval(timer) };
  }

  return { verifyIngress, admit, adaptivePolicy, startStateSync, limits: { maxBodyBytes, timestampWindowMs, seenTtlMs, maxSeen } };
}
module.exports = { createV464Fortress };
