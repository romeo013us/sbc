'use strict';

/*
 * SBC V56.13.3 — Revenue Sprint Client Onboarding
 *
 * Owner-only, durable onboarding endpoint.
 * - Writes the canonical customer record to MySQL when available.
 * - Keeps the in-memory CRM synchronized only after the durable write succeeds.
 * - Does NOT mark a customer active merely because an onboarding request arrived.
 * - Uses the existing SBC SMS pipeline for an owner notification only.
 * - No new secrets and no direct Twilio credential handling here.
 */

const crypto = require('crypto');

const VERSION = '56.13.3';
const TIERS = new Map([
  ['starter', 100],
  ['business', 100],
  ['elite', 200],
  ['professional', 200]
]);

const clean = (value, max = 255) => String(value ?? '').trim().slice(0, max);
const money = value => Math.max(0, Math.min(999999, Number(value || 0) || 0));
const now = () => new Date();
const sqlDateTime = value => new Date(value).toISOString().slice(0, 19).replace('T', ' ');
const id = prefix => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

function normalizeTier(value) {
  const tier = clean(value, 40).toLowerCase();
  return TIERS.has(tier) ? tier : '';
}

function duplicateMatch(customers, candidate) {
  const phone = clean(candidate.phone, 80).replace(/global.__SBC_REQUIRE_TENANT(req)D/g, '');
  const email = clean(candidate.email, 255).toLowerCase();
  const business = clean(candidate.businessName, 255).toLowerCase();
  return (customers || []).find(c => {
    const cp = String(c.phone || '').replace(/global.__SBC_REQUIRE_TENANT(req)D/g, '');
    const ce = String(c.email || '').trim().toLowerCase();
    const cb = String(c.businessName || '').trim().toLowerCase();
    return (phone && cp && phone === cp) || (email && ce && email === ce) || (business && cb && business === cb);
  });
}

function buildCustomer({ businessName, ownerPhone, packageTier, tokenAmount, email = '', contactName = '' }) {
  const createdAt = now();
  const tier = normalizeTier(packageTier);
  const floor = TIERS.get(tier);
  const expected = money(tokenAmount) || floor;
  return {
    id: id('cust'),
    businessName: clean(businessName),
    contactName: clean(contactName),
    phone: clean(ownerPhone, 80),
    email: clean(email),
    status: 'Onboarding Pending Payment',
    source: 'Revenue Sprint Onboarding',
    followUp: '',
    notes: `Revenue Sprint onboarding created. Package: ${tier}. Expected recurring floor: $${floor}. Expected onboarding/payment amount supplied: $${expected}. Client remains pending payment until a verified Square/payment event activates the account.`,
    website: '',
    websiteStatus: '',
    industry: '',
    assignedTo: '',
    createdAt,
    updatedAt: createdAt,
    verificationStatus: 'Needs Verification',
    leadTemperature: 'Warm',
    revenueSprint: {
      version: VERSION,
      packageTier: tier,
      rateFloor: floor,
      tokenAmount: expected,
      paymentState: 'PENDING',
      activationState: 'PENDING_PAYMENT',
      createdAt: createdAt.toISOString()
    }
  };
}

module.exports = function registerRevenueSprintOnboarding(app, { auth, ownerOnly, getContext, sendSms }) {
  app.post('/api/v56133/revenue-sprint/onboard', auth, ownerOnly, async (req, res) => {
    const b = req.body || {};
    const businessName = clean(b.businessName);
    const ownerPhone = clean(b.ownerPhone, 80);
    const packageTier = normalizeTier(b.packageTier);
    const email = clean(b.email);
    const contactName = clean(b.contactName);

    if (!businessName || !ownerPhone || !packageTier) {
      return res.status(400).json({ ok: false, error: 'Business name, owner phone, and a supported package tier are required.' });
    }

    const ctx = getContext();
    const customers = Array.isArray(ctx.db?.customers) ? ctx.db.customers : (ctx.db.customers = []);
    const duplicate = duplicateMatch(customers, { businessName, phone: ownerPhone, email });
    if (duplicate) {
      return res.status(409).json({
        ok: false,
        error: 'A possible matching CRM customer already exists. Review the existing record before onboarding.',
        duplicate: { id: duplicate.id, businessName: duplicate.businessName, phone: duplicate.phone, email: duplicate.email }
      });
    }

    const customer = buildCustomer({ businessName, ownerPhone, packageTier, tokenAmount: b.tokenAmount, email, contactName });
    const accountNotes = [{
      type: 'revenue_sprint_onboarding',
      version: VERSION,
      packageTier,
      rateFloor: TIERS.get(packageTier),
      tokenAmount: customer.revenueSprint.tokenAmount,
      paymentState: 'PENDING',
      activationState: 'PENDING_PAYMENT',
      createdAt: customer.createdAt.toISOString()
    }];

    try {
      if (ctx.mysqlPool) {
        await ctx.mysqlPool.query(
          `INSERT INTO sbc_customers
            (id,business_name,contact_name,phone,email,status,source,follow_up,notes,website,industry,website_status,assigned_to,account_notes_json,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            customer.id,
            customer.businessName,
            customer.contactName,
            customer.phone,
            customer.email,
            customer.status,
            customer.source,
            null,
            customer.notes,
            customer.website,
            customer.industry,
            customer.websiteStatus,
            customer.assignedTo,
            JSON.stringify(accountNotes),
            sqlDateTime(customer.createdAt),
            sqlDateTime(customer.updatedAt)
          ]
        );

        const [rows] = await ctx.mysqlPool.query('SELECT id,status FROM sbc_customers WHERE id=? LIMIT 1', [customer.id]);
        if (!rows.length) throw new Error('Durable CRM write could not be verified.');
      }

      customers.unshift(customer);
      if (typeof ctx.saveData === 'function') await ctx.saveData();

      ctx.audit?.(req.user || { id: 'owner', name: 'Owner', role: 'owner' }, 'revenue_sprint_onboarded', `Created onboarding record for ${customer.businessName}`, {
        customerId: customer.id,
        packageTier,
        rateFloor: customer.revenueSprint.rateFloor,
        tokenAmount: customer.revenueSprint.tokenAmount,
        paymentState: 'PENDING',
        activationState: 'PENDING_PAYMENT',
        durable: Boolean(ctx.mysqlPool)
      });

      let ownerNotification = { attempted: false, sent: false, reason: 'Owner notification not configured.' };
      const ownerPhoneNumber = clean(ctx.db?.settings?.phone, 80);
      if (ownerPhoneNumber && typeof sendSms === 'function') {
        ownerNotification.attempted = true;
        try {
          await sendSms(
            { phone: ownerPhoneNumber, businessName: 'SBC Owner', source: 'owner-notification' },
            `✦ SBC ALERT ✦global.__SBC_REQUIRE_TENANT(req)nNew onboarding created:global.__SBC_REQUIRE_TENANT(req)n${customer.businessName}global.__SBC_REQUIRE_TENANT(req)nTier: ${packageTier.toUpperCase()}global.__SBC_REQUIRE_TENANT(req)nMRR floor: $${customer.revenueSprint.rateFloor}.00global.__SBC_REQUIRE_TENANT(req)nPayment: PENDINGglobal.__SBC_REQUIRE_TENANT(req)nActivation: PENDING PAYMENT`
          );
          ownerNotification.sent = true;
          ownerNotification.reason = 'Existing SBC SMS pipeline accepted the owner notification.';
        } catch (e) {
          ownerNotification.reason = `Owner notification failed without rolling back onboarding: ${e.message}`;
          ctx.audit?.(req.user || { id: 'owner', name: 'Owner', role: 'owner' }, 'revenue_sprint_owner_notification_failed', `Owner notification failed for ${customer.businessName}`, { customerId: customer.id, error: e.message });
        }
      }

      return res.status(201).json({
        ok: true,
        version: VERSION,
        customer,
        mrrAdded: 0,
        projectedMrrFloor: customer.revenueSprint.rateFloor,
        paymentRequired: true,
        activationRequired: true,
        message: 'Client onboarding record created durably. Revenue is not recognized and the account is not active until a verified payment/activation event occurs.',
        persistence: { mysql: Boolean(ctx.mysqlPool), verified: true },
        ownerNotification
      });
    } catch (error) {
      console.error(`[SBC Revenue Sprint] onboarding failed: ${error.message}`);
      return res.status(500).json({ ok: false, error: 'Onboarding could not be durably created.', detail: error.message });
    }
  });
};

module.exports._test = { normalizeTier, duplicateMatch, buildCustomer, TIERS, VERSION };
