// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const crypto=require('crypto');
const VERSION='56.14.0-MONETIZATION-OPS';
const OWNER_SETTLEMENT_THRESHOLD=10000;
const PLANS=Object.freeze({
  starter:{monthlyPrice:49,leadImportsPerMonth:250,playRunsPerMonth:30,users:1,analytics:false,automations:false,customDomain:false,advancedRevenue:false},
  business:{monthlyPrice:99,leadImportsPerMonth:1000,playRunsPerMonth:100,users:3,analytics:true,automations:true,customDomain:false,advancedRevenue:false},
  professional:{monthlyPrice:149,leadImportsPerMonth:5000,playRunsPerMonth:300,users:5,analytics:true,automations:true,customDomain:true,advancedRevenue:true},
  team:{monthlyPrice:199,leadImportsPerMonth:20000,playRunsPerMonth:1000,users:10,analytics:true,automations:true,customDomain:true,advancedRevenue:true},
  enterprise:{monthlyPrice:null,leadImportsPerMonth:1000000,playRunsPerMonth:10000,users:100,analytics:true,automations:true,customDomain:true,advancedRevenue:true}
});
const FEATURES=Object.freeze({analytics:'analytics',automations:'automations',customDomain:'customDomain',advancedRevenue:'advancedRevenue'});
const ADDONS=Object.freeze({customDomain:{price:29,interval:'month'},advancedAnalytics:{price:19,interval:'month'},leadVerification:{price:15,interval:'month'},strategySession:{price:149,interval:'one_time'}});
function plan(name){return PLANS[String(name||'starter').toLowerCase()]||PLANS.starter;}
function monthKey(d=new Date()){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
function key({tenantId,metric,month=monthKey()}){return crypto.createHash('sha256').update(`${Number(__sbcRequireTenantId(tenantId))}:${String(metric)}:${month}`).digest('hex');}
function limit({planName='starter',metric}){return Number(plan(planName)[metric]||0);}
function admit({planName='starter',metric,current=0,amount=1}){const lim=limit({planName,metric});const next=Number(current||0)+Number(amount||0);return {ok:next<=lim,plan:planName,metric,current:Number(current||0),requested:Number(amount||0),next,limit:lim,overage:Math.max(0,next-lim),action:next<=lim?'ALLOW':'OVERAGE_RECORDED'};}
function feature({planName='starter',feature}){const p=plan(planName);return Boolean(p[feature]);}
function eventId({tenantId,metric,amount=1,month=monthKey(),idempotencyKey=''}){return `MON-${crypto.createHash('sha256').update(`${tenantId}:${metric}:${amount}:${month}:${idempotencyKey}`).digest('hex').slice(0,28)}`;}
function usagePercent(current,limitValue){return limitValue>0?Math.min(100,Math.round((Number(current||0)/limitValue)*100)):0;}
function settlementGate(amount){const value=Number(amount||0);if(!Number.isFinite(value)||value<0)return {ok:false,status:'INVALID_AMOUNT',amount:value};if(value>OWNER_SETTLEMENT_THRESHOLD)return {ok:false,status:'OWNER_APPROVAL_REQUIRED',amount:value,threshold:OWNER_SETTLEMENT_THRESHOLD,automationBlocked:true};return {ok:true,status:'AUTO_ALLOWED',amount:value,threshold:OWNER_SETTLEMENT_THRESHOLD,automationBlocked:false};}
function normalizePlan(name){const n=String(name||'starter').toLowerCase();return PLANS[n]?n:'starter';}
module.exports={VERSION,OWNER_SETTLEMENT_THRESHOLD,PLANS,FEATURES,ADDONS,plan,normalizePlan,monthKey,key,limit,admit,feature,eventId,usagePercent,settlementGate};
