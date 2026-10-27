// SBC_V6648_TENANT_SCOPED_REVENUE
const {scopeCustomers}=require('../enterprise/v6648-revenue-tenant.cjs');
'use strict';

const VERSION = '56.13.1';
const MAX_PLAY = 20;
const ACTIVE_STATUSES = new Set(['lead','qualified','sales ready','contacted','human call pending']);
const TERMINAL = new Set(['customer','lost','do not call','closed','duplicate','not qualified']);

function clean(v, n=240) { return String(v ?? '').trim().slice(0, n); }
function temperature(c) { return clean(c?.leadTemperature, 40).toLowerCase(); }
function verification(c) { return clean(c?.verificationStatus, 80).toLowerCase().replace(/[-_]+/g, ' '); }
function contactable(c) { return Boolean(clean(c?.email) || clean(c?.phone)); }
function isActive(c) { return c && !TERMINAL.has(clean(c.status, 80).toLowerCase()); }
function isWarmHot(c) { return ['warm','hot'].includes(temperature(c)); }
function isSalesReady(c) { return ['verified','sales ready'].includes(verification(c)); }
function score(c) {
  const n = Number(c?.leadScore ?? c?.leadIntelligence?.score ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}
function stage(c, route) {
  if (!isActive(c)) return 'CLOSED';
  if (!isSalesReady(c)) return isWarmHot(c) ? 'NEEDS_VERIFICATION' : 'QUALIFYING';
  if (!isWarmHot(c)) return 'QUALIFYING';
  if (!contactable(c)) return 'SALES_READY_NO_CONTACT';
  if (String(c.pipelineStage || '').toLowerCase() === 'human call pending') return 'REVENUE_PLAY_READY';
  if (route && /^ROUTED_/.test(route.route)) return 'REVENUE_PLAY_READY';
  return 'SALES_READY';
}

function summarize(customers, routeRevenueLead) {
  const rows = (Array.isArray(customers) ? customers : []).filter(Boolean);
  const summary = {
    total: rows.length,
    qualifying: 0,
    needsVerification: 0,
    salesReady: 0,
    revenuePlayReady: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    noContact: 0,
    suppressed: 0,
    stages: {}
  };
  const items = rows.map(c => {
    if (isWarmHot(c)) temperature(c) === 'hot' ? summary.hot++ : summary.warm++;
    else summary.cold++;
    if (!contactable(c)) summary.noContact++;
    if (TERMINAL.has(clean(c.status, 80).toLowerCase())) summary.suppressed++;
    const route = typeof routeRevenueLead === 'function' ? routeRevenueLead(c) : null;
    const s = stage(c, route);
    summary.stages[s] = Number(summary.stages[s] || 0) + 1;
    if (s === 'QUALIFYING') summary.qualifying++;
    if (s === 'NEEDS_VERIFICATION') summary.needsVerification++;
    if (isSalesReady(c)) summary.salesReady++;
    if (s === 'REVENUE_PLAY_READY') summary.revenuePlayReady++;
    return {
      id: c.id,
      businessName: clean(c.businessName || c.contactName || 'Lead'),
      temperature: temperature(c) || 'unknown',
      score: score(c),
      verificationStatus: clean(c.verificationStatus || 'Unverified', 80),
      stage: s,
      route: route?.route || 'UNASSESSED',
      email: Boolean(clean(c.email)),
      phone: Boolean(clean(c.phone)),
      assignedTo: clean(c.assignedTo, 120)
    };
  });
  items.sort((a,b) => b.score - a.score || a.businessName.localeCompare(b.businessName));
  return { summary, items };
}

module.exports = function registerRevenuePipeline(app, { auth, ownerOnly, getContext }) {
  app.get('/api/v56131/revenue-pipeline/status', auth, async (req, res) => {
    try {
      const ctx = getContext();
      const out = summarize(scopeCustomers(ctx.db?.customers || [], global.__SBC_REQUIRE_TENANT(req)), ctx.routeRevenueLead);
      res.json({ ok: true, version: VERSION, generatedAt: new Date().toISOString(), ...out });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message || 'Revenue pipeline status failed.' });
    }
  });

  app.post('/api/v56131/revenue-pipeline/prepare', auth, ownerOnly, async (req, res) => {
    try {
      const ctx = getContext();
      const limit = Math.max(1, Math.min(250, Number(req.body?.limit) || 250));
      const verification = await ctx.verifyRevenueLeadPool({ limit, tenantId:global.__SBC_REQUIRE_TENANT(req) });
      const out = summarize(scopeCustomers(ctx.db?.customers || [], global.__SBC_REQUIRE_TENANT(req)), ctx.routeRevenueLead);
      ctx.audit({ id: req.user?.id || 'owner', name: req.user?.name || 'Owner', role: req.user?.role || 'owner' }, 'revenue_pipeline_prepared', 'Prepared Lorna leads for Revenue PLAY', {
        checked: verification.checked,
        passed: verification.passed,
        needsReview: verification.needsReview,
        revenuePlayReady: out.summary.revenuePlayReady
      });
      res.json({ ok: true, version: VERSION, verification, ...out });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message || 'Revenue pipeline preparation failed.' });
    }
  });

  app.post('/api/v56131/revenue-pipeline/play', auth, ownerOnly, async (req, res) => {
    try {
      const requested = Number(req.body?.limit) || 10;
      const limit = Math.max(1, Math.min(MAX_PLAY, requested));
      const prepared = await ctxSafePrepare(getContext(), limit, global.__SBC_REQUIRE_TENANT(req));
      if (!prepared.ok) return res.status(400).json(prepared);
      const result = await getContext().runRevenueFirstPlay({ limit, reason: 'lorna-revenue-pipeline', tenantId:global.__SBC_REQUIRE_TENANT(req) });
      res.status(result.locked ? 409 : 200).json({ ok: !result.locked, version: VERSION, prepared, play: result });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message || 'Revenue pipeline PLAY failed.' });
    }
  });
};

async function ctxSafePrepare(ctx, limit, tenantId) {
  if (!ctx || typeof ctx.verifyRevenueLeadPool !== 'function') return { ok: false, error: 'Revenue verifier is unavailable.' };
  const verification = await ctx.verifyRevenueLeadPool({ limit: Math.max(10, Math.min(250, limit * 25)), tenantId });
  return { ok: true, verification: { checked: verification.checked, passed: verification.passed, needsReview: verification.needsReview } };
}

module.exports.summarize = summarize;
module.exports._test = { stage, score, isSalesReady, isWarmHot };
