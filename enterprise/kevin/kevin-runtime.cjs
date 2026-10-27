'use strict';

/**
 * SBC V64.2.28 — HARDENED SOVEREIGN EXECUTIVE RUNTIME
 *
 * OBSERVE -> MODEL -> PREDICT -> DECIDE -> SIMULATE -> COUNCIL -> RED TEAM
 * -> INDEPENDENT VERIFY -> GOVERNANCE -> EXECUTE/STAGE -> VERIFY -> AUDIT
 *
 * Design rule: intelligence may be autonomous; authority is bounded.
 * Romeo remains the sovereign owner. No autonomous money movement, credential
 * mutation, unrestricted production mutation, or self-escalation is permitted.
 */
const crypto = require('crypto');
const {confirmedPaid}=require('../v6640-payment-evidence.cjs');
const vetoStore=require('./owner-veto-store.cjs');
// SBC_V6643_DURABLE_OWNER_VETO_AND_KEVIN_REVENUE
const path = require('path');
const { KimExecutiveBriefing } = require('../kim-executive-briefing.cjs');

let runtime = null;

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function deterministicIdempotencyKey({ proposalId, type, targetActionSuite, simulationSeed }) {
  return sha256(stableJson({
    proposalId: String(proposalId || ''),
    type: String(type || ''),
    targetActionSuite: String(targetActionSuite || ''),
    simulationSeed: String(simulationSeed || '')
  }));
}

function summarizeDb(db) {
  const arr = (k) => Array.isArray(db?.[k]) ? db[k] : [];
  const leads = arr('leads');
  const customers = arr('customers');
  const quotes = arr('quotes');
  const orders = arr('orders');
  const fulfillment = arr('fulfillmentJobs');
  const warm = leads.filter(x => String(x?.temperature || x?.leadTemperature || x?.status || '').toLowerCase().includes('warm')).length;
  const hot = leads.filter(x => String(x?.temperature || x?.leadTemperature || x?.status || '').toLowerCase().includes('hot')).length;
  const collectedRevenue = orders.reduce((n,o) => n + (confirmedPaid(o) ? Number(o?.paidAmount ?? o?.amountPaid ?? o?.totalPaid ?? o?.total ?? o?.price ?? 0) : 0), 0);
  return {
    customers: customers.length,
    leads: leads.length,
    warmLeads: warm,
    hotLeads: hot,
    openQuotes: quotes.filter(q => !['paid','closed','cancelled','rejected'].includes(String(q?.status||'').toLowerCase())).length,
    orders: orders.length,
    collectedRevenue,
    grossProfit: orders.reduce((n,o) => n + Number(o?.grossProfit ?? 0), 0),
    cashAvailable: Number(db?.cashAvailable ?? 0),
    fulfillmentBacklog: fulfillment.filter(j => !['completed','cancelled','delivered'].includes(String(j?.status||'').toLowerCase())).length,
    overdueActions: Array.isArray(db?.actions) ? db.actions.filter(a => a?.dueAt && new Date(a.dueAt) < new Date() && !['done','completed'].includes(String(a.status||'').toLowerCase())).length : 0,
    automationFailures: 0,
    capacity: { sales:Number(db?.salesCapacity||0), fulfillment:Number(db?.fulfillmentCapacity||0), engineering:Number(db?.engineeringCapacity||0) }
  };
}

class HardenedControlPlane {
  constructor({ rootDir, mysqlPoolGetter, stateKernel, evolutionEngine, config }) {
    this.rootDir = rootDir;
    this.mysqlPoolGetter = mysqlPoolGetter;
    this.stateKernel = stateKernel;
    this.evolutionEngine = evolutionEngine;
    this.config = config;
    this.cycleActive = false;
    this.cycleId = null;
    this.lastHeartbeat = null;
    this.lastIndependentVerification = null;
    this.lastExecutionVerification = null;
    this.auditTail = 'GENESIS';
    this.startedAt = new Date().toISOString();
    this.metrics = { cyclesStarted:0, cyclesCompleted:0, cyclesSkippedOverlap:0, greenExecuted:0, yellowStaged:0, redBlocked:0, duplicatesPrevented:0, verificationFailures:0 };
    this.capitalForecast = null;
    this.kimBriefing = null;
  }

  pool() { try { return this.mysqlPoolGetter?.() || null; } catch (_) { return null; } }

  async ensureSchema() {
    const pool = this.pool();
    if (!pool) return { ok:false, mode:'MEMORY_FALLBACK' };
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_kevin_runtime_ledger (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      proposal_id VARCHAR(191) NOT NULL,
      idempotency_key CHAR(64) NOT NULL,
      action_type VARCHAR(120) NOT NULL,
      target_action_suite VARCHAR(191) NOT NULL DEFAULT '',
      autonomy_band VARCHAR(16) NOT NULL,
      status VARCHAR(40) NOT NULL,
      result_json LONGTEXT NULL,
      previous_hash CHAR(64) NOT NULL,
      entry_hash CHAR(64) NOT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY(id),
      UNIQUE KEY uq_kevin_runtime_idem(tenant_id,idempotency_key),
      KEY idx_kevin_runtime_status(created_at,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    return { ok:true, mode:'MYSQL' };
  }

  async ledgerGet(tenantId, idempotencyKey) {
    const pool = this.pool();
    if (!pool) return null;
    const [rows] = await pool.query('SELECT * FROM sbc_kevin_runtime_ledger WHERE tenant_id=? AND idempotency_key=? LIMIT 1', [tenantId, idempotencyKey]);
    return rows[0] || null;
  }

  async ledgerAppend({ tenantId=1, proposalId, idempotencyKey, actionType, targetActionSuite, autonomyBand, status, result }) {
    const resultJson = JSON.stringify(result ?? {});
    const previousHash = this.auditTail;
    const entryHash = sha256(stableJson({ tenantId, proposalId, idempotencyKey, actionType, targetActionSuite, autonomyBand, status, resultJson, previousHash }));
    this.auditTail = entryHash;
    const pool = this.pool();
    if (pool) {
      try {
        await pool.query(`INSERT INTO sbc_kevin_runtime_ledger(tenant_id,proposal_id,idempotency_key,action_type,target_action_suite,autonomy_band,status,result_json,previous_hash,entry_hash,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`, [tenantId, proposalId, idempotencyKey, actionType, targetActionSuite, autonomyBand, status, resultJson, previousHash, entryHash]);
      } catch (e) {
        // A UNIQUE(idempotency_key) race is a successful duplicate prevention,
        // not a runtime failure.
        if (e?.code !== 'ER_DUP_ENTRY') throw e;
        const existing = await this.ledgerGet(tenantId, idempotencyKey);
        return { previousHash: existing?.previous_hash || previousHash, entryHash: existing?.entry_hash || entryHash, duplicate:true };
      }
    }
    return { previousHash, entryHash };
  }

  async verifyIndependent({ proposal, simulation, council, adversarial }) {
    // Independent verifier deliberately does not call Kevin's decision engine.
    // It recomputes the safety evidence from immutable proposal inputs.
    const seed = sha256(stableJson({ proposal, simulationSeed: proposal.simulationSeed || 'V64.1' }));
    let x = parseInt(seed.slice(0, 8), 16) >>> 0;
    let passedCases = 0;
    let securityViolations = 0;
    let tenantIsolationViolations = 0;
    let performanceFloor = 1;
    const cases = 10000;
    for (let i = 0; i < cases; i++) {
      x = (Math.imul(1664525, x) + 1013904223) >>> 0;
      const perturb = x / 0x100000000;
      const risk = Number(proposal.risk || 0) * (0.5 + perturb * 1.5);
      const profit = Number(proposal.expectedGrossProfitGain || 0) * (0.25 + perturb * 1.25) - Number(proposal.cost || 0);
      const secure = !proposal.bypassesGovernance && !proposal.credentialMutation && !proposal.unrestrictedProductionMutation;
      const isolated = proposal.crossTenantMutation !== true;
      const performance = 1 - Math.min(0.05, Number(proposal.performanceDeltaPct || 0) / 100);
      if (risk <= 1 && profit >= -Math.max(100, Number(proposal.cost || 0))) passedCases++;
      if (!secure) securityViolations++;
      if (!isolated) tenantIsolationViolations++;
      performanceFloor = Math.min(performanceFloor, performance);
    }
    const passed = passedCases >= 10000 && securityViolations === 0 && tenantIsolationViolations === 0 && performanceFloor >= 0.95 && simulation?.pass === true && council?.consensus === true && adversarial?.pass === true;
    return { passed, cases, passedCases, securityViolations, tenantIsolationViolations, performanceFloor, seed, threshold:{passedCases:10000,securityViolations:0,tenantIsolationViolations:0,performanceDeltaFloor:0.95} };
  }

  classify(action, independent) {
    const p = action?.payload || action || {};
    const actionType = String(action?.type || p.type || '').toUpperCase();
    if (this.config.governance?.ownerVetoActive) return 'RED';
    if (p.credentialMutation || p.type === 'CREDENTIAL_MUTATION' || p.unrestrictedProductionMutation || p.directProductionMutation || p.irreversible || p.financialMutation || p.moneyMovement || p.paymentCapture || p.refund || p.crossTenantMutation) return 'RED';
    const safeGreen = new Set(['HEALTH_CHECK','REPORT_GENERATION','LEAD_CLASSIFICATION','LEAD_ENRICHMENT','NOTIFICATION','CRM_READ','ANALYTICS_REFRESH']);
    if (safeGreen.has(actionType) && independent?.passed) return 'GREEN';
    return 'YELLOW';
  }

  async verifyPostExecution(result) {
    const pool = this.pool();
    let database = { ok:true, mode:'NO_DB_CHECK' };
    if (pool) {
      try { await pool.query('SELECT 1 AS ok'); database = { ok:true, mode:'MYSQL' }; }
      catch (e) { database = { ok:false, mode:'MYSQL', error:String(e.message || e) }; }
    }
    let adapter = { ok:true, mode:'GOVERNED' };
    if (result?.executionVerification && result.executionVerification.ok === false) adapter = result.executionVerification;
    const ok = database.ok && adapter.ok;
    this.lastExecutionVerification = { ok, database, adapter, at:new Date().toISOString() };
    if (!ok) this.metrics.verificationFailures++;
    return this.lastExecutionVerification;
  }

  async routeAction({ tenantId=1, result, dryRun=true }) {
    const directive = result.directive || {};
    const payload = directive.payload || {};
    const proposalId = result.proposalId || directive.id || crypto.randomUUID();
    const type = String(directive.type || 'UNKNOWN');
    const targetActionSuite = String(payload.targetActionSuite || payload.target || type);
    const simulationSeed = String(payload.simulationSeed || result.simulation?.proposalId || proposalId);
    const idempotencyKey = deterministicIdempotencyKey({ proposalId, type, targetActionSuite, simulationSeed });
    const tenant = Number(tenantId || 1);
    const existing = await this.ledgerGet(tenant, idempotencyKey);
    if (existing) { this.metrics.duplicatesPrevented++; return { status:'DUPLICATE_PREVENTED', idempotencyKey, ledgerId:existing.id, autonomyBand:existing.autonomy_band }; }

    const independent = await this.verifyIndependent({ proposal:{...payload, id:proposalId, type, simulationSeed}, simulation:result.simulation, council:result.council, adversarial:result.adversarial });
    this.lastIndependentVerification = independent;
    const autonomyBand = this.classify({type,payload}, independent);
    let status = 'BLOCKED';
    let execution = { status:'BLOCKED', reason:'governance_default' };

    if (this.config.governance?.ownerVetoActive) {
      status='FROZEN';execution={status:'FROZEN',reason:'OWNER_VETO'};this.metrics.redBlocked++;
    } else if (autonomyBand === 'GREEN' && !dryRun) {
      try {
        const adapterResult = await this.executeSafe(payload);
        execution = { status:'EXECUTED', result:adapterResult };
        status = 'EXECUTED';
        this.metrics.greenExecuted++;
      } catch (error) {
        execution = { status:'FAILED', error:String(error.message || error) };
        status = 'FAILED';
      }
    } else if (autonomyBand === 'GREEN') {
      execution = { status:'SIMULATED', reason:'dry_run_default' };
      status = 'SIMULATED';
    } else if (autonomyBand === 'YELLOW') {
      execution = await this.stageYellow({ tenantId:tenant, proposalId, type, payload, idempotencyKey });
      status = execution.status;
      this.metrics.yellowStaged++;
    } else {
      execution = { status:'FROZEN', reason:'RED_AUTONOMY_REQUIRES_ROMEO_APPROVAL' };
      status = 'FROZEN';
      this.metrics.redBlocked++;
    }

    const post = (status === 'EXECUTED') ? await this.verifyPostExecution(execution) : { ok:true, mode:'NOT_REQUIRED' };
    const audit = await this.ledgerAppend({ tenantId:tenant, proposalId, idempotencyKey, actionType:type, targetActionSuite, autonomyBand, status, result:{ independent, execution, post } });
    return { proposalId, idempotencyKey, autonomyBand, status, independentVerification:independent, execution, postExecutionVerification:post, audit };
  }

  async executeSafe(payload) {
    if(this.config.governance?.ownerVetoActive)throw Error('KEVIN_OWNER_VETO_ACTIVE');
    // Green actions are intentionally non-destructive. External integrations are
    // read-only here; mutations stay in the governed evolution/staging path.
    const type = String(payload.type || payload.actionType || '').toUpperCase();
    if (!['HEALTH_CHECK','REPORT_GENERATION','LEAD_CLASSIFICATION','LEAD_ENRICHMENT','NOTIFICATION','CRM_READ','ANALYTICS_REFRESH'].includes(type)) throw new Error('GREEN_ACTION_NOT_ALLOWLISTED');
    return { ok:true, type, executedBy:'SBC_V64.2.28_HARDENED_RUNTIME', destructive:false, financialMutation:false };
  }

  async stageYellow({ tenantId, proposalId, type, payload, idempotencyKey }) {
    if(this.config.governance?.ownerVetoActive)return {status:'FROZEN',reason:'OWNER_VETO'};
    if (this.evolutionEngine?.stage) {
      try {
        const proposal = await this.evolutionEngine.stage({ tenantId, intent:`Kevin staged governed action ${type}`, context:{ proposalId, payload, idempotencyKey, source:'KEVIN_V64.2.28_HARDENED_RUNTIME' } });
        return { status:'STAGED', proposalId:proposal?.id || proposalId, evolutionProposal:proposal, requiresKimReview:true, requiresOwnerApproval:Boolean(payload.irreversible || payload.financialMutation) };
      } catch (error) {
        return { status:'STAGED_LOCAL', requiresKimReview:true, requiresOwnerApproval:Boolean(payload.irreversible || payload.financialMutation), stagingError:String(error.message || error) };
      }
    }
    return { status:'STAGED_LOCAL', requiresKimReview:true, requiresOwnerApproval:Boolean(payload.irreversible || payload.financialMutation) };
  }

  async run({ core, dbGetter, dryRun=true, tenantId=1 }) {
    if (this.cycleActive) {
      this.metrics.cyclesSkippedOverlap++;
      return { ok:true, skipped:true, reason:'SINGLE_FLIGHT_ACTIVE', cycleId:this.cycleId };
    }
    this.cycleActive = true;
    this.cycleId = crypto.randomUUID();
    this.metrics.cyclesStarted++;
    try {
      const snapshot = summarizeDb(dbGetter?.() || {});
      await core.observe({ type:'HARDENED_BUSINESS_SNAPSHOT', source:'sbc-v64.2.26', payload:{snapshot, cycleId:this.cycleId} });
      const cycle = await core.cognitiveCycle({ dryRun:true });
      const routed = [];
      for (const result of cycle.results || []) {
        routed.push(await this.routeAction({ tenantId, result, dryRun }));
      }
      this.metrics.cyclesCompleted++;
      this.lastHeartbeat = { ok:true, cycleId:this.cycleId, ts:new Date().toISOString(), dryRun, snapshot, routed, metrics:{...this.metrics} };
      return this.lastHeartbeat;
    } finally {
      this.cycleActive = false;
      this.cycleId = null;
    }
  }

  status() {
    return { version:'64.2.28', signature:'KEVIN_V64.2.28_HARDENED_SOVEREIGN_RUNTIME', running:true, singleFlight:{active:this.cycleActive,cycleId:this.cycleId}, ownerVeto:Boolean(this.config.governance?.ownerVetoActive), financialMutations:'BLOCKED_BY_DESIGN', capitalForecast:'READ_ONLY_STAGED', credentialMutations:'BLOCKED_BY_DESIGN', unrestrictedProductionMutations:'BLOCKED_BY_DESIGN', lastHeartbeat:this.lastHeartbeat?.ts || null, lastIndependentVerification:this.lastIndependentVerification, lastExecutionVerification:this.lastExecutionVerification, metrics:{...this.metrics}, startedAt:this.startedAt };
  }
}

async function startKevinV6422({app, dbGetter, mysqlPoolGetter, stateKernel, evolutionEngine, auth, ownerOnly, rootDir, recoveryRequired=false}) {
  if (runtime) return runtime;
  const [{createKevin}, fsmod] = await Promise.all([
    import(pathToFileURL(path.join(rootDir,'enterprise/kevin/kevin-kernel.js')).href),
    import('fs')
  ]);
  const fs = fsmod.default || fsmod;
  const configPath = path.join(rootDir,'config/kevin-v63.json');
  const config = JSON.parse(fs.readFileSync(configPath,'utf8'));
  config.version = '64.2.28';
  config.execution = {...config.execution, dryRunDefault:true, requireSimulationForRisky:true, requireVerification:true, allowIrreversibleWithoutOwner:false};
  const vetoReceipt=vetoStore.read(rootDir);
  config.governance = {...config.governance, ownerVetoActive:vetoReceipt.active, credentialModification:false, unrestrictedProductionMutation:false, selfPromotion:false, selfEscalation:false};
  if(!vetoReceipt.verified)console.warn('[KEVIN OWNER VETO] fail-closed',vetoReceipt.reason);

  const adapter = {
    stateKernel,
    evolutionEngine,
    externalDispatcher: async () => ({ok:false,mode:'HARDENED_RUNTIME',status:'STAGED',message:'External production mutation is disabled by the V64.1 sovereign control plane.'})
  };
  const {kernel,kim} = createKevin({config,adapter});
  const { CapitalPredictionEngine } = await import(pathToFileURL(path.join(rootDir,'enterprise/prediction/prediction-engine.js')).href);
  const capitalPrediction = new CapitalPredictionEngine({
    poolGetter: mysqlPoolGetter,
    config: config.forecasting || {},
    logger: console
  });
  const kimBriefing = new KimExecutiveBriefing({ poolGetter: mysqlPoolGetter, logger: console });

  const recoverySafe = () => typeof recoveryRequired === 'function' ? Boolean(recoveryRequired()) : Boolean(recoveryRequired);
  const control = new HardenedControlPlane({rootDir,mysqlPoolGetter,stateKernel,evolutionEngine,config});
  runtime={kernel,kim,config,control,capitalPrediction,kimBriefing,recoverySafe:false};

  const emitSnapshot = async () => {
    try { await kernel.core.observe({type:'BUSINESS_SNAPSHOT',source:'sbc-command-center',payload:{snapshot:summarizeDb(dbGetter?.()||{})}}); }
    catch(e) { kernel.core.memory.append({type:'V64_1_SNAPSHOT_FAULT',ts:new Date().toISOString(),error:String(e)}); }
  };

  app.get('/api/kevin/status',auth,ownerOnly,async(req,res)=>res.json({ok:true,...kernel.status(),hardened:{...control.status(),recoverySafe:recoverySafe(),heartbeatSuspended:recoverySafe()}}));
  app.get('/api/kevin/hardened/status',auth,ownerOnly,async(req,res)=>res.json({ok:true,...control.status(),recoverySafe:recoverySafe(),heartbeatSuspended:recoverySafe()}));
  app.post('/api/kevin/heartbeat',auth,ownerOnly,async(req,res)=>{try{if(recoverySafe())return res.status(423).json({ok:false,error:'KEVIN_RECOVERY_SAFE',readOnly:true,recoverySafe:true,message:'Kevin heartbeat is suspended while authoritative CRM recovery is required.'});const out=await control.run({core:kernel.core,dbGetter,dryRun:req.body?.dryRun===false?false:true,tenantId:req.tenantId||1});res.json({ok:true,heartbeat:out});}catch(e){res.status(500).json({ok:false,error:e.message});}});
  app.post('/api/kevin/owner-veto',auth,ownerOnly,async(req,res)=>{
    if(typeof req.body?.active!=='boolean')return res.status(400).json({ok:false,code:'KEVIN_VETO_BOOLEAN_REQUIRED'});
    if(String(process.env.SBC_RUNTIME_ROLE||'readonly').toLowerCase()!=='writer')return res.status(423).json({ok:false,code:'KEVIN_VETO_WRITER_REQUIRED'});
    try{
      const record=vetoStore.save(rootDir,req.body.active);
      kernel.core.governance.setOwnerVeto(record.active);
      return res.json({ok:true,ownerVetoActive:record.active,durable:true});
    }catch(e){
      // A veto may be raised even if persistence failed, but never silently cleared.
      if(req.body.active===true)kernel.core.governance.setOwnerVeto(true);
      return res.status(503).json({ok:false,code:'KEVIN_VETO_PERSIST_FAILED',ownerVetoActive:config.governance.ownerVetoActive});
    }
  });
  app.post('/api/kevin/verify',auth,ownerOnly,async(req,res)=>{try{const p=req.body?.proposal||req.body||{};const out=await control.verifyIndependent({proposal:p,simulation:req.body?.simulation||{pass:true},council:req.body?.council||{consensus:true},adversarial:req.body?.adversarial||{pass:true}});res.json({ok:true,verification:out});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/kevin/ask',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,...await kim.ask(req.body?.text||'status')});}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/kevin/capital-forecast',auth,ownerOnly,async(req,res)=>{
    try{
      const forecast=await capitalPrediction.calculateOperationalRunrateForecast(req.body?.metrics||{});
      res.json({ok:true,forecast,capitalMovement:'BLOCKED_BY_DESIGN'});
    }catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.get('/api/kevin/capital-forecast',auth,ownerOnly,async(req,res)=>{
    try{res.json({ok:true,forecast:await capitalPrediction.getLatestForecast(),capitalMovement:'BLOCKED_BY_DESIGN'});}
    catch(e){res.status(500).json({ok:false,error:e.message});}
  });
  app.post('/api/kim/executive-briefing/run',auth,ownerOnly,async(req,res)=>{
    try{if(recoverySafe())return res.status(423).json({ok:false,error:'KIM_RECOVERY_SAFE',readOnly:true,recoverySafe:true,message:'Kim executive briefing workers are suspended while authoritative CRM recovery is required.'});res.json(await kimBriefing.generate({tenantId:req.tenantId||1}));}
    catch(e){res.status(500).json({ok:false,error:e.message});}
  });
  app.get('/kevin-cockpit',auth,ownerOnly,(req,res)=>res.sendFile(path.join(rootDir,'public/kevin-cockpit.html')));

  if (recoverySafe()) {
    runtime.recoverySafe = true;
    console.log('[KEVIN V64.2.28] RECOVERY_SAFE — schema bootstrap and Kim briefing worker skipped; diagnostics only.');
  } else {
    try {
      await control.ensureSchema();
      if(mysqlPoolGetter?.()) await stateKernel?.ensure?.();
      await kimBriefing.ensureSchema();
      kimBriefing.start();
    }
    catch(e) { console.warn('[KEVIN V64.2.28] durable schema init deferred:',e.message); }
  }

  await emitSnapshot();
  const intervalMs = Number(process.env.SBC_KEVIN_HEARTBEAT_MS || config.heartbeat.defaultIntervalMs || 900000);
  let heartbeatRunning = false;
  const tick = async () => {
    if (heartbeatRunning) return;
    heartbeatRunning = true;
    try { await control.run({core:kernel.core,dbGetter,dryRun:true,tenantId:1}); }
    catch(e) { kernel.core.memory.append({type:'V64_1_RUNTIME_FAULT',ts:new Date().toISOString(),error:String(e)}); }
    finally { heartbeatRunning=false; }
  };
  // V64.2.27: recovery-safe isolation. When the authoritative CRM core is quarantined,
  // Kevin must remain available for read-only status/diagnostics but MUST NOT run a
  // background cognitive heartbeat that can stage or persist state into the suspended
  // mutation plane.
  if (recoveryRequired) {
    runtime.intervalHandle = null;
    runtime.recoverySafe = true;
    runtime.stop = () => {};
    runtime.lastHeartbeat = null;
    console.log('[KEVIN V64.2.28] RECOVERY_SAFE — heartbeat suspended; read-only diagnostics/status only.');
  } else {
    void tick();
    const intervalHandle = setInterval(() => void tick(), intervalMs);
    runtime.intervalHandle = intervalHandle;
    runtime.stop = () => clearInterval(intervalHandle);
  }
  global.__SBC_KEVIN_V64_1 = control;
  global.__SBC_KIM_KEVIN_V64_1 = kim;
  console.log(`[KEVIN V64.2.28] HARDENED — heartbeat=${intervalMs}ms dryRun=true singleFlight=true independentVerifier=10000 ownerVeto=true financialMutations=BLOCKED`);
  return runtime;
}

function pathToFileURL(p){ return require('url').pathToFileURL(p); }
module.exports={startKevinV6422, startKevinV641:startKevinV6422, startKevinV63:startKevinV6422, deterministicIdempotencyKey, HardenedControlPlane, sbcV6643SummarizeDb:summarizeDb};
