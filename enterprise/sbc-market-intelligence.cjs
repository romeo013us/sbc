'use strict';

const watchlist = require('./catalogs/sbc-market-watch.json');
const Search = require('./sbc-search-console.cjs');
const Revenue = require('./sbc-revenue-reporting-truth-v66142.cjs');
const { proofFields } = require('./v6640-payment-evidence.cjs');
const { requestIdValid } = require('./v6672-site-checkout-integrity.cjs');

const SITE = 'sbcmia.com';
const DAY = 86_400_000;
const ROW_LIMIT = 5000;
const MONEY_REVERSAL = /^(refund(ed)?|charge_?back|charged_back|void(ed)?)$/i;

function windows(days, time) {
  const end = Math.floor(time / DAY) * DAY;
  return { end, current: end - days * DAY, previous: end - 2 * days * DAY };
}

const date = value => new Date(value).toISOString().slice(0, 10);
const dateTime = value => `${date(value)} 00:00:00`;

async function readSite(pool, tenantId, days, time) {
  const range = windows(days, time);
  const args = [tenantId, SITE, dateTime(range.previous), dateTime(range.end), ROW_LIMIT + 1];
  const [leadResult, orderResult] = await Promise.all([
    pool.query({ timeout: 4000, sql: `
      SELECT tenant_id, business_name, contact_name, source,
             DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
      FROM sbc_customers
      WHERE tenant_id = ? AND source = ? AND COALESCE(status, '') <> 'Deleted'
        AND created_at >= ? AND created_at < ? LIMIT ?` }, args),
    pool.query({ timeout: 4000, sql: `
      SELECT o.id, o.tenant_id, o.customer_name, o.status, o.price, o.notes,
             DATE_FORMAT(o.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
             c.business_name, c.contact_name, c.source AS customer_source
      FROM sbc_orders o
      LEFT JOIN sbc_customers c ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
      WHERE o.tenant_id = ? AND COALESCE(o.status, '') <> 'Deleted'
        AND (CASE WHEN JSON_VALID(o.notes) THEN JSON_UNQUOTE(JSON_EXTRACT(o.notes, '$.websiteCheckoutSource')) END) = ?
        AND o.created_at >= ? AND o.created_at < ? LIMIT ?` }, args)
  ]);
  const [leads] = leadResult;
  const [orders] = orderResult;
  if (leads.length > ROW_LIMIT || orders.length > ROW_LIMIT) return { status: 'volume_limit' };
  if ([...leads, ...orders].some(row => Number(row.tenant_id) !== tenantId)) throw Error('SITE_REPORT_TENANT_MISMATCH');

  const blank = () => ({ crmInquiries: 0, signedCheckouts: 0, paidCheckouts: 0, capturedCents: 0 });
  const current = blank();
  const previous = blank();
  const bucket = started => {
    if (!Number.isFinite(started) || started < range.previous || started >= range.end) return null;
    return started >= range.current ? current : previous;
  };
  for (const row of leads) {
    const totals = bucket(Date.parse(row.created_at));
    if (totals && row.source === SITE && !Revenue.isQaCustomer({ businessName: row.business_name, contactName: row.contact_name })) {
      totals.crmInquiries++;
    }
  }

  const checkouts = new Map();
  const duplicateRequests = new Set();
  const usedPayments = new Set();
  const duplicatePayments = new Set();
  for (const row of orders) {
    const started = Date.parse(row.created_at);
    const totals = bucket(started);
    const notes = Revenue.parseNotes(row);
    const requestId = notes.websiteCheckoutRequestId;
    if (!totals || notes.websiteCheckoutSource !== SITE || notes.publicCheckout !== true || !requestIdValid(requestId)) continue;
    const order = { id: row.id, customerName: row.customer_name, price: row.price, notes, parsed: notes, paymentStatus: notes.paymentStatus };
    const customer = { businessName: row.business_name, contactName: row.contact_name, source: row.customer_source };
    if (Revenue.isQaOrder(order, customer)) continue;
    const capture = proofFields(order);
    const capturedAt = Date.parse(capture.completedAt);
    const captured = Revenue.providerPaid(order, customer) && !MONEY_REVERSAL.test(String(row.status).trim()) &&
      capturedAt >= started && capturedAt <= time;
    if (captured) {
      if (usedPayments.has(capture.id)) duplicatePayments.add(capture.id);
      usedPayments.add(capture.id);
    }
    if (checkouts.has(requestId)) duplicateRequests.add(requestId);
    checkouts.set(requestId, { totals, paymentId: captured ? capture.id : null, cents: Math.round(Number(row.price) * 100) });
  }
  for (const [requestId, { totals, paymentId, cents }] of checkouts) {
    if (duplicateRequests.has(requestId)) continue;
    totals.signedCheckouts++;
    if (paymentId && !duplicatePayments.has(paymentId)) {
      totals.paidCheckouts++;
      totals.capturedCents += cents;
    }
  }

  return {
    status: 'available', current, previous, currency: 'USD',
    periods: {
      current: { startDate: date(range.current), endDate: date(range.end - DAY) },
      previous: { startDate: date(range.previous), endDate: date(range.current - DAY) }
    },
    conflictingRequestIds: duplicateRequests.size,
    conflictingPaymentIds: duplicatePayments.size
  };
}

function recommendedActions(site, search) {
  const actions = [];
  if (search.status === 'not_configured') actions.push('Verify sbcmia.com in Search Console and connect the read-only service account.');
  if (search.status === 'access_denied') actions.push('Check the service account’s permission on the sbcmia.com Search Console property.');
  if (search.status === 'credential_invalid') actions.push('Replace the Search Console service account JSON in the Provider Credential Vault.');
  if (search.status === 'connected' && search.current && search.previous) {
    const { current, previous } = search;
    if (current.impressions > previous.impressions && current.clicks < previous.clicks) {
      actions.push('Search impressions rose while clicks fell. Review the service pages and queries driving the difference in Search Console.');
    }
  }
  if (site.status === 'available') {
    if (site.conflictingRequestIds || site.conflictingPaymentIds) actions.push('Review duplicate checkout or payment references with the existing reconciliation tools.');
    if (site.current.crmInquiries > 0 && site.current.signedCheckouts === 0) actions.push('Verify how sbcmia.com package buttons reach the signed checkout before using checkout counts to assess conversion.');
  }
  return actions;
}

function register(app, { auth, ownerOnly, requireTenant, isSiteTenant, getPool, readSearchCredential, fetcher, clock = Date.now }) {
  const readSearch = Search.createReader(fetcher);
  app.get('/api/owner/market-intelligence', auth, ownerOnly, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    let tenantId;
    try { tenantId = requireTenant(req); }
    catch { return res.status(403).json({ ok: false, code: 'TENANT_CONTEXT_REQUIRED' }); }
    const rawDays = req.query.days ?? '30';
    if (rawDays !== '30' && rawDays !== '90') return res.status(400).json({ ok: false, code: 'MARKET_WINDOW_INVALID' });
    const days = Number(rawDays);
    const time = clock();
    const allowed = isSiteTenant(tenantId);
    const pool = allowed ? getPool() : null;
    const [site, search] = allowed ? await Promise.all([
      pool ? readSite(pool, tenantId, days, time).catch(() => ({ status: 'unavailable' })) : { status: 'unavailable' },
      Promise.resolve().then(() => readSearchCredential(tenantId)).then(value => readSearch({ tenantId, value, days, time }))
        .catch(() => ({ status: 'unavailable', property: Search.PROPERTY }))
    ]) : [{ status: 'out_of_scope' }, { status: 'out_of_scope' }];
    return res.json({
      ok: true, generatedAt: new Date(time).toISOString(), days, site, search,
      market: { ...watchlist, reviewDue: time >= Date.parse(watchlist.observedOn) + 30 * DAY },
      actions: recommendedActions(site, search)
    });
  });
}

module.exports = { register };
