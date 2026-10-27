'use strict';
/**
 * SBC V56.6 Scale + Revenue Rails
 * Additive orchestration layer over the proven V56.5 engines.
 *
 * Design rules:
 * - No new GoDaddy secrets.
 * - MySQL tenant isolation is enforced at database-ingress/query boundaries.
 * - Provider submission is fail-closed and uses existing provider adapters only.
 * - Dropzone accepts bounded payloads and hands CSV parsing to the existing worker.
 * - $10k+ execution remains owner-gated.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const V435 = require('./v435-phase2-phase3');
const V562 = require('./v562-tier1-architecture');
const V562NEXT = require('./v562-next-architecture');
const V563 = require('./v563-maturity-layer');
const V565 = require('./v565-operational-hardening');

const VERSION = '56.6.0';
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const DEFAULT_TENANT = 1;
const EDGE_MANIFEST = path.join(__dirname, '..', 'config', 'v566-edge-domain-manifest.json');

const now = () => new Date().toISOString();
const clean = (v, n = 255) => String(v ?? '').trim().slice(0, n);
const stable = v => { if (v === null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`; return `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',')}}`; };
const sha256 = v => crypto.createHash('sha256').update(String(v)).digest('hex');

function tenantIdForRequest(req) {
  const n = Number(req?.tenantId ?? req?.user?.tenantId ?? req?.session?.tenantId ?? DEFAULT_TENANT);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('Invalid tenant context.');
  return n;
}

function signedTenantContext(req, env = process.env) {
  const supplied = clean(req?.headers?.['x-sbc-tenant-context'], 2048);
  if (supplied) {
    const verified = V435.verifyTenantContext(supplied, env);
    if (!verified.ok) throw new Error(verified.reason);
    if (Number(verified.context.tenantId) !== tenantIdForRequest(req)) throw new Error('Tenant context does not match authenticated tenant.');
    return verified.context;
  }
  return { v: 1, tenantId: tenantIdForRequest(req), actorId: String(req?.user?.id || 'system'), role: String(req?.user?.role || 'system'), iat: Date.now(), exp: Date.now() + 300000, unsignedFallback: true };
}

function tenantBindingFor(req, subject = {}) {
  const tenantId = tenantIdForRequest(req);
  const key = process.env.SBC_TENANT_CONTEXT_KEY || process.env.SBC_SESSION_SECRET || '';
  if (!key) return { configured: false, tenantId, binding: null };
  return { configured: true, tenantId, binding: V565.tenantBinding(key, tenantId, subject) };
}

function scopedSql(sql, params, tenantId, mode = 'strict') {
  return V435.tenantGuard(sql, params, { tenantId }, { mode });
}

async function tenantQuery(pool, sql, params, tenantId, mode = 'strict') {
  if (!pool) throw new Error('MySQL is unavailable.');
  const checked = scopedSql(sql, params, tenantId, mode);
  return pool.query(checked.sql, checked.params);
}

function capacity(db = {}) {
  const leads = Array.isArray(db.customers) ? db.customers : [];
  const active = leads.filter(c => !['Customer','Lost','Closed','Duplicate','Not Qualified','Do Not Call'].includes(String(c.status || '')));
  const outreach = (Array.isArray(db.activities) ? db.activities : []).filter(a => ['call','sms','email','meeting','conversation','contact'].some(k => String(a.type || '').toLowerCase().includes(k)));
  const ratio = outreach.length ? active.length / outreach.length : active.length;
  const state = ratio > 5 ? 'PAUSE_SOURCING' : ratio > 3 ? 'REDUCE_SOURCING' : 'SOURCE_OK';
  return { state, activeLeads: active.length, outreachEvents: outreach.length, leadsPerOutreach: Number.isFinite(ratio) ? Number(ratio.toFixed(2)) : null, thresholds: { reduceAbove: 3, pauseAbove: 5 }, generatedAt: now() };
}

function customer360(db = {}, customerId) {
  const id = String(customerId);
  const customers = Array.isArray(db.customers) ? db.customers : [];
  const customer = customers.find(c => String(c.id) === id);
  if (!customer) return null;
  const quotes = (db.quotes || []).filter(x => String(x.customerId) === id);
  const orders = (db.orders || []).filter(x => String(x.customerId) === id);
  const renewals = (db.renewals || []).filter(x => String(x.customerId) === id);
  const activities = (db.activities || []).filter(x => String(x.meta?.customerId || x.customerId) === id);
  const tasks = (db.tasks || []).filter(x => String(x.customerId) === id);
  const paid = orders.filter(o => ['Paid','Completed','Fulfilled','Won'].includes(String(o.status || '')));
  const lifetimeValue = paid.reduce((s, o) => s + Number(o.price || o.total || 0), 0);
  const timeline = [...quotes.map(x => ({at:x.updatedAt||x.createdAt,type:'quote',status:x.status,id:x.id})), ...orders.map(x => ({at:x.updatedAt||x.createdAt,type:'order',status:x.status,id:x.id,value:Number(x.price||0)})), ...renewals.map(x => ({at:x.updatedAt||x.createdAt,type:'renewal',status:x.status,id:x.id,value:Number(x.amount||0)})), ...activities.map(x => ({at:x.createdAt,type:'activity',status:x.type,id:x.id,message:x.message})), ...tasks.map(x => ({at:x.updatedAt||x.createdAt,type:'task',status:x.status,id:x.id,title:x.title}))].sort((a,b) => new Date(b.at||0)-new Date(a.at||0));
  return { customer, quotes, orders, renewals, activities, tasks, lifetimeValue, timeline, sourceOrigin: customer.source || '', generatedAt: now() };
}

function growthFactory(input = {}) {
  const audience = clean(input.audience || input.target || 'local small businesses', 180);
  const offer = clean(input.offer || 'SBC business growth package', 180);
  const CTA = clean(input.cta || 'Book a business review', 120);
  const channelSet = Array.isArray(input.channels) && input.channels.length ? input.channels.map(x => clean(x, 40)).slice(0, 8) : ['landing','email','sms','phone'];
  const message = `Build a coordinated ${offer} campaign for ${audience}. Keep the same offer, proof points, objection handling and CTA across every selected channel.`;
  return { version: VERSION, audience, offer, channels: channelSet, landing: { headline: `${offer} for ${audience}`, subheadline: 'One clear offer. One clear next step. Built to move qualified buyers.', cta: CTA }, email: { subject: `${offer} — a simpler way to get your business ready`, body: message }, sms: { body: `${offer}: ${CTA}. Reply READY and we will take it from there.` }, phoneScript: { opener: `Hi, this is SBC. I’m calling because we help ${audience} with ${offer}.`, close: CTA }, objections: [{ objection:'I need to think about it.', response:'Absolutely. Let’s isolate the one question that is keeping you from a decision.' }, { objection:'I already have someone.', response:'That makes sense. We can still identify gaps without asking you to replace what already works.' }], generatedAt: now() };
}

function dropzonePreview({filename, contentBase64, tenantId}) {
  const name = clean(filename || 'dropzone.csv', 180);
  const bytes = Buffer.from(String(contentBase64 || ''), 'base64');
  if (!bytes.length) throw new Error('contentBase64 is required.');
  if (bytes.length > MAX_FILE_BYTES) throw new Error('Dropzone file exceeds the 25MB processing limit.');
  const ext = path.extname(name).toLowerCase();
  if (!['.csv','.txt'].includes(ext)) throw new Error('V56.6 Dropzone currently accepts CSV/TXT lead documents.');
  const parsed = V562.parseCsvBinary(bytes);
  const headers=parsed[0]||[]; const data=parsed.slice(1);
  return { ok:true, version:VERSION, tenantId, filename:name, bytes:bytes.length, rows:data.length, headers, preview:data.slice(0,20), handoff:{worker:'workers/tier1-bulk-ingest.js',normalization:'native-tier1',tenantBound:true} };
}

function immutableEdgeManifest() {
  if (!fs.existsSync(EDGE_MANIFEST)) return { version:VERSION, mode:'manifest-only', domains:[] };
  const raw = JSON.parse(fs.readFileSync(EDGE_MANIFEST,'utf8'));
  const canonical = stable(raw);
  return { ...raw, immutableHash: sha256(canonical), servedAt:now() };
}

function ownerGate(value) { return V565.ownerThreshold(value, { threshold: 10000 }); }

function providerPlan({provider, job, value, configured, adapterRegistered, credentialsAvailable}) {
  const gate = ownerGate(value);
  const readiness = V565.providerReadiness({provider, configured, adapterRegistered, credentialsAvailable});
  return { version:VERSION, provider, jobId:clean(job?.id,120), orderId:clean(job?.orderId,120), gate, readiness, execution: gate.requiresOwnerSignature ? 'OWNER_CLEARANCE_REQUIRED' : readiness.liveSubmission ? 'ADAPTER_ELIGIBLE' : 'STAGED_ONLY', liveSubmission:false };
}

function subscriptionRecovery(payload = {}) { return V565.recoveryPlan(payload); }

function releaseManifest() {
  return { version:VERSION, name:'SBC Scale + Revenue Rails', layers:['domain-controllers','cryptographic-tenant-shield','immutable-edge-manifest','learned-funnel','customer-360','capacity-pacing','provider-fulfillment-rails','owner-clearance','subscription-recovery','omnichannel-growth-factory','dropzone-file-strapper'], rollback:'V56.5.0', secretsAdded:0, liveVendorSubmissionInvented:false, generatedAt:now() };
}

module.exports = { VERSION, tenantIdForRequest, signedTenantContext, tenantBindingFor, scopedSql, tenantQuery, capacity, customer360, growthFactory, dropzonePreview, immutableEdgeManifest, ownerGate, providerPlan, subscriptionRecovery, releaseManifest, MAX_FILE_BYTES };
