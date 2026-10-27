'use strict';
const crypto=require('crypto');
const FEATURE_BITS=Object.freeze({CORE_SAAS:1,SEO_SYNDICATION:2,OPEN_FACADE:4,ADVANCED_INTELLIGENCE:8,DEMO_BUILDER:16,OFFICE_BOX:32});
const CAPABILITY_FEATURE_MAP=Object.freeze({CORE_SAAS:'analytics',SEO_SYNDICATION:'advancedRevenue',OPEN_FACADE:'aiConcierge',ADVANCED_INTELLIGENCE:'aiConcierge',DEMO_BUILDER:'interactiveDemo',OFFICE_BOX:'analytics'});
const registry=new Map();
function normalize(v){return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9_:-]/g,'_').slice(0,100);}
function register(name,adapter,meta={}){const key=normalize(name);if(!key)throw new Error('Capability name is required.');if(!adapter||typeof adapter.dispatch!=='function')throw new Error(`Capability ${key} requires a dispatch(adapter) function.`);registry.set(key,{name:key,adapter,meta:{version:String(meta.version||'1.0.0'),mode:meta.mode||'on-demand',description:String(meta.description||'')}});return registry.get(key);}
function unregister(name){return registry.delete(normalize(name));}
function list(){return [...registry.values()].map(x=>({name:x.name,...x.meta}));}
function resolve(name,{featureEngine,plan='starter',overrides={}}={}){const key=normalize(name);const item=registry.get(key);if(!item)return {enabled:false,reason:'capability_not_registered',name:key};const mapped=CAPABILITY_FEATURE_MAP[key];if(featureEngine&&mapped){const mask=featureEngine.featureMask(plan,overrides);if(!featureEngine.hasFeature(mask,mapped))return {enabled:false,reason:'plan_feature_not_entitled',name:key,feature:mapped,featureMask:mask};}return {enabled:true,name:key,...item.meta,dispatch:item.adapter.dispatch,health:item.adapter.health||(()=>({ok:true}))};}
async function dispatch(name,payload,opts={}){const r=resolve(name,opts);if(!r.enabled) return {ok:false,skipped:true,name:r.name,reason:r.reason};const requestId=opts.requestId||crypto.randomBytes(8).toString('hex');const out=await r.dispatch(payload,{requestId,capability:r.name,meta:r});return {ok:true,requestId,capability:r.name,result:out};}
module.exports={FEATURE_BITS,CAPABILITY_FEATURE_MAP,register,unregister,list,resolve,dispatch};
