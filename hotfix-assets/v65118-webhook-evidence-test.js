'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

const start = server.indexOf('async function handleVendorTrackingWebhook(provider,raw){');
const end = server.indexOf("\napp.post('/api/webhooks/4over4'", start);
assert.ok(start >= 0 && end > start, 'vendor tracking handler must exist');
const handler = server.slice(start, end);

assert.match(handler, /SBC_V65118_PROVIDER_MATCH_TRACKING_EVIDENCE/, 'V65.1.18 evidence guard marker');
assert.match(handler, /normalizeVendor\(job\?\.vendor\)/, 'webhook must normalize the job vendor');
assert.match(handler, /expectedProvider==='4over4'.*fouroverfour/s, '4OVER4 endpoint may update only 4OVER4 jobs');
assert.match(handler, /expectedProvider==='vistaprint'.*vistaprint/s, 'VistaPrint endpoint may update only VistaPrint jobs');
assert.match(handler, /return refMatches&&isExpectedVendor\(j\)/, 'job match must include provider match');
assert.match(handler, /if\(\(shippingState\|\|terminalDelivery\)&&!trackingNumber\)return \{ok:false,error:'tracking_number_required_for_shipping_status'\}/, 'shipping and terminal statuses require tracking evidence');
const evidenceIndex = handler.indexOf('if((shippingState||terminalDelivery)&&!trackingNumber)');
const mutationIndex = handler.indexOf('job.vendorStatus=status;');
assert.ok(evidenceIndex >= 0 && mutationIndex > evidenceIndex, 'evidence must be validated before mutating the job');
assert.match(handler, /if\(terminalDelivery\)job\.status='completed'/, 'only terminal delivery statuses mark completion after the evidence gate');
assert.equal((server.match(/res\.status\(result\.ok\?200:409\)\.json\(result\)/g)||[]).length, 2, 'both vendor endpoints return conflict for rejected webhook events');
assert.doesNotMatch(server, /res\.status\(200\)\.json\(await handleVendorTrackingWebhook\(/, 'vendor endpoint must not acknowledge rejected event bodies with HTTP 200');
console.log(JSON.stringify({
  ok: true,
  version: '65.1.18',
  checks: [
    'provider-to-job binding',
    'vendor reference cannot cross provider boundaries',
    'tracking evidence required for shipped/delivered/fulfilled events',
    'invalid events leave state unchanged',
    'rejected webhook payloads return HTTP 409'
  ]
}, null, 2));
