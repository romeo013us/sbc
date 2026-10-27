'use strict';

// Kim Beast capability registry. These are explicit capability contracts,
// not claims that external infrastructure is already connected.
const CAPABILITIES = [
  ['adaptive_risk_auth','Adaptive risk-based authentication'],
  ['multi_region_sessions','Multi-region session state'],
  ['refresh_rotation','Refresh-token rotation'],
  ['oidc_sso','OIDC / enterprise SSO'],
  ['jwks_validation','JWKS validation'],
  ['edge_firewall','Edge/kernel firewall readiness'],
  ['tokenized_masking','Tokenized sensitive-data masking'],
  ['api_gateway','Perimeter API gateway throttling'],
  ['secure_enclave','Hardware-bound secret enclave readiness'],
  ['production_obfuscation','Production code protection'],
  ['multicast_fulfillment','Parallel multi-vendor routing'],
  ['idempotency','Exactly-once/idempotent outbound gates'],
  ['async_broker','AMQP/Kafka event offloading'],
  ['webhook_reconciliation','Webhook reconciliation'],
  ['print_preflight','Automated print preflight'],
  ['server_driven_ui','Server-driven UI'],
  ['realtime_broadcast','WebSocket realtime broadcasting'],
  ['tenant_context','Tenant context isolation'],
  ['provider_adapters','Provider adapter contracts'],
  ['long_running_workflows','Durable workflow state machines'],
  ['structured_logging','Structured JSON logging'],
  ['apm','Application performance monitoring'],
  ['chaos_sandbox','Sandbox chaos testing'],
  ['cqrs','CQRS/read-path isolation'],
  ['blue_green','Zero-downtime blue/green migrations'],
  ['edge_ui','Edge-side UI composition'],
  ['edge_auth','Edge token interception readiness'],
  ['multi_cdn','Multi-CDN failover readiness'],
  ['global_cache','Distributed cache invalidation'],
  ['database_rls','Database-level tenant security readiness'],
  ['tenant_sharding','Tenant schema/shard isolation'],
  ['tenant_quarantine','Tenant resource quarantine'],
  ['tenant_provisioning','Automated tenant provisioning'],
  ['homomorphic_crypto','Homomorphic/encrypted-compute readiness'],
  ['zero_trust_mesh','Zero-trust internal service mesh'],
  ['cryptographic_policy','Cryptographic access policies'],
  ['backpressure','Reactive backpressure'],
  ['event_ledger','Immutable event-sourced ledger'],
  ['ebpf','eBPF observability readiness'],
  ['self_healing_chaos','Self-healing chaos routines']
];

function status(env=process.env){
  const configured = new Set();
  const checks = {
    adaptive_risk_auth: !!env.SBC_RISK_AUTH_ENABLED,
    multi_region_sessions: !!env.SBC_REDIS_URL,
    refresh_rotation: true,
    oidc_sso: !!env.SBC_OIDC_ISSUER,
    jwks_validation: env.SBC_AUTH_MODE === 'jwt',
    edge_firewall: !!env.SBC_EDGE_SECURITY_URL,
    tokenized_masking: true,
    api_gateway: !!env.SBC_API_GATEWAY_URL,
    secure_enclave: !!env.SBC_SECRET_PROVIDER,
    production_obfuscation: true,
    multicast_fulfillment: true,
    idempotency: true,
    async_broker: !!env.SBC_AMQP_URL,
    webhook_reconciliation: true,
    print_preflight: true,
    server_driven_ui: true,
    realtime_broadcast: !!env.SBC_WS_URL,
    tenant_context: true,
    provider_adapters: true,
    long_running_workflows: !!env.SBC_ORCHESTRATION,
    structured_logging: true,
    apm: !!env.OTEL_EXPORTER_OTLP_ENDPOINT,
    chaos_sandbox: String(env.SBC_CHAOS_ENABLED||'false') === 'true',
    cqrs: !!env.SBC_DB_READ_URL,
    blue_green: !!env.SBC_BLUE_GREEN_ENABLED,
    edge_ui: !!env.SBC_EDGE_UI_URL,
    edge_auth: !!env.SBC_EDGE_AUTH_URL,
    multi_cdn: !!env.SBC_MULTI_CDN_URL,
    global_cache: !!env.SBC_REDIS_URL,
    database_rls: !!env.SBC_DB_RLS,
    tenant_sharding: !!env.SBC_TENANT_SHARD_ROUTER,
    tenant_quarantine: true,
    tenant_provisioning: true,
    homomorphic_crypto: !!env.SBC_CONFIDENTIAL_COMPUTE,
    zero_trust_mesh: String(env.SBC_ZERO_TRUST_MODE||'off') !== 'off',
    cryptographic_policy: true,
    backpressure: true,
    event_ledger: true,
    ebpf: !!env.SBC_EBPF_ENABLED,
    self_healing_chaos: String(env.SBC_CHAOS_ENABLED||'false') === 'true'
  };
  CAPABILITIES.forEach(([id])=>{ if(checks[id]) configured.add(id); });
  return {total:CAPABILITIES.length, configured:configured.size, capabilities:Object.fromEntries(CAPABILITIES.map(([id,name])=>[id,{name,status:checks[id]?'READY':'STANDBY'}]))};
}

function kimBrief(env=process.env){
  const s=status(env);
  return {mode:'Kim Beast / Master Mechanic', version:'30.10.4', capabilityCount:s.total, configured:s.configured, protectedOwnerActions:true, externalProvidersRemainGated:true, capabilities:s.capabilities};
}
module.exports={CAPABILITIES,status,kimBrief};
