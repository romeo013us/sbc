'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const pkg = require('../package.json');
const release = require('../config/release-identity');
const csvPath = path.join(__dirname, '..', 'starter-leads', 'SBC-Lorna-Barbershop-Batch-2026-10-09.csv');
const csv = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const lines = csv.trim().split(/\r?\n/);
assert.strictEqual(pkg.version, release.RELEASE_VERSION);
assert.strictEqual(release.RELEASE_VERSION,pkg.version);
assert(server.includes('SBC-Lorna-Barbershop-Batch-2026-10-09.csv'), 'new batch must be registered with the existing seeder');
assert(server.includes("if(spec.kind==='lorna-cold-pending-verification')return true;"), 'new batch must deduplicate on normalized business name');
assert.strictEqual(lines.length - 1, 29, 'expected exactly 29 leads');
assert(lines[0].includes('Business Name') && lines[0].includes('Research Notes'), 'required source columns must exist');
const records = lines.slice(1).map(line => {
  // All fields are quoted by Python csv writer when needed. Parse using a minimal CSV parser for test data.
  const out=[]; let cur=''; let quoted=false;
  for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(quoted && line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;} else if(ch===','&&!quoted){out.push(cur);cur='';} else cur+=ch;}
  out.push(cur); return out;
});
const businessNames = records.map(r => r[0]);
assert(businessNames.every(Boolean), 'all records must have business names');
assert.strictEqual(new Set(businessNames.map(x=>x.toLowerCase())).size, 29, 'business names must be unique within the batch');
assert(records.every(r => r[9] === 'Jonathan Verification Required'), 'all leads must require owner verification');
assert(records.every(r => r[11] === 'Cold' && r[12] === '0'), 'all leads must start cold with score 0');
assert(records.every(r => r[8].includes('Source URL:')), 'source URLs must be preserved in research notes');
assert(server.includes('VERIFIED_PRE_CORRUPTION_CRM_COUNT = 248'), 'do not bypass recovery threshold');
assert(server.includes('if(MYSQL_RECOVERY_REQUIRED){console.error'), 'recovery startup remains isolated');
console.log('V65.1.26 LORNA BATCH REGRESSION TEST: PASS');
console.log('records=29 cold=29 score0=29 owner_verification_required=29 source_urls_preserved=PASS seeder_registered=PASS recovery_gate_preserved=PASS');
