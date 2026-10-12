'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const patch = fs.readFileSync(path.join(__dirname, 'apply-v6525-customer360-workspace.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(__dirname, 'customer360-workspace-v6525.js'), 'utf8');
for (const feature of [
  'openCustomer360Safe=async function', 'openV322Customer360', 'sbcStartCustomerQuote',
  'sbcCustomerFastCheckout', 'sbcConfirmSendCheckoutLink', 'openSbcDialer',
  'sendEmailToLead', 'sendSmsToLead', 'Request Refund', 'Generate Demo',
  'Recovery/read-only mode blocks outreach.', 'Paid/won quotes are not offered for a second charge.',
  'customer requested or consented', 'target="_blank" rel="noopener noreferrer"'
]) assert.ok(moduleSource.includes(feature), `missing feature/safety assertion: ${feature}`);
assert.ok(patch.includes('right:18px;left:auto;bottom:22px;'), 'desktop launcher must move away from sign-out sidebar');
assert.ok(patch.includes('right:10px;left:auto;bottom:10px'), 'mobile launcher must move away from sign-out sidebar');
assert.ok(patch.includes('65.1.25'), 'patcher must set the new release identity');
console.log('[SBC V65.1.25] PASS: Customer 360 actions, consent, paid-quote guard, recovery lock, and launcher repositioning checks.');
