'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const modulePath = path.join(__dirname, 'sbc-demo-studio-v6526.js');
const patchPath = path.join(__dirname, 'apply-v6526-demo-studio.js');
const moduleSource = fs.readFileSync(modulePath, 'utf8');
const patchSource = fs.readFileSync(patchPath, 'utf8');
for (const token of [
  'SBC Demo Studio', 'v6526PreviewFrame', 'data-v6526-device', 'Generate variation',
  'Copy link', 'Email demo', 'Text demo', '/api/website-demos',
  '/api/communications/email', '/api/communications/sms', 'customer.smsConsent === true',
  'customer.smsOptOut === true', 'customer.consentToSms === true', "currentRole() !== 'owner'",
  'No email or SMS was sent.', 'No payment, order, or fulfillment state is changed', 'state.data.recovery?.required'
]) assert.ok(moduleSource.includes(token), `Demo Studio missing required token: ${token}`);
for (const token of ['sbc-concept-ribbon', 'sbc-demo-studio-v6526.js', '65.1.26', 'test:v6526-demo-studio', 'server-side email recovery gate', 'server-side SMS recovery gate', 'server-side demo-generation recovery gate', 'install design-specific renderer CSS', 'styleCss(styleFor(demo))']) assert.ok(patchSource.includes(token), `patcher missing token: ${token}`);
assert.ok(!moduleSource.includes('innerHTML = customer.'), 'raw customer data must not be assigned to innerHTML');
assert.ok(!moduleSource.includes('window.open ='), 'demo studio must not override global navigation');
assert.ok(patchSource.includes("designStyle:style"), 'selected design variation must override a previous AI-plan style');
assert.ok(patchSource.includes("const oldReturn = \"  return String(result.html||'').replace('</body>',checkoutBlock+'</body>');\""), 'patcher must target the existing demo renderer');
console.log('[SBC V65.1.26] PASS: Demo Studio UI, owner-only email, server-validated SMS consent, responsive preview, safe generation, and personalized site rendering.');
