'use strict';
// Preview-to-appointment: deterministic policy, no AI API, outbound contact,
// payment provider, durable data mutation, or website publishing here.
const { randomBytes } = require('node:crypto');

function id(value) {
  const n = Number(value);
  return (String(value ?? '').trim() !== '' && Number.isSafeInteger(n) && n > 0) ? n : 0;
}
function sameTenant(record, tenantId) {
  const tid = id(tenantId);
  if (!record || !tid) return false;
  const a = record.tenantId == null ? 0 : id(record.tenantId);
  const b = record.tenant_id == null ? 0 : id(record.tenant_id);
  if (a && b && a !== b) return false;
  return (a || b) === tid;
}
function canOperate(customer, actor, tenantId) {
  if (!sameTenant(customer,tenantId) || !sameTenant(actor,tenantId) || actor?.active === false) return false;
  const role = String(actor.role || '');
  if (role === 'owner' || role === 'manager') return true;
  return role === 'caller' && String(customer.assignedTo || '') !== '' &&
    String(customer.assignedTo) === String(actor.id);
}
function canReadDemo(demo, customer, actor, tenantId) {
  return !!demo && !demo.archived &&
    String(demo.customerId || '') === String(customer?.id || '') &&
    sameTenant(demo,tenantId) && canOperate(customer,actor,tenantId);
}
function publicReady(demo, customer) {
  return !!demo && !!customer && !demo.archived &&
    demo.status === 'Approved' &&
    String(demo.customerId || '') === String(customer.id || '') &&
    sameTenant(customer,id(demo.tenantId ?? demo.tenant_id)) &&
    sameTenant(demo,id(customer.tenantId ?? customer.tenant_id));
}
function canCheckout(demo, customer) {
  return publicReady(demo,customer) && demo.checkoutEnabled === true;
}
function newSlug(businessName) {
  const base = String(businessName || 'business').normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0,45) || 'business';
  return base + '-' + randomBytes(16).toString('hex');
}
function reviewApproval(input = {}) {
  if(input.reviewedDetails !== true || input.reviewedVisuals !== true || input.reviewedContent !== true)
    throw Object.assign(new Error('PREVIEW_REVIEW_REQUIRED'), { status:400 });
  return {status:'Approved',checkoutEnabled:false};
}
function salesScript(customer, demo) {
  const name = String(customer?.businessName || customer?.contactName || 'your business').trim().slice(0,100);
  const greeting = 'Hello, is this the owner of ' + name + '? This is [your real first and last name] from Successful By Choice.';
  const done = demo?.status === 'Approved';
  const intro = customer?.googleBusinessWebsiteStatus === 'verified_missing'
    ? 'I checked your Google Business Profile and noticed there was no website linked.'
    : 'I was checking out your business online and had an idea for how your website could look.';
  return greeting + ' ' + intro + ' ' + (done
    ? 'I put together a website preview for your business. Would tonight or tomorrow work for a quick 10-minute walkthrough?'
    : 'Would you be interested in seeing a website concept if I put one together?');
}
module.exports = {sameTenant,canOperate,canReadDemo,publicReady,canCheckout,newSlug,reviewApproval,salesScript};
