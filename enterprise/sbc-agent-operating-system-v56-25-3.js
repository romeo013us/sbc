'use strict';

const crypto = require('crypto');

const VERSION = '56.25.3';
const GOVERNOR_THRESHOLD = 10000;
function requireTenantId(value){ const n=Number(value); if(!Number.isInteger(n)||n<=0) throw new Error('TENANT_CONTEXT_REQUIRED'); return n; }

const BRAINS = [
  {key:'PROSPECT', name:'Prospect Brain', domain:'Acquisition & Hygiene'},
  {key:'CONTEXT', name:'Context Brain', domain:'Prospect Intelligence'},
  {key:'OPENING', name:'Opening Brain', domain:'Conversation & Pattern Hooking'},
  {key:'OFFERING', name:'Offering Brain', domain:'Solution Graph & Value Alignment'},
  {key:'CLOSING', name:'Closing Brain', domain:'Revenue & Transaction Friction'},
  {key:'FULFILLMENT', name:'Fulfillment Brain', domain:'Delivery & Provisioning'},
  {key:'ACCOUNT_MANAGER', name:'Account Manager Brain', domain:'Relationship & Retention'},
  {key:'CONTROLLER', name:'Controller Brain', domain:'Business Operations & Optimization'},
  {key:'RECOVERY', name:'Recovery Brain', domain:'Resilience & Self-Healing'},
  {key:'TELEMETRY', name:'Telemetry Brain', domain:'KPIs, Economics & Executive Visibility'}
];

const AGENTS = [
  {key:'KIM', name:'Kim Executive Orchestrator', kind:'manager', brain:'CONTROLLER', can:['inspect','delegate','diagnose','escalate','orchestrate'], cannot:['bypass_governor','bypass_consent','issue_refunds','alter_credentials']},
  {key:'LEAD', name:'Lead Generation Agent', kind:'worker', brain:'PROSPECT', can:['ingest_leads','verify_leads','score_leads','dedupe_leads','emit_events'], cannot:['contact_suppressed','take_payment','issue_refund']},
  {key:'SALES', name:'Sales Calling Agent', kind:'worker', brain:'OPENING', can:['create_call_tasks','contact_eligible_prospects','advance_sales_state','emit_events'], cannot:['contact_suppressed','bypass_consent','issue_refund']},
  {key:'CLOSER', name:'Closing Agent', kind:'worker', brain:'CLOSING', can:['build_quotes','recommend_bundles','create_checkout','schedule_followup'], cannot:['override_catalog','bypass_governor','issue_refund','alter_credentials']},
  {key:'FULFILLMENT', name:'Fulfillment Agent', kind:'worker', brain:'FULFILLMENT', can:['create_jobs','track_provisioning','run_qa','emit_exceptions'], cannot:['issue_refund','change_payment_status','bypass_idempotency']},
  {key:'GUARDIAN', name:'Guardian Agent', kind:'control', brain:'RECOVERY', can:['inspect_health','quarantine_jobs','freeze_agent','escalate'], cannot:['approve_financial_hold','bypass_owner_gate']},
  {key:'ANALYST', name:'Business Analyst Agent', kind:'intelligence', brain:'TELEMETRY', can:['analyze_metrics','calculate_margin','surface_anomalies','recommend'], cannot:['execute_financial_action','change_catalog']}
];

function id(prefix){ return `${prefix}_${crypto.randomUUID()}`; }
function json(v){ return JSON.stringify(v == null ? {} : v); }
function safeJson(v, fallback={}) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }
function now(){ return new Date(); }
function mysqlDate(d=new Date()){ return d.toISOString().slice(0,19).replace('T',' '); }

// SBC_V6529_OPEN_READINESS: status must not perform DDL in read-only or recovery runtimes.
function createAgentOS({getPool, getCatalog=()=>({}), audit=()=>{}, logger=console, releaseVersion=()=> '65.1.31', allowSchemaWrites=()=>false}) {
  let schemaReady = false;

  async function ensureSchema(){
    const pool=getPool();
    if(!pool || schemaReady) return false;
    const ddl=[
      `CREATE TABLE IF NOT EXISTS sbc_agent_registry (
        agent_key VARCHAR(60) PRIMARY KEY, name VARCHAR(160) NOT NULL, kind VARCHAR(40) NOT NULL,
        brain_key VARCHAR(60) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'READY',
        capabilities_json LONGTEXT NOT NULL, restrictions_json LONGTEXT NOT NULL,
        version VARCHAR(40) NOT NULL DEFAULT '56.25.3', heartbeat_at DATETIME NULL,
        created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
        INDEX idx_agent_brain(brain_key), INDEX idx_agent_status(status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_agent_events (
        event_id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL,
        event_type VARCHAR(140) NOT NULL, source_agent VARCHAR(60) NOT NULL, target_agent VARCHAR(60) NOT NULL DEFAULT '*',
        aggregate_type VARCHAR(80) NOT NULL DEFAULT '', aggregate_id VARCHAR(160) NOT NULL DEFAULT '',
        payload_json LONGTEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL', attempts INT NOT NULL DEFAULT 0,
        idempotency_key VARCHAR(220) NOT NULL, available_at DATETIME NOT NULL,
        processed_at DATETIME NULL, last_error TEXT, created_at DATETIME NOT NULL,
        UNIQUE KEY uq_agent_event_idem(tenant_id,idempotency_key),
        INDEX idx_agent_event_queue(status,available_at,priority), INDEX idx_agent_event_target(target_agent,status),
        INDEX idx_agent_event_aggregate(aggregate_type,aggregate_id,created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_agent_jobs (
        job_id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL,
        agent_key VARCHAR(60) NOT NULL, job_type VARCHAR(140) NOT NULL, aggregate_type VARCHAR(80) NOT NULL DEFAULT '',
        aggregate_id VARCHAR(160) NOT NULL DEFAULT '', state VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
        priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL', payload_json LONGTEXT NOT NULL,
        attempts INT NOT NULL DEFAULT 0, max_attempts INT NOT NULL DEFAULT 3,
        due_at DATETIME NULL, locked_until DATETIME NULL, completed_at DATETIME NULL,
        last_error TEXT, idempotency_key VARCHAR(220) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
        UNIQUE KEY uq_agent_job_idem(tenant_id,idempotency_key), INDEX idx_agent_job_queue(agent_key,state,priority,due_at),
        INDEX idx_agent_job_aggregate(aggregate_type,aggregate_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_agent_audit (
        audit_id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL,
        agent_key VARCHAR(60) NOT NULL, action VARCHAR(180) NOT NULL, decision VARCHAR(40) NOT NULL,
        reason TEXT, input_json LONGTEXT, output_json LONGTEXT, policy_result VARCHAR(60) NOT NULL DEFAULT 'NOT_EVALUATED',
        risk VARCHAR(30) NOT NULL DEFAULT 'LOW', owner_required TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL, INDEX idx_agent_audit_agent(agent_key,created_at), INDEX idx_agent_audit_policy(policy_result,created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_agent_governor_holds (
        hold_id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL,
        action VARCHAR(180) NOT NULL, resource_id VARCHAR(180) NOT NULL DEFAULT '',
        transaction_amount DECIMAL(14,2) NOT NULL DEFAULT 0, vendor_commitment DECIMAL(14,2) NOT NULL DEFAULT 0,
        cumulative_exposure DECIMAL(14,2) NOT NULL DEFAULT 0, exposure_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        threshold DECIMAL(14,2) NOT NULL DEFAULT 10000, status VARCHAR(30) NOT NULL DEFAULT 'FROZEN',
        reason VARCHAR(500) NOT NULL, request_json LONGTEXT, owner_approved_by VARCHAR(120) NOT NULL DEFAULT '',
        owner_approved_at DATETIME NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
        INDEX idx_governor_status(status,created_at), INDEX idx_governor_resource(resource_id,created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_agent_memory (
        memory_id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL,
        scope_type VARCHAR(60) NOT NULL, scope_id VARCHAR(160) NOT NULL, memory_key VARCHAR(140) NOT NULL,
        value_json LONGTEXT NOT NULL, sensitivity VARCHAR(30) NOT NULL DEFAULT 'NORMAL', source_agent VARCHAR(60) NOT NULL,
        created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
        UNIQUE KEY uq_agent_memory(tenant_id,scope_type,scope_id,memory_key), INDEX idx_agent_memory_scope(scope_type,scope_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS sbc_solution_assessments (
        assessment_id VARCHAR(120) PRIMARY KEY, tenant_id BIGINT NOT NULL,
        lead_id VARCHAR(120) NOT NULL, needs_json LONGTEXT NOT NULL, solution_json LONGTEXT NOT NULL,
        revenue_amount DECIMAL(14,2) NOT NULL DEFAULT 0, estimated_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
        contribution_margin DECIMAL(14,2) NOT NULL DEFAULT 0, margin_percent DECIMAL(7,3) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'PROPOSED', created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
        INDEX idx_solution_lead(lead_id,created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];
    for(const sql of ddl) await pool.query(sql);
    const t=mysqlDate();
    for(const b of BRAINS){
      await pool.query(`INSERT INTO sbc_agent_registry(agent_key,name,kind,brain_key,status,capabilities_json,restrictions_json,version,heartbeat_at,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),kind=VALUES(kind),brain_key=VALUES(brain_key),capabilities_json=VALUES(capabilities_json),restrictions_json=VALUES(restrictions_json),version=VALUES(version),updated_at=VALUES(updated_at)`,
        [`BRAIN_${b.key}`,b.name,'brain',b.key,'READY',json(['read','analyze','emit_events']),json(['no_direct_financial_execution']),VERSION,t,t,t]);
    }
    for(const a of AGENTS){
      await pool.query(`INSERT INTO sbc_agent_registry(agent_key,name,kind,brain_key,status,capabilities_json,restrictions_json,version,heartbeat_at,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),kind=VALUES(kind),brain_key=VALUES(brain_key),capabilities_json=VALUES(capabilities_json),restrictions_json=VALUES(restrictions_json),version=VALUES(version),updated_at=VALUES(updated_at)`,
        [a.key,a.name,a.kind,a.brain,'READY',json(a.can),json(a.cannot),VERSION,t,t,t]);
    }
    schemaReady=true;
    return true;
  }

  function exposure({amount=0,vendorCommitment=0,cumulativeExposure=0}={}){
    const transaction=Number(amount)||0, vendor=Number(vendorCommitment)||0, cumulative=Number(cumulativeExposure)||0;
    const total=Math.max(transaction + vendor, cumulative, transaction, vendor);
    return {transactionAmount:transaction,vendorCommitment:vendor,cumulativeExposure:cumulative,exposureAmount:total,threshold:GOVERNOR_THRESHOLD,blocked:total>=GOVERNOR_THRESHOLD};
  }

  async function auditDecision({
tenantId,agentKey='SYSTEM',action,decision,reason='',input={},output={},policyResult='NOT_EVALUATED',risk='LOW',ownerRequired=false}){
    const pool=getPool();
    const record={auditId:id('agent_audit'),agentKey,action,decision,reason,policyResult,risk,ownerRequired,createdAt:mysqlDate()};
    if(pool) await pool.query(`INSERT INTO sbc_agent_audit(audit_id,tenant_id,agent_key,action,decision,reason,input_json,output_json,policy_result,risk,owner_required,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [record.auditId,tenantId,agentKey,action,decision,reason,json(input),json(output),policyResult,risk,ownerRequired?1:0,record.createdAt]);
    try{ audit({id:record.auditId,actor:{id:agentKey,name:agentKey},type:'agent_decision',message:reason,meta:{action,decision,policyResult,risk,ownerRequired}}); }catch{}
    return record;
  }

  async function emitEvent({
tenantId,eventType,sourceAgent,targetAgent='*',aggregateType='',aggregateId='',payload={},idempotencyKey,priority='NORMAL',availableAt}={}){
    tenantId=requireTenantId(tenantId);
    const pool=getPool();
    if(!pool) throw new Error('Agent Event Bus requires relational MySQL.');
    const idem=String(idempotencyKey||`${eventType}:${aggregateType}:${aggregateId}:${crypto.createHash('sha256').update(json(payload)).digest('hex').slice(0,24)}`);
    const eventId=id('evt'), t=mysqlDate(), available=mysqlDate(availableAt?new Date(availableAt):new Date());
    try{
      await pool.query(`INSERT INTO sbc_agent_events(event_id,tenant_id,event_type,source_agent,target_agent,aggregate_type,aggregate_id,payload_json,status,priority,idempotency_key,available_at,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE event_id=event_id`,
        [eventId,tenantId,eventType,sourceAgent,targetAgent,aggregateType,aggregateId,json(payload),'PENDING',priority,idem,available,t]);
      const [rows]=await pool.query('SELECT event_id,status FROM sbc_agent_events WHERE tenant_id=? AND idempotency_key=? LIMIT 1',[tenantId,idem]);
      return {ok:true,eventId:rows[0]?.event_id||eventId,status:rows[0]?.status||'PENDING',idempotencyKey:idem};
    }catch(e){ logger.warn?.('[SBC AGENT BUS] emit:',e.message); throw e; }
  }

  async function governorEvaluate({
tenantId,agentKey='SYSTEM',action='economic_action',resourceId='',amount=0,vendorCommitment=0,cumulativeExposure=0,request={},reason='Economic exposure requires policy evaluation.'}={}){
    tenantId=requireTenantId(tenantId);
    const ex=exposure({amount,vendorCommitment,cumulativeExposure});
    if(!ex.blocked){
      await auditDecision({tenantId,agentKey,action,decision:'ALLOW',reason,input:{resourceId,...ex,request},output:{status:'ALLOWED'},policyResult:'BELOW_THRESHOLD',risk:'LOW'});
      return {ok:true,status:'ALLOWED',frozen:false,...ex};
    }
    const pool=getPool();
    if(!pool) throw new Error('Economic Governor requires relational MySQL.');
    const holdId=id('hold'),t=mysqlDate();
    await pool.query(`INSERT INTO sbc_agent_governor_holds(hold_id,tenant_id,action,resource_id,transaction_amount,vendor_commitment,cumulative_exposure,exposure_amount,threshold,status,reason,request_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [holdId,tenantId,action,resourceId,ex.transactionAmount,ex.vendorCommitment,ex.cumulativeExposure,ex.exposureAmount,GOVERNOR_THRESHOLD,'FROZEN',reason,json(request),t,t]);
    await emitEvent({tenantId,eventType:'governor.freeze',sourceAgent:'GOVERNOR',targetAgent:'KIM',aggregateType:'governor_hold',aggregateId:holdId,payload:{holdId,action,resourceId,...ex,reason},idempotencyKey:`governor:${holdId}`,priority:'CRITICAL'});
    await auditDecision({tenantId,agentKey,action,decision:'FREEZE',reason,input:{resourceId,...ex,request},output:{holdId,status:'FROZEN'},policyResult:'OWNER_APPROVAL_REQUIRED',risk:'CRITICAL',ownerRequired:true});
    return {ok:false,status:'FROZEN',frozen:true,ownerApprovalRequired:true,holdId,...ex};
  }

  async function ownerApprove(holdId, ownerId='owner', tenantId){
    tenantId=requireTenantId(tenantId);

    const pool=getPool();
    if(!pool) throw new Error('Economic Governor requires relational MySQL.');
    const [rows]=await pool.query(`SELECT * FROM sbc_agent_governor_holds WHERE hold_id=? AND tenant_id=? LIMIT 1`,[holdId,tenantId]);
    if(!rows[0]) throw new Error('Governor hold not found.');
    if(rows[0].status!=='FROZEN') return {ok:false,status:rows[0].status,hold:rows[0]};
    const t=mysqlDate();
    await pool.query(`UPDATE sbc_agent_governor_holds SET status='OWNER_APPROVED',owner_approved_by=?,owner_approved_at=?,updated_at=? WHERE hold_id=? AND tenant_id=? AND status='FROZEN'`,[ownerId,t,t,holdId,tenantId]);
    await emitEvent({tenantId,eventType:'governor.owner_approved',sourceAgent:'OWNER',targetAgent:'*',aggregateType:'governor_hold',aggregateId:holdId,payload:{holdId,approvedBy:ownerId,approvedAt:t},idempotencyKey:`governor-approved:${holdId}` ,priority:'HIGH'});
    await auditDecision({agentKey:'OWNER',action:'owner_approve_governor_hold',decision:'APPROVED',reason:'Explicit owner approval released economic freeze.',input:{holdId},output:{status:'OWNER_APPROVED'},policyResult:'OWNER_APPROVED',risk:'HIGH'});
    return {ok:true,status:'OWNER_APPROVED',holdId};
  }

  async function status(tenantId){
    tenantId=requireTenantId(tenantId);

    const pool=getPool();
    if(!pool) return {ok:false,version:VERSION,releaseVersion:releaseVersion(),mysql:false,error:'Relational MySQL unavailable.'};
    const writerAllowed=Boolean(typeof allowSchemaWrites==='function'&&allowSchemaWrites());
    if(!writerAllowed)return {ok:true,version:VERSION,releaseVersion:releaseVersion(),tenantId,mysql:true,readOnly:true,schemaReady:false,governor:{threshold:GOVERNOR_THRESHOLD,hardFreeze:true,ownerApprovalRequired:true},brains:BRAINS,agents:AGENTS,metrics:{events:{},jobs:{},governorHolds:{},agents:{},audit:{},solutions:{}},message:'Read-only runtime. Agent OS status does not initialize schema or write data.'};
    await ensureSchema();
    const [[events],[jobs],[holds],[agents],[audits],[solutions]]=await Promise.all([
      pool.query(`SELECT COUNT(*) count, SUM(status='PENDING') pending, SUM(status='FAILED') failed FROM sbc_agent_events WHERE tenant_id=?`,[tenantId]),
      pool.query(`SELECT COUNT(*) count, SUM(state='QUEUED') queued, SUM(state='FAILED') failed FROM sbc_agent_jobs WHERE tenant_id=?`,[tenantId]),
      pool.query(`SELECT COUNT(*) count, SUM(status='FROZEN') frozen FROM sbc_agent_governor_holds WHERE tenant_id=?`,[tenantId]),
      pool.query(`SELECT COUNT(*) count, SUM(status='READY') ready FROM sbc_agent_registry`),
      pool.query(`SELECT COUNT(*) count FROM sbc_agent_audit WHERE tenant_id=?`,[tenantId]),
      pool.query(`SELECT COUNT(*) count, COALESCE(SUM(contribution_margin),0) margin FROM sbc_solution_assessments WHERE tenant_id=?`,[tenantId])
    ]);
    return {ok:true,version:VERSION,releaseVersion:releaseVersion(),tenantId:tenantId,mysql:true,governor:{threshold:GOVERNOR_THRESHOLD,hardFreeze:true,ownerApprovalRequired:true},brains:BRAINS,agents:AGENTS,metrics:{events:events[0]||{},jobs:jobs[0]||{},governorHolds:holds[0]||{},agents:agents[0]||{},audit:audit[0]||{},solutions:solutions[0]||{}}};
  }

  async function queueJob({
tenantId,agentKey,jobType,aggregateType='',aggregateId='',payload={},priority='NORMAL',maxAttempts=3,idempotencyKey}={}){
    tenantId=requireTenantId(tenantId);
    const pool=getPool(); if(!pool) throw new Error('Agent Job Bus requires relational MySQL.');
    const t=mysqlDate(),idem=String(idempotencyKey||`${agentKey}:${jobType}:${aggregateType}:${aggregateId}`),jobId=id('job');
    await pool.query(`INSERT INTO sbc_agent_jobs(job_id,tenant_id,agent_key,job_type,aggregate_type,aggregate_id,state,priority,payload_json,attempts,max_attempts,idempotency_key,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE updated_at=updated_at`,[jobId,tenantId,agentKey,jobType,aggregateType,aggregateId,'QUEUED',priority,json(payload),0,Math.max(1,Number(maxAttempts)||3),idem,t,t]);
    const [rows]=await pool.query('SELECT job_id,state FROM sbc_agent_jobs WHERE tenant_id=? AND idempotency_key=? LIMIT 1',[tenantId,idem]);
    return {ok:true,jobId:rows[0]?.job_id||jobId,state:rows[0]?.state||'QUEUED',idempotencyKey:idem};
  }

  async function nextJobs(agentKey,limit=10,tenantId){
    tenantId=requireTenantId(tenantId);

    const pool=getPool(); if(!pool) throw new Error('Agent Job Bus requires relational MySQL.');
    const n=Math.min(20,Math.max(1,Number(limit)||10));
    const [rows]=await pool.query(`SELECT * FROM sbc_agent_jobs WHERE tenant_id=? AND agent_key=? AND state='QUEUED' AND (due_at IS NULL OR due_at<=UTC_TIMESTAMP()) ORDER BY FIELD(priority,'CRITICAL','HIGH','NORMAL','LOW'),created_at LIMIT ?`,[tenantId,agentKey,n]);
    return rows.map(r=>({...r,payload:safeJson(r.payload_json)}));
  }

  async function solutionEvaluate({
tenantId,leadId,needs={},items=[],costs={},revenue=0,setupRevenue=0,recurringRevenue=0,customer={}}={}){
    tenantId=requireTenantId(tenantId);
    const pool=getPool(); if(!pool) throw new Error('Solution Graph requires relational MySQL.');
    let graph={solution:[],needs:[],status:'NO_MATCH',customerPayableNow:0,monthlyRecurring:0,upfrontSetup:0};
    try{
      const engine=require('./v56135-consultative-revenue-engine');
      graph=engine.composeSolution({catalog:getCatalog(),needsMatrix:needs,customer:{id:leadId,...customer},discoveryText:String(customer?.discoveryText||'')});
    }catch(e){ logger.warn?.('[SBC SOLUTION GRAPH] consultative engine fallback:',e.message); }
    const selectedItems=Array.isArray(graph.solution)&&graph.solution.length?graph.solution:items;
    const revenueAmount=Number(revenue)||((Number(setupRevenue)||0)+(Number(recurringRevenue)||0)+(Number(graph.customerPayableNow)||0));
    const estimatedCost=Object.values(costs||{}).reduce((a,v)=>a+(Number(v)||0),0);
    const margin=revenueAmount-estimatedCost;
    const marginPercent=revenueAmount>0?(margin/revenueAmount)*100:0;
    const assessmentId=id('solution'),t=mysqlDate();
    const solution={items:selectedItems,needs:graph.needs||Object.keys(needs||{}),upfrontSetup:Number(graph.upfrontSetup||setupRevenue||0),monthlyRecurring:Number(graph.monthlyRecurring||recurringRevenue||0),customerPayableNow:Number(graph.customerPayableNow||0),ranking:'customer_value + close_probability + contribution_margin + fulfillment_capacity',marginAware:true,catalogTruth:'Observed SBC canonical catalog'};
    await pool.query(`INSERT INTO sbc_solution_assessments(assessment_id,tenant_id,lead_id,needs_json,solution_json,revenue_amount,estimated_cost,contribution_margin,margin_percent,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[assessmentId,tenantId,String(leadId||''),json(needs),json(solution),revenueAmount,estimatedCost,margin,marginPercent,'PROPOSED',t,t]);
    await auditDecision({tenantId,agentKey:'OFFERING',action:'solution_graph_evaluate',decision:'RECOMMEND',reason:'Mapped prospect needs through the canonical SBC Solution Graph and applied economic margin awareness.',input:{leadId,needs,items,costs},output:{assessmentId,revenueAmount,estimatedCost,contributionMargin:margin,marginPercent,catalogItems:selectedItems.length},policyResult:'CATALOG_ANALYSIS',risk:'LOW'});
    return {ok:true,assessmentId,leadId,revenueAmount,estimatedCost,contributionMargin:margin,marginPercent,solution,graph};
  }

  async function listHolds(statusFilter='FROZEN', tenantId){
    tenantId=requireTenantId(tenantId);

    const pool=getPool(); if(!pool) throw new Error('Economic Governor requires relational MySQL.');
    const [rows]=await pool.query(`SELECT * FROM sbc_agent_governor_holds WHERE tenant_id=? AND status=? ORDER BY created_at DESC LIMIT 100`,[tenantId,statusFilter]);
    return rows;
  }

  return {VERSION,GOVERNOR_THRESHOLD,BRAINS,AGENTS,ensureSchema,status,emitEvent,queueJob,nextJobs,governorEvaluate,ownerApprove,listHolds,solutionEvaluate,auditDecision,exposure};
}

function registerRoutes(app,{auth,ownerOnly,getOS}){
  app.get('/api/agent-os/status',auth,ownerOnly,async(req,res)=>{try{res.setHeader('Cache-Control','no-store');res.json(await getOS().status(req.tenantId));}catch(e){res.status(503).json({ok:false,version:VERSION,error:e.message});}});
  app.get('/api/agent-os/holds',auth,ownerOnly,async(req,res)=>{try{res.json({ok:true,version:VERSION,tenantId:req.tenantId,holds:await getOS().listHolds(String(req.query?.status||'FROZEN'),req.tenantId)});}catch(e){res.status(503).json({ok:false,error:e.message});}});
  app.post('/api/agent-os/events',auth,ownerOnly,async(req,res)=>{try{const b=req.body||{};res.status(202).json(await getOS().emitEvent({...b,tenantId:req.tenantId}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/agent-os/jobs',auth,ownerOnly,async(req,res)=>{try{res.status(202).json(await getOS().queueJob({...req.body,tenantId:req.tenantId}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/agent-os/governor/evaluate',auth,ownerOnly,async(req,res)=>{try{res.status(200).json(await getOS().governorEvaluate({...req.body,tenantId:req.tenantId}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/agent-os/governor/:holdId/approve',auth,ownerOnly,async(req,res)=>{try{res.status(200).json(await getOS().ownerApprove(req.params.holdId,req.user?.id||'owner',req.tenantId));}catch(e){res.status(400).json({ok:false,error:e.message});}});
  app.post('/api/agent-os/solutions/evaluate',auth,ownerOnly,async(req,res)=>{try{res.status(200).json(await getOS().solutionEvaluate({...req.body,tenantId:req.tenantId}));}catch(e){res.status(400).json({ok:false,error:e.message});}});
}

module.exports={createAgentOS,registerRoutes,BRAINS,AGENTS,VERSION,GOVERNOR_THRESHOLD};
