'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSION = '60.5.0-evolution-engine';
const GOVERNANCE = ['OBSERVE','DIAGNOSE','DESIGN','BUILD','TEST','SECURITY_CHECK','SIMULATE','STAGE','APPROVE','DEPLOY','VERIFY','ROLLBACK','LEARN'];
const RISK = {LOW:10, MEDIUM:40, HIGH:70, CRITICAL:100};
const BLOCKED_CAPABILITIES = new Set(['payment','refund','charge','credential','permission','delete','merge','owner_access','bulk_message','production_database_direct_write']);
const SAFE_EXTENSIONS = new Set(['.js','.json','.sql','.md','.css','.html']);
const SAFE_ROOTS = ['enterprise','routes','scripts','public','migrations','docs'];

function id(prefix){ return `${prefix}_${crypto.randomUUID()}`; }
function hash(v){ return crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex'); }
function now(){ return new Date().toISOString(); }
function clip(v,n=4000){ return String(v||'').slice(0,n); }
function normalize(v){ return String(v||'').toLowerCase().replace(/[^a-z0-9_ -]/g,' ').replace(/\s+/g,' ').trim(); }

const BLUEPRINTS = [
  {id:'call-queue',signals:['call list','call queue','prioritize calls','prioritize the call','last contacted','contacted 48 hours','follow up'],domains:['SALES','CRM'],artifacts:['migration','service','api','ui','test'],risk:'LOW'},
  {id:'lead-prioritization',signals:['prioritize leads','lead priority','hot leads','warm leads','sales ready'],domains:['SALES'],artifacts:['scoring','api','ui','test'],risk:'LOW'},
  {id:'customer-health',signals:['customer health','at risk customer','churn','retention'],domains:['CORE','SALES'],artifacts:['projection','api','ui','test'],risk:'MEDIUM'},
  {id:'operational-diagnostics',signals:['broken','error','not working','timed out','slow','failure'],domains:['CORE','AI'],artifacts:['diagnostic','test','observability'],risk:'LOW'},
  {id:'fulfillment-workflow',signals:['fulfillment','order tracking','production queue','delivery'],domains:['FULFILLMENT'],artifacts:['state machine','api','ui','test'],risk:'MEDIUM'},
  {id:'telephony-workflow',signals:['call status','missed call','phone queue','twilio'],domains:['TELEPHONY'],artifacts:['webhook','state machine','api','test'],risk:'MEDIUM'}
];

function inferBlueprint(intent){
  const text = normalize(intent);
  let best = null, bestScore = 0;
  for(const bp of BLUEPRINTS){
    const score = bp.signals.reduce((n,s)=> n + (text.includes(s) ? 1 : 0),0);
    if(score > bestScore){ best = bp; bestScore = score; }
  }
  return best ? {...best, matchScore:bestScore} : {id:'first-principles',signals:[],domains:['CORE','AI'],artifacts:['discovery','architecture','test'],risk:'MEDIUM',matchScore:0};
}

function classifyRisk(text, blueprint){
  const t=normalize(text);
  if([...BLOCKED_CAPABILITIES].some(x=>t.includes(x))) return 'CRITICAL';
  return blueprint?.risk || 'MEDIUM';
}

function createPlan({intent, context={}, capabilityGaps=[]}){
  const bp=inferBlueprint(intent);
  const risk=classifyRisk(intent,bp);
  const gapEvidence=Array.isArray(capabilityGaps)?capabilityGaps.slice(0,20):[];
  const needsDb=/last contacted|contacted|timestamp|indexed|schema|database|migration/i.test(intent) || gapEvidence.some(x=>/db|schema|index|migration/i.test(String(x)));
  const needsApi=/queue|sort|prioritize|api|endpoint|service/i.test(intent);
  const needsUi=/list|queue|dashboard|ui|screen/i.test(intent);
  const steps=[
    'Observe current capability registry, routes, schema, telemetry, and recent failures',
    'Diagnose the smallest durable capability gap',
    `Design a governed ${bp.id} capability using first-principles constraints`,
    'Generate changes only inside an isolated evolution workspace',
    'Run syntax, security, tenant-isolation, regression, and adversarial tests',
    'Simulate representative historical workload before staging',
    'Create a reviewable staging artifact and live diff',
    risk==='LOW' ? 'Request owner approval before production deployment' : 'Require explicit owner approval before any production deployment',
    'Verify production health after deployment and retain rollback checkpoint',
    'Record the learned capability for future autonomous use'
  ];
  const artifacts=[];
  if(needsDb) artifacts.push('database migration/index plan');
  if(needsApi) artifacts.push('server capability/API contract');
  if(needsUi) artifacts.push('Command Center queue/UI surface');
  if(!artifacts.length) artifacts.push('capability contract and diagnostic/test harness');
  return {planId:id('evo_plan'),createdAt:now(),intent:clip(intent,12000),blueprint:bp.id,domains:bp.domains,risk,confidence:bp.matchScore?Math.min(.98,.65+bp.matchScore*.1):.42,capabilityGaps:gapEvidence,artifacts,steps,governance:'OBSERVE→DIAGNOSE→DESIGN→BUILD→TEST→SECURITY_CHECK→SIMULATE→STAGE→APPROVE→DEPLOY→VERIFY→ROLLBACK→LEARN',dbRequired:needsDb,apiRequired:needsApi,uiRequired:needsUi,productionWrite:'blocked_until_approval'};
}

function sanitizePath(p){
  const rel=String(p||'').replace(/\\/g,'/').replace(/^\/+/, '');
  if(!rel || rel.includes('..') || path.isAbsolute(rel)) throw new Error('unsafe_artifact_path');
  const root=rel.split('/')[0];
  if(!SAFE_ROOTS.includes(root)) throw new Error('artifact_root_not_allowed');
  if(!SAFE_EXTENSIONS.has(path.extname(rel).toLowerCase())) throw new Error('artifact_extension_not_allowed');
  return rel;
}

function securityScan(code){
  const s=String(code||'');
  const findings=[];
  const patterns=[
    [/process\.env\.[A-Z0-9_]+/g,'direct-secret-reference'],
    [/child_process|execSync|spawnSync|exec\(/g,'shell-execution'],
    [/https?:\/\/(?!localhost)/g,'external-network-reference'],
    [/DROP\s+TABLE|TRUNCATE\s+TABLE/ig,'destructive-sql'],
    [/DELETE\s+FROM/ig,'delete-sql'],
    [/require\(['"]https?:/g,'remote-require'],
    [/npm\s+install|curl\s+|wget\s+/ig,'runtime-download']
  ];
  for(const [rx,type] of patterns) if(rx.test(s)) findings.push({type,severity:['destructive-sql','delete-sql','runtime-download'].includes(type)?'HIGH':'MEDIUM'});
  return {ok:findings.every(f=>f.severity!=='HIGH'),findings};
}

function diffText(before, after){
  const a=String(before||'').split('\n'), b=String(after||'').split('\n');
  const out=[]; const max=Math.max(a.length,b.length);
  for(let i=0;i<max;i++){ if(a[i]!==b[i]){if(a[i]!==undefined)out.push(`-${a[i]}`);if(b[i]!==undefined)out.push(`+${b[i]}`);} }
  return out.slice(0,1200).join('\n');
}

function createEngine({getPool,rootDir=process.cwd(),logger=console}={}){
  const memory = new Map();
  const pool=()=>typeof getPool==='function'?getPool():null;
  async function ensure(){
    const p=pool(); if(!p) return false;
    await p.query(`CREATE TABLE IF NOT EXISTS sbc_evolution_capabilities (capability_id VARCHAR(120) PRIMARY KEY, tenant_id VARCHAR(80) NOT NULL, name VARCHAR(180) NOT NULL, domain VARCHAR(80) NOT NULL, status ENUM('DISCOVERED','STAGED','ACTIVE','DEPRECATED') NOT NULL DEFAULT 'DISCOVERED', version VARCHAR(40) NOT NULL, contract_json JSON NOT NULL, evidence_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), KEY idx_evo_cap_tenant(tenant_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await p.query(`CREATE TABLE IF NOT EXISTS sbc_evolution_proposals (proposal_id VARCHAR(120) PRIMARY KEY, tenant_id VARCHAR(80) NOT NULL, intent_text TEXT NOT NULL, stage VARCHAR(40) NOT NULL, risk ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL, plan_json JSON NOT NULL, diff_json JSON NOT NULL, security_json JSON NOT NULL, simulation_json JSON NOT NULL, approval_required TINYINT(1) NOT NULL DEFAULT 1, approved_by VARCHAR(120) NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), KEY idx_evo_prop_tenant(tenant_id,stage,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await p.query(`CREATE TABLE IF NOT EXISTS sbc_evolution_runs (run_id VARCHAR(120) PRIMARY KEY, proposal_id VARCHAR(120) NULL, tenant_id VARCHAR(80) NOT NULL, stage VARCHAR(40) NOT NULL, event_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), KEY idx_evo_runs(tenant_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await p.query(`CREATE TABLE IF NOT EXISTS sbc_evolution_checkpoints (checkpoint_id VARCHAR(120) PRIMARY KEY, proposal_id VARCHAR(120) NOT NULL, tenant_id VARCHAR(80) NOT NULL, artifact_hash CHAR(64) NOT NULL, rollback_manifest_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), KEY idx_evo_checkpoint(tenant_id,proposal_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    return true;
  }
  async function logRun(tenantId,proposalId,stage,event){
    const p=pool(); const packet={runId:id('evo_run'),proposalId,tenantId,stage,event,at:now()};
    if(p) await p.query('INSERT INTO sbc_evolution_runs(run_id,proposal_id,tenant_id,stage,event_json) VALUES(?,?,?,?,?)',[packet.runId,proposalId||null,tenantId,stage,JSON.stringify(event||{})]);
    memory.set(packet.runId,packet); return packet;
  }
  async function observe({tenantId=1,intent,context={}}){
    const bp=inferBlueprint(intent); const p=pool(); let live={};
    if(p){ try { const [rows]=await p.query("SELECT COUNT(*) AS customers FROM customers"); live.customers=Number(rows[0]?.customers||0); } catch(e){ live.db='unavailable'; } }
    const capabilities=BLUEPRINTS.map(x=>({id:x.id,domain:x.domains[0],status:'registry_blueprint'}));
    const gaps=[];
    if(bp.id==='call-queue'){gaps.push('dedicated call-prioritization capability not guaranteed by current registry');gaps.push('last-contacted indexing/API contract requires verification');}
    return {ok:true,tenantId:String(tenantId),observedAt:now(),intent:clip(intent,12000),selectedBlueprint:bp.id,live,capabilities,gaps,context};
  }
  function scaffoldFor(plan, proposalId){
    const root=path.join(rootDir,'data','evolution','staging',proposalId);
    const files=[];
    const add=(rel,content)=>{const safe=sanitizePath(rel);const abs=path.join(rootDir,'data','evolution','staging',proposalId,safe);fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,content,'utf8');files.push({path:safe,hash:hash(content),bytes:Buffer.byteLength(content)});};
    if(plan.blueprint==='call-queue'){
      add('migrations/evolution_call_queue.sql',`-- SANDBOX ONLY: generated by SBC Evolution Engine ${VERSION}\nCREATE TABLE IF NOT EXISTS sbc_evolution_call_queue (tenant_id VARCHAR(80) NOT NULL, lead_id VARCHAR(120) NOT NULL, priority_score DECIMAL(8,2) NOT NULL DEFAULT 0, last_contacted_at DATETIME(6) NULL, reason VARCHAR(500) NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY(tenant_id,lead_id), KEY idx_call_queue_priority(tenant_id,priority_score DESC,last_contacted_at));\n`);
      add('routes/evolution-call-queue.js',`'use strict';\n// SANDBOX SCAFFOLD — not mounted by production routing.\nfunction prioritize(row){ const age=row.last_contacted_at?Date.now()-new Date(row.last_contacted_at).getTime():Number.MAX_SAFE_INTEGER; return Math.min(100,50+(age>=48*3600000?40:10)+(row.phone?5:0)); }\nmodule.exports={prioritize};\n`);
      add('public/evolution-call-queue.js',`// SANDBOX UI SCAFFOLD — not loaded by production Command Center.\nexport function sortCallQueue(rows){ return [...rows].sort((a,b)=>(b.priority_score||0)-(a.priority_score||0)); }\n`);
      add('scripts/evolution-call-queue.test.js',`const assert=require('assert'); const {prioritize}=require('../routes/evolution-call-queue'); assert(prioritize({last_contacted_at:new Date(Date.now()-49*3600000),phone:'1'} )>prioritize({last_contacted_at:new Date(),phone:'1'})); console.log('sandbox call queue scaffold PASS');\n`);
    } else {
      add(`docs/evolution-${plan.blueprint}.md`, `# ${plan.blueprint}\n\nGenerated in SBC Evolution Engine sandbox.\n\nIntent: ${clip(plan.intent,4000)}\n\nRisk: ${plan.risk}\n\nProduction deployment: BLOCKED until governed approval and verification.\n`);
    }
    return {root,files};
  }

  async function stage({tenantId=1,intent,context={},proposalId}){
    const obs=await observe({tenantId,intent,context});
    const plan=createPlan({intent,context,capabilityGaps:obs.gaps});
    const pid=proposalId||id('evo');
    const scaffold=scaffoldFor(plan,pid);
    const artifact={proposalId:pid,version:VERSION,files:scaffold.files,migration:plan.dbRequired?'generated sandbox migration':'not required',generatedBy:'SBC Evolution Engine',mode:'sandbox-only',sandboxRoot:scaffold.root};
    const security=securityScan(JSON.stringify(plan));
    const simulation={status:'READY_TO_RUN',workload:10000,tenantIsolation:'required',financialMutation:'blocked',externalDownload:'blocked'};
    const proposal={proposalId:pid,tenantId:String(tenantId),intent:clip(intent,12000),stage:'STAGED',risk:plan.risk,plan,diff:artifact,security,simulation,approvalRequired:true,createdAt:now()};
    const p=pool(); if(p) await p.query('INSERT INTO sbc_evolution_proposals(proposal_id,tenant_id,intent_text,stage,risk,plan_json,diff_json,security_json,simulation_json,approval_required) VALUES(?,?,?,?,?,?,?,?,?,1)',[pid,String(tenantId),proposal.intent,'STAGED',plan.risk,JSON.stringify(plan),JSON.stringify(artifact),JSON.stringify(security),JSON.stringify(simulation)]);
    await logRun(String(tenantId),pid,'STAGE',{blueprint:plan.blueprint,risk:plan.risk,security,simulation});
    return proposal;
  }
  async function list({tenantId=1,limit=20}={}){
    const p=pool(); if(!p) return [...memory.values()].filter(x=>String(x.tenantId)===String(tenantId)).slice(-limit);
    const [rows]=await p.query('SELECT proposal_id,tenant_id,intent_text,stage,risk,plan_json,diff_json,security_json,simulation_json,approval_required,approved_by,created_at,updated_at FROM sbc_evolution_proposals WHERE tenant_id=? ORDER BY created_at DESC LIMIT ?',[String(tenantId),Math.min(100,Math.max(1,Number(limit)||20))]);
    return rows.map(r=>({...r,plan:parse(r.plan_json),diff:parse(r.diff_json),security:parse(r.security_json),simulation:parse(r.simulation_json)}));
  }
  async function get(proposalId,tenantId=1){ const p=pool(); if(!p) return [...memory.values()].find(x=>x.proposalId===proposalId)||null; const [rows]=await p.query('SELECT * FROM sbc_evolution_proposals WHERE proposal_id=? AND tenant_id=? LIMIT 1',[proposalId,String(tenantId)]); if(!rows[0])return null; const r=rows[0]; return {...r,plan:parse(r.plan_json),diff:parse(r.diff_json),security:parse(r.security_json),simulation:parse(r.simulation_json)}; }
  async function approve({proposalId,tenantId=1,actor='owner'}){
    const item=await get(proposalId,tenantId); if(!item) throw new Error('evolution_proposal_not_found');
    if(String(item.risk)==='CRITICAL') throw new Error('critical_evolution_requires_explicit_security_review');
    const p=pool(); if(p) await p.query("UPDATE sbc_evolution_proposals SET stage='APPROVE',approved_by=?,updated_at=CURRENT_TIMESTAMP(6) WHERE proposal_id=? AND tenant_id=? AND stage='STAGED'",[actor,proposalId,String(tenantId)]);
    await logRun(String(tenantId),proposalId,'APPROVE',{actor,productionDeployment:'not executed by approval endpoint'});
    return {ok:true,proposalId,stage:'APPROVE',productionDeployment:'BLOCKED_BY_DESIGN',next:'deploy requires a separate governed execution path'};
  }
  async function reject({proposalId,tenantId=1,actor='owner',reason='owner_rejected'}){const p=pool();if(p)await p.query("UPDATE sbc_evolution_proposals SET stage='REJECTED',approved_by=?,updated_at=CURRENT_TIMESTAMP(6) WHERE proposal_id=? AND tenant_id=?",[actor,proposalId,String(tenantId)]);await logRun(String(tenantId),proposalId,'ROLLBACK',{actor,reason});return {ok:true,proposalId,stage:'REJECTED'};}
  return {VERSION,GOVERNANCE,BLUEPRINTS,ensure,observe,stage,list,get,approve,reject,createPlan,securityScan,diffText,hash};
}
function parse(v){try{return typeof v==='string'?JSON.parse(v||'{}'):v||{};}catch{return {};}}
module.exports={VERSION,GOVERNANCE,BLUEPRINTS,inferBlueprint,createPlan,securityScan,diffText,createEngine};
