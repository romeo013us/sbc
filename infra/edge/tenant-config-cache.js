"use strict";
const crypto=require('crypto');
const CACHE=new Map(); const MAX=Number(process.env.SBC_EDGE_TENANT_CACHE_MAX||5000); const TTL=Number(process.env.SBC_EDGE_TENANT_CACHE_TTL_MS||600000);
function key(t){return crypto.createHash('sha256').update(String(t)).digest('hex').slice(0,24)}
function set(t,config){if(CACHE.size>=MAX){const first=CACHE.keys().next().value;if(first)CACHE.delete(first)}CACHE.set(key(t),{tenant_id:t,config,expires_at:Date.now()+TTL})}
function get(t){const k=key(t),x=CACHE.get(k);if(!x)return null;if(x.expires_at<Date.now()){CACHE.delete(k);return null}return x.config}
function invalidate(t){CACHE.delete(key(t))}
function summary(){let live=0;for(const [k,x] of CACHE){if(x.expires_at<Date.now())CACHE.delete(k);else live++}return {enabled:true,entries:live,max:MAX,ttl_ms:TTL,backend:process.env.SBC_REDIS_URL?'redis-ready-local-fallback':'process-local-lru',note:'Use Redis for multi-process deployment; local cache is a safe fallback.'}}
module.exports={set,get,invalidate,summary};
