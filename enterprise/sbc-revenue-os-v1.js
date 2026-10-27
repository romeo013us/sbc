'use strict';
const crypto = require('crypto');
const VERSION = '56.13.1';
const FINANCIAL_BREAKPOINT = 10000;
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyRing = new Map();
const breakers = new Map();

function s(v,n=500){return String(v??'').trim().slice(0,n)}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function now(){return new Date().toISOString()}
function normalizePhone(v){return String(v??'').replace(/\D/g,'')}
function hashPayload(raw){return crypto.createHash('sha256').update(Buffer.isBuffer(raw)?raw:Buffer.from(String(raw??''))).digest('hex')}
function pruneIdempotency(){const cutoff=Date.now()-IDEMPOTENCY_TTL_MS;for(const [k,t] of idempotencyRing){if(t<cutoff)idempotencyRing.delete(k)}}
function admitIdempotency(raw,key){pruneIdempotency();const h=s(key)||hashPayload(raw);if(idempotencyRing.has(h))return {ok:false,duplicate:true,key:h};idempotencyRing.set(h,Date.now());return {ok:true,duplicate:false,key:h}}

function circuit(name,{failureThreshold=3,resetMs=30000}={}){
  const key=s(name,100);let st=breakers.get(key);if(!st){st={failures:0,openedAt:0};breakers.set(key,st)}
  const open=st.openedAt && Date.now()-st.openedAt<resetMs;
  return {name:key,state:open?'OPEN':'CLOSED',failures:st.failures,allow:!open,failureThreshold,resetMs};
}
function recordDependency(name,ok,{failureThreshold=3,resetMs=30000}={}){const key=s(name,100);let st=breakers.get(key)||{failures:0,openedAt:0};if(ok){st.failures=0;st.openedAt=0}else{st.failures++;if(st.failures>=failureThreshold)st.openedAt=Date.now()}breakers.set(key,st);return circuit(key,{failureThreshold,resetMs})}

function financialGate({amount,action='financial action',ownerApproved=false}){
  const value=Math.max(0,num(amount));
  if(value<FINANCIAL_BREAKPOINT)return {allowed:true,status:'CLEAR',amount:value,requiresOwner:false,reason:'Below protected financial breakpoint.'};
  return {allowed:Boolean(ownerApproved),status:ownerApproved?'OWNER_CLEARED':'HARD_HOLD',amount:value,requiresOwner:true,reason:ownerApproved?'Owner clearance supplied.':'Amount meets or exceeds $10,000; owner clearance is mandatory.',action:s(action,160)};
}

function contactEligibility({phone,zip,consent=false,suppressed=false,localHour=null}){
  const p=normalizePhone(phone);const reasons=[];
  if(p.length<10)reasons.push('INVALID_PHONE');
  if(suppressed)reasons.push('INTERNAL_SUPPRESSION');
  if(localHour!==null && (!Number.isFinite(Number(localHour)) || Number(localHour)<8 || Number(localHour)>=21) && !consent)reasons.push('OUTSIDE_BASELINE_CALL_WINDOW');
  return {eligible:reasons.length===0,phone:p,consent:Boolean(consent),suppressed:Boolean(suppressed),liveDncCheck:'NOT_CONFIGURED',reasons};
}

function customerRevenue(c,orders,quotes){
  const id=String(c.id);const os=orders.filter(x=>String(x.customerId||x.customer_id)===id);const qs=quotes.filter(x=>String(x.customerId||x.customer_id)===id);const wonOrders=os.filter(x=>['paid','completed','fulfilled','won'].includes(String(x.status).toLowerCase()));const wonQuotes=qs.filter(x=>['paid','won','accepted'].includes(String(x.status).toLowerCase()));return wonOrders.reduce((a,x)=>a+num(x.price||x.total),0)+wonQuotes.reduce((a,x)=>a+num(x.total),0);
}
function learning(db){
  const customers=Array.isArray(db?.customers)?db.customers:[],orders=Array.isArray(db?.orders)?db.orders:[],quotes=Array.isArray(db?.quotes)?db.quotes:[],calls=Array.isArray(db?.callReports)?db.callReports:[],activities=Array.isArray(db?.activities)?db.activities:[];
  const won=customers.filter(c=>['customer','won'].includes(String(c.status).toLowerCase())).length;
  const lost=customers.filter(c=>String(c.status).toLowerCase()==='lost').length;
  const revenue=customers.reduce((a,c)=>a+customerRevenue(c,orders,quotes),0);
  const hooks={};for(const x of calls){const h=s(x.hookVariant||x.hook||x.openingVariant||x.scriptVariant,80);if(!h)continue;const k=(hooks[h] ||= {variant:h,attempts:0,connected:0,won:0,revenue:0});k.attempts++;if(x.connected||/connected|conversation|answered/i.test(String(x.outcome||x.status||'')))k.connected++;if(x.won||/won|paid|sale|closed/i.test(String(x.outcome||x.status||''))){k.won++;k.revenue+=num(x.revenue||x.amount||x.dealValue)}}
  const hookRanking=Object.values(hooks).map(x=>({...x,connectRate:x.attempts?Math.round(x.connected/x.attempts*100):0,winRate:x.attempts?Math.round(x.won/x.attempts*100):0})).sort((a,b)=>b.revenue-a.revenue||b.winRate-a.winRate);
  const lossReasons={price:0,timing:0,trust:0,fit:0,followup:0,unknown:0};for(const c of customers){if(String(c.status).toLowerCase()!=='lost')continue;const t=String(c.notes||'')+' '+String(c.lossReason||c.leadIntelligence?.lossReason||'');if(/price|expensive|budget|cost/i.test(t))lossReasons.price++;else if(/timing|later|not ready/i.test(t))lossReasons.timing++;else if(/trust|competitor|agency/i.test(t))lossReasons.trust++;else if(/fit|need/i.test(t))lossReasons.fit++;else if(/follow|response|ghost/i.test(t))lossReasons.followup++;else lossReasons.unknown++}
  const dominant=Object.entries(lossReasons).sort((a,b)=>b[1]-a[1])[0];
  return {generatedAt:now(),sample:{customers:customers.length,won,lost,revenue,activities:activities.length,calls:calls.length},hookRanking,lossReasons,dominantLossReason:dominant?.[0]||'unknown',confidence:Math.min(1,(customers.length+calls.length)/100)};
}
function nextBestActions(db){
  const customers=Array.isArray(db?.customers)?db.customers:[],orders=Array.isArray(db?.orders)?db.orders:[],quotes=Array.isArray(db?.quotes)?db.quotes:[];const actions=[];
  for(const c of customers){const status=String(c.status||'Lead').toLowerCase();if(status==='lost')continue;const text=`${c.website||''} ${c.notes||''}`;const gaps=[];if(!c.website)gaps.push('website');if(!c.email)gaps.push('business email');if(!c.phone)gaps.push('phone');if(/booking|calendar|form|shop/i.test(text)===false && c.website)gaps.push('lead capture');const overdue=c.followUp&&new Date(c.followUp).getTime()<Date.now();const revenue=customerRevenue(c,orders,quotes);let priority=20;if(status==='customer')priority+=25;if(overdue)priority+=25;if(gaps.length)priority+=Math.min(20,gaps.length*7);if(revenue>0)priority+=10;actions.push({customerId:c.id,businessName:c.businessName||c.contactName||'Unnamed',priority:Math.min(100,priority),action:status==='customer'?(gaps.length?'Review expansion/health gap':'Review retention and next offer'):(overdue?'Work overdue follow-up':gaps.length?'Research one proof point, then contact':'Verify and route to Revenue PLAY'),reasons:gaps.length?gaps:['no obvious data gap'],revenue});}
  return actions.sort((a,b)=>b.priority-a.priority).slice(0,20);
}
function overview(db){const l=learning(db);const a=nextBestActions(db);return {version:VERSION,generatedAt:now(),mission:'SBC Revenue Operating System',northStar:'Find what matters, explain why, recommend what happens next, and learn from the outcome.',metrics:{...l.sample,nextBestActions:a.length,financialBreakpoint:FINANCIAL_BREAKPOINT},focus:a[0]||null,learning:l,actions:a,guardrails:{ownerControls:true,liveDncConfigured:false,fakeVendorApi:false,newSecretsRequired:0}}}
function queueEnrichment(db,id){const c=(db?.customers||[]).find(x=>String(x.id)===String(id));if(!c)return {ok:false,error:'Customer not found.'};c.leadIntelligence=c.leadIntelligence||{};c.leadIntelligence.enrichment={status:'QUEUED',queuedAt:now(),requestedSignals:['website','business presence','contactability','social footprint'],sourcePolicy:'Use approved/authorized sources only; no credential bypass or fake API.'};c.updatedAt=now();return {ok:true,customerId:c.id,status:'QUEUED',signals:c.leadIntelligence.enrichment.requestedSignals};}
module.exports={VERSION,FINANCIAL_BREAKPOINT,hashPayload,admitIdempotency,circuit,recordDependency,financialGate,contactEligibility,learning,nextBestActions,overview,queueEnrichment};
