'use strict';

const assert = require('node:assert/strict');
const { SBCTelemetryEngine } = require('./v6604-telemetry-engine');

(async () => {
  let warned = 0;
  let tick = 100;
  const engine = new SBCTelemetryEngine({
    readPoolMetrics: async () => ({ activeConnections: 10, freeConnections: 1, connectionLimit: 10 }),
    now: () => tick++,
    maxSnapshots: 2,
    alert: () => warned++
  });
  const first = await engine.captureSystemSnapshot();
  assert.equal(first.poolUtilization, 1);
  assert.equal(warned, 1);
  await engine.captureSystemSnapshot();
  await engine.captureSystemSnapshot();
  assert.equal(engine.getRecentSnapshots().length, 2, 'snapshot history remains bounded');
  assert.equal(engine.getRecentSnapshots()[0].timestamp, 101, 'oldest snapshot is evicted');
  assert.throws(() => new SBCTelemetryEngine(), /readPoolMetrics adapter is required/);

  const invalid = new SBCTelemetryEngine({
    readPoolMetrics: async () => ({ activeConnections: 2, freeConnections: 3, connectionLimit: 10 }),
    alert: () => {}
  });
  await assert.rejects(invalid.captureSystemSnapshot(), /Pool metrics are inconsistent/);
  console.log('SBC V6604 telemetry engine tests: PASS');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
