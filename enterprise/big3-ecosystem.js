'use strict';

/**
 * SBC Big 3 ecosystem contract.
 * The three applications remain separately deployable. This module only
 * defines the signed handoff envelope and deterministic package entitlements.
 */
const crypto = require('crypto');

const VERSION = '1.0.0';
const PRODUCTS = Object.freeze({
  visibility: { price: 99, officeBox: 'upgrade' },
  starter: { price: 199, officeBox: 'upgrade' },
  essentials: { price: 349, officeBox: 'upgrade' },
  complete: { price: 699, officeBox: 'included' }
});

function packageKey(input) {
  const s = String(input || '').toLowerCase();
  if (/699|complete|launch/.test(s)) return 'complete';
  if (/349|essential/.test(s)) return 'essentials';
  if (/199|starter/.test(s)) return 'starter';
  if (/99|visibility/.test(s)) return 'visibility';
  return 'custom';
}
function entitlementFor(input) {
  const key = packageKey(input);
  return { packageKey: key, officeBox: PRODUCTS[key]?.officeBox || 'upgrade', source: 'sbc-package-catalog-v48' };
}
function canonicalPayload(payload){
  const normalize=(v)=>{
    if(Array.isArray(v))return v.map(normalize);
    if(v&&typeof v==='object')return Object.keys(v).sort().reduce((o,k)=>(o[k]=normalize(v[k]),o),{});
    return v;
  };
  return JSON.stringify(normalize(payload||{}));
}
function sign(payload, secret) {
  if (!secret) throw new Error('SBC_WEBHOOK_SECRET_NOT_CONFIGURED');
  return crypto.createHmac('sha256', String(secret)).update(canonicalPayload(payload)).digest('hex');
}
function verify(payload, signature, secret) {
  if (!signature || !secret) return false;
  const expected = sign(payload, secret);
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function buildHandoff({order, customer, packageName, activationToken, sourceVersion, industry=''}) {
  const ent = entitlementFor(packageName || order?.product);
  return {
    schema: 'sbc.big3.handoff', version: VERSION,
    event: 'order.paid', occurredAt: new Date().toISOString(),
    source: { app: 'sbc-command-center', version: sourceVersion || '48.0.0' },
    idempotencyKey: `sbc-order:${String(order?.id || '')}`,
    order: {
      id: String(order?.id || ''), product: String(order?.product || packageName || ''),
      packageKey: ent.packageKey, amount: Number(order?.price || 0), currency: 'USD',
      paymentStatus: 'PAID', fulfillmentStatus: String(order?.fulfillmentStatus || 'Ready for Fulfillment')
    },
    customer: {
      sourceId: String(customer?.id || order?.customerId || ''),
      businessName: String(customer?.businessName || order?.customerName || '').slice(0,190),
      contactName: String(customer?.contactName || customer?.name || '').slice(0,190),
      email: String(customer?.email || '').slice(0,320), phone: String(customer?.phone || '').slice(0,80), industry: String(industry || customer?.industry || '').slice(0,190)
    },
    business: { industry: String(industry || customer?.industry || '').slice(0,190) },
    entitlements: { officeBox: ent.officeBox, officeBoxPlan: ent.officeBox === 'included' ? 'starter' : null },
    activation: activationToken ? { token: activationToken, expiresInHours: 72 } : null
  };
}
module.exports = { VERSION, PRODUCTS, packageKey, entitlementFor, canonicalPayload, sign, verify, buildHandoff };
