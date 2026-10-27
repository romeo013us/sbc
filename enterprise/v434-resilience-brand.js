'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const RESILIENCE_FILE = path.join(ROOT, 'data', 'v434-resilience-suite.json');
const BRAND_FILE = path.join(ROOT, 'data', 'v434-brand-intelligence.json');
const AUDIT_FILE = path.join(ROOT, 'data', 'v434-audit-chain.jsonl');

const RESILIENCE = JSON.parse(fs.readFileSync(RESILIENCE_FILE, 'utf8'));
const BRAND = JSON.parse(fs.readFileSync(BRAND_FILE, 'utf8'));

const now = () => new Date().toISOString();
const clean = (v, n = 2000) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);

function envTrue(v) {
  return String(v || '').toLowerCase() === 'true' || String(v || '') === '1';
}

function architectureConfigured(env) {
  return Boolean(
    env?.SBC_GLOBAL_ROUTER_URL ||
    env?.SBC_DB_GLOBAL_ENDPOINT ||
    env?.SBC_ORCHESTRATION ||
    env?.SBC_API_GATEWAY_URL ||
    env?.SBC_MULTI_REGION
  );
}

function providerConfigured(env) {
  return Boolean(
    env?.SQUARE_ACCESS_TOKEN ||
    env?.TWILIO_AUTH_TOKEN ||
    env?.GODADDY_PAT ||
    env?.FOUROVER4_API_KEY ||
    env?.VISTAPRINT_API_KEY ||
    env?.REDIS_URL ||
    env?.AMQP_URL ||
    env?.OTEL_EXPORTER_OTLP_ENDPOINT
  );
}

function statusFor(item, env) {
  if (item.mode === 'architecture-gated') {
    return architectureConfigured(env) ? 'CONFIGURED' : 'HOST-GATED';
  }
  if (item.mode === 'provider-gated') {
    return providerConfigured(env) ? 'INTEGRATION-READY' : 'PROVIDER-GATED';
  }
  return 'READY';
}

function counts(db) {
  const arr = (k) => Array.isArray(db?.[k]) ? db[k].length : 0;
  return {
    customers: arr('customers'),
    leads: arr('leads') || arr('crm'),
    orders: arr('orders'),
    tasks: arr('tasks'),
    users: arr('users'),
    callReports: arr('callReports')
  };
}

function readiness(db, env = process.env) {
  const all = [...RESILIENCE.items, ...BRAND.items];
  const statuses = all.reduce((m, item) => {
    const s = statusFor(item, env);
    m[s] = (m[s] || 0) + 1;
    return m;
  }, {});
  return {
    ok: true,
    version: '43.4.1',
    suite: 'SBC Resilience + Brand Intelligence',
    counts: {
      resilience: RESILIENCE.items.length,
      brand: BRAND.items.length,
      total: all.length,
      records: counts(db)
    },
    statuses,
    hosting: {
      provider: 'GoDaddy/cPanel/Airo compatible',
      singleHostSafeMode: !architectureConfigured(env),
      externalInfrastructureIsOptIn: true
    },
    safety: {
      defaultActionsMutateBusinessRecords: false,
      destructiveActions: 'owner-gated',
      providerWrites: 'credential-gated',
      architectureActivation: 'explicit-environment-gated'
    }
  };
}

function catalog() {
  return {
    version: '43.4.1',
    resilience: RESILIENCE.items,
    brand: BRAND.items
  };
}

function safeCheck(featureId, db, env = process.env, user = {}) {
  const all = [...RESILIENCE.items, ...BRAND.items];
  const item = all.find(x => x.id === String(featureId));
  if (!item) throw new Error('Unknown V43.4 capability.');

  const status = statusFor(item, env);
  const c = counts(db);
  let detail = 'Safe readiness check completed. No customer, lead, order, payment or fulfillment record was changed.';

  if (item.name.includes('Webhook Signature')) {
    detail = 'Webhook verification utility is available locally; a provider signature secret must be configured before live verification is enabled.';
  } else if (item.name.includes('Rate Throttle')) {
    detail = 'Local token-bucket throttle is available for bounded outbound work; provider limits remain integration-specific.';
  } else if (item.name.includes('Graceful Code Execution Shutdown')) {
    detail = 'Graceful shutdown/drain support is active in the Node runtime and remains compatible with GoDaddy single-process hosting.';
  } else if (item.name.includes('Regression Test Harness')) {
    detail = 'Static syntax, package-integrity and V43.4 unit tests can run without touching production records.';
  } else if (item.name.includes('Tenant') || item.name.includes('Multi-Tenant')) {
    detail = `Tenant isolation check sees ${c.customers} customer records in the current workspace and uses the authenticated tenant context before protected operations.`;
  } else if (item.name.includes('Audit')) {
    detail = 'Append-only hash-chain audit storage is available locally; existing business audit data is not rewritten.';
  } else if (item.name.includes('Brand') || item.name.includes('Founder') || item.name.includes('Customer Victory') || item.name.includes('Story') || item.name.includes('Reputation')) {
    detail = 'Brand intelligence check uses verified operational facts and approval gates; it does not fabricate reviews, outcomes, customers or credentials.';
  } else if (item.mode === 'architecture-gated') {
    detail = 'Capability is modeled and guarded, but not falsely activated on the current single-host GoDaddy runtime. Configure the required external infrastructure to enable it.';
  } else if (item.mode === 'provider-gated') {
    detail = status === 'INTEGRATION-READY'
      ? 'Required integration capability is detected; live vendor writes remain credential and endpoint gated.'
      : 'Provider-dependent capability is staged safely and remains inactive until the required provider configuration is present.';
  }

  return {
    ok: true,
    version: '43.4.1',
    feature: item,
    status,
    detail,
    actor: clean(user.name || user.username || 'authenticated-user', 120),
    checkedAt: now(),
    recordCounts: c
  };
}

/* ---------- Safe primitives ---------- */

function sanitizeValue(value, depth = 0) {
  if (depth > 6) return '[depth-limit]';
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/\bon\w+\s*=/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/\0/g, '')
      .trim()
      .slice(0, 10000);
  }
  if (Array.isArray(value)) return value.slice(0, 200).map(v => sanitizeValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 200)) {
      out[String(k).slice(0, 200)] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

function maskSensitive(value) {
  const keys = /password|secret|token|authorization|api[_-]?key|private[_-]?key|ssn|card|cvv|bank/i;
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = keys.test(k) ? '[REDACTED]' : maskSensitive(v);
  }
  return out;
}

function tenantGuard(userTenantId, recordTenantId) {
  if (!userTenantId) return { ok: false, reason: 'missing-tenant-context' };
  if (!recordTenantId) return { ok: true, reason: 'legacy-record-without-tenant-marker' };
  return String(userTenantId) === String(recordTenantId)
    ? { ok: true, reason: 'tenant-match' }
    : { ok: false, reason: 'tenant-mismatch' };
}

function verifyHmac(rawBody, signature, secret, algorithm = 'sha256') {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac(algorithm, String(secret)).update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody))).digest('hex');
  const supplied = String(signature).replace(/^sha256=/i, '').trim();
  try {
    return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  } catch {
    return false;
  }
}

function issueOneTimeToken(payload, secret, ttlMs = 10 * 60 * 1000) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs, nonce: crypto.randomUUID() })).toString('base64url');
  const sig = crypto.createHmac('sha256', String(secret || '')).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyOneTimeToken(token, secret) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', String(secret || '')).update(body).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > Number(parsed.exp)) return null;
    return parsed;
  } catch {
    return null;
  }
}

class CircuitBreaker {
  constructor({ failureThreshold = 3, resetMs = 30000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.resetMs = resetMs;
    this.failures = 0;
    this.openedAt = 0;
  }
  state() {
    if (this.openedAt && Date.now() - this.openedAt >= this.resetMs) return 'HALF_OPEN';
    return this.openedAt ? 'OPEN' : 'CLOSED';
  }
  async run(fn) {
    const s = this.state();
    if (s === 'OPEN') throw new Error('Circuit breaker is open.');
    try {
      const result = await fn();
      this.failures = 0;
      this.openedAt = 0;
      return result;
    } catch (e) {
      this.failures += 1;
      if (this.failures >= this.failureThreshold) this.openedAt = Date.now();
      throw e;
    }
  }
}

class TokenBucket {
  constructor({ capacity = 10, refillPerSecond = 2 } = {}) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSecond = refillPerSecond;
    this.updatedAt = Date.now();
  }
  take(cost = 1) {
    const nowMs = Date.now();
    const elapsed = Math.max(0, (nowMs - this.updatedAt) / 1000);
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.updatedAt = nowMs;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

function appendAudit(event, actor = 'system') {
  const record = {
    ts: now(),
    actor: clean(actor, 120),
    event: clean(event?.type || 'event', 120),
    data: maskSensitive(sanitizeValue(event?.data || {}))
  };
  let previous = '';
  try {
    const lines = fs.existsSync(AUDIT_FILE) ? fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').filter(Boolean) : [];
    if (lines.length) previous = JSON.parse(lines[lines.length - 1]).hash || '';
  } catch {}
  record.previous = previous;
  const canonical = JSON.stringify(record);
  record.hash = crypto.createHash('sha256').update(canonical).digest('hex');
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(record) + '\n', { encoding: 'utf8' });
  return record;
}

function verifyAuditChain() {
  if (!fs.existsSync(AUDIT_FILE)) return { ok: true, entries: 0, intact: true };
  const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean);
  let previous = '';
  for (let i = 0; i < lines.length; i++) {
    const row = JSON.parse(lines[i]);
    const { hash, ...rest } = row;
    if (rest.previous !== previous) return { ok: true, entries: lines.length, intact: false, failedAt: i };
    const expected = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
    if (expected !== hash) return { ok: true, entries: lines.length, intact: false, failedAt: i };
    previous = hash;
  }
  return { ok: true, entries: lines.length, intact: true };
}

function runtimeSnapshot() {
  const mem = process.memoryUsage();
  return {
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    loadAverage: os.loadavg ? os.loadavg() : [],
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external
    }
  };
}

function resourceGuard({ maxHeapUsedMb = 512 } = {}) {
  const heapUsedMb = process.memoryUsage().heapUsed / 1024 / 1024;
  return { ok: heapUsedMb <= maxHeapUsedMb, heapUsedMb: Number(heapUsedMb.toFixed(1)), maxHeapUsedMb };
}

module.exports = {
  RESILIENCE,
  BRAND,
  readiness,
  catalog,
  safeCheck,
  sanitizeValue,
  maskSensitive,
  tenantGuard,
  verifyHmac,
  issueOneTimeToken,
  verifyOneTimeToken,
  CircuitBreaker,
  TokenBucket,
  appendAudit,
  verifyAuditChain,
  runtimeSnapshot,
  resourceGuard
};
