// SBC_V6648_TENANT_SCOPED_REVENUE
const {scopeRevenueDb}=require('../enterprise/v6648-revenue-tenant.cjs');
'use strict';

/*
 * SBC V56.13.3 Revenue Sprint
 *
 * Additive monetization control layer. It deliberately does NOT replace
 * Revenue PLAY, Square, fulfillment, or provider adapters.
 *
 * Policy:
 *  - Intake can hold a large prospect pool (500 is a planning target).
 *  - Verification remains the gate before sales execution.
 *  - PLAY remains owner-controlled and hard-capped at 20.
 *  - Provider fulfillment remains fail-closed until an approved provider
 *    contract/endpoint is actually configured.
 *  - No new secrets are required.
 */

const VERSION = '56.13.3';
const INTAKE_TARGET = 500;
const PLAY_CAP = 20;
const SCALE_STEPS = [10, 25, 50, 100, 500];
const TERMINAL = new Set(['customer','lost','do not call','closed','duplicate','not qualified']);
const PAID = new Set(['paid','completed','fulfilled','won']);

const lower = v => String(v ?? '').trim().toLowerCase();
const active = c => c && !TERMINAL.has(lower(c.status));
const warmHot = c => ['warm','hot'].includes(lower(c.leadTemperature));
const contactable = c => Boolean(String(c?.email || '').trim() || String(c?.phone || '').trim());

function poolSnapshot(db) {
  const customers = Array.isArray(db?.customers) ? db.customers : [];
  const activeRows = customers.filter(active);
  const warm = activeRows.filter(c => lower(c.leadTemperature) === 'warm').length;
  const hot = activeRows.filter(c => lower(c.leadTemperature) === 'hot').length;
  const verified = activeRows.filter(c => ['verified','sales ready'].includes(lower(c.verificationStatus))).length;
  const revenueReady = activeRows.filter(c =>
    warmHot(c) &&
    ['verified','sales ready'].includes(lower(c.verificationStatus)) &&
    contactable(c)
  ).length;
  const orders = Array.isArray(db?.orders) ? db.orders : [];
  const paid = orders.filter(o => PAID.has(lower(o.status)));
  const fulfillmentJobs = Array.isArray(db?.megaOpsStore?.fulfillmentJobs) ? db.megaOpsStore.fulfillmentJobs : [];
  const pendingPaid = paid.filter(o => !fulfillmentJobs.some(j => String(j.orderId) === String(o.id) && ['completed','fulfilled','shipped'].includes(lower(j.status))));
  const revenue = paid.reduce((sum,o) => sum + Number(o.total || o.amount || o.price || 0), 0);
  return {
    generatedAt: new Date().toISOString(),
    leadPool: {
      total: customers.length,
      active: activeRows.length,
      intakeTarget: INTAKE_TARGET,
      intakeProgressPct: Math.min(100, Math.round((customers.length / INTAKE_TARGET) * 1000) / 10),
      hot,
      warm,
      verified,
      revenuePlayReady: revenueReady,
      uncontactable: activeRows.filter(c => !contactable(c)).length
    },
    commerce: {
      totalOrders: orders.length,
      paidOrders: paid.length,
      recognizedRevenue: Math.round(revenue * 100) / 100,
      paidOrdersAwaitingFulfillment: pendingPaid.length
    },
    controls: {
      playCap: PLAY_CAP,
      ownerControlledPlay: true,
      verificationGate: true,
      providerFailClosed: true,
      noNewSecretsRequired: true,
      scaleSteps: SCALE_STEPS
    }
  };
}

function nextScaleStep(snapshot) {
  const n = Number(snapshot?.leadPool?.revenuePlayReady || 0);
  const current = SCALE_STEPS.find(step => n < step);
  return current || 500;
}

function revenueProof(db) {
  const orders = Array.isArray(db?.orders) ? db.orders : [];
  const paid = orders.filter(o => PAID.has(lower(o.status)));
  const fulfillmentJobs = Array.isArray(db?.megaOpsStore?.fulfillmentJobs) ? db.megaOpsStore.fulfillmentJobs : [];
  const hasCustomer = paid.some(o => o.customerId || o.customer || o.customerName);
  const hasOrder = paid.length > 0;
  const linkedFulfillment = paid.filter(o => fulfillmentJobs.some(j => String(j.orderId) === String(o.id))).length;
  const shipped = paid.filter(o => fulfillmentJobs.some(j => String(j.orderId) === String(o.id) && ['shipped','fulfilled','completed'].includes(lower(j.status)))).length;
  return {
    prospect: Array.isArray(db?.customers) && db.customers.some(active),
    payment: hasOrder,
    squareConfirmation: paid.length > 0,
    orderCreated: hasOrder,
    fulfillmentJobCreated: linkedFulfillment > 0,
    fulfillmentCompleted: shipped > 0,
    revenueRecognized: paid.reduce((n,o) => n + Number(o.total || o.amount || o.price || 0), 0) > 0,
    counts: { paidOrders: paid.length, linkedFulfillment, shipped }
  };
}

module.exports = function registerRevenueSprint(app, { auth, ownerOnly, getContext }) {
  app.get('/api/v56133/revenue-sprint/status', auth, ownerOnly, (req,res) => {
    try {
      const ctx = getContext();
      const snapshot = poolSnapshot(scopeRevenueDb(ctx.db || {}, global.__SBC_REQUIRE_TENANT(req)));
      res.json({ ok:true, version:VERSION, ...snapshot, nextScaleStep:nextScaleStep(snapshot), proof:revenueProof(scopeRevenueDb(ctx.db || {}, global.__SBC_REQUIRE_TENANT(req))) });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message || 'Revenue Sprint status unavailable.' });
    }
  });

  app.post('/api/v56133/revenue-sprint/prepare', auth, ownerOnly, async (req,res) => {
    try {
      const ctx = getContext();
      const requested = Math.max(1, Math.min(INTAKE_TARGET, Number(req.body?.verifyLimit) || 250));
      if (typeof ctx.verifyRevenueLeadPool !== 'function') return res.status(503).json({ ok:false, error:'Revenue verifier is unavailable.' });
      const verification = await ctx.verifyRevenueLeadPool({ limit:requested, tenantId:global.__SBC_REQUIRE_TENANT(req) });
      const snapshot = poolSnapshot(scopeRevenueDb(ctx.db || {}, global.__SBC_REQUIRE_TENANT(req)));
      ctx.audit?.(req.user || {id:'owner',name:'Owner',role:'owner'}, 'revenue_sprint_prepared', 'Prepared bounded Revenue Sprint verification batch.', {
        requested,
        checked: verification.checked,
        passed: verification.passed,
        needsReview: verification.needsReview,
        revenuePlayReady: snapshot.leadPool.revenuePlayReady,
        noNewSecretsRequired: true
      });
      res.json({ ok:true, version:VERSION, verification, snapshot, nextScaleStep:nextScaleStep(snapshot), playCap:PLAY_CAP });
    } catch (e) {
      res.status(400).json({ ok:false, error:e.message || 'Revenue Sprint preparation failed.' });
    }
  });

  app.post('/api/v56133/revenue-sprint/play', auth, ownerOnly, async (req,res) => {
    try {
      const ctx = getContext();
      const requested = Math.max(1, Math.min(PLAY_CAP, Number(req.body?.limit) || 10));
      if (typeof ctx.verifyRevenueLeadPool !== 'function' || typeof ctx.runRevenueFirstPlay !== 'function') {
        return res.status(503).json({ ok:false, error:'Revenue PLAY controls are unavailable.' });
      }
      const verification = await ctx.verifyRevenueLeadPool({ limit:Math.max(10, requested * 5), tenantId:global.__SBC_REQUIRE_TENANT(req) });
      const play = await ctx.runRevenueFirstPlay({ limit:requested, reason:'v56133-revenue-sprint', tenantId:global.__SBC_REQUIRE_TENANT(req) });
      const snapshot = poolSnapshot(scopeRevenueDb(ctx.db || {}, global.__SBC_REQUIRE_TENANT(req)));
      ctx.audit?.(req.user || {id:'owner',name:'Owner',role:'owner'}, 'revenue_sprint_play', 'Executed owner-controlled Revenue Sprint PLAY batch.', {
        requested,
        checked:verification.checked,
        passed:verification.passed,
        locked:Boolean(play?.locked),
        noNewSecretsRequired:true
      });
      res.status(play?.locked ? 409 : 200).json({ ok:!play?.locked, version:VERSION, verification, play, snapshot, policy:{maxPlay:PLAY_CAP,ownerControlled:true,verificationGate:true} });
    } catch (e) {
      res.status(400).json({ ok:false, error:e.message || 'Revenue Sprint PLAY failed.' });
    }
  });

  app.get('/api/v56133/revenue-sprint/proof', auth, ownerOnly, (req,res) => {
    try {
      const ctx = getContext();
      res.json({ ok:true, version:VERSION, proof:revenueProof(scopeRevenueDb(ctx.db || {}, global.__SBC_REQUIRE_TENANT(req))), snapshot:poolSnapshot(scopeRevenueDb(ctx.db || {}, global.__SBC_REQUIRE_TENANT(req))) });
    } catch (e) {
      res.status(500).json({ ok:false, error:e.message || 'Revenue proof unavailable.' });
    }
  });
};

module.exports._test = { poolSnapshot, nextScaleStep, revenueProof, INTAKE_TARGET, PLAY_CAP, SCALE_STEPS };
