'use strict';
/**
 * SBC V56.2 Next Architecture Layer
 * Additive, GoDaddy-safe orchestration for the second architecture drop.
 * No live vendor/network action is performed here.
 */
const crypto=require('crypto');
const EventEmitter=require('events');
const events=new EventEmitter();
events.setMaxListeners(200);
const recoveryClaims=new Map();
const RECOVERY_TTL_MS=Math.max(15*60*1000,Number(process.env.SBC_BILLING_RECOVERY_TTL_MS||7*24*60*60*1000));

function sha256(v){return crypto.createHash('sha256').update(String(v)).digest('hex');}
function stable(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return `[${v.map(stable).join(',')}]`;return `{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')}}`;}
function idempotencyKey(scope,payload){return sha256(`${scope}:${stable(payload||{})}`);}
function publish(topic,payload){const evt={id:crypto.randomUUID(),topic,payload,at:new Date().toISOString()};events.emit('event',evt);return evt;}
function subscribe(fn){events.on('event',fn);return()=>events.off('event',fn);}

function billingFriction(payload={}){
  const status=String(payload.status||payload.type||'').toLowerCase();
  if(!['invoice_failed','payment_failed','subscription_payment_failed'].includes(status) || !payload.client_email){
    return {queued:false,reason:'Not an eligible billing-friction event.'};
  }
  const claimKey=idempotencyKey('billing-recovery',{clientId:payload.client_id||payload.customer_id||'',email:String(payload.client_email).trim().toLowerCase(),amount:Number(payload.amount||payload.failed_amount||0),invoiceId:payload.invoice_id||''});
  const existing=recoveryClaims.get(claimKey);
  if(existing&&existing.expiresAt>Date.now())return {queued:false,duplicate:true,recovery:existing.recovery};
  const recovery={client_id:String(payload.client_id||payload.customer_id||''),client_email:String(payload.client_email).trim().toLowerCase(),failed_amount:Number(payload.amount||payload.failed_amount||0),invoice_id:String(payload.invoice_id||''),next_outreach_epoch:new Date(Date.now()+15*60*1000).toISOString(),channel:'approved-communications',status:'QUEUED',source:'v562-billing-friction'};
  recoveryClaims.set(claimKey,{recovery,expiresAt:Date.now()+RECOVERY_TTL_MS});
  const event=publish('billing.friction.detected',recovery);
  return {queued:true,duplicate:false,recovery,event,idempotencyKey:claimKey};
}

function optimisticTransitionSpec({leadId,targetState,allowedStates}={}){
  const id=String(leadId||'').trim();
  const target=String(targetState||'').trim();
  const states=Array.isArray(allowedStates)&&allowedStates.length?allowedStates:['Lead','Prospect','Contacted','Qualified','Proposal','Customer','Lost','Do Not Call','Closed','Duplicate','Not Qualified'];
  if(!id)throw new Error('leadId is required.');
  if(!states.includes(target))throw new Error(`Unsupported pipeline state: ${target}`);
  return {ok:true,leadId:id,targetState:target,operationId:crypto.randomUUID(),issuedAt:new Date().toISOString()};
}

function tenantRouteKey(host){
  const normalized=String(host||'').trim().toLowerCase().split(',')[0].replace(/:\d+$/,'');
  if(!normalized||normalized.length>253||/[\s/]/.test(normalized))return null;
  return `tenant-host:v1:${normalized}`;
}
function resolveTenantFromAuthoritativeMap(host,tenantMap={}){
  const key=tenantRouteKey(host);if(!key)return {ok:false,reason:'Invalid host.'};
  const hostValue=key.slice('tenant-host:v1:'.length);
  const tenant=tenantMap[hostValue];
  return tenant?{ok:true,host:hostValue,tenant}:{ok:false,host:hostValue,reason:'Host is not mapped to an authoritative tenant.'};
}

function shellViewRegistry(){return {home:'home',sales:'sales',growth:'growth',delivery:'delivery',reports:'reports'};}
function capabilities(){return {version:'56.2.0',optimisticTransitions:true,singleShellViews:true,billingRecovery:true,tenantHostRouting:true,providerSubmission:false,goDaddySafe:true};}
module.exports={billingFriction,optimisticTransitionSpec,tenantRouteKey,resolveTenantFromAuthoritativeMap,shellViewRegistry,capabilities,publish,subscribe,idempotencyKey};
