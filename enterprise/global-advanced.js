const crypto = require('crypto');

const ADVANCED_TRACKS = {
  anycastFailover: 'global-bgp-anycast-failover-foundation',
  polymorphicContracts: 'self-assembling-api-contracts-foundation',
  zeroKnowledgeIsolation: 'zero-knowledge-tenant-isolation-foundation',
  graphInference: 'distributed-graph-inference-foundation',
  microVm: 'ephemeral-micro-vm-foundation',
  backpressure: 'distributed-event-backpressure-foundation',
  hotSwap: 'live-runtime-patch-foundation',
  formalVerification: 'formal-verification-foundation',
  ebpf: 'ebpf-kernel-observability-foundation',
  consensus: 'distributed-consensus-foundation'
};

function readiness(env = process.env, fs = null, path = null) {
  return {
    tracks: ADVANCED_TRACKS,
    status: {
      anycastFailover: Boolean(env.SBC_ANYCAST_PROVIDER && env.SBC_GLOBAL_ROUTER_URL),
      polymorphicContracts: true,
      zeroKnowledgeIsolation: Boolean(env.SBC_ZK_PROVIDER),
      graphInference: Boolean(env.SBC_GRAPH_PROVIDER),
      microVm: Boolean(env.SBC_MICROVM_PROVIDER),
      backpressure: true,
      hotSwap: String(env.SBC_HOT_SWAP_ENABLED || 'false') === 'true',
      formalVerification: Boolean(env.SBC_FORMAL_SPEC_PATH),
      ebpf: Boolean(env.SBC_EBPF_AGENT_URL),
      consensus: Boolean(env.SBC_CONSENSUS_PROVIDER)
    },
    safety: {
      anycastRequiresExternalProvider: true,
      adaptiveVendorParsingMustRemainSchemaValidated: true,
      homomorphicEncryptionNotEnabledWithoutExplicitProvider: true,
      graphDataMustRespectTenantBoundary: true,
      microVmExecutionMustBeIsolated: true,
      backpressureQueueIsDurable: true,
      hotSwapDisabledByDefault: String(env.SBC_HOT_SWAP_ENABLED || 'false') !== 'true',
      formalVerificationIsPreReleaseEvidenceNotRuntimeProof: true,
      ebpfRequiresHostKernelSupport: true,
      consensusRequiresQuorumProvider: true
    }
  };
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeVendorPayload(payload = {}, schema = {}) {
  const out = {};
  const fields = schema.fields || {};
  for (const [target, source] of Object.entries(fields)) {
    const path = Array.isArray(source) ? source : String(source).split('.');
    let value = payload;
    for (const part of path) value = value == null ? undefined : value[part];
    out[target] = value;
  }
  return out;
}

function mergeByLamport(left = {}, right = {}) {
  const out = {...left};
  for (const [key, rv] of Object.entries(right)) {
    const lv = out[key];
    const rClock = Number(rv?.clock || 0);
    const lClock = Number(lv?.clock || 0);
    if (!lv || rClock > lClock || (rClock === lClock && String(rv?.nodeId || '') > String(lv?.nodeId || ''))) out[key] = rv;
  }
  return out;
}

function tokenBucket(capacity, refillPerSecond) {
  let tokens = capacity, last = Date.now();
  return { take(cost = 1) {
    const now = Date.now();
    tokens = Math.min(capacity, tokens + ((now-last)/1000)*refillPerSecond);
    last = now;
    if (tokens < cost) return false;
    tokens -= cost; return true;
  }};
}

function consensusDigest(proposal, votes) {
  const quorum = Math.floor(votes.length / 2) + 1;
  const approvals = votes.filter(v => v.approve).length;
  return {approved: approvals >= quorum, approvals, quorum, digest: stableHash({proposal, votes})};
}

module.exports = {ADVANCED_TRACKS, readiness, stableHash, normalizeVendorPayload, mergeByLamport, tokenBucket, consensusDigest};
