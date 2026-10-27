'use strict';
/**
 * SBC V56.13.5 — SUPER-BRAIN INTELLIGENCE FABRIC
 * Shared evidence substrate for all ten brains.
 *
 * Design principle:
 *   Intelligence = observed SBC history + authorized catalog knowledge + explicitly
 *   sourced external benchmarks + recorded recovery knowledge.
 *
 * The fabric never invents historical wins, prices, margins, customer outcomes,
 * or external-company experience. Unknowns remain unknown and lower confidence.
 */
const VERSION='56.13.5-SUPERBRAIN';
const MAX_MEMORY_ITEMS=500;
const MAX_PRODUCT_ITEMS=500;
const BRAIN_PROFILES=Object.freeze({
  PROSPECT_BRAIN:['identity','fit','suppression','industry'],
  CONTEXT_BRAIN:['history','business_context','prior_interactions'],
  OPENING_BRAIN:['successful_openings','objections','channel_fit'],
  DISCOVERY_BRAIN:['needs','pain_patterns','industry_patterns'],
  SOLUTION_BRAIN:['catalog','compatibility','historical_fit','margin'],
  CLOSING_BRAIN:['buying_signals','objections','checkout_patterns'],
  FULFILLMENT_BRAIN:['dependencies','delivery_history','failure_patterns'],
  ACCOUNT_MANAGER_BRAIN:['retention','expansion','next_needs','customer_history'],
  RECOVERY_CONTROLLER_BRAIN:['failures','recovery_actions','policy'],
  TELEMETRY_BRAIN:['revenue','conversion','retention','yield']
});
function clean(v,n=1000){return String(v??'').replace(/[\u0000]/g,'').trim().slice(0,n);}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function tokens(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2);}
function paid(o){return /PAID|COMPLETED|FULFILLED/i.test(String(o?.paymentStatus||o?.status||''));}
function catalogItems(catalog){
  const p=Array.isArray(catalog?.packages)?catalog.packages:[];
  const s=Array.isArray(catalog?.services)?catalog.services:[];
  return [...p,...s].filter(x=>x&&x.testOnly!==true).map(x=>({
    sku:String(x.id||''),name:String(x.name||''),category:String(x.category||''),unit:String(x.unit||''),
    price:num(x.price),description:String(x.description||''),features:Array.isArray(x.features)?x.features.map(String):[],
    recurring:/month|monthly/i.test(String(x.unit||'')),paymentUrl:String(x.paymentUrl||''),
    evidence:'canonical SBC catalog'
  })).filter(x=>x.sku&&x.name).slice(0,MAX_PRODUCT_ITEMS);
}
function buildProductKnowledge(catalog){
  return catalogItems(catalog).map(p=>({
    ...p,
    searchText:[p.name,p.category,p.description,...p.features].join(' '),
    capabilities:[...new Set([p.category,...tokens(p.name),...tokens(p.description)])].slice(0,30),
    confidence:1,
    knowledgeSource:'SBC-authorized-catalog'
  }));
}
function buildObservedHistory({db={},externalBenchmarks=[],recoveryLogs=[]}={}){
  const customers=Array.isArray(db.customers)?db.customers:[];
  const orders=Array.isArray(db.orders)?db.orders:[];
  const activities=Array.isArray(db.activities)?db.activities:[];
  const byId=new Map(customers.map(c=>[String(c.id),c]));
  const outcomes=[];
  for(const o of orders){
    const c=byId.get(String(o.customerId||o.customer_id));
    outcomes.push({
      source:'SBC_OBSERVED',type:'ORDER',id:String(o.id||''),industry:String(c?.industry||'unknown'),
      customerId:String(o.customerId||''),product:String(o.product||''),status:String(o.paymentStatus||o.status||''),
      paid:paid(o),revenue:num(o.price||o.total),createdAt:o.createdAt||o.created_at||null
    });
  }
  const relevantActivities=activities.slice(-MAX_MEMORY_ITEMS).map(a=>({
    source:'SBC_OBSERVED',type:'ACTIVITY',id:String(a.id||''),activityType:String(a.activityType||a.type||''),
    message:clean(a.message||'',600),customerId:String(a.meta?.customerId||a.customerId||''),createdAt:a.createdAt||a.created_at||null
  }));
  return {orders:outcomes.slice(-MAX_MEMORY_ITEMS),activities:relevantActivities,external:externalBenchmarks.slice(-MAX_MEMORY_ITEMS),recovery:recoveryLogs.slice(-MAX_MEMORY_ITEMS)};
}
function aggregateHistory(history){
  const wins=history.orders.filter(x=>x.paid);
  const industries={};
  const products={};
  for(const x of wins){
    const i=x.industry||'unknown'; industries[i]=industries[i]||{wins:0,revenue:0};industries[i].wins++;industries[i].revenue+=x.revenue;
    const p=x.product||'unknown';products[p]=products[p]||{wins:0,revenue:0};products[p].wins++;products[p].revenue+=x.revenue;
  }
  return {wins:wins.length,revenue:Number(wins.reduce((n,x)=>n+x.revenue,0).toFixed(2)),industries,products};
}
function fitScore(product,{needs=[],text='',industry='',history}={}){
  const hay=[product.name,product.category,product.description,...product.features].join(' ').toLowerCase();
  let score=0;const reasons=[];
  for(const need of needs){
    const nt=tokens(need);const hits=nt.filter(t=>hay.includes(t));
    if(hits.length){score+=Math.min(30,hits.length*7);reasons.push(`Need match: ${need}`);}
  }
  const tt=tokens(text);const contextHits=tt.filter(t=>hay.includes(t));score+=Math.min(15,contextHits.length*2);
  if(product.recurring)score+=3;
  const productHistory=history?.products?.[product.name]||history?.products?.[product.sku];
  if(productHistory){score+=Math.min(20,productHistory.wins*2);reasons.push(`Observed wins: ${productHistory.wins}`);}
  if(industry&&history?.industries?.[industry]?.wins) {score+=Math.min(10,history.industries[industry].wins);reasons.push(`Observed ${industry} wins: ${history.industries[industry].wins}`);}
  return {score,reasons};
}
function recommend({customer={},needs=[],text='',catalog,history}={}){
  const products=buildProductKnowledge(catalog);
  const aggregate=aggregateHistory(history||{orders:[]});
  const industry=String(customer.industry||'').trim().toLowerCase();
  const ranked=products.map(product=>({product,...fitScore(product,{needs,text,industry,history:aggregate})}))
    .sort((a,b)=>b.score-a.score||a.product.price-b.product.price);
  const selected=[];const seen=new Set();
  for(const x of ranked){
    if(x.score<=0||seen.has(x.product.sku))continue;
    selected.push(x);seen.add(x.product.sku);if(selected.length>=8)break;
  }
  const evidenceCount=aggregate.wins+Number(history?.external?.length||0)+Number(history?.recovery?.length||0);
  const confidence=Math.max(.25,Math.min(.99,.35+Math.min(.4,evidenceCount/100)+Math.min(.24,selected.length*.03)));
  return {
    version:VERSION,customerId:String(customer.id||''),industry:industry||'unknown',
    recommended:selected.map(x=>({...x.product,score:x.score,reasons:x.reasons})),
    nextBestAction:selected.length?'DISCOVER_AND_PRESENT_SOLUTION':'GATHER_MORE_EVIDENCE',
    confidence:Number(confidence.toFixed(2)),
    evidence:{observedWins:aggregate.wins,observedRevenue:aggregate.revenue,externalBenchmarks:Number(history?.external?.length||0),recoveryRecords:Number(history?.recovery?.length||0)},
    principle:'Recommendations are evidence-weighted; unknown history is not treated as a win.'
  };
}
function createFabric({db={},catalog={},externalBenchmarks=[],recoveryLogs=[]}={}){
  const history=buildObservedHistory({db,externalBenchmarks,recoveryLogs});
  const productKnowledge=buildProductKnowledge(catalog);
  const aggregate=aggregateHistory(history);
  const getContext=()=>({version:VERSION,history,aggregate,productKnowledge,brainProfiles:BRAIN_PROFILES});
  return {
    version:VERSION,brainProfiles:BRAIN_PROFILES,getContext,
    recommend:input=>recommend({...input,catalog,history}),
    snapshot:()=>({version:VERSION,brains:Object.keys(BRAIN_PROFILES).map(brain=>({brain,state:'SUPER_INTELLIGENT',domains:BRAIN_PROFILES[brain]})),memory:{observedOrders:history.orders.length,observedActivities:history.activities.length,externalBenchmarks:history.external.length,recoveryRecords:history.recovery.length},catalog:{knownProducts:productKnowledge.length},aggregate:{observedWins:aggregate.wins,observedRevenue:aggregate.revenue},truth:'Observed or explicitly sourced evidence only.'})
  };
}
async function refreshFromMySQL({mysqlPool,db,catalog,tenantId=1}={}){
  let external=[],recovery=[];
  if(mysqlPool){
    try{[external]=await mysqlPool.query('SELECT industry,metric,value,evidence_uri,source_name,verified_at FROM sbc_brain_external_benchmarks WHERE tenant_id=? AND active=1 ORDER BY verified_at DESC LIMIT 500',[tenantId]);}catch(e){}
    try{[recovery]=await mysqlPool.query('SELECT failure_code,recovery_action,success_count,source_event_id,created_at FROM sbc_brain_recovery_memory WHERE tenant_id=? ORDER BY created_at DESC LIMIT 500',[tenantId]);}catch(e){}
  }
  return createFabric({db,catalog,externalBenchmarks:external,recoveryLogs:recovery});
}
module.exports={VERSION,BRAIN_PROFILES,catalogItems,buildProductKnowledge,buildObservedHistory,aggregateHistory,recommend,createFabric,refreshFromMySQL};
