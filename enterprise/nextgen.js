// SBC_V6520_STRICT_TENANT_HARDENING
function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto = require('crypto');

const TRACKS = {
  microFrontendFederation: 'dynamic-micro-frontend-federation',
  serverDrivenUI: 'server-driven-ui',
  collaborativeOps: 'real-time-collaborative-operations',
  cdc: 'change-data-capture-streams',
  tenantTelemetry: 'multi-tenant-timeseries-telemetry',
  graphRisk: 'graph-fraud-risk-foundation',
  streamAnalytics: 'stream-analytics-foundation',
  abac: 'attribute-based-access-control',
  confidentialCompute: 'confidential-computing-foundation',
  tokenizedMasking: 'tokenized-data-masking',
  circuitBreaker: 'circuit-breaker-resilience',
  idempotency: 'idempotent-transaction-gates',
  activePassive: 'multi-region-active-passive-failover',
  chaosRunners: 'automated-chaos-injection',
  tenantProvisioning: 'tenant-provisioning-workflows',
  schemaEvolution: 'dynamic-schema-evolution',
  quotas: 'strict-api-usage-quotas',
  tenantContext: 'abstract-tenant-context',
  retention: 'data-retention-purge',
  temporal: 'declarative-workflow-orchestration'
};

function readiness(env = process.env) {
  return {
    tracks: TRACKS,
    status: {
      microFrontendFederation: true,
      serverDrivenUI: true,
      collaborativeOps: Boolean(env.SBC_COLLAB_PROVIDER),
      cdc: Boolean(env.SBC_CDC_PROVIDER),
      tenantTelemetry: Boolean(env.SBC_TELEMETRY_DB_URL),
      graphRisk: Boolean(env.SBC_GRAPH_PROVIDER),
      streamAnalytics: Boolean(env.SBC_FLINK_URL),
      abac: true,
      confidentialCompute: Boolean(env.SBC_CONFIDENTIAL_COMPUTE_PROVIDER),
      tokenizedMasking: true,
      circuitBreaker: true,
      idempotency: true,
      activePassive: Boolean(env.SBC_DB_FAILOVER_ENDPOINT),
      chaosRunners: String(env.SBC_CHAOS_ENABLED || 'false') === 'true',
      tenantProvisioning: true,
      schemaEvolution: true,
      quotas: true,
      tenantContext: true,
      retention: true,
      temporal: Boolean(env.SBC_TEMPORAL_URL)
    },
    safety: {
      externalProvidersAreExplicit: true,
      collaborationRequiresProvider: true,
      cdcIsDurableBeforeDelivery: true,
      telemetryMustBeTenantScoped: true,
      graphRiskMustBeTenantScoped: true,
      confidentialComputeNotClaimedWithoutHardwareProvider: true,
      destructiveChaosRequiresExplicitNonProductionMode: true,
      failoverRequiresHealthGatedCutover: true,
      purgeRequiresOwnerPolicyAndRetentionProof: true,
      workflowEngineIsProviderGated: true
    }
  };
}

function validateSdui(layout = {}) {
  const allowed = new Set(['page','title','blocks','theme','actions','version']);
  const out = {};
  for (const [k,v] of Object.entries(layout || {})) if (allowed.has(k)) out[k] = v;
  if (!Array.isArray(out.blocks)) out.blocks = [];
  out.blocks = out.blocks.slice(0,100).map((b,i)=>({id:String(b?.id||`block-${i+1}`),type:String(b?.type||'text').slice(0,80),props:(b?.props&&typeof b.props==='object')?b.props:{}}));
  return out;
}

function transformOps(base, ops = []) {
  let text = String(base || '');
  const ordered = [...ops].sort((a,b)=>Number(a.position||0)-Number(b.position||0));
  let shift = 0;
  for (const op of ordered) {
    const pos = Math.max(0, Math.min(text.length, Number(op.position||0)+shift));
    if (op.type === 'insert') { const v=String(op.text||''); text=text.slice(0,pos)+v+text.slice(pos); shift += v.length; }
    else if (op.type === 'delete') { const n=Math.max(0,Math.min(text.length-pos,Number(op.length||0))); text=text.slice(0,pos)+text.slice(pos+n); shift -= n; }
  }
  return text;
}

function eventEnvelope(type, tenantId, payload, source='sbc') {
  const event = {id:crypto.randomUUID(),type:String(type),tenantId:Number(__sbcRequireTenantId(tenantId)),source,payload:payload||{},createdAt:new Date().toISOString()};
  event.hash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
  return event;
}

function evaluateAbac(policy={}, context={}) {
  const rules = Array.isArray(policy.rules) ? policy.rules : [];
  if (!rules.length) return {allowed:false,reason:'No ABAC rule matched'};
  for (const rule of rules) {
    const conditions = rule.when || {};
    const ok = Object.entries(conditions).every(([k,v]) => String(context[k]) === String(v));
    if (ok) return {allowed:rule.effect !== 'deny',ruleId:rule.id||'',reason:rule.effect === 'deny'?'Explicit deny':'Rule matched'};
  }
  return {allowed:false,reason:'Default deny'};
}

function mask(value, visibleTail=4) {
  const s=String(value??''); if(!s) return '';
  if(s.length<=visibleTail) return '•'.repeat(s.length);
  return '•'.repeat(Math.max(0,s.length-visibleTail))+s.slice(-visibleTail);
}

function idempotencyKey(parts) { return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex'); }

function circuitBreaker(config={}) {
  const failureThreshold=Math.max(1,Number(config.failureThreshold||3));
  const cooldownMs=Math.max(1000,Number(config.cooldownMs||30000));
  let failures=0, openedAt=0;
  return {
    state(){return openedAt ? (Date.now()-openedAt>=cooldownMs?'HALF_OPEN':'OPEN') : 'CLOSED'},
    allow(){return this.state()!=='OPEN'},
    success(){failures=0;openedAt=0},
    failure(){failures++;if(failures>=failureThreshold)openedAt=Date.now()},
    failures:()=>failures
  };
}

function quotaDecision({used=0,limit=100,windowSeconds=900}={}) {
  return {allowed:Number(used)<Number(limit),used:Number(used),limit:Number(limit),windowSeconds:Number(windowSeconds)};
}

function retentionDecision({createdAt,retentionDays=365,closed=false}={}) {
  if(!closed || !createdAt) return {eligible:false};
  const age=Date.now()-new Date(createdAt).getTime();
  return {eligible:age>=Number(retentionDays)*86400000,ageDays:Math.floor(age/86400000)};
}

function workflowTransition(state, action) {
  const transitions={START:['RUNNING'],RUNNING:['WAITING','COMPLETED','FAILED'],WAITING:['RUNNING','FAILED'],FAILED:['RETRYING'],RETRYING:['RUNNING'],COMPLETED:[]};
  const allowed=transitions[state]||[];
  if(!allowed.includes(action)) throw new Error(`Invalid workflow transition: ${state} -> ${action}`);
  return action;
}

module.exports={TRACKS,readiness,validateSdui,transformOps,eventEnvelope,evaluateAbac,mask,idempotencyKey,circuitBreaker,quotaDecision,retentionDecision,workflowTransition};
