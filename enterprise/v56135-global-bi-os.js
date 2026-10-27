'use strict';
/**
 * SBC BI-OS — GLOBAL BUSINESS INTELLIGENCE FABRIC
 *
 * Global knowledge is deliberately separate from private SBC customer state.
 * The fabric retrieves evidence; it does not pretend 100M companies are already
 * present. Scale is provided by indexed MySQL graph tables and bounded retrieval.
 */
const VERSION='56.13.5-BIOS-GLOBAL';
const MAX_RESULTS=25;
const MAX_EVIDENCE=100;
const SOURCE_TYPES=Object.freeze(['PUBLIC','LICENSED','PARTNER','SBC_OBSERVED','USER_AUTHORIZED']);
const CHANNELS=Object.freeze(['GLOBAL_KB','INDUSTRY','COMPANY','CONVERSATION','OUTCOME']);
const BRAIN_DOMAINS=Object.freeze({
  PROSPECT_BRAIN:['identity','fit','suppression','industry','global_patterns'],
  CONTEXT_BRAIN:['company_context','industry_context','events','history'],
  OPENING_BRAIN:['channel_fit','common_objections','industry_language'],
  DISCOVERY_BRAIN:['needs','pain_patterns','benchmarks','events'],
  SOLUTION_BRAIN:['catalog','compatibility','global_patterns','observed_fit','margin'],
  CLOSING_BRAIN:['buying_signals','objections','offer_patterns','outcomes'],
  FULFILLMENT_BRAIN:['dependencies','delivery_patterns','failure_patterns'],
  ACCOUNT_MANAGER_BRAIN:['retention','expansion','next_needs','industry_patterns'],
  RECOVERY_CONTROLLER_BRAIN:['failures','recovery_actions','policy'],
  TELEMETRY_BRAIN:['conversion','revenue','retention','global_benchmarks']
});
function clean(v,n=1000){return String(v??'').replace(/[\u0000]/g,'').trim().slice(0,n);}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function tokens(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2);}
function normIndustry(v){return clean(v,120).toLowerCase();}
function scoreText(query,text){const q=[...new Set(tokens(query))];const hay=String(text||'').toLowerCase();return q.reduce((n,t)=>n+(hay.includes(t)?1:0),0);}
function rankEvidence(rows,query){return (Array.isArray(rows)?rows:[]).map(r=>({...r,_score:(num(r.confidence_score)||num(r.confidence)||0.5)*100+scoreText(query,[r.industry_type,r.observed_vulnerability,r.problem_code,r.solution_class,r.claim_text,r.typical_bottleneck].join(' '))*5})).sort((a,b)=>b._score-a._score).slice(0,MAX_RESULTS);}
function buildCompanyContext(customer={}){return {companyId:String(customer.id||''),industry:normIndustry(customer.industry||customer.industryVertical),region:clean(customer.region||customer.city||'',100),sizeBand:clean(customer.employeeCountBand||customer.sizeBand||'',50),facts:Object.fromEntries(['businessName','website','industry','city','region','leadTemperature','verificationStatus'].filter(k=>customer[k]!==undefined).map(k=>[k,customer[k]]))};}
function createGlobalFabric({mysqlPool:poolArg=null,globalRows={},sbcHistory={},catalog={}}={}){
  const mysqlPoolOuter=poolArg;
  const local={benchmarks:Array.isArray(globalRows.benchmarks)?globalRows.benchmarks:[],patterns:Array.isArray(globalRows.patterns)?globalRows.patterns:[],events:Array.isArray(globalRows.events)?globalRows.events:[],evidence:Array.isArray(globalRows.evidence)?globalRows.evidence:[]};
  const catalogItems=[...(Array.isArray(catalog.packages)?catalog.packages:[]),...(Array.isArray(catalog.services)?catalog.services:[])].filter(x=>x&&x.testOnly!==true);
  function retrieve({customer={},needs=[],text='',industry}={}){
    const ind=normIndustry(industry||customer.industry||customer.industryVertical);
    const query=[ind,...needs,text].join(' ');
    const benchmarks=rankEvidence(local.benchmarks.filter(r=>!ind||!r.industry_type||normIndustry(r.industry_type)===ind||normIndustry(r.industry_type)==='general'),query);
    const patterns=rankEvidence(local.patterns.filter(r=>!ind||!r.industry_type||normIndustry(r.industry_type)===ind||normIndustry(r.industry_type)==='general'),query);
    const evidence=rankEvidence(local.evidence,query).slice(0,MAX_EVIDENCE);
    const events=local.events.filter(r=>!ind||!r.industry_type||normIndustry(r.industry_type)===ind).slice(-MAX_RESULTS);
    const provenSkus=[...new Set([...patterns,...benchmarks].map(x=>x.proven_solution_sku||x.solution_sku).filter(Boolean))];
    return {version:VERSION,channels:CHANNELS,company:buildCompanyContext(customer),industry:ind||'unknown',query:clean(query,3000),benchmarks,patterns,evidence,events,provenSkus,catalogCount:catalogItems.length,truth:'Global intelligence is evidence-backed; unavailable evidence remains unknown.'};
  }
  function recommend(input={}){
    const ctx=retrieve(input);
    const globalSkuScore=new Map();
    for(const row of [...ctx.benchmarks,...ctx.patterns]){
      const sku=String(row.proven_solution_sku||row.solution_sku||''); if(!sku)continue;
      globalSkuScore.set(sku,(globalSkuScore.get(sku)||0)+Math.max(1,num(row.confidence_score)*100));
    }
    const recommended=catalogItems.map(p=>{const sku=String(p.id||'');const base=globalSkuScore.get(sku)||0;const textScore=scoreText([input.text,...(input.needs||[])].join(' '),[p.name,p.description,p.category,...(p.features||[])].join(' '))*4;return {...p,globalEvidenceScore:Number((base+textScore).toFixed(2))};}).filter(x=>x.globalEvidenceScore>0).sort((a,b)=>b.globalEvidenceScore-a.globalEvidenceScore).slice(0,8);
    return {...ctx,recommended,nextBestAction:recommended.length?'USE_EVIDENCE_TO_DIAGNOSE':'GATHER_MORE_EVIDENCE',confidence:Number(Math.min(.99,.25+(ctx.benchmarks.length+ctx.patterns.length+ctx.evidence.length)*.01).toFixed(2))};
  }
  async function refreshFromDatabase({tenantId=1}={}){
    if(!mysqlPoolOuter)return {ok:false,reason:'MySQL pool unavailable.'};
    const q=async(sql,args)=>{try{const [rows]=await mysqlPoolOuter.query(sql,args);return Array.isArray(rows)?rows:[];}catch(e){return [];}};
    local.benchmarks=await q('SELECT * FROM global_industry_benchmarks WHERE status=? ORDER BY confidence_score DESC, verified_at DESC LIMIT 500',['ACTIVE']);
    local.patterns=await q('SELECT * FROM global_solution_patterns WHERE active=1 ORDER BY confidence_score DESC, verified_at DESC LIMIT 500');
    local.events=await q('SELECT * FROM global_business_events ORDER BY observed_at DESC LIMIT 500');
    local.evidence=await q('SELECT * FROM global_knowledge_evidence WHERE active=1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY confidence_score DESC, observed_at DESC LIMIT 500');
    return {ok:true,tenantId,loaded:{benchmarks:local.benchmarks.length,patterns:local.patterns.length,events:local.events.length,evidence:local.evidence.length}};
  }
  async function seedCatalogToDatabase({mysqlPool:pool}= {}){
    pool=pool||mysqlPoolOuter;
    if(!pool)return {ok:false,reason:'MySQL pool unavailable.'};
    let written=0;
    for(const item of catalogItems){
      const unit=String(item.unit||'').toLowerCase();const recurring=/month|monthly/i.test(unit);const price=num(item.price);
      try{await pool.query(`INSERT INTO sbc_authorized_catalog (sku,item_name,category,setup_fee,recurring_fee,description,metadata_json,status) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE item_name=VALUES(item_name),category=VALUES(category),setup_fee=VALUES(setup_fee),recurring_fee=VALUES(recurring_fee),description=VALUES(description),metadata_json=VALUES(metadata_json),status=VALUES(status)`,[String(item.id),String(item.name),String(item.category||'GENERAL'),recurring?0:price,recurring?price:0,String(item.description||''),JSON.stringify({unit:item.unit||'',features:item.features||[],paymentUrl:item.paymentUrl||''}),'ACTIVE']);written++;}catch(e){}
    }
    return {ok:true,written};
  }
  function snapshot(){return {version:VERSION,architecture:'GLOBAL_BUSINESS_INTELLIGENCE_FABRIC',scaleTarget:'100M+ company/pattern records via indexed retrieval',channels:CHANNELS,brains:Object.entries(BRAIN_DOMAINS).map(([brain,domains])=>({brain,domains,state:'SUPER_INTELLIGENT'})),localEvidence:{benchmarks:local.benchmarks.length,patterns:local.patterns.length,events:local.events.length,evidence:local.evidence.length},catalogKnown:catalogItems.length,privacy:'Global layer stores evidence/provenance; private SBC customer state remains separate.',truth:'No claim of 100M records unless ingestion has actually populated them.'};}
  return {version:VERSION,channels:CHANNELS,brainDomains:BRAIN_DOMAINS,retrieve,recommend,refreshFromDatabase,seedCatalogToDatabase,snapshot};
}
module.exports={VERSION,CHANNELS,BRAIN_DOMAINS,SOURCE_TYPES,createGlobalFabric,buildCompanyContext,rankEvidence};
