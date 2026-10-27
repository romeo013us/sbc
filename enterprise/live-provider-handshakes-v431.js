'use strict';
const crypto=require('crypto');
const CONFIG={
  '4over4':{url:['FOUROVER4_API_URL','FOUR_OVER_FOUR_API_URL'],key:['FOUROVER4_API_KEY','FOUR_OVER_FOUR_API_KEY'],order:['FOUROVER4_ORDER_ENDPOINT','FOUR_OVER_FOUR_ORDER_ENDPOINT'],webhook:'FOUROVER4_WEBHOOK_SECRET'},
  'vistaprint':{url:['VISTAPRINT_API_URL'],key:['VISTAPRINT_API_KEY','VISTAPRINT_PROSHOP_API_KEY'],order:['VISTAPRINT_ORDER_ENDPOINT'],webhook:'VISTAPRINT_WEBHOOK_SECRET'},
  'godaddy':{url:['GODADDY_API_URL'],key:['GODADDY_PAT'],order:['GODADDY_ORDER_ENDPOINT'],webhook:null}
};
const first=(keys,env=process.env)=>keys.map(k=>String(env[k]||'').trim()).find(Boolean)||'';
const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
function config(provider,env=process.env){const c=CONFIG[provider];if(!c)throw Error('Unsupported provider');return {provider,baseUrl:first(c.url,env),apiKey:first(c.key,env),orderEndpoint:first(c.order,env),webhookSecret:c.webhook?first([c.webhook],env):''};}
function safeHeaders(apiKey){return apiKey?{'Authorization':apiKey.startsWith('Bearer ')?apiKey:`Bearer ${apiKey}`,'Accept':'application/json'}:{Accept:'application/json'};}
async function handshake(provider,{env=process.env,timeoutMs=10000}={}){
 const c=config(provider,env); if(!c.baseUrl)return {provider,status:'MISSING',live:false,reason:'Provider base URL not configured'};
 if(!c.apiKey)return {provider,status:'MISSING',live:false,reason:'Provider credential not configured'};
 const started=Date.now();
 try{const r=await fetch(c.baseUrl,{method:'GET',headers:safeHeaders(c.apiKey),signal:AbortSignal.timeout(timeoutMs)});return {provider,status:r.ok?'READY':'REJECTED',live:r.ok,httpStatus:r.status,latencyMs:Date.now()-started,checkedAt:new Date().toISOString()};}
 catch(e){return {provider,status:'UNREACHABLE',live:false,error:e.message,latencyMs:Date.now()-started,checkedAt:new Date().toISOString()};}
}
async function submit(provider,payload,{env=process.env,timeoutMs=20000}={}){
 const c=config(provider,env);if(!c.orderEndpoint||!c.apiKey)throw Error(`${provider} live submission is fail-closed: configured endpoint and credential are required`);
 if(!payload||!payload.idempotencyKey)throw Error('idempotencyKey is required');
 const body=JSON.stringify(payload);const headers={...safeHeaders(c.apiKey),'Content-Type':'application/json','Idempotency-Key':String(payload.idempotencyKey)};
 const r=await fetch(c.orderEndpoint,{method:'POST',headers,body,signal:AbortSignal.timeout(timeoutMs)});const text=await r.text();let data=text;try{data=JSON.parse(text)}catch{}
 if(!r.ok)throw Error(`${provider} returned HTTP ${r.status}`);
 return {provider,status:'SUBMITTED',httpStatus:r.status,idempotencyKey:payload.idempotencyKey,response:data,responseHash:sha(text)};
}
module.exports={CONFIG,config,handshake,submit};
