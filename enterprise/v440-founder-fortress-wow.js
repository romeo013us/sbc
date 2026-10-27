'use strict';
const crypto = require('crypto');

const VERSION = '44.0.0';
const WINDOW_MS = 30000;
const SESSION_SECRET = String(process.env.CORE_FORTRESS_SALT || process.env.SBC_SESSION_SECRET || 'development-only-fortress-salt');

const CAPABILITIES = [
  ['polymorphic-challenge','Ephemeral Command Challenge','Sensitive actions receive a short-lived HMAC challenge; public route names remain stable for compatibility.'],
  ['memory-canary','Process Memory Canary','Frozen canary state detects unexpected mutation and records a security event without pretending memory isolation is absolute.'],
  ['one-time-handshake','Outbound One-Time Handshake','Vendor payloads can carry a nonce + HMAC integrity envelope with replay detection.'],
  ['field-encryption','Selective Data Vault','Configured sensitive fields can be encrypted at rest with AES-256-GCM; keys stay in approved runtime secrets.'],
  ['honeypot-sandbox','Synthetic Honeypot Sandbox','Suspicious unauthenticated requests can receive inert synthetic responses; no real customer data is exposed.'],
  ['web-shatter-preview','Instant Web-Shatter Preview','Consent-based public URL analysis extracts limited brand metadata into a temporary preview; no credentialed scraping.'],
  ['ghost-cursor-consent','Ghost Cursor Collaboration','Optional SSE collaboration shows coarse user presence/active section; raw keystrokes and sensitive field contents are never streamed.'],
  ['directors-cut','Director\'s Cut Interface','Owner/Kim can switch to a War Room presentation layer without changing authorization boundaries.'],
  ['phoenix-plan','Phoenix Protocol Planner','Creates a reversible restart/recovery plan and verifies state checkpoints; it does not self-terminate production from a browser click.'],
  ['predictive-matrix','Predictive Operations Matrix','Turns historical operational signals into transparent heat indicators and reorder candidates.']
];

function windowId(now=Date.now()){ return Math.floor(now/WINDOW_MS); }
function challengeFor(now=Date.now()){
  return crypto.createHmac('sha256', SESSION_SECRET).update(String(windowId(now))).digest('hex');
}
function verifyChallenge(token, now=Date.now()){
  const candidates=[challengeFor(now),challengeFor(now-WINDOW_MS),challengeFor(now+WINDOW_MS)];
  if(typeof token!=='string'||token.length!==64)return false;
  return candidates.some(x=>crypto.timingSafeEqual(Buffer.from(x),Buffer.from(token)));
}
function nonce(){return crypto.randomBytes(18).toString('base64url');}
function signedEnvelope(payload, secret=SESSION_SECRET){
  const body=JSON.stringify(payload||{});
  const n=nonce();
  const mac=crypto.createHmac('sha256',secret).update(n+'.'+body).digest('hex');
  return {nonce:n,body,mac,createdAt:new Date().toISOString()};
}
function verifyEnvelope(env, secret=SESSION_SECRET){
  if(!env||!env.nonce||!env.body||!env.mac)return false;
  const expected=crypto.createHmac('sha256',secret).update(String(env.nonce)+'.'+String(env.body)).digest('hex');
  return expected.length===String(env.mac).length && crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(env.mac));
}
function encryptField(value, keyHex=process.env.SBC_VAULT_KEY){
  if(!keyHex)return {configured:false,reason:'SBC_VAULT_KEY not configured'};
  const key=Buffer.from(String(keyHex),'hex');
  if(key.length!==32)return {configured:false,reason:'SBC_VAULT_KEY must decode to 32 bytes'};
  const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const ct=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return {configured:true,format:'sbc1',iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:ct.toString('base64url')};
}
function memoryCanary(){return Object.freeze({id:'SBC-CANARY-44',role:'SYNTHETIC_ONLY',isTrap:true,createdAt:new Date().toISOString()});}
function canaryCheck(candidate){return Boolean(candidate&&candidate.id==='SBC-CANARY-44'&&candidate.role==='SYNTHETIC_ONLY'&&candidate.isTrap===true);}
function honeypotResponse(){return {ok:true,synthetic:true,workspace:'SBC-SANDBOX',records:0,message:'Synthetic sandbox. No production records are exposed.'};}
function previewBrand(html=''){
  const text=String(html).slice(0,2_000_000);
  const title=(text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
  const colors=[...text.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(x=>x[0].toLowerCase());
  const unique=[...new Set(colors)].slice(0,12);
  const logo=(text.match(/<img[^>]+(?:alt=["']?[^"'>]*logo|src=["'][^"']*logo)[^>]*>/i)||[])[0]||'';
  return {title:title.replace(/<[^>]+>/g,'').trim().slice(0,160),colors:unique,logoDetected:Boolean(logo),htmlBytes:Buffer.byteLength(text),mode:'metadata-only-temporary-preview'};
}
function phoenixPlan(state={}){
  return {mode:'reversible-plan-only',steps:['capture runtime checkpoint','flush durable writes','stop accepting new background work','allow host process manager to restart','verify database/session integrity','restore verified runtime snapshot','run health probes'],requiresOwnerApproval:true,checkpointHash:crypto.createHash('sha256').update(JSON.stringify(state)).digest('hex')};
}
function predictiveMatrix(input={}){
  const rows=Array.isArray(input.rows)?input.rows:[];
  return rows.map(r=>{const velocity=Number(r.velocity||0),recency=Number(r.recency||0),value=Number(r.value||0);const score=Math.round(Math.max(0,Math.min(100,velocity*0.45+recency*0.25+Math.min(100,value)*0.30)));return {...r,heatIndex:score};}).sort((a,b)=>b.heatIndex-a.heatIndex).slice(0,10);
}
function summary(){return {version:VERSION,capabilityCount:CAPABILITIES.length,capabilities:CAPABILITIES,security:{challengeWindowMs:WINDOW_MS,fieldEncryption:'AES-256-GCM when SBC_VAULT_KEY is configured',transport:'TLS remains required; application envelopes do not replace TLS'},collaboration:{ghostCursor:'coarse presence only; explicit opt-in recommended'},preview:{mode:'metadata-only temporary preview; SSRF/credentialed access must remain blocked'},phoenix:{mode:'plan-and-verify; no browser-triggered process suicide'}};}

module.exports={VERSION,CAPABILITIES,WINDOW_MS,challengeFor,verifyChallenge,signedEnvelope,verifyEnvelope,encryptField,memoryCanary,canaryCheck,honeypotResponse,previewBrand,phoenixPlan,predictiveMatrix,summary};
