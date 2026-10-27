// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto=require('crypto');const {AsyncLocalStorage}=require('async_hooks');
const storage=new AsyncLocalStorage();
function tenantKey(v){const n=Number(v);if(!Number.isInteger(n)||n<1)throw new Error('Invalid tenant context');return n;}
function createShadowContext({tenantId,actorId,requestId,capability}={}){const tid=tenantKey(__sbcRequireTenantId(tenantId));const aid=String(actorId||'system').slice(0,128);const rid=String(requestId||crypto.randomUUID()).slice(0,128);const cap=String(capability||'read').slice(0,80);return Object.freeze({tenantId:tid,actorId:aid,requestId:rid,capability:cap,shadowId:`shadow_${tid}_${crypto.createHash('sha256').update(`${rid}:${aid}:${cap}`).digest('hex').slice(0,16)}`});}
function runWithShadow(ctx,fn){assertContext(ctx);return storage.run(ctx,fn);}
function currentShadow(){return storage.getStore()||null;}
function requireTenant(expected){const ctx=currentShadow();if(!ctx)throw new Error('Tenant shadow context is required before database access.');assertContext(ctx,{tenantId:expected});return ctx;}
function assertContext(ctx,expected={}){if(!ctx||tenantKey(ctx.tenantId)!==tenantKey(expected.tenantId||ctx.tenantId))throw new Error('Shadow tenant context mismatch');if(expected.actorId&&String(ctx.actorId)!==String(expected.actorId))throw new Error('Shadow actor mismatch');if(expected.capability&&String(ctx.capability)!==String(expected.capability))throw new Error('Shadow capability mismatch');return true;}
function isolateArray(records,ctx,field='tenantId'){assertContext(ctx);return (Array.isArray(records)?records:[]).filter(x=>Number(x?.[field]||ctx.tenantId)===ctx.tenantId);}
function tenantWhere(ctx,field='tenant_id'){assertContext(ctx);return {sql:`${field} = ?`,params:[ctx.tenantId]};}
module.exports={createShadowContext,runWithShadow,currentShadow,requireTenant,assertContext,isolateArray,tenantWhere};
