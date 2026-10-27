const crypto = require('crypto');

const TRACKS = {
  crdt: 'global-multi-master-crdt-foundation',
  predictiveScaling: 'predictive-autoscaling-foundation',
  chaosRecovery: 'continuous-chaos-recovery-foundation',
  semanticMetadata: 'dynamic-semantic-metadata-layer',
  shadowTraffic: 'shadow-traffic-regression-foundation',
  eventSourcing: 'immutable-event-ledger-foundation',
  edgeRuntime: 'edge-execution-foundation',
  cacheInvalidation: 'global-cache-invalidation-foundation',
  apiFederation: 'graphql-federation-foundation',
  blueGreen: 'zero-downtime-blue-green-migration-foundation'
};

function hashEvent(previousHash, event) {
  return crypto.createHash('sha256').update(`${previousHash || ''}|${JSON.stringify(event)}`).digest('hex');
}

// Safe deterministic register merge for metadata/configuration. This is a CRDT-ready
// foundation, not a claim of globally replicated CRDT storage.
function mergeRegisters(left = {}, right = {}) {
  const out = {...left};
  for (const [key, rv] of Object.entries(right || {})) {
    const lv = out[key];
    if (!lv || Number(rv?.timestamp || 0) > Number(lv?.timestamp || 0) ||
        (Number(rv?.timestamp || 0) === Number(lv?.timestamp || 0) && String(rv?.nodeId || '') > String(lv?.nodeId || ''))) out[key] = rv;
  }
  return out;
}

function readiness(env = process.env) {
  return {
    tracks: TRACKS,
    status: {
      crdt: Boolean(env.SBC_CRDT_PROVIDER_URL || env.SBC_GLOBAL_DB_PROVIDER),
      predictiveScaling: Boolean(env.SBC_PREDICTIVE_SCALING_PROVIDER),
      chaosRecovery: String(env.SBC_CHAOS_ENABLED || 'false') === 'true',
      semanticMetadata: true,
      shadowTraffic: Boolean(env.SBC_SHADOW_TRAFFIC_TARGET),
      eventSourcing: true,
      edgeRuntime: Boolean(env.SBC_EDGE_PROVIDER),
      cacheInvalidation: Boolean(env.SBC_REDIS_URL || env.REDIS_URL),
      apiFederation: Boolean(env.SBC_GRAPHQL_FEDERATION_URL),
      blueGreen: Boolean(env.SBC_DEPLOYMENT_CONTROLLER_URL)
    },
    safety: {
      productionChaosBlockedByDefault: String(env.SBC_CHAOS_ENABLED || 'false') !== 'true',
      shadowTrafficReadOnlyByDefault: true,
      externalReplicationRequiresExplicitProvider: true,
      edgeDeploymentRequiresExplicitProvider: true,
      noClaimsOfGlobalReplicationWithoutInfrastructure: true
    }
  };
}

module.exports = {TRACKS, hashEvent, mergeRegisters, readiness};
