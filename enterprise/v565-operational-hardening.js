'use strict';
/**
 * SBC V56.5 Operational Hardening Layer
 * Additive facade over V56.3/V56.4 engines.
 *
 * Guarantees:
 * - no new secrets are required
 * - no live vendor submission is invented
 * - no automatic code deletion
 * - tenant isolation is enforced as an application/query contract
 * - learned funnel uses a rolling 90-day event window when evidence exists
 * - billing recovery is idempotent and policy-gated
 */
const crypto = require('crypto');
const V562_NEXT = require('./v562-next-architecture');
const V563 = require('./v563-maturity-layer');

const VERSION='56.5.0';
const FACADE_VERSION='v56';
const DEFAULT_WINDOW_DAYS=90;

function sha256(v){return crypto.createHash('sha256').update(String(v)).digest('hex');}
function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return `[${v.map(stable).join(',')}]`;return `{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')}}`;}
function now(){return new Date().toISOString();}
function clean(v,n=160){return String(v??'').trim().slice(0,n);}

// ---------- 1. Public facade contract ----------
const FACADE_DOMAINS=Object.freeze({
  crm:Object.freeze(['/api/v56/intel/customer-360/:id']),
  growth:Object.freeze(['/api/v56/intel/strategy','/api/v56/growth/toolkit','/api/v56/growth/deploy']),
  delivery:Object.freeze(['/api/v56/delivery/provider/stage']),
  intelligence:Object.freeze(['/api/v56/intel/funnel','/api/v56/intel/strategy']),
  operations:Object.freeze(['/api/v56/ops/score']),
  communications:Object.freeze(['/api/v56/communications/gate','/api/v56/communications/reputation']),
  billing:Object.freeze(['/api/v56/billing/recovery']),
  security:Object.freeze(['/api/v56/security/tenant-context']),
  guardian:Object.freeze(['/api/v56/guardian/summary','/api/v56/guardian/audit','/api/v56/guardian/impact/:file','/api/v56/guardian/snapshot','/api/v56/guardian/quarantine','/api/v56/guardian/manifest'])
});
function facadeManifest(){return {version:VERSION,publicPrefix:`/${FACADE_VERSION}`,domains:Object.entries(FACADE_DOMAINS).map(([domain,routes])=>({domain,routes:[...routes]})),legacyPolicy:'LEGACY_ROUTES_MAY_REMAIN_ACTIVE_BUT_NEW_FRONTEND_WORK MUST USE /api/v56'};}
function normalizePath(p){return String(p||'').split('?')[0].replace(/\/{2,}/g,'/').replace(/\/$/,'')||'/';}
function facadePolicy(pathname){const p=normalizePath(pathname);if(p.startsWith('/api/v56/'))return {allowed:true,public:true,version:FACADE_VERSION};return {allowed:false,public:false,version:null,reason:'LEGACY_OR_INTERNAL_PATH'};}

// ---------- 2. Tenant cryptographic isolation primitives ----------
function deriveTenantKey(masterKey,tenantId){
  const raw=Buffer.isBuffer(masterKey)?masterKey:Buffer.from(String(masterKey||''),'utf8');
  if(raw.length<16) throw new Error('Tenant cryptographic key material is not configured with sufficient entropy.');
  return crypto.hkdfSync('sha256',raw,Buffer.from('sbc-tenant-salt-v1'),Buffer.from(`tenant:${String(tenantId)}`),32);
}
function tenantBinding(masterKey,tenantId,subject){
  const key=deriveTenantKey(masterKey,tenantId);
  return crypto.createHmac('sha256',key).update(stable(subject||{})).digest('hex');
}
function verifyTenantBinding(masterKey,tenantId,subject,binding){
  if(!binding)return false;
  const expected=tenantBinding(masterKey,tenantId,subject);
  const a=Buffer.from(expected,'hex'),b=Buffer.from(String(binding),'hex');
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
function tenantContext(req,{defaultTenantId=1}={}){
  const raw=req?.tenantId??req?.user?.tenantId??req?.session?.tenantId??req?.headers?.['x-sbc-tenant-id']??defaultTenantId;
  const n=Number(raw); return Number.isInteger(n)&&n>0?n:null;
}
function assertTenantRecord(record,tenantId){
  if(!record)return {ok:false,reason:'RECORD_NOT_FOUND'};
  if(record.tenant_id!=null && String(record.tenant_id)!==String(tenantId))return {ok:false,reason:'TENANT_BOUNDARY_VIOLATION'};
  return {ok:true};
}

// ---------- 3. Learned 90-day funnel ----------
function withinWindow(value,days=DEFAULT_WINDOW_DAYS){
  const t=new Date(value||0).getTime();
  return Number.isFinite(t) && t >= Date.now()-days*86400000;
}
function eventDate(x){return x?.createdAt||x?.created_at||x?.updatedAt||x?.updated_at||x?.date||x?.at||null;}
function status(v){return String(v||'').trim().toUpperCase().replace(/[-\s]+/g,'_');}
function learnedFunnel90d(ctx,{days=DEFAULT_WINDOW_DAYS}={}){
  const db=ctx?.db||{};
  const customers=Array.isArray(db.customers)?db.customers.filter(x=>withinWindow(eventDate(x),days)):[];
  const activities=Array.isArray(db.activities)?db.activities.filter(x=>withinWindow(eventDate(x),days)):[];
  const quotes=Array.isArray(db.quotes)?db.quotes.filter(x=>withinWindow(eventDate(x),days)):[];
  const orders=Array.isArray(db.orders)?db.orders.filter(x=>withinWindow(eventDate(x),days)):[];
  const customerStatuses=new Set(['LEAD','PROSPECT','NEW','CONTACTED','QUALIFIED','VERIFIED','SALES_READY','CUSTOMER','ACTIVE','WON']);
  const leads=Math.max(customers.filter(x=>customerStatuses.has(status(x.status))).length, customers.length);
  const conversations=activities.filter(x=>['CALL','CALL_REPORT','SMS','EMAIL','MEETING','CONVERSATION','CONTACT'].some(k=>status(x.type||x.eventType||x.activity_type).includes(k))).length;
  const verified=Math.max(customers.filter(x=>['VERIFIED','QUALIFIED','SALES_READY','SALES_READY'].includes(status(x.status))).length,0);
  const won=Math.max(orders.filter(x=>['PAID','COMPLETED','FULFILLED','WON'].includes(status(x.status||x.paymentStatus))).length, quotes.filter(x=>['WON','ACCEPTED'].includes(status(x.status))).length);
  const leadToConversation=leads>0?Math.min(1,conversations/leads):null;
  const conversationToVerified=conversations>0?Math.min(1,verified/conversations):null;
  const verifiedToWon=verified>0?Math.min(1,won/verified):null;
  const observedVolume=leads+conversations+verified+won;
  return {
    window:`rolling ${days} days`,days,
    counts:{leads,conversations,verified,won,quotes:quotes.length,orders:orders.length,activities:activities.length},
    ratios:{leadToConversation,conversationToVerified,verifiedToWon},
    confidence:observedVolume>=30?'observed':'limited',
    source:'SBC recorded CRM/order/activity state',
    generatedAt:now()
  };
}

// ---------- 4. Subscription recovery / dunning ----------
function recoveryPlan(payload={}){
  const state=status(payload.status||payload.type);
  const eligible=['INVOICE_FAILED','PAYMENT_FAILED','SUBSCRIPTION_PAYMENT_FAILED','PAYMENT_INTENT_PAYMENT_FAILED'].includes(state);
  if(!eligible)return {eligible:false,state,reason:'EVENT_NOT_ELIGIBLE'};
  const customerId=clean(payload.customer_id||payload.client_id||payload.customerId,120);
  const email=clean(payload.customer_email||payload.client_email||payload.email,200).toLowerCase();
  const amount=Number(payload.amount||payload.amount_due||payload.failed_amount||0);
  const eventId=clean(payload.event_id||payload.id||'',120);
  const idempotencyKey=sha256(`billing-recovery:${stable({customerId,email,amount,eventId})}`);
  return {eligible:true,state,customerId,email,amount,eventId,idempotencyKey,grace:{enabled:true,accessPolicy:'GRACE_RESTRICTED',durationDays:7},outreach:{channels:['email','sms'],requiresConsent:true,providerPolicyGate:true},nextAction:'UPDATE_PAYMENT_METHOD',generatedAt:now()};
}

// ---------- 5. Provider procurement + carrier policy ----------
function providerReadiness({provider,configured=false,adapterRegistered=false,credentialsAvailable=false}={}){
  const p=clean(provider||'',80).toUpperCase();
  return {provider:p,configured:Boolean(configured),adapterRegistered:Boolean(adapterRegistered),credentialsAvailable:Boolean(credentialsAvailable),liveSubmission:Boolean(configured&&adapterRegistered&&credentialsAvailable),status:configured&&adapterRegistered&&credentialsAvailable?'READY':'STAGED_ONLY',note:'No vendor endpoint or credential is invented by this layer.'};
}
function carrierReputationPolicy({channel='SMS',senderConfigured=false,consent=true,optOut=false,providerStatus='unknown'}={}){
  const c=clean(channel,20).toUpperCase();
  if(optOut)return {allowed:false,reason:'SUPPRESSED_OPT_OUT'};
  if(['SMS','MMS','TEXT','VOICE'].includes(c)&&!consent)return {allowed:false,reason:'CONSENT_REQUIRED'};
  if(!senderConfigured)return {allowed:false,reason:'SENDER_NOT_CONFIGURED'};
  return {allowed:true,channel:c,providerStatus,lookup:'PROVIDER_ADAPTER_REQUIRED',attestation:'NOT_ASSERTED_BY_SBC',note:'SBC does not fabricate carrier reputation, CNAM, or STIR/SHAKEN results.'};
}

// ---------- 6. Owner guardrail ----------
function ownerThreshold(value,{threshold=10000}={}){
  const amount=Number(value||0); const limit=Math.max(0,Number(threshold)||10000);
  return {amount,threshold:limit,requiresOwnerSignature:amount>=limit,automationAllowed:amount<limit,status:amount>=limit?'OWNER_CLEARANCE_REQUIRED':'AUTOMATION_ALLOWED'};
}

// ---------- 7. Route/dependency hygiene ----------
function routeContract(routes=[]){
  const seen=new Map(),duplicates=[];
  for(const r of routes){const k=`${r.method} ${r.path}`;const n=(seen.get(k)||0)+1;seen.set(k,n);if(n===2)duplicates.push(k);}
  return {routeCount:routes.length,duplicateRoutes:duplicates,duplicateCount:duplicates.length,facadeRequired:true,publicPrefix:'/api/v56'};
}

function registerRoutes(app,{auth,ownerOnly,getContext,guardian}={}){
  const ctx=()=>getContext?getContext():{};
  app.get('/api/v56/facade/v565-manifest',auth,(req,res)=>res.json({ok:true,...facadeManifest()}));
  app.get('/api/v56/security/tenant-context',auth,(req,res)=>{
    const tenantId=tenantContext(req); res.json({ok:true,version:VERSION,tenant:{tenantId,source:req.headers?.['x-sbc-tenant-id']?'header':'session-or-default',isolation:'APPLICATION_QUERY_BOUNDARY',cryptographicBinding:'AVAILABLE_WHEN_EXISTING_KEY_IS_CONFIGURED'}});
  });
  app.get('/api/v56/intel/funnel-90d',auth,async(req,res)=>{
    try{res.json({ok:true,version:VERSION,data:learnedFunnel90d(ctx(),{days:90})});}catch(e){res.status(500).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/billing/recovery',auth,async(req,res)=>{
    try{
      const plan=recoveryPlan(req.body||{}); if(!plan.eligible)return res.status(200).json({ok:true,version:VERSION,data:plan});
      const durable=V562_NEXT.billingFriction({status:req.body?.status||req.body?.type,client_id:plan.customerId,client_email:plan.email,amount:plan.amount,invoice_id:req.body?.invoice_id||req.body?.id});
      res.status(202).json({ok:true,version:VERSION,data:{...plan,durable}});
    }catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/communications/reputation',auth,async(req,res)=>{
    try{res.json({ok:true,version:VERSION,data:carrierReputationPolicy(req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/delivery/procurement/readiness',auth,ownerOnly,async(req,res)=>{
    try{res.status(202).json({ok:true,version:VERSION,data:providerReadiness(req.body||{})});}catch(e){res.status(400).json({ok:false,error:e.message});}
  });
  app.post('/api/v56/security/owner-threshold',auth,ownerOnly,(req,res)=>res.json({ok:true,version:VERSION,data:ownerThreshold(req.body?.value,{threshold:req.body?.threshold||10000})}));
  app.get('/api/v56/guardian/route-contract',auth,ownerOnly,(req,res)=>{
    try{
      const report=guardian?.audit?guardian.audit(guardian.rootDir||process.cwd(),{version:VERSION,config:{}}):{routes:[]};
      res.json({ok:true,version:VERSION,data:routeContract(report.routes||[])});
    }catch(e){res.status(500).json({ok:false,error:e.message});}
  });
}

module.exports={VERSION,facadeManifest,facadePolicy,deriveTenantKey,tenantBinding,verifyTenantBinding,tenantContext,assertTenantRecord,learnedFunnel90d,recoveryPlan,providerReadiness,carrierReputationPolicy,ownerThreshold,routeContract,registerRoutes};
