'use strict';
// SBC V6648 — no broadcast verification/outreach when a caller omits tenant scope.
// Applied after V6647; affects compiled runtime only, no live SQL or providers.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6648_TENANT_SCOPED_REVENUE';
function replace(s,a,b,expected,label){
 const n=s.split(a).length-1;
 if(n!==expected)throw Error(MARKER+': '+label+' expected '+expected+' anchors, found '+n);
 return s.split(a).join(b);
}
const one=(s,a,b,label)=>replace(s,a,b,1,label);
function patchServer(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate server');
 s=one(s,'async function verifyRevenueLeadPool({limit=250,tenantId=null}={}){',
   'async function verifyRevenueLeadPool({limit=250,tenantId}={}){\n  const sbcRevenueTenant=requireTenantValue(tenantId); // '+MARKER,'verifier guard');
 s=one(s,'const candidates=(db.customers||[]).filter(c=>tenantId===null||Number(c?.tenantId)===Number(tenantId))',
   'const candidates=(db.customers||[]).filter(c=>Number(c?.tenantId)===sbcRevenueTenant)','verifier selection');
 s=one(s,'async function processRevenueFollowups({tenantId=null}={}){',
   'async function processRevenueFollowups({tenantId}={}){\n  const sbcRevenueTenant=requireTenantValue(tenantId);','followup guard');
 s=one(s,'if(tenantId!==null&&Number(c?.tenantId)!==Number(tenantId))return false;',
   'if(Number(c?.tenantId)!==sbcRevenueTenant)return false;','followup selection');
 s=one(s,"async function runRevenueFirstPlay({limit=10,reason='press-play',tenantId=null}={}){",
   "async function runRevenueFirstPlay({limit=10,reason='press-play',tenantId}={}){\n  const sbcRevenueTenant=requireTenantValue(tenantId);",'play guard');
 s=one(s,'const leads=(db.customers||[]).filter(c=>tenantId===null||Number(c?.tenantId)===Number(tenantId))',
   'const leads=(db.customers||[]).filter(c=>Number(c?.tenantId)===sbcRevenueTenant)','play selection');
 s=one(s,'const warmHotVerified=(db.customers||[]).filter(c=>',
   'const warmHotVerified=(db.customers||[]).filter(c=>Number(c?.tenantId)===sbcRevenueTenant).filter(c=>','no-lead diagnostics');
 s=one(s,'await verifyRevenueLeadPool({limit:250,tenantId});',
   'await verifyRevenueLeadPool({limit:250,tenantId:sbcRevenueTenant});','play verification propagation');
 s=one(s,'await verifyRevenueLeadPool({limit:req.body?.limit||250});',
   'await verifyRevenueLeadPool({limit:req.body?.limit||250,tenantId:requireRequestTenant(req)});','owner verify');
 s=one(s,"await runRevenueFirstPlay({limit:req.body?.limit||10,reason:'press-play'});",
   "await runRevenueFirstPlay({limit:req.body?.limit||10,reason:'press-play',tenantId:requireRequestTenant(req)});",'owner play');
 s=one(s,'const customers=(Array.isArray(db.customers)?db.customers:[]).filter(c=>!isSbcSyntheticTestRecord(c));',
   'const sbcRevenueTenant=requireRequestTenant(req);\n    const customers=(Array.isArray(db.customers)?db.customers:[]).filter(c=>Number(c?.tenantId)===sbcRevenueTenant&&!isSbcSyntheticTestRecord(c));','owner revenue status');
 s=one(s,'runGrowthCycle:async({tenantId=1,limit=100,auto=false}={})=>',
   'runGrowthCycle:async({tenantId,limit=100,auto=false}={})=>','growth default');
 s=replace(s,'onRevenuePlay:({limit,reason})=>runRevenueFirstPlay({limit,reason})',
   'onRevenuePlay:({limit,reason,tenantId})=>runRevenueFirstPlay({limit,reason,tenantId})',2,'delegated growth callbacks');
 return s;
}
function patchPipeline(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate pipeline');
 s='// '+MARKER+"\nconst {scopeCustomers}=require('../enterprise/v6648-revenue-tenant.cjs');\n"+s;
 s=replace(s,'summarize(ctx.db?.customers || [], ctx.routeRevenueLead)',
   'summarize(scopeCustomers(ctx.db?.customers || [], global.__SBC_REQUIRE_TENANT(req)), ctx.routeRevenueLead)',2,'pipeline status and prepare');
 s=one(s,'ctx.verifyRevenueLeadPool({ limit })',
   'ctx.verifyRevenueLeadPool({ limit, tenantId:global.__SBC_REQUIRE_TENANT(req) })','pipeline verify');
 s=one(s,'ctxSafePrepare(getContext(), limit)',
   'ctxSafePrepare(getContext(), limit, global.__SBC_REQUIRE_TENANT(req))','pipeline play prepare');
 s=one(s,"runRevenueFirstPlay({ limit, reason: 'lorna-revenue-pipeline' })",
   "runRevenueFirstPlay({ limit, reason: 'lorna-revenue-pipeline', tenantId:global.__SBC_REQUIRE_TENANT(req) })",'pipeline play');
 s=one(s,'async function ctxSafePrepare(ctx, limit) {',
   'async function ctxSafePrepare(ctx, limit, tenantId) {','pipeline helper scope');
 s=one(s,'ctx.verifyRevenueLeadPool({ limit: Math.max(10, Math.min(250, limit * 25)) })',
   'ctx.verifyRevenueLeadPool({ limit: Math.max(10, Math.min(250, limit * 25)), tenantId })','pipeline prepared verification');
 return s;
}
function patchSprint(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate sprint');
 s='// '+MARKER+"\nconst {scopeRevenueDb}=require('../enterprise/v6648-revenue-tenant.cjs');\n"+s;
 s=replace(s,'poolSnapshot(ctx.db || {})',
   'poolSnapshot(scopeRevenueDb(ctx.db || {}, global.__SBC_REQUIRE_TENANT(req)))',4,'sprint scope');
 s=replace(s,'revenueProof(ctx.db || {})',
   'revenueProof(scopeRevenueDb(ctx.db || {}, global.__SBC_REQUIRE_TENANT(req)))',2,'sprint proof');
 s=one(s,'ctx.verifyRevenueLeadPool({ limit:requested })',
   'ctx.verifyRevenueLeadPool({ limit:requested, tenantId:global.__SBC_REQUIRE_TENANT(req) })','sprint prepare');
 s=one(s,'ctx.verifyRevenueLeadPool({ limit:Math.max(10, requested * 5) })',
   'ctx.verifyRevenueLeadPool({ limit:Math.max(10, requested * 5), tenantId:global.__SBC_REQUIRE_TENANT(req) })','sprint play verify');
 s=one(s,"ctx.runRevenueFirstPlay({ limit:requested, reason:'v56133-revenue-sprint' })",
   "ctx.runRevenueFirstPlay({ limit:requested, reason:'v56133-revenue-sprint', tenantId:global.__SBC_REQUIRE_TENANT(req) })",'sprint play');
 return s;
}
function patchAutopilot(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate autopilot');
 s='// '+MARKER+'\n'+s;
 s=one(s,'ctx.saveData?.();return out;','await ctx.saveData?.();return out;','await cycle persistence');
 s=replace(s,'await processRevenueFollowups();',
   'await processRevenueFollowups({tenantId:global.__SBC_REQUIRE_TENANT(req)});',2,'nightly and safe followups');
 return s;
}
function patchCommand(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate command');
 s='// '+MARKER+'\n'+s;
 return one(s,"c.runRevenueFirstPlay({limit,reason:'90-day-revenue-command'})",
   "c.runRevenueFirstPlay({limit,reason:'90-day-revenue-command',tenantId:global.__SBC_REQUIRE_TENANT(req)})",'90day scope');
}
function patchGrowth(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate growth');
 s="// "+MARKER+"\nconst {requireTenant,scopeCustomers,scopeRevenueDb}=require('./v6648-revenue-tenant.cjs');\n"+s;
 s=one(s,'async cycle({tenantId=1,limit=100,auto=false}={}){',
   'async cycle({tenantId,limit=100,auto=false}={}){\n    tenantId=requireTenant(tenantId);','growth cycle guard');
 s=one(s,'const customers=(this.db.customers||[]).filter(c=>Number(__sbcRequireTenantId(c.tenantId))===Number(tenantId));',
   'const customers=scopeCustomers(this.db.customers,tenantId);','growth lead metrics');
 s=one(s,'const interactions=this.db.eliteCloserInteractions||[];const orders=this.db.orders||[];const actions=[];',
   'const scoped=scopeRevenueDb(this.db,tenantId);const interactions=scoped.eliteCloserInteractions||[];const orders=scoped.orders||[];const actions=[];','growth order metrics');
 s=one(s,"this.onRevenuePlay({limit:Math.min(10,Math.max(1,Number(limit))),reason:'v56.12.2-growth-engine'})",
   "this.onRevenuePlay({limit:Math.min(10,Math.max(1,Number(limit))),reason:'v56.12.2-growth-engine',tenantId})",'growth play tenant');
 s=one(s,'async dashboard(tenantId=1){await this.ensureTables();',
   'async dashboard(tenantId){tenantId=requireTenant(tenantId);await this.ensureTables();','growth dashboard guard');
 s=one(s,'else metrics=revenueMetrics(this.db.customers||[],this.db.eliteCloserInteractions||[],this.db.orders||[]);',
   'else {const scoped=scopeRevenueDb(this.db,tenantId);metrics=revenueMetrics(scoped.customers||[],scoped.eliteCloserInteractions||[],scoped.orders||[]);}','growth fallback stats');
 return s;
}
const TARGETS={'server.js':patchServer,'routes/v56131-revenue-pipeline.js':patchPipeline,
 'routes/v56133-revenue-sprint.js':patchSprint,'routes/v56131-revenue-autopilot.js':patchAutopilot,
 'routes/v56140-90day-revenue-command.js':patchCommand,'enterprise/sbc-revenue-growth-v56122.js':patchGrowth};
function apply(root){
 const edits=new Map();
 for(const [rel,fn] of Object.entries(TARGETS)){
  const p=path.join(root,rel);if(!fs.existsSync(p))throw Error(MARKER+': missing '+rel);
  const updated=fn(fs.readFileSync(p,'utf8'));new vm.Script(updated,{filename:rel});edits.set(p,updated);
 }
 const helper=path.join(__dirname,'../enterprise/v6648-revenue-tenant.cjs');
 if(!fs.existsSync(helper))throw Error(MARKER+': missing helper');
 new vm.Script(fs.readFileSync(helper,'utf8'));
 for(const [p,code] of edits)fs.writeFileSync(p,code);
 fs.copyFileSync(helper,path.join(root,'enterprise/v6648-revenue-tenant.cjs'));
 return {marker:MARKER,files:[...Object.keys(TARGETS),'enterprise/v6648-revenue-tenant.cjs'],
  tenantRequired:true,noBroadcastFallback:true,noProviderCalls:true,noSchemaChanges:true};
}
module.exports={apply,MARKER};
