'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const owner = read('public/app.js');
const researcher = read('public/lead-research.js');
const workspace = read('public/sbc-lead-workspace-v6519.js');
const editor = read('public/sbc-lead-edit-v6606.js');
const route = read('routes/crm-edits-v6606.js');
const form = read('public/lead-research.html');
const csv = read('public/lead-research-import-core.js');

assert.match(owner, /z\.address=first\(z\.address/,'canonical CRM row must retain the saved business address');
assert.match(owner, /<th>Address<\/th>/,'owner lead table must label the address column');
assert.match(owner, /<td>\$\{esc\(c\.address\|\|'Not recorded'\)\}<\/td>/,'owner lead row must escape the address and show an honest missing-data label');
assert.match(owner, /c\.address,c\.city/,'owner lead search must include business location');
assert.match(owner, /function newCustomer\([^\n]*name="address"[^>]*value=/,'owner lead entry/edit must capture the address');
assert.match(researcher, /Address: /,'researcher submitted and exception lists must label the full address');
assert.match(researcher, /Business address','address'/,'researcher correction must be able to update the address');
assert.match(researcher, /row\.record\.address/,'researcher CSV preview must show the imported address');
assert.match(form, /name="address"/,'researcher creation form must preserve the address field');
assert.match(csv, /address:\[/,'CSV import must map address headers');
assert.match(workspace, /<th>Address<\/th>/,'read-only CRM lead workspace must show addresses');
assert.match(workspace, /r\.address/,'read-only CRM workspace filter must search addresses');
assert.match(editor, /name="address"/,'durable CRM editor must expose the editable address');
assert.match(editor, /address:'address'/,'durable CRM editor must load the saved address');
assert.match(route, /address:\['address',500\]/,'durable tenant-safe CRM edit route must allow address');
assert.match(route, /SELECT id,assigned_to,[^\n]*address/,'revision-guarded row read must include address');
assert.match(route, /SELECT id,tenant_id,[^\n]*address/,'commit readback must include address');
for (const file of ['app.js', 'sbc-lead-workspace-v6519.js','sbc-lead-edit-v6606.js']) {
  assert.equal(read('public/' + file), read('browser_public/' + file), file + ' browser mirror must match production');
}
console.log('PASS business address: owner and researcher lead lists, editable forms, CSV, guarded durable API, and production mirrors');
