'use strict';
/**
 * SBC V56.2 Tier-1 Architecture Pack
 * Safe, GoDaddy-compatible implementations of the additional architecture proposals.
 * No secrets are embedded. No provider is called unless an exact configured endpoint exists.
 */
const crypto = require('crypto');
const {fork} = require('child_process');
const EventEmitter = require('events');

const VERSION = '56.2.0';
const events = new EventEmitter();
events.setMaxListeners(200);
const idempotencyMemory = new Map();
const MAX_IDEMPOTENCY_MEMORY = 5000;
const IDEMPOTENCY_TTL_MS = Math.max(60_000, Number(process.env.SBC_TIER1_IDEMPOTENCY_TTL_MS || 86_400_000));

function sha256(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function canonical(value){return JSON.stringify(value, Object.keys(value||{}).sort());}
function idempotencyKey(scope, payload){return sha256(`${String(scope)}:${canonical(payload||{})}`);}
function pruneIdempotency(now=Date.now()){
  for(const [k,v] of idempotencyMemory){if(now-v.expiresAt>0)idempotencyMemory.delete(k);}
  while(idempotencyMemory.size>MAX_IDEMPOTENCY_MEMORY)idempotencyMemory.delete(idempotencyMemory.keys().next().value);
}
function claimIdempotency(key,result){
  pruneIdempotency();
  const k=String(key||'').trim();
  if(!k) throw new Error('Idempotency key is required.');
  const existing=idempotencyMemory.get(k);
  if(existing && existing.expiresAt>Date.now()) return {duplicate:true,result:existing.result};
  idempotencyMemory.set(k,{result,createdAt:Date.now(),expiresAt:Date.now()+IDEMPOTENCY_TTL_MS});
  return {duplicate:false,result};
}

/** RFC-4180-ish byte scanner. It accepts Buffer/Uint8Array and avoids creating one giant split array. */
function parseCsvBinary(input,{maxBytes=25*1024*1024,maxRows=250000}={}){
  const buf=Buffer.isBuffer(input)?input:Buffer.from(input||'');
  if(buf.length>maxBytes)throw new Error(`Bulk upload exceeds ${maxBytes} byte limit.`);
  const rows=[]; let row=[]; let fieldStart=0; let field=''; let quoted=false; let i=0;
  const flushField=()=>{row.push(field.trim());field='';};
  const flushRow=()=>{if(row.length||field.length){flushField();rows.push(row);row=[];}else row=[];};
  while(i<buf.length){
    const b=buf[i];
    if(b===34){
      if(quoted && buf[i+1]===34){field+='"';i+=2;continue;}
      quoted=!quoted;i++;continue;
    }
    if(!quoted && b===44){flushField();i++;continue;}
    if(!quoted && (b===10||b===13)){
      flushRow();
      if(b===13&&buf[i+1]===10)i++;
      i++;continue;
    }
    // Decode only the current character sequence; UTF-8 multi-byte data is handled by accumulating bytes below.
    const start=i;
    if(b<128){field+=String.fromCharCode(b);i++;continue;}
    while(i<buf.length && (buf[i]&0xC0)===0x80)i++;
    i++;
    field+=buf.subarray(start,i).toString('utf8');
  }
  if(field.length||row.length)flushRow();
  if(rows.length>maxRows)throw new Error(`Bulk upload exceeds ${maxRows} rows.`);
  return rows;
}

function normalizeLeadRows(rows,{batchId,source='Lorna'}={}){
  const seen=new Set(); const leads=[]; let duplicates=0,invalid=0;
  for(const r of rows){
    const company=String(r[0]||'').trim();
    const phone=String(r[1]||'').replace(/\D/g,'');
    const email=String(r[2]||'').trim().toLowerCase();
    if(!company || (!phone && !email)){invalid++;continue;}
    const key=sha256(`${company.toLowerCase()}|${phone}|${email}`);
    if(seen.has(key)){duplicates++;continue;}
    seen.add(key); leads.push({batchId,source,company_name:company,phone_digits:phone,email_address:email||null,conversion_state:'PROSPECT',ingest_timestamp:new Date().toISOString(),dedupe_key:key});
  }
  return {leads,counts:{received:rows.length,accepted:leads.length,duplicates,invalid}};
}

function createBatchId(source='LORNA'){
  const d=new Date().toISOString().slice(0,10).replace(/-/g,'');
  return `${String(source).toUpperCase()}-BATCH-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function publish(topic,payload){events.emit('event',{id:crypto.randomUUID(),topic,payload,at:new Date().toISOString()});}
function subscribe(fn){events.on('event',fn);return()=>events.off('event',fn);}

function capacitySnapshot({activeLeads=0,unworked=0,hotWarm=0,workerBacklog=0,maxUnworked=50,maxBacklog=100}={}){
  const pressure=Math.max(unworked/Math.max(1,maxUnworked),workerBacklog/Math.max(1,maxBacklog));
  return {activeLeads,unworked,hotWarm,workerBacklog,maxUnworked,maxBacklog,pressure:Number(pressure.toFixed(3)),state:pressure>=1.5?'PAUSE_SOURCING':pressure>=1?'REDUCE_SOURCING':'SOURCE_OK',reason:pressure>=1?'Sales capacity is above the configured operating limit.':'Pipeline capacity is within operating range.'};
}

function spotlightOpportunities(customers=[]){
  const now=Date.now();
  return customers.map(c=>{
    const temp=String(c.leadTemperature||c.temperature||'').toLowerCase();
    const value=Number(c.dealValue||c.estimatedValue||0);
    const updated=Date.parse(c.updatedAt||c.stateUpdatedAt||c.createdAt||'');
    const stale=Number.isFinite(updated)&&now-updated>4*60*60*1000;
    let score=(temp==='hot'?60:temp==='warm'?35:10)+(Math.min(value,10000)/10000)*30+(stale?10:0);
    return {...c,opportunityScore:Math.round(score),stale};
  }).filter(x=>x.opportunityScore>=55).sort((a,b)=>b.opportunityScore-a.opportunityScore).slice(0,10);
}

function encryptField(value,keyMaterial){
  const secret=String(keyMaterial||process.env.SBC_DATA_ENCRYPTION_KEY||'').trim();
  if(!secret)throw new Error('SBC_DATA_ENCRYPTION_KEY is not configured.');
  const key=crypto.createHash('sha256').update(secret).digest();
  const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}
function decryptField(token,keyMaterial){
  const secret=String(keyMaterial||process.env.SBC_DATA_ENCRYPTION_KEY||'').trim();
  if(!secret)throw new Error('SBC_DATA_ENCRYPTION_KEY is not configured.');
  const parts=String(token||'').split('.'); if(parts.length!==4||parts[0]!=='v1')throw new Error('Invalid encrypted field.');
  const key=crypto.createHash('sha256').update(secret).digest(); const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(parts[1],'base64url'));decipher.setAuthTag(Buffer.from(parts[2],'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(parts[3],'base64url')),decipher.final()]).toString('utf8');
}

function evaluateGuardrail({estimatedValue=0,action='automation'}={}){
  const threshold=Math.max(1,Number(process.env.SBC_AUTOMATION_VALUE_THRESHOLD||10000));
  const locked=Number(estimatedValue)>=threshold;
  return {ok:!locked,locked,requiresOwnerSignature:locked,threshold,action,reason:locked?'Owner approval required above the automation threshold.':'Within autonomous execution boundary.'};
}

function checkoutRecovery(payload){
  if(String(payload?.status||'').toLowerCase()!=='abandoned' || !payload?.client_email)return {queued:false,reason:'Not an eligible abandoned checkout.'};
  const key=idempotencyKey('checkout-recovery',{clientId:payload.client_id,email:String(payload.client_email).toLowerCase(),cartTotal:Number(payload.cart_total||0)});
  const claim=claimIdempotency(key,{clientId:payload.client_id,abandonedValue:Number(payload.cart_total||0),stage:1,nextActionAt:new Date(Date.now()+15*60*1000).toISOString(),channel:'approved-communications'});
  if(claim.duplicate)return {queued:false,duplicate:true,recovery:claim.result};
  publish('checkout.abandoned',claim.result);return {queued:true,duplicate:false,recovery:claim.result};
}

function stagedProvisioning(order,{provider='4over4'}={}){
  const guard=evaluateGuardrail({estimatedValue:Number(order?.estimatedValue||order?.total||0),action:'vendor_provisioning'});
  const key=idempotencyKey(`vendor:${provider}`,order||{});
  return {status:guard.ok?'READY_FOR_PROVIDER':'OWNER_APPROVAL_REQUIRED',provider,idempotencyKey:key,guardrail:guard,endpointConfigured:Boolean(process.env[`SBC_${String(provider).toUpperCase().replace(/[^A-Z0-9]/g,'_')}_ORDER_URL`]),note:'No vendor request is sent by this adapter until the exact provider endpoint and credential reference are configured and the existing provider adapter authorizes submission.'};
}

function spawnWorker({workerPath,payload,timeoutMs=120000}={}){
  if(!workerPath)throw new Error('workerPath is required.');
  return new Promise((resolve,reject)=>{
    const child=fork(workerPath,[],{silent:true,env:{...process.env}});let settled=false;let timer=setTimeout(()=>{if(!settled){settled=true;child.kill('SIGTERM');reject(new Error('Worker timed out.'));}},timeoutMs);
    let stderr=''; child.stderr?.on('data',d=>stderr+=String(d));
    child.on('message',m=>{if(settled)return;settled=true;clearTimeout(timer);child.kill();resolve(m);});
    child.on('error',e=>{if(settled)return;settled=true;clearTimeout(timer);reject(e);});
    child.on('exit',(code)=>{if(!settled&&code!==0){settled=true;clearTimeout(timer);reject(new Error(stderr||`Worker exited ${code}`));}});
    child.send(payload);
  });
}

module.exports={VERSION,parseCsvBinary,normalizeLeadRows,createBatchId,claimIdempotency,idempotencyKey,publish,subscribe,capacitySnapshot,spotlightOpportunities,encryptField,decryptField,evaluateGuardrail,checkoutRecovery,stagedProvisioning,spawnWorker};
