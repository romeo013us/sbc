'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registerCRM = require('../routes/crm');
const root = path.resolve(__dirname, '..');
const routeSource = fs.readFileSync(path.join(root, 'routes/crm.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const legacyV9 = fs.readFileSync(path.join(root, 'public/v9.js'), 'utf8');
const expected = [
  'GET /api/v566/crm/customer-360/:id',
  'GET /api/v566/crm/customer-360-relational/:id',
  'GET /api/v6519/crm/leads',
  'GET /api/v6519/crm/leads/:id',
  'POST /api/v65110/crm/leads'
];
function mockApp() {
  const routes = [];
  return { routes, get(path, ...handlers) { routes.push({ method: 'GET', path, handlers }); }, post(path, ...handlers) { routes.push({ method: 'POST', path, handlers }); } };
}
function mockResponse() {
  return { statusCode: 200, body: null, headers: {}, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, setHeader(k,v) { this.headers[k]=v; } };
}
function findHandler(app, method, path) {
  const route = app.routes.find(r => r.method === method && r.path === path);
  assert.ok(route, `route must register during startup: ${method} ${path}`);
  return route.handlers.at(-1);
}
async function main() {
  // All endpoints must register immediately when the module is mounted.
  const bootApp = mockApp();
  let recoveryConnections = 0;
  registerCRM(bootApp, { auth: (req,res,next)=>next(), getContext: () => ({
    db: { customers: [] },
    mysqlPool: { getConnection: async () => { recoveryConnections++; throw new Error('must not connect while locked'); } },
    recoveryRequired: () => true
  }) });
  const actual = bootApp.routes.map(r => `${r.method} ${r.path}`);
  for (const route of expected) assert.ok(actual.includes(route), `missing startup registration: ${route}`);
  assert.equal(bootApp.routes.length, expected.length, 'all CRM routes register exactly once at startup');

  const lockedRes = mockResponse();
  await findHandler(bootApp, 'POST', '/api/v65110/crm/leads')({ user: { role: 'owner', username: 'owner' }, tenantId: 1, body: { businessName: 'Locked Test Lead' } }, lockedRes);
  assert.equal(lockedRes.statusCode, 423, 'lead write must fail closed while recovery is active');
  assert.equal(lockedRes.body.code, 'MYSQL_RECOVERY_REQUIRED');
  assert.equal(recoveryConnections, 0, 'recovery guard rejects before opening a database connection');

  // Exercise a successful path against a fake connection; this is not a live database test.
  const statements = [];
  let committed = 0, rolledBack = 0, released = 0, auditCalls = 0, saveCalls = 0;
  const conn = {
    async ping() {}, async beginTransaction() {},
    async query(sql, params=[]) {
      statements.push({ sql, params });
      if (/^\s*SELECT id, business_name FROM sbc_customers/i.test(sql)) return [[], []];
      if (/^\s*INSERT INTO sbc_customers/i.test(sql)) return [{ affectedRows: 1, insertId: 1 }, []];
      if (/^\s*SELECT id,business_name,contact_name,email,phone,status,source,tenant_id FROM sbc_customers/i.test(sql)) return [[{ id: params[1], business_name: 'Example Business', contact_name: 'Owner', email: 'owner@example.com', phone: '3055550100', status: 'Lead', source: 'SBC Lead Workspace', tenant_id: 1 }], []];
      if (/^\s*INSERT INTO sbc_activities/i.test(sql)) return [{ affectedRows: 1 }, []];
      throw new Error('Unexpected SQL in fake DB test: ' + sql);
    },
    async commit() { committed++; }, async rollback() { rolledBack++; }, release() { released++; }
  };
  const fakeDb = { customers: [] };
  const writeApp = mockApp();
  registerCRM(writeApp, { auth: (req,res,next)=>next(), getContext: () => ({
    db: fakeDb, mysqlPool: { getConnection: async () => conn },
    recoveryRequired: () => false,
    audit: () => { auditCalls++; },
    saveData: async () => { saveCalls++; }
  }) });
  const savedRes = mockResponse();
  await findHandler(writeApp, 'POST', '/api/v65110/crm/leads')({
    user: { role: 'owner', username: 'owner' }, tenantId: 1, requestId: 'test-request',
    body: { businessName: 'Example Business', contactName: 'Owner', email: 'OWNER@example.com', phone: '(305) 555-0100', source: 'Integration Test' }
  }, savedRes);
  assert.equal(savedRes.statusCode, 201, 'successful verified fake-DB write returns 201');
  assert.equal(savedRes.body.durable, true);
  assert.equal(committed, 1, 'transaction commits after read-after-write verification');
  assert.equal(rolledBack, 0);
  assert.equal(released, 1);
  assert.equal(fakeDb.customers.length, 1, 'in-memory cache updates only after commit');
  assert.equal(auditCalls, 1);
  assert.equal(saveCalls, 0, 'lead save must not invoke broad snapshot writer');
  for (const entry of statements) assert.equal((entry.sql.match(/\?/g)||[]).length, entry.params.length, 'prepared SQL placeholder count must match bound values');

  assert.ok(routeSource.includes('REGEXP_REPLACE(COALESCE(phone'), 'duplicate check includes normalized phone matching');
  assert.ok(routeSource.includes('LEAD_PERSISTENCE_VERIFICATION_FAILED'), 'success requires read-after-write verification');
  assert.ok(!routeSource.includes('await ctx.saveData()'), 'direct lead write does not call broad snapshot replacement writer');
  assert.ok(appJs.includes('window.sbcPrimaryRender = render'), 'canonical renderer reference remains available');
  assert.ok(!/window\.render\s*=\s*renderV9/.test(legacyV9), 'legacy V55.10.2 renderer collision is not reintroduced');
  const ui = fs.readFileSync(path.join(root, 'public/sbc-lead-workspace-v6519.js'), 'utf8');
  assert.ok(ui.includes("fetch('/api/v65110/crm/leads'"), 'lead form calls guarded persistence endpoint');
  assert.ok(ui.includes('browser staging only'), 'lead form preserves fallback staging while blocked');
  console.log(`PASS V65.1.26 lead integration: ${expected.length} routes registered; recovery gate blocks writes; fake transaction save verifies; renderer guard retained`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
