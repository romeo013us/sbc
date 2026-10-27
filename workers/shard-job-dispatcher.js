'use strict';

/**
 * V58.3 shard dispatcher.
 * Routes durable Agent OS jobs by event type while preserving one DB-owned
 * event lifecycle. Unknown jobs fail safely instead of being silently dropped.
 */
class ShardJobDispatcher {
  constructor({ handlers = {} } = {}) {
    this.handlers = handlers;
  }

  async dispatch(job, context) {
    const handler = this.handlers[job.event_type];
    if (!handler) {
      throw new Error(`NO_HANDLER_FOR_EVENT:${job.event_type}`);
    }
    return handler(job, context);
  }
}

module.exports = ShardJobDispatcher;
