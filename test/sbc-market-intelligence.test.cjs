'use strict';

const assert = require('node:assert/strict');
const { generateKeyPairSync, verify } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const express = require('express');
const { register } = require('../enterprise/sbc-market-intelligence.cjs');
const Search = require('../enterprise/sbc-search-console.cjs');
const { MARK, patchServer } = require('../scripts/v66-stage-market-intelligence.cjs');

const TIME = Date.parse('2026-11-12T14:00:00Z');
const SITE = 'sbcmia.com';
const root = path.resolve(__dirname, '..');

function exampleOrder(id, { started = '2026-11-11T01:00:00Z', status = 'New', price = '199.00', request = id, payment, ...fields } = {}) {
  return {
    id: `ord_fixture_${id}`, tenant_id: 1, created_at: started, customer_name: 'Synthetic Customer', status, price,
    notes: JSON.stringify({
      publicCheckout: true, websiteCheckoutSource: SITE, websiteCheckoutRequestId: `sbcweb_${request.toString(16).padStart(32, '0')}`,
      ...(payment ? { squareOrderId: `square-order-${id}`, squarePaymentId: payment, squarePaymentStatus: 'COMPLETED', squarePaymentCompletedAt: '2026-11-12T11:00:00Z' } : {}),
      ...fields
    })
  };
}

async function withReport(options, run) {
  const app = express();
  register(app, {
    auth(req, res, next) {
      const role = req.get('x-test-role');
      if (!role) return res.sendStatus(401);
      req.user = { role, tenantId: Number(req.get('x-test-tenant') ?? 1) };
      next();
    },
    ownerOnly(req, res, next) { return req.user.role === 'owner' ? next() : res.sendStatus(403); },
    requireTenant(req) { if (req.user.tenantId < 1) throw Error('required'); return req.user.tenantId; },
    isSiteTenant: id => id === 1, getPool: () => null, readSearchCredential: () => '', clock: () => TIME,
    ...options
  });
  const server = await new Promise(resolve => {
    const bound = app.listen(0, '127.0.0.1', () => resolve(bound));
  });
  const request = (query = '', headers = { 'x-test-role': 'owner' }) => fetch(
    `http://127.0.0.1:${server.address().port}/api/owner/market-intelligence${query}`, { headers }
  );
  try { await run(request); }
  finally { await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
}

test('authentication, owner role, tenant and date validation precede data access', async () => {
  await withReport({ getPool: assert.fail, readSearchCredential: assert.fail }, async request => {
    assert.equal((await request('', {})).status, 401);
    assert.equal((await request('', { 'x-test-role': 'lead_researcher' })).status, 403);
    assert.equal((await request('', { 'x-test-role': 'owner', 'x-test-tenant': '0' })).status, 403);
    assert.equal((await request('?days=30&days=90')).status, 400);
    assert.equal((await request('?days=365')).status, 400);
    const foreign = await request('?tenantId=1', { 'x-test-role': 'owner', 'x-test-tenant': '2' });
    assert.equal(foreign.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await foreign.json()).site, { status: 'out_of_scope' });
  });
});

test('durable tenant reads use equal UTC periods and count only eligible Square checkout evidence', async () => {
  const leads = [
    { tenant_id: 1, source: SITE, business_name: 'PRIVATE FIXTURE BUSINESS', created_at: '2026-11-11T23:59:59Z' },
    { tenant_id: 1, source: SITE, created_at: '2026-10-12T00:00:00Z' },
    { tenant_id: 1, source: SITE, business_name: 'SBC SYSTEM TEST', created_at: '2026-11-11T18:00:00Z' }
  ];
  const orders = [
    exampleOrder(1, { payment: 'fixture-paid' }),
    exampleOrder(2, { status: 'Paid' }),
    exampleOrder(3, { payment: 'fixture-refunded', status: 'Refunded' }),
    exampleOrder(4, { payment: 'fixture-duplicate-request' }),
    exampleOrder(5, { request: 4 }),
    exampleOrder(6, { payment: 'fixture-duplicate-payment' }),
    exampleOrder(7, { payment: 'fixture-duplicate-payment', started: '2026-10-12T01:00:00Z' }),
    exampleOrder(8, { payment: 'fixture-qa', ownerCheckoutLab: true }),
    exampleOrder(9, { payment: 'fixture-direct', websiteCheckoutSource: '' }),
    exampleOrder(10, { payment: 'fixture-future', started: '2026-11-12T00:00:00Z' }),
    exampleOrder(11, { payment: 'fixture-past', started: '2026-10-12T00:00:00Z', price: '99.01' }),
    exampleOrder(12, { payment: 'fixture-notes-refund', paymentStatus: 'REFUNDED' }),
    { tenant_id: 1, created_at: '2026-11-11T00:00:00Z', notes: 'legacy notes' }
  ];
  const query = async ({ sql, timeout }, params) => {
    assert.deepEqual(params, [1, SITE, '2026-09-13 00:00:00', '2026-11-12 00:00:00', 5001]);
    assert.equal(timeout, 4000);
    assert.match(sql, /^\s*SELECT\b/);
    assert.match(sql, /WHERE (o\.)?tenant_id = \?/);
    if (sql.includes('FROM sbc_orders')) {
      assert.match(sql, /c\.tenant_id = o\.tenant_id/);
      assert.match(sql, /JSON_VALID\(o\.notes\)/);
      return [orders];
    }
    return [leads];
  };
  await withReport({ getPool: () => ({ query }) }, async request => {
    const result = await (await request()).json();
    assert.equal(result.site.status, 'available');
    assert.deepEqual(result.site.periods, {
      current: { startDate: '2026-10-13', endDate: '2026-11-11' }, previous: { startDate: '2026-09-13', endDate: '2026-10-12' }
    });
    assert.deepEqual(result.site.current, { crmInquiries: 1, signedCheckouts: 5, paidCheckouts: 1, capturedCents: 19900 });
    assert.deepEqual(result.site.previous, { crmInquiries: 1, signedCheckouts: 2, paidCheckouts: 1, capturedCents: 9901 });
    assert.equal(result.site.conflictingPaymentIds, 1);
    assert.equal(result.site.conflictingRequestIds, 1);
    assert.equal(result.search.status, 'not_configured');
    assert.equal(result.market.competitors.length, 6);
    for (const item of result.market.competitors) assert.equal(new URL(item.source).protocol, 'https:');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE FIXTURE|fixture-paid|ord_fixture|private_key/);
  });
});

test('SQL failures, inconsistent tenant rows and truncated results yield explicit unavailable states', async () => {
  for (const [query, status] of [
    [async () => { throw Error('private SQL error'); }, 'unavailable'],
    [async () => [[{ tenant_id: 2 }]], 'unavailable'],
    [async () => [Array(5001).fill({ tenant_id: 1 })], 'volume_limit']
  ]) {
    await withReport({ getPool: () => ({ query }) }, async request => {
      const result = await (await request('?days=90')).json();
      assert.deepEqual(result.site, { status });
      assert.equal(result.search.status, 'not_configured');
      assert.equal(result.ok, true);
    });
  }
});

test('Search Console signs a read-only JWT and uses fixed Google endpoints and scoped caching', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const value = JSON.stringify({
    type: 'service_account', client_email: 'fixture@sbc-test.iam.gserviceaccount.com', token_uri: tokenUrl,
    private_key: privateKey.export({ format: 'pem', type: 'pkcs8' })
  });
  const calls = [];
  let denied = false;
  const fetcher = async (url, options) => {
    calls.push(url);
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    if (url === tokenUrl) {
      const [header, claims, signature] = options.body.get('assertion').split('.');
      assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'RS256');
      const payload = JSON.parse(Buffer.from(claims, 'base64url'));
      assert.equal(payload.aud, tokenUrl);
      assert.equal(payload.scope, 'https://www.googleapis.com/auth/webmasters.readonly');
      assert.equal(payload.exp - payload.iat, 900);
      assert(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, 'base64url')));
      return { ok: true, json: async () => ({ access_token: 'synthetic-google-token' }) };
    }
    assert.equal(url, `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(Search.PROPERTY)}/searchAnalytics/query`);
    assert.equal(options.headers.Authorization, 'Bearer synthetic-google-token');
    const query = JSON.parse(options.body);
    assert.equal(query.type, 'web');
    assert.equal(query.dataState, 'final');
    if (denied) return { ok: false, status: 403 };
    return { ok: true, json: async () => query.endDate === '2026-11-08' ? { rows: [{ clicks: 2, impressions: 10 }] } : {} };
  };
  const read = Search.createReader(fetcher);
  const args = { tenantId: 1, days: 30, time: TIME, value };
  const [first, second] = await Promise.all([read(args), read(args)]);
  assert.deepEqual(first, second);
  assert.equal(calls.length, 3);
  assert.deepEqual(first.current, { clicks: 2, impressions: 10 });
  assert.equal(first.previous, null);
  assert.deepEqual(first.periods.current, { startDate: '2026-10-10', endDate: '2026-11-08' });
  assert.doesNotMatch(JSON.stringify(first), /synthetic-google-token|private_key|fixture@/);
  assert.equal((await read({ ...args, value: value.replace(tokenUrl, 'https://invalid.example/') })).status, 'credential_invalid');
  assert.equal(calls.length, 3);
  denied = true;
  assert.equal((await read({ ...args, tenantId: 2 })).status, 'access_denied');
  assert.equal(calls.length, 6);
  assert.equal((await read({ ...args, value: '' })).status, 'not_configured');
  assert.equal((await read(args)).status, 'access_denied');
});

test('release stage wires owner access and durable website receipts, and mirrors the browser assets', async () => {
  const read = name => fs.readFileSync(path.join(root, name), 'utf8');
  const source = read('server.js');
  const staged = patchServer(source);
  assert(staged.includes(MARK));
  assert.equal(patchServer(staged), staged);
  assert.match(staged, /app\.use\('\/api', apiRateLimiter\);\n\/\* SBC_MARKET_INTELLIGENCE \*\/[\s\S]*?auth,ownerOnly,requireTenant:requireRequestTenant/);
  new vm.Script(staged);
  if (process.env.SBC_MARKET_INTELLIGENCE_EXPECT_STAGED === 'YES') assert.equal(source, staged);
  const start = staged.indexOf('async function confirmWebsiteInquiry(');
  const end = staged.indexOf("app.use('/api', apiRateLimiter)", start);
  const handler = staged.slice(staged.indexOf("app.post('/api/web-lead'"), staged.indexOf("app.disable('x-powered-by')", start));
  assert(handler.indexOf('WEBSITE_INQUIRY_WRITER_UNAVAILABLE') < handler.indexOf('webLeadDuplicate(c0,tenantId)'));
  assert.equal(handler.match(/await confirmWebsiteInquiry\(tenantId,c\.id,activity\.id\)/g).length, 2);
  let commits = 0;
  const confirm = vm.runInNewContext(`${staged.slice(start, end)}\nconfirmWebsiteInquiry`, {
    saveData: async () => { commits++; }, mysqlPool: { query: async ({ sql }, values) => {
      assert.match(sql, /c\.tenant_id=a\.tenant_id/);
      assert.equal(Array.from(values).join(','), 'customer-1,1,activity-1');
      return [commits === 1 ? [{ id: 'activity-1' }] : []];
    } }
  });
  assert.equal(await confirm(1, 'customer-1', 'activity-1'), true);
  assert.equal(await confirm(1, 'customer-1', 'activity-1'), false);
  for (const file of ['index.html', 'sbc-v6567-marketing-hub.js', 'sbc-market-intelligence.js', 'sbc-market-intelligence.css']) {
    assert.equal(read(`public/${file}`), read(`browser_public/${file}`));
  }
  assert.match(read('public/index.html'), /sbc-market-intelligence\.js[\s\S]*sbc-v6567-marketing-hub\.js/);
});
