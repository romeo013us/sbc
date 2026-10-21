import { createHash } from 'node:crypto';

/**
 * Staging-only state kernel.
 * ledger.insertOnce must be backed by a database UNIQUE constraint on event_hash.
 * The adapter must resolve only after the database commit is durable.
 * This module is deliberately not wired into live payment, CRM, or fulfillment routes.
 */
export class SBCStateKernel {
  constructor({ ledger, readModelCache, clock = () => Date.now() } = {}) {
    if (!ledger || typeof ledger.insertOnce !== 'function') {
      throw new TypeError('ledger.insertOnce adapter is required');
    }
    if (!readModelCache || typeof readModelCache.getLocalSnapshot !== 'function' ||
        typeof readModelCache.updateLocalSnapshot !== 'function') {
      throw new TypeError('readModelCache adapter is required');
    }
    this.ledger = ledger;
    this.readModelCache = readModelCache;
    this.clock = clock;
  }

  async dispatchAuthoritativeCommand(packet) {
    if (!packet || typeof packet !== 'object') throw new TypeError('intent packet required');
    const { tenantId, eventType, idempotencyKey, payload } = packet;
    for (const [name, value] of Object.entries({ tenantId, eventType, idempotencyKey })) {
      if (typeof value !== 'string' || !value.trim() || value.length > 255) {
        throw new TypeError(name + ' must be a non-empty string of at most 255 characters');
      }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new TypeError('payload must be an object');
    }

    // JSON tuple encoding avoids ambiguous delimiter concatenation.
    const eventHash = createHash('sha256')
      .update(JSON.stringify([tenantId, eventType, idempotencyKey]), 'utf8')
      .digest('hex');
    const startedAt = process.hrtime.bigint();
    const result = await this.ledger.insertOnce({
      eventHash,
      tenantId,
      eventType,
      idempotencyKey,
      payload,
      ingestedAt: this.clock()
    });

    if (!result || result.inserted !== true) {
      return {
        committed: false,
        duplicateDetected: true,
        eventHash,
        durationNs: (process.hrtime.bigint() - startedAt).toString()
      };
    }

    // Projection happens only after adapter confirms durable commit.
    if (typeof payload.customerId === 'string' && payload.customerId.length) {
      const snapshot = this.readModelCache.getLocalSnapshot(payload.customerId) || {};
      const projected = this.projectStateInvariants(snapshot, eventType, payload);
      this.readModelCache.updateLocalSnapshot(payload.customerId, projected);
    }

    return {
      committed: true,
      duplicateDetected: false,
      eventHash,
      durationNs: (process.hrtime.bigint() - startedAt).toString()
    };
  }

  projectStateInvariants(snapshot, eventType, payload) {
    switch (eventType) {
      case 'TRANSACTION_CONFIRMED':
        // This projection is informational; never use it as a payment ledger.
        return { ...snapshot, transactionEventObserved: true, transactionEventAmount: payload.amount };
      case 'FULFILLMENT_COMPLETE':
        return { ...snapshot, fulfillmentStatus: 'COMPLETE', fulfillmentUpdatedAt: this.clock() };
      default:
        return { ...snapshot, ...(payload.delta && typeof payload.delta === 'object' ? payload.delta : {}) };
    }
  }
}
