'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'routes/crm.js'), 'utf8');
const repo = fs.readFileSync(path.join(root, 'enterprise/repositories/customer-repository.cjs'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'public/sbc-lead-workspace-v6519.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const checks = {
  read_only_list_route: route.includes("app.get('/api/v6519/crm/leads', auth") && route.includes('repository.list({ limit, offset, status })'),
  read_only_detail_route: route.includes("app.get('/api/v6519/crm/leads/:id', auth") && route.includes('repository.findById(req.params.id)'),
  repository_tenant_predicate: /WHERE tenant_id = \? AND id = \?/i.test(repo) && /WHERE tenant_id = \?/i.test(repo),
  no_caller_supplied_tenant: !ui.includes('x-sbc-tenant-context') && route.includes('authenticated AsyncLocalStorage context'),
  recovery_locked_write_falls_back_to_staging: ui.includes('staged: []') && ui.includes('/api/v65110/crm/leads') && ui.includes('browser staging only'),
  new_write_route_is_separate_and_guarded: !route.includes("app.post('/api/v6519/crm/leads") && route.includes("app.post('/api/v65110/crm/leads', auth") && route.includes('MYSQL_RECOVERY_REQUIRED'),
  csv_export_available: ui.includes('Export Staged CSV') && ui.includes('text/csv;charset=utf-8'),
  script_loaded_by_dashboard: html.includes('/sbc-lead-workspace-v6519.js?v=65.1.26-demo-studio'),
  safe_errors_do_not_echo_exception: route.includes('Lead records are temporarily unavailable; no data was changed.') && !route.includes('error: error.message')
};
for (const [name, ok] of Object.entries(checks)) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); assert.ok(ok, name); }
console.log(`Lead workspace rebuild checks: ${Object.keys(checks).length}/${Object.keys(checks).length} PASS`);
