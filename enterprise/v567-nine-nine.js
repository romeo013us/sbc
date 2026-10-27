// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
/**
 * SBC V56.7 — 9.9 Production Hardening Layer
 * Bounded, additive controls over V56.6.
 */
const crypto=require('crypto');
const VERSION='56.9.2';
// Historical engine VERSION is preserved for rollback/test compatibility.
// The active package release is validated explicitly here rather than forcing
// every newer additive release to masquerade as V56.9.2/V56.10.
const ACTIVE_PACKAGE_RELEASE='66.0.0'; /* Historical compatibility marker: ACTIVE_PACKAGE_RELEASE='60.4.5'. */
// V56.25.3 is the active consolidated production release. Older releases remain rollback-compatible.
// Older V56.13.1 remains a supported rollback release.
const COMPATIBLE_PACKAGE_RELEASES=Object.freeze(new Set(['66.0.0','65.1.66','65.1.64',VERSION,ACTIVE_PACKAGE_RELEASE,'60.1.2','60.3.0','60.1.1','60.1.0','60.0.0','58.3.0','56.25.0','56.24.2','56.22.0','56.23.0','56.21.0','56.20.0','56.18.0','56.17.0','56.16.0','56.15.0','56.14.0','56.13.3','56.13.1']));
const OWNER_THRESHOLD=10000;
const ORDER_STATES=Object.freeze(['CREATED','PAYMENT_PENDING','PAID','OWNER_REVIEW','FULFILLMENT_QUEUED','PROVIDER_SUBMITTED','IN_PRODUCTION','SHIPPED','COMPLETED','PAYMENT_FAILED','PROVIDER_FAILED','MANUAL_HOLD','CANCELLED','REFUNDED']);
const TRANSITIONS=Object.freeze({
  CREATED:['PAYMENT_PENDING','CANCELLED'],
  PAYMENT_PENDING:['PAID','PAYMENT_FAILED','CANCELLED'],
  PAID:['OWNER_REVIEW','FULFILLMENT_QUEUED','REFUNDED','CANCELLED'],
  OWNER_REVIEW:['FULFILLMENT_QUEUED','MANUAL_HOLD','CANCELLED'],
  FULFILLMENT_QUEUED:['PROVIDER_SUBMITTED','PROVIDER_FAILED','MANUAL_HOLD'],
  PROVIDER_SUBMITTED:['IN_PRODUCTION','PROVIDER_FAILED','MANUAL_HOLD'],
  IN_PRODUCTION:['SHIPPED','PROVIDER_FAILED','MANUAL_HOLD'],
  SHIPPED:['COMPLETED','PROVIDER_FAILED'],
  COMPLETED:['REFUNDED'],
  PAYMENT_FAILED:['PAYMENT_PENDING','CANCELLED'],
  PROVIDER_FAILED:['FULFILLMENT_QUEUED','MANUAL_HOLD'],
  MANUAL_HOLD:['OWNER_REVIEW','FULFILLMENT_QUEUED','CANCELLED'],
  CANCELLED:[],REFUNDED:[]
});
const DUNNING=Object.freeze({PAYMENT_FAILED:'PAYMENT_FAILED',GRACE_PERIOD:'GRACE_PERIOD',REMINDER_1:'REMINDER_1',REMINDER_2:'REMINDER_2',FINAL_NOTICE:'FINAL_NOTICE',PAST_DUE:'PAST_DUE',SUSPENDED:'SUSPENDED',RESTORED:'RESTORED'});
const PROVIDER_CONTRACT_VERSION='1.0';
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
function releaseIdentity(pkg){const packageVersion=String(pkg?.version||'').trim();const compatible=COMPATIBLE_PACKAGE_RELEASES.has(packageVersion)||/^56\.10\./.test(packageVersion);if(!compatible)throw new Error(`RELEASE_IDENTITY_MISMATCH package=${packageVersion} expected ${ACTIVE_PACKAGE_RELEASE} (or supported rollback release)`);return {version:ACTIVE_PACKAGE_RELEASE,packageVersion,status:'VALID'};}
function transitionOrder(current,next){const from=String(current||'CREATED').toUpperCase(),to=String(next||'').toUpperCase();if(!ORDER_STATES.includes(from)||!ORDER_STATES.includes(to))throw new Error('INVALID_ORDER_STATE');if(from===to)return {ok:true,from,to,idempotent:true};if(!(TRANSITIONS[from]||[]).includes(to))throw new Error(`ILLEGAL_ORDER_TRANSITION:${from}->${to}`);return {ok:true,from,to,idempotent:false};}
function ownerGate(amount){const value=Number(amount||0);return {amount:value,threshold:OWNER_THRESHOLD,requiresOwnerSignature:value>=OWNER_THRESHOLD,automationAllowed:value<OWNER_THRESHOLD};}
function revenueHarness({paymentValid=true,duplicate=false,amount=0,providerReady=true,providerResult='PROVIDER_SUBMITTED'}={}){if(!paymentValid)return {status:'PAYMENT_REJECTED',safe:true};if(duplicate)return {status:'DUPLICATE_IGNORED',safe:true};const gate=ownerGate(amount);if(gate.requiresOwnerSignature)return {status:'OWNER_CLEARANCE_REQUIRED',safe:true,gate};if(!providerReady)return {status:'STAGED_PROVIDER_UNAVAILABLE',safe:true,gate};return {status:providerResult, safe:['PROVIDER_SUBMITTED','IN_PRODUCTION'].includes(providerResult),gate};}
function tenantScope({tenantId,table,operation='read'}={}){const id=Number(tenantId);if(!Number.isSafeInteger(id)||id<1)throw new Error('TENANT_CONTEXT_REQUIRED');const allowed=/^[a-zA-Z0-9_]+$/.test(String(table||''));if(!allowed)throw new Error('INVALID_TABLE_IDENTIFIER');return {tenantId:id,table:String(table),operation:String(operation),policy:'TENANT_REQUIRED',enforcement:'application+query-boundary'};}
function observabilityEvent({automation,runId,status,reason='',details={}}={}){return {version:VERSION,automation:clean(automation,120),runId:clean(runId||crypto.randomUUID(),120),status:clean(status||'UNKNOWN',40),reason:clean(reason,240),details,at:new Date().toISOString()};}
function kimDecision({action,reason,evidence={},risk='LOW',reversible=true,ownerRequired=false,result='PLANNED'}={}){return {version:VERSION,decisionId:`KIM-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,agent:'kim',action:clean(action,120),reason:clean(reason,500),evidence,risk,reversible,ownerRequired,result,at:new Date().toISOString()};}
function dunningPlan({customerId,invoiceId,amount,email='',phone='',status='PAYMENT_FAILED'}={}){const state=String(status).toUpperCase();const eligible=state==='PAYMENT_FAILED'||state==='PAST_DUE';return {version:VERSION,customerId:clean(customerId,100),invoiceId:clean(invoiceId,160),amount:Number(amount||0),email:clean(email,320),phone:clean(phone,80),state:eligible?DUNNING.GRACE_PERIOD:DUNNING.RESTORED,next:eligible?DUNNING.REMINDER_1:DUNNING.RESTORED,channels:{email:Boolean(email),sms:Boolean(phone)},eligible};}
function providerContract(provider){const p=clean(provider,100).toUpperCase();return {version:VERSION,provider:p,contractVersion:PROVIDER_CONTRACT_VERSION,required:['validate','submit','status'],liveSubmission:false,status:'STAGED_ONLY',reason:'Live execution requires an explicitly registered adapter and verified provider contract.'};}
function releaseCertificate({tests={},guardian='PASS',rollback='READY',database='PASS',revenue='PASS'}={}){const body={version:VERSION,guardian,rollback,database,revenue,tests,generatedAt:new Date().toISOString()};return {...body,certificateId:`REL-${VERSION}-${sha(body).slice(0,16)}`,certification:Object.values(tests).every(v=>v==='PASS')&&[guardian,database,revenue].every(v=>v==='PASS') && ['PASS','READY'].includes(rollback)?'9.9_READY':'NOT_CERTIFIED'};}
function batchLedger(input={}){return {version:VERSION,batchId:clean(input.batchId||`LD-${Date.now()}`,100),filename:clean(input.filename,180),tenantId:Number(__sbcRequireTenantId(input.tenantId)),submittedBy:clean(input.submittedBy||'system',100),rowsReceived:Number(input.rowsReceived||0),rowsValid:Number(input.rowsValid||0),duplicates:Number(input.duplicates||0),invalid:Number(input.invalid||0),hot:Number(input.hot||0),warm:Number(input.warm||0),cold:Number(input.cold||0),status:clean(input.status||'RECEIVED',40),createdAt:new Date().toISOString()};}
module.exports={VERSION,OWNER_THRESHOLD,ORDER_STATES,TRANSITIONS,DUNNING,releaseIdentity,transitionOrder,ownerGate,revenueHarness,tenantScope,observabilityEvent,kimDecision,dunningPlan,providerContract,releaseCertificate,batchLedger};
