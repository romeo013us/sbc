// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.9.1 Production Expansion
 * Additive security + revenue automation layer over V56.9.0.
 *
 * Safety rules:
 * - No new GoDaddy secrets are required.
 * - MySQL tenant isolation is application/query-boundary enforcement; native MySQL RLS is not claimed.
 * - Host -> tenant mapping is authoritative and fail-closed for whitelabel traffic.
 * - Self-healing is logical quarantine/circuit isolation on GoDaddy; container kill/proxy reload are only emitted as requests.
 * - Route nonce is a capability gasket, not a substitute for authentication/TLS.
 * - Vendor execution remains adapter-gated and provider-contract-gated.
 * - $10,000+ financial/fulfillment actions are hard-held until owner approval.
 */
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const VERSION='56.9.2';
const OWNER_THRESHOLD=10000;
const HOST_MAP_FILE=path.join(__dirname,'..','config','tenant-host-map.json');
const TEMPLATE_DIR=path.join(__dirname,'..','templates','tenant-storefront');
const runtime=new Map();
const thresholdLocks=new Map();
const publicCapabilities=new Map();
const errorWindows=new Map();
const now=()=>new Date().toISOString();
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');

function hostOnly(value){
  const raw=String(value||'').split(',')[0].trim().toLowerCase().replace(/:\d+$/,'');
  if(!raw||raw.length>253||/[\s/]/.test(raw))return '';
  return raw;
}
function loadHostMap(){
  try{return JSON.parse(fs.readFileSync(HOST_MAP_FILE,'utf8'))||{};}catch{return {};}
}
function tenantFromHost(host,{defaultTenantId=1,allowDefault=true}={}){
  const h=hostOnly(host); if(!h)throw new Error('INVALID_HOST');
  const map=loadHostMap();
  const record=map[h]||null;
  if(record){
    const tenantId=Number(record.tenantId); if(!Number.isSafeInteger(tenantId)||tenantId<1)throw new Error('INVALID_TENANT_MAPPING');
    return {ok:true,host:h,tenantId,source:'authoritative-host-map',plan:clean(record.plan||'starter',40),brand:record.brand||{},customerId:clean(record.customerId||'',120)};
  }
  if(allowDefault && (h==='sbcmia.com'||h==='www.sbcmia.com'))return {ok:true,host:h,tenantId:Number(defaultTenantId),source:'platform-host',plan:'owner',brand:{businessName:'Successful By Choice'}};
  return {ok:false,host:h,reason:'HOST_NOT_MAPPED'};
}
function bindRequestTenant(req,{defaultTenantId=1,strictWhitelabel=true}={}){
  const host=hostOnly(req?.headers?.host||req?.hostname||'');
  const mapped=tenantFromHost(host,{defaultTenantId,allowDefault:!strictWhitelabel});
  if(!mapped.ok)throw new Error(mapped.reason);
  if(req?.user?.tenantId!=null && Number(req.user.tenantId)!==Number(mapped.tenantId) && req.user.role!=='owner')throw new Error('TENANT_HOST_SESSION_MISMATCH');
  req.tenantId=Number(mapped.tenantId); req.tenantHost=host; req.tenantResolution=mapped;
  return mapped;
}
function tenantPredicate(sql,params,tenantId){
  const text=String(sql||'').trim().replace(/;\s*$/,'');
  if(!text)throw new Error('EMPTY_SQL');
  if(/^\s*(drop|truncate|grant|revoke|alter|rename)\b/i.test(text))throw new Error('DESTRUCTIVE_SQL_BLOCKED');
  const tables=[...text.matchAll(/\b(?:from|join|update|into|delete\s+from)\s+([a-zA-Z0-9_]+)/ig)].map(m=>m[1].toLowerCase());
  const tenantTables=tables.filter(t=>t.startsWith('sbc_'));
  if(!tenantTables.length)return {sql:text,params:Array.isArray(params)?params:[],injected:false,tenantId};
  if(/\btenant_id\s*=\s*(\?|\d+|:\w+|\$\d+)/i.test(text))return {sql:text,params:Array.isArray(params)?params:[],injected:false,tenantId};
  if(/^(select|update|delete)\b/i.test(text)){
    const injected=/\bwhere\b/i.test(text)?`${text} AND tenant_id = ?`:`${text} WHERE tenant_id = ?`;
    return {sql:injected,params:[...(Array.isArray(params)?params:[]),Number(tenantId)],injected:true,tenantId};
  }
  throw new Error('TENANT_SCOPED_SQL_REQUIRES_TENANT_PREDICATE');
}
async function tenantQuery(pool,sql,params,tenantId){if(!pool)throw new Error('MYSQL_UNAVAILABLE');const checked=tenantPredicate(sql,params,tenantId);return pool.query(checked.sql,checked.params);}

function capabilityNonce(pathname,{ttlMs=60*60*1000}={}){
  const route=clean(pathname,180); const created=Date.now(); const expires=created+Math.max(60000,Number(ttlMs)||3600000); const nonce=crypto.randomBytes(18).toString('base64url'); const payload=Buffer.from(JSON.stringify({v:1,route,iat:created,exp:expires,nonce})).toString('base64url'); const secret=String(process.env.SBC_SESSION_SECRET||'sbc-capability-fallback'); const sig=crypto.createHmac('sha256',secret).update(payload).digest('base64url'); return {capability:`${payload}.${sig}`,route,expiresAt:new Date(expires).toISOString(),ttlMs:expires-created};
}
function verifyCapability(cap,pathname){try{const [payload,sig]=String(cap||'').split('.');if(!payload||!sig)return false;const secret=String(process.env.SBC_SESSION_SECRET||'sbc-capability-fallback');const expected=crypto.createHmac('sha256',secret).update(payload).digest();const supplied=Buffer.from(sig,'base64url');if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return false;const body=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));return body.v===1&&body.route===String(pathname||'')&&Number(body.exp)>Date.now();}catch{return false;} }
function capabilitySweep(){for(const [k,v] of publicCapabilities){if(v.expiresAt<Date.now())publicCapabilities.delete(k)}}

function recordTenantFailure(tenantId,kind,message,{threshold=3,windowMs=5*60*1000}={}){
  const id=String(tenantId); const at=Date.now(); const arr=(errorWindows.get(id)||[]).filter(x=>at-x.at<windowMs); arr.push({at,kind:clean(kind,80),message:clean(message,300)}); errorWindows.set(id,arr); const consecutive=arr.slice(-threshold).length>=threshold; if(consecutive)quarantineTenant(id,`THREE_CONSECUTIVE_FAILURES:${kind}`); return {tenantId:Number(tenantId),count:arr.length,consecutive,quarantined:Boolean(runtime.get(id)?.quarantined)};
}
function quarantineTenant(tenantId,reason){const id=String(tenantId);const current=runtime.get(id)||{};const next={...current,tenantId:Number(tenantId),quarantined:true,reason:clean(reason,240),quarantinedAt:now(),workerAction:'ISOLATE_LOGICAL_WORKER',proxyAction:'RELOAD_REQUEST_ONLY',alert:'CINEMATIC_OWNER_ALERT'};runtime.set(id,next);global.__SBC_RECENT_RUNTIME_EVENTS=Array.isArray(global.__SBC_RECENT_RUNTIME_EVENTS)?global.__SBC_RECENT_RUNTIME_EVENTS:[];global.__SBC_RECENT_RUNTIME_EVENTS.push({id:crypto.randomUUID(),event:'tenant_quarantined',tenantId:Number(tenantId),reason:next.reason,at:next.quarantinedAt});global.__SBC_RECENT_RUNTIME_EVENTS=global.__SBC_RECENT_RUNTIME_EVENTS.slice(-500);return next;}
function releaseTenant(tenantId){const id=String(tenantId);runtime.set(id,{tenantId:Number(tenantId),quarantined:false,releasedAt:now()});return runtime.get(id);}
function tenantHealth(tenantId){return runtime.get(String(tenantId))||{tenantId:Number(tenantId),quarantined:false};}

function financialLock({action,amount,tenantId,resourceId,metadata={}}={}){
  const value=Number(amount||0); const locked=value>=OWNER_THRESHOLD; const id=crypto.randomUUID(); const rec={id,action:clean(action,120),amount:value,tenantId:Number(__sbcRequireTenantId(tenantId)),resourceId:clean(resourceId,160),status:locked?'OWNER_LOCKED':'AUTONOMOUS_ALLOWED',ownerRequired:locked,automationAllowed:!locked,createdAt:now(),metadata}; thresholdLocks.set(id,rec); return rec;
}
function authorizeFinancialExecution(lockId,ownerId){const rec=thresholdLocks.get(String(lockId));if(!rec)throw new Error('FINANCIAL_LOCK_NOT_FOUND');if(rec.amount<OWNER_THRESHOLD)return {...rec,status:'AUTHORIZED',automationAllowed:true};if(!ownerId)throw new Error('OWNER_APPROVAL_REQUIRED');rec.status='OWNER_AUTHORIZED';rec.ownerAuthorizedBy=String(ownerId);rec.ownerAuthorizedAt=now();rec.automationAllowed=true;return {...rec};}
function assertFinancialExecution({amount,ownerClearanceAt,ownerId,action='financial_action',tenantId,resourceId}={}){const value=Number(amount||0);if(value<OWNER_THRESHOLD)return {ok:true,locked:false,amount:value,threshold:OWNER_THRESHOLD};if(!ownerClearanceAt||!ownerId)throw new Error(`OWNER_HARD_BREAKPOINT:${action}`);return {ok:true,locked:true,authorized:true,amount:value,threshold:OWNER_THRESHOLD,ownerId:String(ownerId),ownerClearanceAt};}
function financialStatus(){return {threshold:OWNER_THRESHOLD,openLocks:[...thresholdLocks.values()].filter(x=>x.status==='OWNER_LOCKED').map(x=>({...x})).slice(-100),activeLocks:thresholdLocks.size};}

async function persistFinancialLock(pool,lock){
  if(!pool) { if(lock.ownerRequired) throw new Error('FINANCIAL_VAULT_STORAGE_UNAVAILABLE'); return lock; }
  await pool.query(`INSERT INTO sbc_financial_vault_locks(lock_id,tenant_id,action,amount,resource_id,status,owner_required,automation_allowed,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE updated_at=UTC_TIMESTAMP()`,[
    lock.id,Number(__sbcRequireTenantId(lock.tenantId)),lock.action,Number(lock.amount||0),lock.resourceId||'',lock.status,lock.ownerRequired?1:0,lock.automationAllowed?1:0,JSON.stringify(lock.metadata||{}),new Date(lock.createdAt)
  ]);
  return lock;
}

async function authorizePersistentFinancialExecution(pool,lockId,ownerId,{tenantId}={}){
  if(!pool) throw new Error('FINANCIAL_VAULT_STORAGE_UNAVAILABLE');
  const id=String(lockId||'').trim();
  const actor=String(ownerId||'').trim();
  if(!id) throw new Error('FINANCIAL_LOCK_ID_REQUIRED');
  if(!actor) throw new Error('OWNER_APPROVAL_REQUIRED');
  const tenant=Number(tenantId||0);
  if(!Number.isSafeInteger(tenant)||tenant<1) throw new Error('FINANCIAL_VAULT_TENANT_REQUIRED');
  const [rows]=await pool.query('SELECT * FROM sbc_financial_vault_locks WHERE lock_id=? AND tenant_id=? LIMIT 1',[id,tenant]);
  const row=rows[0]; if(!row) throw new Error('FINANCIAL_LOCK_NOT_FOUND');
  if(Number(row.amount)<OWNER_THRESHOLD) return {...row,status:'AUTHORIZED',automation_allowed:1,approvalOutcome:'NOT_REQUIRED'};
  if(String(row.status)==='OWNER_AUTHORIZED') return {...row,approvalOutcome:'ALREADY_AUTHORIZED'};
  if(String(row.status)!=='OWNER_LOCKED') throw new Error(`FINANCIAL_LOCK_NOT_APPROVABLE:${row.status}`);
  const [result]=await pool.query(`UPDATE sbc_financial_vault_locks SET status='OWNER_AUTHORIZED',owner_authorized_by=?,owner_authorized_at=UTC_TIMESTAMP(),automation_allowed=1,updated_at=UTC_TIMESTAMP() WHERE lock_id=? AND tenant_id=? AND status='OWNER_LOCKED'`,[actor,id,tenant]);
  const [updated]=await pool.query('SELECT * FROM sbc_financial_vault_locks WHERE lock_id=? AND tenant_id=? LIMIT 1',[id,tenant]);
  const out=updated[0];
  const mem=thresholdLocks.get(id);
  if(mem&&out){mem.status='OWNER_AUTHORIZED';mem.ownerAuthorizedBy=String(out.owner_authorized_by||actor);mem.ownerAuthorizedAt=out.owner_authorized_at?new Date(out.owner_authorized_at).toISOString():now();mem.automationAllowed=true;}
  return {...(out||mem||{lockId:id,status:'OWNER_AUTHORIZED',ownerAuthorizedBy:actor}),approvalOutcome:Number(result?.affectedRows||0)===1?'AUTHORIZED':'ALREADY_AUTHORIZED'};
}

async function getPersistentFinancialLock(pool,lockId,tenantId){
  if(!pool) throw new Error('FINANCIAL_VAULT_STORAGE_UNAVAILABLE');
  const tenant=Number(tenantId||0); if(!Number.isSafeInteger(tenant)||tenant<1) throw new Error('FINANCIAL_VAULT_TENANT_REQUIRED');
  const [rows]=await pool.query('SELECT * FROM sbc_financial_vault_locks WHERE lock_id=? AND tenant_id=? LIMIT 1',[String(lockId||''),tenant]);
  return rows[0]||null;
}

async function financialStatusPersistent(pool,tenantId){
  if(!pool) throw new Error('FINANCIAL_VAULT_STORAGE_UNAVAILABLE');
  const tenant=Number(tenantId||0); if(!Number.isSafeInteger(tenant)||tenant<1) throw new Error('FINANCIAL_VAULT_TENANT_REQUIRED');
  const [rows]=await pool.query(`SELECT lock_id,tenant_id,action,amount,resource_id,status,owner_required,automation_allowed,owner_authorized_by,owner_authorized_at,created_at,updated_at FROM sbc_financial_vault_locks WHERE tenant_id=? AND status='OWNER_LOCKED' ORDER BY created_at DESC LIMIT 100`,[tenant]);
  const [counts]=await pool.query(`SELECT status,COUNT(*) AS count FROM sbc_financial_vault_locks WHERE tenant_id=? GROUP BY status`,[tenant]);
  return {threshold:OWNER_THRESHOLD,openLocks:rows,counts};
}

async function financialExecutionGate({pool,amount,tenantId,resourceId,lockId,action='financial_action'}={}){
  const value=Number(amount||0);
  if(value<OWNER_THRESHOLD) return {ok:true,locked:false,authorized:true,amount:value,threshold:OWNER_THRESHOLD};
  if(!pool) throw new Error('OWNER_HARD_BREAKPOINT_STORAGE_UNAVAILABLE');
  let row=null;
  if(lockId){ const [rows]=await pool.query('SELECT * FROM sbc_financial_vault_locks WHERE lock_id=? AND tenant_id=? LIMIT 1',[String(lockId),Number(__sbcRequireTenantId(tenantId))]); row=rows[0]||null; }
  if(!row && resourceId){ const [rows]=await pool.query(`SELECT * FROM sbc_financial_vault_locks WHERE tenant_id=? AND resource_id=? AND amount>=? ORDER BY created_at DESC LIMIT 1`,[Number(__sbcRequireTenantId(tenantId)),String(resourceId),OWNER_THRESHOLD]); row=rows[0]||null; }
  if(!row || row.status!=='OWNER_AUTHORIZED' || !row.owner_authorized_by || !row.owner_authorized_at){
    throw new Error(`OWNER_HARD_BREAKPOINT:${action}`);
  }
  return {ok:true,locked:true,authorized:true,amount:value,threshold:OWNER_THRESHOLD,lockId:row.lock_id,ownerId:String(row.owner_authorized_by),ownerClearanceAt:row.owner_authorized_at};
}

function normalizeE164(value,defaultCountry='+1'){const raw=String(value||'').trim();if(!raw)return '';const plus=raw.startsWith('+');const digits=raw.replace(/\D/g,'');if(plus&&digits.length>=8&&digits.length<=15)return `+${digits}`;if(defaultCountry==='+1'&&digits.length===10)return `+1${digits}`;if(defaultCountry==='+1'&&digits.length===11&&digits.startsWith('1'))return `+${digits}`;return '';}
function normalizeLeadRow(row={}){const company=clean(row.company_name||row.businessName||row.business_name,255);const phoneE164=normalizeE164(row.phone||row.phone_digits||row.phone_number);const email=clean(row.email_address||row.email||'',320).toLowerCase();const key=sha(`${company.toLowerCase()}|${phoneE164}|${email}`);return {...row,company_name:company,phone_e164:phoneE164,email_address:email||null,dedupe_key:key};}
function normalizeLeadBatch(rows=[]){const seen=new Set(),out=[];let duplicates=0,invalid=0;for(const raw of rows){const r=normalizeLeadRow(raw);if(!r.company_name||(!r.phone_e164&&!r.email_address)){invalid++;continue;}if(seen.has(r.dedupe_key)){duplicates++;continue;}seen.add(r.dedupe_key);out.push(r);}return {rows:out,counts:{received:rows.length,accepted:out.length,duplicates,invalid}};}

function storefrontProfile({tenantId,customer={},order={},brand={}}={}){const parsed=order?.parsed||{};const colors=Array.isArray(brand.colors)?brand.colors.slice(0,6):[];return {schema:'sbc.tenant-storefront.v1',tenantId:Number(__sbcRequireTenantId(tenantId)),businessName:clean(brand.businessName||customer.businessName||order.customerName||'SBC Business',120),tagline:clean(brand.tagline||'Built to help your business move.',180),primaryColor:/^#[0-9a-f]{6}$/i.test(String(brand.primaryColor||''))?brand.primaryColor:'#0B63CE',accentColor:/^#[0-9a-f]{6}$/i.test(String(brand.accentColor||''))?brand.accentColor:'#F97316',phone:clean(brand.phone||customer.phone||'',40),email:clean(brand.email||customer.email||'',200),fulfillmentLink:clean(brand.fulfillmentLink||parsed.fulfillmentLink||'',500),template:clean(brand.template||'print-reseller',80),orderId:clean(order.id||'',120),updatedAt:now(),colors};}
function renderStorefront(profile,templateName){const name=String(templateName||profile.template||'print-reseller').replace(/[^a-z0-9-]/gi,'').toLowerCase()||'print-reseller';const file=path.join(TEMPLATE_DIR,`${name}.html`);if(!fs.existsSync(file))throw new Error('STOREFRONT_TEMPLATE_NOT_FOUND');let html=fs.readFileSync(file,'utf8');const values={businessName:profile.businessName,tagline:profile.tagline,primaryColor:profile.primaryColor,accentColor:profile.accentColor,phone:profile.phone,email:profile.email,fulfillmentLink:profile.fulfillmentLink||'#'};for(const [k,v] of Object.entries(values))html=html.replaceAll(`{{${k}}}`,String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));return html;}
function provisionStorefront({tenantId,customer,order,brand,template}={}){const profile=storefrontProfile({tenantId,customer,order,brand});const html=renderStorefront(profile,template);const root=path.join(__dirname,'..','data','tenant-storefronts',String(profile.tenantId));fs.mkdirSync(root,{recursive:true});const file=path.join(root,`${String(profile.template).replace(/[^a-z0-9-]/gi,'')||'print-reseller'}.html`);fs.writeFileSync(file,html,'utf8');const configFile=path.join(root,'tenant-config.json');fs.writeFileSync(configFile,JSON.stringify(profile,null,2),'utf8');return {ok:true,profile,file,configFile,mode:'local-immutable-artifact'};}

function revenueCapacitySnapshot({tenantId,plan='starter',db={}}={}){const rows=Array.isArray(db.orders)?db.orders.filter(x=>Number(__sbcRequireTenantId(x.tenantId))===Number(tenantId)):[];const bytes=JSON.stringify(rows).length;const limits={starter:{bytes:5*1024*1024,webhooksPerHour:300},business:{bytes:25*1024*1024,webhooksPerHour:1500},pro:{bytes:100*1024*1024,webhooksPerHour:5000},enterprise:{bytes:500*1024*1024,webhooksPerHour:20000}};const l=limits[String(plan)]||limits.starter;const velocity=rows.filter(x=>Date.now()-new Date(x.updatedAt||x.createdAt||0).getTime()<3600000).length;const flags=[];if(bytes>l.bytes)flags.push('DATA_CAPACITY');if(velocity>l.webhooksPerHour)flags.push('TRANSACTION_VELOCITY');return {tenantId:Number(tenantId),plan,usage:{approxBytes:bytes,transactionsLastHour:velocity},limits:l,flags,upgradeOpportunity:flags.length>0,status:flags.length?'UPGRADE_RECOMMENDED':'WITHIN_TIER'};}

function vendorPayload({job,provider='4over4'}={}){const allowed=['4over4','fourOverFour','vistaprint','vistaPrint'];if(!allowed.includes(provider))throw new Error('UNSUPPORTED_VENDOR');return {schema:'sbc.vendor-order.v1',provider,jobId:clean(job?.id,120),orderId:clean(job?.orderId,120),tenantId:Number(__sbcRequireTenantId(job?.tenantId)),product:clean(job?.product,255),quantity:Number(job?.quantity||1),artwork:{preflight:'REQUIRED',format:'VECTOR_OR_PRINT_READY',dpi:300},idempotencyKey:clean(job?.idempotencyKey,200),requiresOwnerClearance:Number(job?.value||0)>=OWNER_THRESHOLD};}

function twilioPolicy({phone,region='',consent=true,optOut=false}={}){if(optOut)return {allowed:false,reason:'OPT_OUT'};if(!consent)return {allowed:false,reason:'CONSENT_REQUIRED'};const configured=Boolean(process.env.TWILIO_PHONE_NUMBER);return {allowed:configured,reason:configured?'SENDER_CONFIGURED':'SENDER_NOT_CONFIGURED',requestedRegion:clean(region,80),from:configured?String(process.env.TWILIO_PHONE_NUMBER):'',identityAttestation:'NOT_ASSERTED_BY_SBC'};}

module.exports={VERSION,OWNER_THRESHOLD,hostOnly,loadHostMap,tenantFromHost,bindRequestTenant,tenantPredicate,tenantQuery,capabilityNonce,verifyCapability,capabilitySweep,recordTenantFailure,quarantineTenant,releaseTenant,tenantHealth,financialLock,authorizeFinancialExecution,assertFinancialExecution,financialStatus,persistFinancialLock,authorizePersistentFinancialExecution,getPersistentFinancialLock,financialStatusPersistent,financialExecutionGate,normalizeE164,normalizeLeadRow,normalizeLeadBatch,storefrontProfile,renderStorefront,provisionStorefront,revenueCapacitySnapshot,vendorPayload,twilioPolicy};
