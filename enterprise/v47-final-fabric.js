'use strict';
/**
 * SBC V47 Big Dogg Final Fabric
 * Final integration layer: real-time internal event streaming, print-fulfillment
 * callbacks, bounded subscriber delivery, demo-router configuration, and a
 * production-test surface. This layer is additive; existing V46.4 controls remain.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

function createV47FinalFabric({ fortress, ultra, logger = console } = {}) {
  if (!fortress || !ultra) throw new Error('V47 requires V46.4 Fortress + V46.3 Ultra infrastructure');
  const bus = new EventEmitter();
  bus.setMaxListeners(250);
  const subscribers = new Map();
  const maxSubscribers = Math.max(1, Number(process.env.SBC_V47_MAX_STREAM_SUBSCRIBERS || 100));
  const maxCallbackQueue = Math.max(100, Number(process.env.SBC_V47_CALLBACK_QUEUE || 2000));
  let callbackQueue = 0;
  let emitted = 0;
  let delivered = 0;
  let dropped = 0;

  function safeTopic(topic) {
    return String(topic || 'system').trim().slice(0, 120).replace(/[^a-zA-Z0-9:._-]/g, '-');
  }

  function loadDemoRouter() {
    const file = path.join(process.cwd(), 'config', 'demo-router.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.routes)) throw new Error('invalid demo router schema');
      return { ok: true, file, ...parsed };
    } catch (e) {
      return { ok: false, file, error: e.message, routes: [] };
    }
  }

  function subscribe({ topic = '*', onEvent }) {
    if (typeof onEvent !== 'function') throw new Error('onEvent callback is required');
    if (subscribers.size >= maxSubscribers) throw new Error('V47 stream subscriber capacity reached');
    const id = crypto.randomUUID();
    subscribers.set(id, { id, topic: safeTopic(topic), onEvent, createdAt: Date.now(), delivered: 0 });
    return { id, unsubscribe: () => subscribers.delete(id) };
  }

  async function emit(topic, payload, meta = {}) {
    const event = {
      id: crypto.randomUUID(),
      topic: safeTopic(topic),
      payload,
      meta,
      at: new Date().toISOString(),
      version: '47.0.0'
    };
    emitted++;
    bus.emit('event', event);
    const matching = [...subscribers.values()].filter(s => s.topic === '*' || s.topic === event.topic);
    if (matching.length > maxCallbackQueue) {
      dropped += matching.length;
      return { ok: false, dropped: matching.length, eventId: event.id };
    }
    callbackQueue += matching.length;
    try {
      const results = await ultra.concurrentDispatch(
        matching.map(s => async () => {
          try {
            await s.onEvent(event);
            s.delivered++;
            delivered++;
            return { ok: true };
          } catch (e) {
            logger.warn('[V47] stream subscriber failed:', e.message);
            return { ok: false, error: e.message };
          }
        }),
        { concurrency: Math.max(1, Math.min(8, fortress.adaptivePolicy().recommendedConcurrency)) }
      );
      return { ok: results.every(x => x.ok), delivered: results.filter(x => x.ok).length, failed: results.filter(x => !x.ok).length, eventId: event.id };
    } finally {
      callbackQueue = Math.max(0, callbackQueue - matching.length);
    }
  }

  async function emitPrintFulfillment(provider, payload, meta = {}) {
    const normalized = String(provider || 'unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return emit(`fulfillment.print.${normalized}`, payload, { ...meta, provider: normalized, domain: 'print-fulfillment' });
  }

  function stats() {
    return {
      version: '47.0.0', emitted, delivered, dropped, callbackQueue,
      subscribers: subscribers.size, maxSubscribers, maxCallbackQueue,
      demoRouter: loadDemoRouter(),
      resource: fortress.adaptivePolicy()
    };
  }

  function readiness() {
    const router = loadDemoRouter();
    return {
      ok: router.ok && subscribers.size <= maxSubscribers,
      version: '47.0.0',
      final: true,
      architecture: 'enterprise-foundation-9-v47-final-fabric',
      capabilities: {
        realtimeEventStreaming: true,
        printFulfillmentCallbacks: true,
        boundedSubscriberDelivery: true,
        adaptiveDispatch: true,
        demoRouterConfig: router.ok,
        warTestSuite: fs.existsSync(path.join(process.cwd(), 'scripts', 'v47-war-test.js')),
        v464FortressRetained: true
      },
      stats: stats()
    };
  }

  return { subscribe, emit, emitPrintFulfillment, loadDemoRouter, stats, readiness };
}
module.exports = { createV47FinalFabric };
