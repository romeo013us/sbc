'use strict';

const os = require('node:os');

class SBCTelemetryEngine {
  constructor({ readPoolMetrics, now = Date.now, maxSnapshots = 100, alert = console.warn } = {}) {
    if (typeof readPoolMetrics !== 'function') {
      throw new TypeError('readPoolMetrics adapter is required; do not inspect private driver fields.');
    }
    if (!Number.isInteger(maxSnapshots) || maxSnapshots < 1 || maxSnapshots > 1000) {
      throw new RangeError('maxSnapshots must be an integer between 1 and 1000.');
    }
    this.readPoolMetrics = readPoolMetrics;
    this.now = now;
    this.maxSnapshots = maxSnapshots;
    this.alert = alert;
    this.metricsWindow = [];
  }

  async captureSystemSnapshot() {
    const memory = process.memoryUsage();
    const pool = await this.readPoolMetrics();
    const active = Number(pool.activeConnections);
    const free = Number(pool.freeConnections);
    const limit = Number(pool.connectionLimit);

    for (const [key, value] of Object.entries({ activeConnections: active, freeConnections: free, connectionLimit: limit })) {
      if (!Number.isFinite(value) || value < 0) throw new TypeError('Invalid pool metric: ' + key);
    }
    if (free > active || (limit > 0 && active > limit)) {
      throw new RangeError('Pool metrics are inconsistent; refusing to publish misleading telemetry.');
    }

    const snapshot = Object.freeze({
      timestamp: this.now(),
      memoryHeapUsed: memory.heapUsed,
      memoryHeapTotal: memory.heapTotal,
      rssBytes: memory.rss,
      cpuLoadAvg1m: os.loadavg()[0],
      activeConnections: active,
      freeConnections: free,
      connectionLimit: limit,
      poolUtilization: limit === 0 ? null : active / limit
    });

    this.metricsWindow.push(snapshot);
    if (this.metricsWindow.length > this.maxSnapshots) this.metricsWindow.splice(0, this.metricsWindow.length - this.maxSnapshots);

    if (limit > 0 && snapshot.poolUtilization >= 0.9) {
      this.alert('[SBC TELEMETRY] Database pool utilization at or above 90%.');
    }
    return snapshot;
  }

  getRecentSnapshots() {
    return this.metricsWindow.slice();
  }
}

module.exports = { SBCTelemetryEngine };
