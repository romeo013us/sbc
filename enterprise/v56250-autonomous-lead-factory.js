'use strict';
const crypto=require('crypto');
const APOLLO='https://api.apollo.io/api/v1';
const VERSION='56.25.0';
const DEFAULTS={enabled:false,autoApollo:false,autoClay:false,batchSize:25,maxDailyApolloPages:10,maxDailyClayRows:250,minScoreForClay:55,requireHumanReviewOnLowConfidence:true};
let ctx={db:null,mysqlPool:null,saveData:async()=>{},audit:()=>{},secretValue:()=>''};
let cfg={...DEFAULTS};
const memory={running:false,lastApolloAt:null,lastClayAt:null,lastResult:null,apolloPagesToday:0,clayRowsToday:0,dayKey:null};
function now(){return new Date().toISOString()}
function clean(v,n=500){return String(v??'').replace(/\s+/g,' ').trim().slice(0,n)}
function normEmail(v){return clean(v,320).toLowerCase()}
function domainOf(v){const s=String(v||'').trim().toLowerCase();if(!s)return '';try{return new URL(/^https?:\/\//i.test(s)?s:'https://'+s).hostname.replace(/^www\./,'')}catch{return s.replace(/^www\./,'').split('/')[0]}}
function resetDay(){const k=new Date().toISOString().slice(0,10);if(memory.dayKey!==k){memory.dayKey=k;memory.apolloPagesToday=0;memory.clayRowsToday=0}}
function status(){resetDay();return {ok:true,version:VERSION,config:{...cfg},runtime:{running:memory.running,lastApolloAt:memory.lastApolloAt,lastClayAt:memory.lastClayAt,lastResult:memory.lastResult,apolloPagesToday:memory.apolloPagesToday,clayRowsToday:memory.clayRowsToday,dayKey:memory.dayKey},credentials:{apollo:Boolean(ctx.secretValue('APOLLO_API_KEY','APOLLO_API_KEY')),clayWebhook:Boolean(ctx.secretValue('CLAY_WEBHOOK_URL','CLAY_WEBHOOK_URL')),clayToken:Boolean(ctx.secretValue('CLAY_WEBHOOK_TOKEN','CLAY_WEBHOOK_TOKEN'))},architecture:{apollo:'source',clay:'waterfall_orchestration',sbc:'system_of_record',lorna:'human_quality_control'}}}
function configure(input={}){ctx={...ctx,...input};cfg={...cfg,...(input.config||{})};resetDay();return status()}
async function call(url,opts={}){const r=await fetch(url,{...opts,signal:AbortSignal.timeout(Number(opts.timeoutMs||15000))});let j={};try{j=await r.json()}catch{};if(!r.ok)throw new Error(`HTTP ${r.status}: ${clean(j?.message||j?.error||r.statusText,240)}`);return j}
function apolloKey(){return ctx.secretValue('APOLLO_API_KEY','APOLLO_API_KEY')}
function clayUrl(){return ctx.secretValue('CLAY_WEBHOOK_URL','CLAY_WEBHOOK_URL')}
function clayToken(){return ctx.secretValue('CLAY_WEBHOOK_TOKEN','CLAY_WEBHOOK_TOKEN')}
function buildApolloQuery(input={}){
  const q={page:Math.max(1,Number(input.page||1)),per_page:Math.max(1,Math.min(100,Number(input.per_page||cfg.batchSize))),organization_locations:input.locations||input.organization_locations||['Miami, Florida, US']};
  if(input.keywords)q.q_organization_keyword_tags=Array.isArray(input.keywords)?input.keywords:[String(input.keywords)];
  if(input.industries)q.q_organization_keyword_tags=Array.isArray(input.industries)?input.industries:[String(input.industries)];
  if(input.employeeRanges)q.organization_num_employees_ranges=input.employeeRanges;
  if(input.revenueMin!=null)q['revenue_range[min]']=Number(input.revenueMin);
  if(input.revenueMax!=null)q['revenue_range[max]']=Number(input.revenueMax);
  if(input.excludeDomains)q.not_organization_websites_list=input.excludeDomains.map(domainOf).filter(Boolean);
  return q;
}
async function apolloSearch(input={}){
  resetDay();if(!apolloKey())throw new Error('Apollo API credential is not configured in the Provider Credential Vault.');
  if(memory.apolloPagesToday>=cfg.maxDailyApolloPages)throw new Error('Apollo daily page guard reached. Increase the owner-controlled limit only after reviewing acquisition economics.');
  const query=buildApolloQuery(input);
  const qs=new URLSearchParams();
  for(const [k,v] of Object.entries(query)){
    if(Array.isArray(v))for(const x of v)qs.append(k+'[]',String(x)); else qs.set(k,String(v));
  }
  const data=await call(`${APOLLO}/mixed_companies/search?${qs.toString()}`,{method:'POST',headers:{accept:'application/json','Content-Type':'application/json','Cache-Control':'no-cache','x-api-key':apolloKey()},body:JSON.stringify(query)});
  memory.apolloPagesToday+=1;memory.lastApolloAt=now();
  const orgs=Array.isArray(data.organizations)?data.organizations:[];
  return {ok:true,source:'apollo',page:query.page,perPage:query.per_page,organizations:orgs,creditsGuard:'Apollo organization search is 1 credit per page; scale only after a small-batch test.'};
}
function canonicalLead(org){
  const website=org.website_url||org.primary_domain||org.domain||'';
  const location=org.city||org.state||org.country||'';
  return {businessName:clean(org.name||org.organization_name,180),website:clean(website,500),phone:clean(org.phone,80),email:'',contactName:'',city:clean(org.city,120),region:clean(org.state,80),industry:clean(org.industry||org.primary_industry,120),address:clean(org.street_address||org.address,240),apolloOrganizationId:clean(org.id||org.organization_id,120),source:'Apollo Autonomous Lead Factory',leadSource:'Apollo',status:'Lead',leadTemperature:'Cold',leadAssist:{status:'QUEUED',source:'apollo_factory',queuedAt:now()}};
}
function existingMatch(lead){
 const rows=Array.isArray(ctx.db?.customers)?ctx.db.customers:[];const d=domainOf(lead.website);const email=normEmail(lead.email);const phone=String(lead.phone||'').replace(/\D/g,'');
 return rows.find(c=>{const cd=domainOf(c.website);const ce=normEmail(c.email);const cp=String(c.phone||'').replace(/\D/g,'');return (d&&cd&&d===cd)||(email&&ce&&email===ce)||(phone&&phone.length>=7&&cp&&phone===cp)||(String(c.businessName||'').trim().toLowerCase()===String(lead.businessName||'').trim().toLowerCase()&&String(c.city||'').trim().toLowerCase()===String(lead.city||'').trim().toLowerCase())});
}
async function ingestOrganizations(orgs,{dispatchClay=true}={}){
 const added=[],duplicates=[];for(const org of orgs.slice(0,cfg.batchSize)){const lead=canonicalLead(org);if(!lead.businessName)continue;const hit=existingMatch(lead);if(hit){duplicates.push({businessName:lead.businessName,existingId:hit.id});continue;}lead.id=crypto.randomUUID();lead.createdAt=now();lead.updatedAt=now();lead.automation={factory:'apollo',state:'ACQUIRED',acquiredAt:now()};ctx.db.customers=Array.isArray(ctx.db.customers)?ctx.db.customers:[];ctx.db.customers.push(lead);added.push(lead);}
 if(added.length)await ctx.saveData();
 let clay={sent:0,failed:0};
 if(dispatchClay&&cfg.autoClay){for(const lead of added.filter(x=>Number(x.leadScore||0)>=cfg.minScoreForClay||!x.leadScore).slice(0,cfg.batchSize)){try{await dispatchToClay(lead);clay.sent++}catch(e){clay.failed++;lead.automation={...(lead.automation||{}),clay:'FAILED',clayError:clean(e.message,300)}}}if(clay.sent||clay.failed)await ctx.saveData();}
 return {added,duplicates,clay};
}
async function dispatchToClay(lead){const url=clayUrl();if(!url)throw new Error('Clay webhook URL is not configured in the Provider Credential Vault.');resetDay();if(memory.clayRowsToday>=cfg.maxDailyClayRows)throw new Error('Clay daily row guard reached.');const token=clayToken();const headers={'Content-Type':'application/json','User-Agent':'SBC-Autonomous-Lead-Factory/56.25.0'};if(token)headers.Authorization=`Bearer ${token}`;const payload={source:'sbc_autonomous_lead_factory',factoryVersion:VERSION,leadId:lead.id,businessName:lead.businessName,website:lead.website,phone:lead.phone,email:lead.email,contactName:lead.contactName,city:lead.city,region:lead.region,industry:lead.industry,address:lead.address,apolloOrganizationId:lead.apolloOrganizationId,requestedFields:['decision_maker','verified_email','verified_phone','website','business_description','industry','location','confidence','evidence']};const out=await call(url,{method:'POST',headers,body:JSON.stringify(payload)});memory.clayRowsToday+=1;memory.lastClayAt=now();lead.automation={...(lead.automation||{}),clay:'SENT',claySentAt:now()};return out}
function normalizeClayPayload(body){const p=body?.data||body?.record||body?.lead||body||{};return {leadId:clean(p.leadId||p.sbcLeadId||p.id,120),businessName:clean(p.businessName||p.company||p.company_name||p.name,180),contactName:clean(p.contactName||p.decision_maker||p.person_name,180),email:normEmail(p.email||p.verified_email),phone:clean(p.phone||p.verified_phone,80),website:clean(p.website||p.website_url,500),city:clean(p.city,120),region:clean(p.region||p.state,80),industry:clean(p.industry,120),address:clean(p.address,240),confidence:clean(p.confidence||p.match_confidence,60),evidence:Array.isArray(p.evidence)?p.evidence:[],sourceUrls:Array.isArray(p.sourceUrls)?p.sourceUrls:[]}}
async function acceptClay(body){const p=normalizeClayPayload(body);let c=(ctx.db.customers||[]).find(x=>String(x.id)===String(p.leadId));if(!c&&p.businessName)c=existingMatch(p);if(!c&&p.businessName){p.id=crypto.randomUUID();p.status='Lead';p.leadSource='Clay';p.source='Clay Autonomous Lead Factory';p.createdAt=now();p.updatedAt=now();ctx.db.customers.push(p);c=p}else if(!c)throw new Error('Clay payload did not identify an existing SBC lead.');
 for(const k of ['businessName','contactName','email','phone','website','city','region','industry','address'])if(p[k]&&(!c[k]||k==='email'||k==='phone'))c[k]=p[k];c.leadResearch={...(c.leadResearch||{}),status:'CLAY_ENRICHED',checkedAt:now(),confidence:p.confidence,evidence:p.evidence,sourceUrls:p.sourceUrls};c.automation={...(c.automation||{}),clay:'ENRICHED',clayEnrichedAt:now()};c.updatedAt=now();await ctx.saveData();return {ok:true,customerId:c.id,businessName:c.businessName,status:'ENRICHED',next:'SBC Lead Assist / Revenue Verification'};
}
async function run(input={}){if(memory.running)return {ok:true,skipped:true,reason:'factory_in_progress'};memory.running=true;try{const search=await apolloSearch(input);const ing=await ingestOrganizations(search.organizations,{dispatchClay:input.dispatchClay!==false});memory.lastResult={at:now(),apollo:search.organizations.length,added:ing.added.length,duplicates:ing.duplicates.length,clay:ing.clay};return {ok:true,...memory.lastResult};}finally{memory.running=false}}
module.exports={VERSION,DEFAULTS,configure,status,apolloSearch,ingestOrganizations,dispatchToClay,acceptClay,run,canonicalLead};
