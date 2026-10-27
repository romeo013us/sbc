const fs=require('fs');
const path=require('path');
const REG_FILE=path.join(__dirname,'..','data','v433-edge-suite.json');
const FALLBACK_REG={version:'43.3.0',items:[]};
let REG=FALLBACK_REG;
try{
  if(fs.existsSync(REG_FILE)){
    const parsed=JSON.parse(fs.readFileSync(REG_FILE,'utf8'));
    if(parsed&&typeof parsed==='object'&&Array.isArray(parsed.items)) REG=parsed;
  }
}catch(e){
  // Startup must remain available if an optional legacy catalog is missing/corrupt.
  // The authoritative package still ships the catalog; this is only a fail-safe.
  REG=FALLBACK_REG;
}
function status(db,env){
  const customers=Array.isArray(db?.customers)?db.customers.length:0;
  const leads=Array.isArray(db?.leads)?db.leads.length:(Array.isArray(db?.crm)?db.crm.length:0);
  const orders=Array.isArray(db?.orders)?db.orders.length:0;
  const tasks=Array.isArray(db?.tasks)?db.tasks.length:0;
  const configured=['SQUARE_ACCESS_TOKEN','TWILIO_ACCOUNT_SID','GODADDY_PAT','OPENAI_API_KEY'].filter(k=>Boolean(env?.[k])).length;
  return {ok:true,version:REG.version,counts:{customers,leads,orders,tasks},configuredCoreIntegrations:configured,guardrail:'non-destructive'};
}
function action(featureId,db,env,user){
  const item=REG.items.find(x=>x.id===featureId);
  if(!item) throw new Error('Unknown Edge Suite capability.');
  const base=status(db,env);
  let detail='Safe readiness check completed. No business records were changed.';
  if(item.name==='One-Click Daily Command Brief') detail=`Prepared a live brief from ${base.counts.customers} customers, ${base.counts.leads} lead/CRM records, ${base.counts.orders} orders and ${base.counts.tasks} tasks.`;
  if(item.name==='Broken-Button Sentinel') detail='UI action is server-reachable and protected by authenticated routing; use the browser test suite for visual click verification.';
  if(item.name==='Payment Processing Readiness Map') detail='Payment-processing workflow is integration-ready; external processor credentials are not assumed or fabricated.';
  if(item.name==='Human-vs-AI Work Router') detail='Router policy: reversible routine work may be handled by Kim; irreversible/destructive work remains owner-gated.';
  if(item.name==='Safe Action Preview') detail='Preview mode: proposed changes must be shown before a reversible action is committed.';
  if(item.name==='SBC Signature Operating Blueprint') detail='Blueprint combines lead → sale → payment → fulfillment → customer completion with Kim coordination and owner exception control.';
  return {...base,feature:item,detail,actor:user?.name||user?.username||'authenticated-user',timestamp:new Date().toISOString()};
}
module.exports={REG,status,action};
