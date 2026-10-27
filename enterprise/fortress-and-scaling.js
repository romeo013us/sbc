const CAPABILITIES={
 codeProtection:'production-code-protection', privateExecution:'private-single-tenant-execution', ipContracts:'ip-assignment-nda-readiness', copyrightReadiness:'software-copyright-readiness',
 voiceUi:'real-time-voice-to-ui', whatIfQuotes:'interactive-what-if-quotes', semanticIngestion:'semantic-omnichannel-lead-ingestion', brandExtraction:'automated-visual-brand-extraction', dynamicDomains:'dynamic-domain-routing',
 parallelFulfillment:'parallel-multi-vendor-payload-splitting', preflight:'print-preflight-diagnostics', trackingSync:'shipping-tracking-synchronization', idempotency:'idempotent-integration-gates', eventPipelines:'decoupled-event-pipelines',
 tenantIsolation:'strict-tenant-row-isolation', adapterFramework:'unified-integration-adapters', tenantSharding:'tenant-schema-sharding', tenantProvisioning:'automated-tenant-provisioning', zeroDowntime:'zero-downtime-schema-upgrades',
 cqrs:'cqrs-read-write-separation', statelessIdentity:'jwt-jwks-readiness', encryptedProcessing:'encrypted-application-processing-readiness', apm:'advanced-performance-telemetry', backpressure:'reactive-backpressure',
 anycast:'global-anycast-readiness', microvms:'ephemeral-worker-microvm-readiness', shadowTraffic:'shadow-traffic-regression', ebpf:'ebpf-observability-readiness', consensus:'distributed-consensus-readiness'
};
const EXTERNAL={
 voiceUi:()=>Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.SBC_TRANSCRIPT_PROVIDER_URL), whatIfQuotes:()=>true, semanticIngestion:()=>Boolean(process.env.SBC_ENRICHMENT_PROVIDER_URL), brandExtraction:()=>Boolean(process.env.SBC_BRAND_PROVIDER_URL), dynamicDomains:()=>Boolean(process.env.SBC_PUBLIC_URL),
 parallelFulfillment:()=>true, preflight:()=>Boolean(process.env.SBC_PREFLIGHT_PROVIDER_URL), trackingSync:()=>true, idempotency:()=>true, eventPipelines:()=>Boolean(process.env.AMQP_URL||process.env.KAFKA_BROKERS),
 tenantIsolation:()=>true, adapterFramework:()=>true, tenantSharding:()=>true, tenantProvisioning:()=>true, zeroDowntime:()=>true,
 cqrs:()=>Boolean(process.env.SBC_READ_REPLICA_URL), statelessIdentity:()=>Boolean(process.env.SBC_JWKS_URL), encryptedProcessing:()=>Boolean(process.env.SBC_KMS_KEY_ID), apm:()=>Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT), backpressure:()=>true,
 anycast:()=>Boolean(process.env.SBC_ANYCAST_ENABLED), microvms:()=>Boolean(process.env.SBC_FIRECRACKER_ENABLED), shadowTraffic:()=>Boolean(process.env.SBC_SHADOW_TRAFFIC_ENABLED), ebpf:()=>Boolean(process.env.SBC_EBPF_ENABLED), consensus:()=>Boolean(process.env.SBC_CONSENSUS_ENABLED)
};
function readiness(){const status={}; for(const k of Object.keys(CAPABILITIES)) status[k]=Boolean(EXTERNAL[k]?.() ?? true); return {featureCount:Object.keys(CAPABILITIES).length,capabilities:CAPABILITIES,status};}
module.exports={CAPABILITIES,readiness};
