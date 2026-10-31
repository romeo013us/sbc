'use strict';

const crypto = require('crypto');
const { MIN_MARGIN_PCT } = require('./sbc-margin-policy.cjs');

/**
 * SBC V58.3 Storefront Checkout Event Handler
 *
 * Responsibilities:
 *  - validate tenant/SKU/amount boundaries
 *  - read vendor cost only from the tenant-scoped product catalog
 *  - fail closed on missing/zero cost
 *  - enforce the owner-approved 20% contribution-margin floor
 *  - persist checkout + revenue + Agent OS event in one transaction
 *  - provide deterministic idempotency for provider retries
 *  - never perform refunds or other irreversible financial mutations
 */
class StorefrontCheckoutEventHandler {
  constructor({ pool, signatureVerifier = null, clock = () => new Date() } = {}) {
    if (!pool) throw new Error('StorefrontCheckoutEventHandler requires pool');
    this.pool = pool;
    this.signatureVerifier = signatureVerifier;
    this.clock = clock;
    this.minimumMargin = MIN_MARGIN_PCT;
  }

  static canonicalize(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    return JSON.stringify(value);
  }

  static sha256(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
  }

  static normalizeTenant(payload) {
    return StorefrontCheckoutEventHandler.canonicalize(
      payload.tenant_id || payload.tenantId || payload.space_domain || payload.spaceDomain || ''
    );
  }

  static normalizeSku(payload) {
    return StorefrontCheckoutEventHandler.canonicalize(
      payload.sku || payload.product_sku || payload.productSku || ''
    ).toUpperCase();
  }

  static normalizeAmount(payload) {
    const value = payload.amount ?? payload.total ?? payload.total_amount ?? payload.price;
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : NaN;
  }

  static providerEventId(payload) {
    return StorefrontCheckoutEventHandler.canonicalize(
      payload.provider_event_id || payload.providerEventId || payload.event_id || payload.eventId || payload.id || ''
    );
  }

  /**
   * Provider event id is the strongest idempotency anchor. If absent, require
   * a stable order id plus checkout identity fields; never use wall-clock time.
   */
  static eventId(payload) {
    const provider = StorefrontCheckoutEventHandler.canonicalize(payload.provider || 'unknown').toLowerCase();
    const providerEventId = StorefrontCheckoutEventHandler.providerEventId(payload);
    const orderId = StorefrontCheckoutEventHandler.canonicalize(payload.order_id || payload.orderId || '');
    const tenantId = StorefrontCheckoutEventHandler.normalizeTenant(payload);
    const sku = StorefrontCheckoutEventHandler.normalizeSku(payload);
    const amount = StorefrontCheckoutEventHandler.canonicalize(StorefrontCheckoutEventHandler.normalizeAmount(payload));
    const currency = StorefrontCheckoutEventHandler.canonicalize(payload.currency || 'USD').toUpperCase();

    if (providerEventId) return StorefrontCheckoutEventHandler.sha256(`provider|${provider}|${providerEventId}`);
    if (!orderId) return null;
    return StorefrontCheckoutEventHandler.sha256(
      `fallback|${tenantId}|${provider}|${orderId}|${sku}|${amount}|${currency}`
    );
  }

  async isEmergencyStopped(connection) {
    const [rows] = await connection.query(
      `SELECT setting_value
         FROM sbc_global_settings
        WHERE setting_key = 'global_emergency_kill_switch'
        LIMIT 1`
    );
    return rows.length > 0 && String(rows[0].setting_value) === '1';
  }

  async handle(payload, { rawBody = null, signature = null } = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('INVALID_CHECKOUT_EVENT_PAYLOAD');
    }

    if (this.signatureVerifier) {
      const verified = await this.signatureVerifier({ rawBody, signature, payload });
      if (!verified) return { accepted: false, status: 'REJECTED_SIGNATURE' };
    }

    const tenantId = StorefrontCheckoutEventHandler.normalizeTenant(payload);
    const sku = StorefrontCheckoutEventHandler.normalizeSku(payload);
    const amount = StorefrontCheckoutEventHandler.normalizeAmount(payload);
    const currency = String(payload.currency || 'USD').trim().toUpperCase();
    const provider = StorefrontCheckoutEventHandler.canonicalize(payload.provider || 'unknown');
    const providerEventId = StorefrontCheckoutEventHandler.providerEventId(payload);
    const orderId = StorefrontCheckoutEventHandler.canonicalize(payload.order_id || payload.orderId || '') || null;
    const customerId = StorefrontCheckoutEventHandler.canonicalize(payload.customer_id || payload.customerId || '') || null;
    const leadId = StorefrontCheckoutEventHandler.canonicalize(payload.lead_id || payload.leadId || '') || null;
    const eventId = StorefrontCheckoutEventHandler.eventId(payload);

    if (!tenantId) return { accepted: false, status: 'REJECTED_TENANT', reason: 'TENANT_REQUIRED' };
    if (!sku) return { accepted: false, status: 'REJECTED_SKU', reason: 'SKU_REQUIRED' };
    if (!eventId) return { accepted: false, status: 'REJECTED_IDEMPOTENCY', reason: 'STABLE_ORDER_OR_PROVIDER_EVENT_REQUIRED' };
    if (!Number.isFinite(amount) || amount <= 0) {
      return { accepted: false, status: 'REJECTED_AMOUNT', reason: 'POSITIVE_CHECKOUT_AMOUNT_REQUIRED' };
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return { accepted: false, status: 'REJECTED_CURRENCY', reason: 'INVALID_CURRENCY' };
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      if (await this.isEmergencyStopped(connection)) {
        await connection.rollback();
        return { accepted: false, status: 'FROZEN_GLOBAL_KILL_SWITCH', event_id: eventId };
      }

      // Tenant-scoped economic source of truth. No fallback to unscoped pricing.
      const [catalogRows] = await connection.query(
        `SELECT sku, product_name, vendor_cost, retail_price, active, economic_status
           FROM sbc_product_catalog
          WHERE tenant_id = ? AND sku = ?
          LIMIT 1
          FOR UPDATE`,
        [tenantId, sku]
      );

      if (!catalogRows.length || Number(catalogRows[0].active) !== 1 || catalogRows[0].economic_status !== 'ACTIVE' || Number(catalogRows[0].vendor_cost) <= 0) {
        await connection.rollback();
        return {
          accepted: false,
          status: 'BLOCKED_MARGIN',
          reason: 'UNCONFIGURED_SKU_COST_REJECTION',
          tenant_id: tenantId,
          sku
        };
      }

      const vendorCost = Number(catalogRows[0].vendor_cost);
      const contributionMargin = Number((amount - vendorCost).toFixed(4));
      const marginPercentage = amount > 0 ? contributionMargin / amount : 0;

      if (!Number.isFinite(contributionMargin) || marginPercentage < this.minimumMargin) {
        await connection.rollback();
        return {
          accepted: false,
          status: 'REJECTED_MARGIN',
          reason: 'MARGIN_BELOW_MINIMUM_POLICY_THRESHOLD',
          tenant_id: tenantId,
          sku,
          amount,
          vendor_cost: vendorCost,
          contribution_margin: contributionMargin,
          margin_pct: marginPercentage
        };
      }

      const [existing] = await connection.query(
        `SELECT id, status, revenue_event_id, agent_event_id
           FROM sbc_checkout_event_ledger
          WHERE idempotency_key = ?
          LIMIT 1
          FOR UPDATE`,
        [eventId]
      );

      if (existing.length) {
        await connection.rollback();
        return {
          accepted: false,
          status: 'REJECTED_DUPLICATE',
          event_id: eventId,
          ledger_id: existing[0].id,
          revenue_event_id: existing[0].revenue_event_id,
          agent_event_id: existing[0].agent_event_id
        };
      }

      const now = this.clock();
      const payloadJson = JSON.stringify(payload);
      const [ledger] = await connection.query(
        `INSERT INTO sbc_checkout_event_ledger
          (tenant_id, idempotency_key, provider, provider_event_id, order_id, customer_id,
           lead_id, sku, amount, currency, vendor_cost, contribution_margin, margin_pct,
           payload_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?)`,
        [
          tenantId, eventId, provider, providerEventId || eventId, orderId, customerId,
          leadId, sku, amount, currency, vendorCost, contributionMargin, marginPercentage,
          payloadJson, now
        ]
      );

      const [revenue] = await connection.query(
        `INSERT INTO sbc_revenue_event_ledger
          (checkout_ledger_id, event_type, order_id, customer_id, lead_id, sku, amount,
           currency, idempotency_key, payload_json, created_at)
         VALUES (?, 'CHECKOUT_PAID', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ledger.insertId, orderId, customerId, leadId, sku, amount, currency,
          eventId, JSON.stringify({
            ...payload,
            tenant_id: tenantId,
            vendor_cost: vendorCost,
            contribution_margin: contributionMargin,
            margin_pct: marginPercentage
          }), now
        ]
      );

      const busIdempotencyKey = StorefrontCheckoutEventHandler.sha256(`checkout.paid|${eventId}`);
      const busPayload = {
        schema: 'sbc.checkout.paid.v2',
        source: 'storefront_checkout',
        tenant_id: tenantId,
        checkout_ledger_id: ledger.insertId,
        revenue_event_id: revenue.insertId,
        order_id: orderId,
        customer_id: customerId,
        lead_id: leadId,
        sku,
        amount,
        currency,
        vendor_cost: vendorCost,
        contribution_margin: contributionMargin,
        margin_pct: marginPercentage
      };

      const [task] = await connection.query(
        `INSERT INTO sbc_agent_event_bus
          (event_type, aggregate_type, aggregate_id, source_agent, payload,
           idempotency_key, status, priority, created_at)
         VALUES ('checkout.paid', 'order', ?, 'storefront_checkout_handler', ?, ?, 'PENDING', 1, ?)`,
        [orderId || eventId, JSON.stringify(busPayload), busIdempotencyKey, now]
      );

      await connection.query(
        `UPDATE sbc_checkout_event_ledger
            SET status = 'QUEUED', revenue_event_id = ?, agent_event_id = ?
          WHERE id = ?`,
        [revenue.insertId, task.insertId, ledger.insertId]
      );

      await connection.commit();

      return {
        accepted: true,
        status: 'QUEUED',
        event_id: eventId,
        tenant_id: tenantId,
        ledger_id: ledger.insertId,
        revenue_event_id: revenue.insertId,
        agent_event_id: task.insertId,
        vendor_cost: vendorCost,
        contribution_margin: contributionMargin,
        margin_pct: marginPercentage
      };
    } catch (err) {
      try { await connection.rollback(); } catch (_) {}
      if (err && err.code === 'ER_DUP_ENTRY') {
        return { accepted: false, status: 'DUPLICATE_ABORTED', event_id: eventId };
      }
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = StorefrontCheckoutEventHandler;
