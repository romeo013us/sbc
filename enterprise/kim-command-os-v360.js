'use strict';
const crypto = require('crypto');

const CAPABILITIES = [
  'executive-command-center','daily-executive-brief','priority-engine','exception-detection','exception-triage',
  'decision-journal','action-approval-queue','business-health-score','customer-health-monitor','customer-360-orchestrator',
  'sales-pipeline-supervisor','lead-funnel-supervisor','marketing-pulse-supervisor','fulfillment-supervisor','vendor-routing-supervisor',
  'payment-reconciliation-supervisor','receivables-watch','margin-watch','expense-watch','commission-watch',
  'renewal-watch','sla-watch','followup-watch','queue-balancer','task-delegation','workforce-coaching',
  'workforce-capacity-planner','training-readiness','knowledge-base-supervisor','communication-supervisor',
  'consent-suppression-guard','notary-workflow-supervisor','notary-record-readiness','asset-vault-supervisor','document-integrity-supervisor',
  'data-quality-supervisor','lead-dedupe-supervisor','integration-health-supervisor','provider-failover-supervisor','api-cost-watch',
  'database-health-supervisor','backup-verification-supervisor','deployment-readiness-supervisor','configuration-drift-watch','security-posture-watch',
  'incident-command','business-continuity-controller','recovery-readiness','operational-scorecard','kim-self-check'
];

const PROTECTED_ACTIONS = new Set([
  'change-owner-security','change-kim-authority','change-pricing','approve-refund','alter-payment-status','rotate-production-secret',
  'permanent-delete','destructive-database-operation','activate-unverified-provider','publish-unreviewed-external-campaign','perform-notarial-act'
]);

const state = {
  version:'36.0.0',
  mode:'autonomous-operations-controller',
  startedAt:new Date().toISOString(),
  lastTick:null,
  counters:{ticks:0,commandsCreated:0,exceptions:0,actionsCompleted:0,actionsBlocked:0},
  priorities:[], exceptions:[], commands:[], decisions:[], health:{},
  protectedActions:Array.from(PROTECTED_ACTIONS)
};

function now(){return new Date().toISOString()}
function id(prefix='kim'){return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function uniq(arr){return [...new Set((arr||[]).filter(Boolean))]}
function safeJson(v){try{return JSON.stringify(v)}catch{return '{}'}}

function roleAllowed(role){return ['owner','manager','kim_operator','system'].includes(String(role||''));}
function protectedAction(action,role){if(PROTECTED_ACTIONS.has(String(action)) && role!=='owner')return false;return true}

function buildHealth(ctx={}){
  const gates=[];
  const add=(name,ok,detail)=>gates.push({name,ok:Boolean(ok),detail:String(detail||'')});
  add('runtime',true,'Node process is running');
  add('database',Boolean(ctx.mysqlPool),'MySQL pool available; fallback state remains supported');
  add('session',Boolean(ctx.sessionReady),ctx.sessionReady?'Session validation available':'Session validation requires runtime configuration');
  add('redis',Boolean(ctx.redisReady),ctx.redisReady?'Distributed cache/lock ready':'Redis not configured or unavailable');
  add('eventBus',Boolean(ctx.eventBusReady),ctx.eventBusReady?'Event bus available':'Durable DB outbox fallback');
  add('openai',Boolean(ctx.openaiConfigured),'AI gateway configuration is '+(ctx.openaiConfigured?'present':'not confirmed'));
  add('providers',Number(ctx.providerReady||0)>0,`${Number(ctx.providerReady||0)} provider connection(s) ready`);
  add('backup',ctx.backupVerified===true,ctx.backupVerified===true?'Latest backup verification passed':'Backup verification not confirmed');
  const score=Math.round(gates.reduce((s,g)=>s+(g.ok?100:40),0)/Math.max(1,gates.length));
  return {score,gates,generatedAt:now()};
}

function createException(type,severity,title,detail,meta={}){
  const existing=state.exceptions.find(x=>x.type===type&&x.status==='OPEN');
  if(existing)return existing;
  const rec={id:id('exc'),type,severity,title,detail,status:'OPEN',createdAt:now(),updatedAt:now(),meta};
  state.exceptions.unshift(rec);state.exceptions=state.exceptions.slice(0,100);state.counters.exceptions++;
  return rec;
}
function createCommand(type,priority,title,detail,meta={}){
  const rec={id:id('cmd'),type,priority,title,detail,status:'QUEUED',createdAt:now(),updatedAt:now(),meta};
  state.commands.unshift(rec);state.commands=state.commands.slice(0,200);state.counters.commandsCreated++;return rec;
}
function decide(topic,decision,reason,meta={}){
  const rec={id:id('dec'),topic,decision,reason,meta,createdAt:now()};state.decisions.unshift(rec);state.decisions=state.decisions.slice(0,200);return rec;
}

function tick(ctx={}){
  state.counters.ticks++;state.lastTick=now();
  const health=buildHealth(ctx);state.health=health;
  if(health.score<75)createException('system-health','HIGH','Kim detected degraded system health','One or more readiness gates are below normal.',{score:health.score,gates:health.gates.filter(x=>!x.ok)});
  if(Number(ctx.overdueOrders||0)>0)createException('overdue-orders','HIGH','Fulfillment work is overdue',`${ctx.overdueOrders} order(s) exceeded their operational SLA.`,{count:Number(ctx.overdueOrders)});
  if(Number(ctx.unverifiedLeads||0)>0)createCommand('lead-verification','HIGH','Process pending lead verification',`${ctx.unverifiedLeads} lead(s) require verification before sales handoff.`,{count:Number(ctx.unverifiedLeads)});
  if(Number(ctx.openFollowups||0)>0)createCommand('followup-review','MEDIUM','Review open sales follow-ups',`${ctx.openFollowups} follow-up item(s) remain open.`,{count:Number(ctx.openFollowups)});
  if(Number(ctx.openExceptions||0)>0)createCommand('exception-review','HIGH','Review operational exceptions',`${ctx.openExceptions} exception(s) require attention.`,{count:Number(ctx.openExceptions)});
  state.priorities=[...state.exceptions.filter(x=>x.status==='OPEN').map(x=>({source:'exception',id:x.id,priority:x.severity,title:x.title,detail:x.detail})),...state.commands.filter(x=>x.status==='QUEUED').map(x=>({source:'command',id:x.id,priority:x.priority,title:x.title,detail:x.detail}))].slice(0,25);
  return {ok:true,tickAt:state.lastTick,health,priorities:state.priorities.slice(0,10)};
}

function authorizeAction({role,action}){return {allowed:protectedAction(action,role),protected:PROTECTED_ACTIONS.has(String(action)),reason:(!protectedAction(action,role)?'Owner authority is required for this action.':'')}}
function completeCommand(commandId,actor='kim'){
  const c=state.commands.find(x=>x.id===commandId);if(!c)throw new Error('Command not found.');
  if(c.status!=='QUEUED')return c;c.status='COMPLETED';c.completedBy=actor;c.updatedAt=now();state.counters.actionsCompleted++;return c;
}
function closeException(exceptionId,actor='kim',note=''){
  const e=state.exceptions.find(x=>x.id===exceptionId);if(!e)throw new Error('Exception not found.');
  e.status='RESOLVED';e.resolvedBy=actor;e.resolution=String(note||'Resolved by Kim');e.updatedAt=now();return e;
}
function summary(ctx={}){
  return {version:state.version,mode:state.mode,capabilityCount:CAPABILITIES.length,capabilities:CAPABILITIES,lastTick:state.lastTick,health:state.health,priorities:state.priorities.slice(0,12),openExceptions:state.exceptions.filter(x=>x.status==='OPEN').slice(0,12),queuedCommands:state.commands.filter(x=>x.status==='QUEUED').slice(0,12),protectedActions:state.protectedActions,counters:{...state.counters},generatedAt:now(),context:ctx};
}
function capabilityMatrix(){return CAPABILITIES.map((name,index)=>({id:151+index,name,status:'ACTIVE',autonomous:true,notes:'Operational controller capability; protected actions remain owner-gated.'}))}
function dailyBrief(ctx={}){const h=state.health||buildHealth(ctx);return {generatedAt:now(),headline:`Kim Operating Brief — health ${h.score}/100`,health:h,topPriorities:state.priorities.slice(0,7),openExceptions:state.exceptions.filter(x=>x.status==='OPEN').slice(0,7),nextActions:state.commands.filter(x=>x.status==='QUEUED').slice(0,7),ownerDecisionsNeeded:state.decisions.filter(x=>x.ownerDecisionNeeded).slice(0,7)}}

module.exports={CAPABILITIES,PROTECTED_ACTIONS,state,tick,summary,dailyBrief,capabilityMatrix,authorizeAction,completeCommand,closeException,createException,createCommand,decide,buildHealth,roleAllowed};
