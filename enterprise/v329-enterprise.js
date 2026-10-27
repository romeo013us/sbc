'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CAPABILITIES = [
  [101,'Provider Credential Health Monitor'],[102,'Vendor Contract/Capability Registry'],[103,'Provider Sandbox Transaction Harness'],[104,'Vendor Quote Snapshot Cache'],[105,'Vendor Catalog Normalization'],
  [106,'Vendor Product Specification Mapper'],[107,'Vendor Webhook Signature Validator'],[108,'Vendor Rate-Limit Governor'],[109,'Vendor Circuit Breaker'],[110,'Vendor Reconciliation Center'],
  [111,'Lead Import Watcher'],[112,'Lead Import Batch Ledger'],[113,'Lead Schema Validator'],[114,'Lead Deduplication Graph'],[115,'Lead Domain Normalizer'],
  [116,'Lead Contact Confidence Model'],[117,'Lead Verification Queue'],[118,'Lead Suppression List'],[119,'Lead Source Attribution'],[120,'Lead Import Rollback'],
  [121,'Opportunity Auto-Creation Rules'],[122,'Sales Activity SLA'],[123,'Next-Best-Action Queue'],[124,'Quote Expiration Monitor'],[125,'Proposal Version Control'],
  [126,'Contract Renewal Calendar'],[127,'Sales Forecast Commit/Best-Case Separation'],[128,'Lost-Deal Reason Taxonomy'],[129,'Customer Onboarding Checklist'],[130,'Customer Handoff Package'],
  [131,'Universal Notification Router'],[132,'Notification Preference Center'],[133,'Message Delivery Receipts'],[134,'Email/SMS Template Versioning'],[135,'Communication Consent Ledger'],
  [136,'Document Generation Queue'],[137,'Document Integrity Hashing'],[138,'Secure Download Expiration'],[139,'System Dependency Blast-Radius Analyzer'],[140,'Maintenance Window Manager'],
  [141,'Worker Heartbeat Registry'],[142,'Worker Job Lease Recovery'],[143,'Queue Backpressure Controller'],[144,'Rate-Limit Budget Dashboard'],[145,'API Cost Meter'],
  [146,'Data Retention Policy Engine'],[147,'PII Redaction Pipeline'],[148,'Export Access Ledger'],[149,'Operational Runbook Library'],[150,'Kim Training/Skill Verification Matrix']
].map(([id,name])=>({id,name,key:name.toLowerCase().replace(/[^a-z0-9]+/g,'_')}));

const state = {
  providers:new Map(), contracts:new Map(), quoteCache:new Map(), catalogs:new Map(), specs:new Map(),
  rateLimits:new Map(), circuits:new Map(), reconciliations:[],
  leadBatches:new Map(), leads:[], verificationQueue:[], suppressions:new Set(), sourceAttribution:new Map(),
  opportunities:[], slas:[], actions:[], quotes:[], proposals:new Map(), renewals:[], lostReasons:new Map(),
  onboarding:new Map(), handoffs:[], notifications:[], preferences:new Map(), receipts:[], templates:new Map(), consents:[],
  documents:[], downloads:new Map(), dependencies:new Map(), maintenance:[], heartbeats:new Map(), leases:new Map(),
  queues:new Map(), rateBudgets:new Map(), apiCosts:[], retention:{policies:[],lastSweep:null}, exports:[], runbooks:new Map(), training:new Map(),
  audit:[], createdAt:new Date().toISOString()
};

function now(){return new Date().toISOString();}
function id(prefix='v329'){return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;}
function safe(v,max=2000){return String(v??'').trim().slice(0,max);}
function hash(v){return crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');}
function norm(v){return safe(v,500).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function domain(v){const s=safe(v,300).toLowerCase().replace(/^https?:\/\//,'').split('/')[0];return s.replace(/^www\./,'');}
function audit(event,payload={}){state.audit.unshift({id:id('audit'),event,payload,at:now()});state.audit=state.audit.slice(0,1000);}

function registerProvider(provider, config={}){
  const key=norm(provider)||'unknown'; const p={id:key,provider:safe(provider,120),configured:Boolean(config.configured),credentialRef:safe(config.credentialRef,120),status:config.configured?'READY':'STANDBY',checkedAt:now(),missing:Array.isArray(config.missing)?config.missing:[]};
  state.providers.set(key,p); audit('provider.health.updated',p); return {...p};
}
function providerHealth(provider){const key=norm(provider); return state.providers.get(key)||registerProvider(provider);}
function upsertContract(provider,contract={}){const key=norm(provider);const c={id:contract.id||id('contract'),provider:safe(provider,120),capabilities:Array.isArray(contract.capabilities)?contract.capabilities.map(x=>safe(x,100)):[],status:contract.status||'ACTIVE',termsHash:hash(contract.terms||{}),updatedAt:now()};state.contracts.set(key,c);audit('vendor.contract.updated',{provider:key,id:c.id});return {...c};}
function sandboxTransaction(provider,payload={}){const p=providerHealth(provider);const tx={id:id('sandbox'),provider:p.provider,status:'SIMULATED',payloadHash:hash(payload),createdAt:now(),productionWrite:false};audit('vendor.sandbox.transaction',tx);return tx;}
function cacheQuote(provider,quote={}){const key=`${norm(provider)}:${safe(quote.product||quote.sku||'quote',100)}`;const q={...quote,id:quote.id||id('quote'),provider:safe(provider,120),cachedAt:now(),expiresAt:quote.expiresAt||new Date(Date.now()+15*60e3).toISOString()};state.quoteCache.set(key,q);return {...q};}
function normalizeCatalog(provider,items=[]){const arr=(Array.isArray(items)?items:[]).map(x=>({sku:safe(x.sku||x.id,100),name:safe(x.name||x.title,200),category:safe(x.category,100),unitPrice:Number(x.unitPrice??x.price??0),currency:safe(x.currency||'USD',10)}));state.catalogs.set(norm(provider),arr);return arr;}
function mapSpec(provider,spec={}){const mapped={provider:safe(provider,120),sku:safe(spec.sku,100),width:Number(spec.width||0),height:Number(spec.height||0),material:safe(spec.material,120),finish:safe(spec.finish,120),mappedAt:now()};state.specs.set(`${norm(provider)}:${mapped.sku}`,mapped);return {...mapped};}
function verifyWebhook(provider,raw,signature,secret){const expected=crypto.createHmac('sha256',String(secret||'')).update(Buffer.isBuffer(raw)?raw:Buffer.from(String(raw||''))).digest('hex');const ok=Boolean(secret)&&crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(signature||'')));return {provider:safe(provider,100),valid:ok,verifiedAt:now(),secretExposed:false};}
function rateLimit(provider,limit=60,windowMs=60000){const key=norm(provider),t=Date.now();let r=state.rateLimits.get(key);if(!r||t-r.windowStart>=windowMs)r={limit:Number(limit),used:0,windowStart:t};const allowed=r.used<r.limit;r.used++;state.rateLimits.set(key,r);return {provider:key,allowed,limit:r.limit,used:r.used,remaining:Math.max(0,r.limit-r.used),resetAt:new Date(r.windowStart+windowMs).toISOString()};}
function circuit(provider,success=true){const key=norm(provider);let c=state.circuits.get(key)||{provider:key,state:'CLOSED',failures:0,openedAt:null};if(success){c.failures=0;c.state='CLOSED';c.openedAt=null;}else{c.failures++;if(c.failures>=3){c.state='OPEN';c.openedAt=now();}}state.circuits.set(key,c);return {...c};}
function reconcile(provider,local=[],remote=[]){const lm=new Map(local.map(x=>[String(x.id),x])),rm=new Map(remote.map(x=>[String(x.id),x]));const missingRemote=[...lm.keys()].filter(k=>!rm.has(k));const missingLocal=[...rm.keys()].filter(k=>!lm.has(k));const mismatch=[...lm.keys()].filter(k=>rm.has(k)&&hash(lm.get(k))!==hash(rm.get(k)));const out={id:id('recon'),provider:safe(provider,120),missingRemote,missingLocal,mismatch,reconciled:missingRemote.length===0&&missingLocal.length===0&&mismatch.length===0,at:now()};state.reconciliations.push(out);audit('vendor.reconciliation',out);return out;}

function parseCsv(text){const rows=[];let row=[],f='',q=false;for(let i=0;i<String(text||'').length;i++){const ch=text[i],nx=text[i+1];if(q){if(ch==='"'&&nx==='"'){f+='"';i++;}else if(ch==='"')q=false;else f+=ch;}else if(ch==='"')q=true;else if(ch===','){row.push(f);f='';}else if(ch==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(ch!=='\r')f+=ch;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
function leadSchema(rows){const header=(rows[0]||[]).map(x=>norm(x));const businessOk=header.includes('business name')||header.includes('business')||header.includes('company name')||header.includes('company');const contactOk=header.includes('email')||header.includes('phone')||header.includes('phone number')||header.includes('website');const evidenceOk=header.includes('verification')||header.includes('source')||header.includes('city')||header.includes('zip');const missing=[];if(!businessOk)missing.push('business name');if(!contactOk&&!evidenceOk)missing.push('email|phone|website or prospect-evidence fields');return {valid:missing.length===0,headers:header,missing};}
function leadDomain(v){return domain(v);}
function confidence(lead){let score=0;if(lead.businessName)score+=25;if(lead.email)score+=20;if(lead.phone)score+=20;if(lead.website)score+=15;if(lead.contactName)score+=10;if(lead.city)score+=5;if(lead.industry)score+=5;return Math.min(100,score);}
function dedupeLeads(leads){const seen=new Map(),unique=[],dupes=[];for(const lead of leads){const key=[norm(lead.businessName),safe(lead.email,200).toLowerCase(),safe(lead.phone,80).replace(/\D/g,''),leadDomain(lead.website)].join('|');if(seen.has(key)){dupes.push({duplicate:lead,of:seen.get(key)});}else{seen.set(key,lead);unique.push(lead);}}return {unique,duplicates:dupes};}
function importLeads({source,text,rows}={}){const parsed=rows||parseCsv(text||'');const schema=leadSchema(parsed);if(!schema.valid)throw new Error(`Lead schema invalid: missing ${schema.missing.join(', ')}`);const headers=schema.headers;const objects=parsed.slice(1).filter(r=>r.some(Boolean)).map(r=>{const o={};headers.forEach((h,i)=>o[h]=safe(r[i],1000));return {businessName:o['business name']||o.business||'',email:o.email||'',phone:o.phone||'',website:o.website||'',contactName:o['contact name']||'',city:o.city||'',industry:o.industry||'',source:source||o.source||'import'};});const d=dedupeLeads(objects);const batch={id:id('leadbatch'),source:safe(source||'csv',200),rows:objects.length,accepted:d.unique.length,duplicates:d.duplicates.length,schema,createdAt:now(),status:'IMPORTED'};state.leadBatches.set(batch.id,batch);state.leads.push(...d.unique.map(x=>({...x,id:id('lead'),domain:leadDomain(x.website),confidence:confidence(x),status:'IMPORTED',batchId:batch.id})));state.verificationQueue.push(...state.leads.filter(x=>x.batchId===batch.id));audit('lead.imported',batch);return {...batch,verificationQueue:d.unique.length};}
function queueVerification(limit=50){const items=state.verificationQueue.splice(0,Number(limit));items.forEach(x=>x.status='VERIFICATION_READY');return items;}
function suppressLead(key,reason=''){const k=norm(key);state.suppressions.add(k);audit('lead.suppressed',{key:k,reason:safe(reason,300)});return {key:k,suppressed:true};}
function attributeSource(leadId,source){const x=state.leads.find(l=>l.id===leadId);if(!x)throw new Error('Lead not found');x.source=safe(source,200);state.sourceAttribution.set(leadId,x.source);return {...x};}
function rollbackBatch(batchId){const b=state.leadBatches.get(batchId);if(!b)throw new Error('Batch not found');const before=state.leads.length;state.leads=state.leads.filter(x=>x.batchId!==batchId);state.verificationQueue=state.verificationQueue.filter(x=>x.batchId!==batchId);b.status='ROLLED_BACK';b.rolledBackAt=now();audit('lead.batch.rolled_back',{batchId});return {batchId,removed:before-state.leads.length,status:b.status};}

function createOpportunity(lead,{owner='unassigned',trigger='verified'}={}){const o={id:id('opp'),leadId:lead.id,owner,trigger,status:'OPEN',createdAt:now(),nextActionAt:new Date(Date.now()+24*3600e3).toISOString()};state.opportunities.push(o);return o;}
function salesSla(opportunityId,dueAt){const s={id:id('sla'),opportunityId,dueAt:new Date(dueAt||Date.now()+24*3600e3).toISOString(),status:'OPEN'};state.slas.push(s);return s;}
function nextAction(){const open=state.opportunities.filter(x=>x.status==='OPEN').sort((a,b)=>String(a.nextActionAt).localeCompare(String(b.nextActionAt)));return open[0]||null;}
function quoteExpiry(quote){const q={id:quote.id||id('salesquote'),expiresAt:new Date(quote.expiresAt||Date.now()+7*86400e3).toISOString(),status:'ACTIVE'};state.quotes.push(q);return q;}
function proposalVersion(proposalId,content){const arr=state.proposals.get(proposalId)||[];const v={id:id('proposalv'),proposalId,version:arr.length+1,contentHash:hash(content),createdAt:now()};arr.push(v);state.proposals.set(proposalId,arr);return v;}
function renewal(customerId,dueAt){const r={id:id('renewal'),customerId,dueAt:new Date(dueAt||Date.now()+30*86400e3).toISOString(),status:'OPEN'};state.renewals.push(r);return r;}
function forecast(opportunities=[]){const rows=opportunities.length?opportunities:state.opportunities;return {commit:rows.filter(x=>x.forecast==='commit').length,bestCase:rows.filter(x=>x.forecast==='best_case').length,unclassified:rows.filter(x=>!x.forecast).length};}
function lostReason(reason,count=1){const key=safe(reason||'unspecified',200);state.lostReasons.set(key,(state.lostReasons.get(key)||0)+Number(count));return {reason:key,count:state.lostReasons.get(key)};}
function onboarding(customerId,steps=[]){const o={customerId,steps:steps.map(s=>({name:s,status:'OPEN'})),updatedAt:now()};state.onboarding.set(String(customerId),o);return o;}
function handoff(customerId,from,to,packageData={}){const h={id:id('handoff'),customerId,from,to,packageHash:hash(packageData),createdAt:now(),status:'READY'};state.handoffs.push(h);return h;}

function notify(channel,to,body,meta={}){const n={id:id('notif'),channel:safe(channel,30),to:safe(to,300),body:safe(body,4000),status:'QUEUED',createdAt:now(),meta};state.notifications.push(n);return n;}
function setPreference(userId,prefs){const p={userId,preferences:{...prefs},updatedAt:now()};state.preferences.set(String(userId),p);return p;}
function receipt(messageId,status,provider='unknown'){const r={id:id('receipt'),messageId,status:safe(status,50),provider:safe(provider,100),receivedAt:now()};state.receipts.push(r);return r;}
function template(channel,name,body){const key=`${channel}:${name}`;const arr=state.templates.get(key)||[];const v={id:id('template'),channel,name,version:arr.length+1,body:safe(body,10000),createdAt:now()};arr.push(v);state.templates.set(key,arr);return v;}
function consent(customerId,channel,status,source='system'){const c={id:id('consent'),customerId,channel,status,source,at:now()};state.consents.push(c);return c;}
function queueDocument(type,payload){const d={id:id('doc'),type:safe(type,100),payloadHash:hash(payload),status:'QUEUED',createdAt:now()};state.documents.push(d);return d;}
function documentHash(content){return {algorithm:'sha256',hash:hash(content)};}
function secureDownload(documentId,ttlSeconds=900){const token=crypto.randomBytes(18).toString('hex');const d={documentId,tokenHash:hash(token),expiresAt:new Date(Date.now()+Number(ttlSeconds)*1000).toISOString()};state.downloads.set(token,d);return {documentId,token,expiresAt:d.expiresAt};}
function dependency(name,dependsOn=[],impact='medium'){const d={name:safe(name,120),dependsOn:dependsOn.map(x=>safe(x,120)),impact:safe(impact,30),updatedAt:now()};state.dependencies.set(d.name,d);return d;}
function maintenance(name,start,end){const m={id:id('maint'),name:safe(name,200),start:new Date(start||Date.now()).toISOString(),end:new Date(end||Date.now()+3600000).toISOString(),status:'SCHEDULED'};state.maintenance.push(m);return m;}
function heartbeat(worker,status='ALIVE'){const h={worker:safe(worker,120),status,at:now()};state.heartbeats.set(h.worker,h);return h;}
function lease(job,worker,ttlSeconds=300){const l={job:safe(job,200),worker:safe(worker,120),leaseId:id('lease'),expiresAt:new Date(Date.now()+ttlSeconds*1000).toISOString(),status:'LEASED'};state.leases.set(l.job,l);return l;}
function queueBackpressure(name,depth,maxDepth){const q={name:safe(name,120),depth:Number(depth||0),maxDepth:Number(maxDepth||100),status:Number(depth||0)>=Number(maxDepth||100)?'THROTTLED':'OPEN',at:now()};state.queues.set(q.name,q);return q;}
function rateBudget(provider,used,budget){const x={provider:safe(provider,100),used:Number(used||0),budget:Number(budget||0),remaining:Math.max(0,Number(budget||0)-Number(used||0)),at:now()};state.rateBudgets.set(x.provider,x);return x;}
function apiCost(provider,cost,units=1){const x={id:id('cost'),provider:safe(provider,100),cost:Number(cost||0),units:Number(units||1),at:now()};state.apiCosts.push(x);return x;}
function retentionPolicy(dataset,days){const p={dataset:safe(dataset,120),days:Number(days),updatedAt:now()};state.retention.policies.push(p);return p;}
function redactPII(obj){if(Array.isArray(obj))return obj.map(redactPII);if(!obj||typeof obj!=='object')return obj;const out={...obj};for(const k of Object.keys(out)){if(/email|phone|address|ssn|token|secret|password/i.test(k))out[k]='[REDACTED]';else if(typeof out[k]==='object')out[k]=redactPII(out[k]);}return out;}
function exportAccess(userId,scope){const e={id:id('export'),userId:safe(userId,120),scope:safe(scope,300),at:now()};state.exports.push(e);audit('export.accessed',e);return e;}
function runbook(name,steps=[]){const r={id:id('runbook'),name:safe(name,200),steps:Array.isArray(steps)?steps.map(x=>safe(x,500)):[],updatedAt:now()};state.runbooks.set(norm(name),r);return r;}
function training(userId,skill,verified=false){const key=`${userId}:${skill}`;const t={userId:safe(userId,120),skill:safe(skill,200),verified:Boolean(verified),verifiedAt:verified?now():null};state.training.set(key,t);return t;}

function importStarterLeadFile(rootDir){const file=path.join(rootDir,'starter-leads','SBC-250-Verified-Lead-Prospects.csv');if(!fs.existsSync(file))return {status:'STAGED',file,rows:0};const text=fs.readFileSync(file,'utf8');return importLeads({source:'SBC-250-Verified-Lead-Prospects.csv',text});}
function summary(){return {version:'32.9.0',capabilities:CAPABILITIES.length,providers:state.providers.size,leadBatches:state.leadBatches.size,leads:state.leads.length,verificationQueue:state.verificationQueue.length,opportunities:state.opportunities.length,notifications:state.notifications.length,documents:state.documents.length,workers:state.heartbeats.size,auditEntries:state.audit.length};}

module.exports={CAPABILITIES,state,now,id,hash,registerProvider,providerHealth,upsertContract,sandboxTransaction,cacheQuote,normalizeCatalog,mapSpec,verifyWebhook,rateLimit,circuit,reconcile,parseCsv,leadSchema,leadDomain,confidence,dedupeLeads,importLeads,queueVerification,suppressLead,attributeSource,rollbackBatch,createOpportunity,salesSla,nextAction,quoteExpiry,proposalVersion,renewal,forecast,lostReason,onboarding,handoff,notify,setPreference,receipt,template,consent,queueDocument,documentHash,secureDownload,dependency,maintenance,heartbeat,lease,queueBackpressure,rateBudget,apiCost,retentionPolicy,redactPII,exportAccess,runbook,training,importStarterLeadFile,summary};
