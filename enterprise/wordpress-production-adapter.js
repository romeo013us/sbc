'use strict';
const crypto=require('crypto');
const VERSION='1.0.0';
const BLUEPRINTS=new Set(['local_service','professional','ecommerce']);
function configured(env){return Boolean(String(env.WORDPRESS_PROVISIONER_URL||'').trim()&&String(env.WORDPRESS_PROVISIONER_SECRET||'').trim());}
function status(env){return {version:VERSION,configured:configured(env),providerUrlConfigured:Boolean(String(env.WORDPRESS_PROVISIONER_URL||'').trim()),secretConfigured:Boolean(String(env.WORDPRESS_PROVISIONER_SECRET||'').trim()),hostingApiConfigured:Boolean(String(env.WP_HOSTING_API_URL||'').trim()),policy:'Signed request -> provider -> verified response -> QA; no passwords in payloads/logs'};}
async function provision(input={},env={}){
  const payload={tenantId:String(input.tenantId||input.customerId||''),orderId:String(input.orderId||''),customerId:String(input.customerId||''),businessName:String(input.businessName||''),domain:String(input.domain||''),blueprint:BLUEPRINTS.has(String(input.blueprint))?String(input.blueprint):'local_service',assets:input.assets&&typeof input.assets==='object'?input.assets:{},correlationId:String(input.correlationId||input.orderId||input.customerId||''),requestedAt:new Date().toISOString()};
  if(!payload.tenantId||!payload.businessName||!payload.domain)return {ok:false,error:'TENANT_BUSINESS_AND_DOMAIN_REQUIRED'};
  if(!configured(env))return {ok:true,mode:'SIMULATED',status:'WAITING_EXTERNAL_PROVIDER',payload:{...payload,assets:{present:Boolean(Object.keys(payload.assets).length)}}};
  const secret=String(env.WORDPRESS_PROVISIONER_SECRET);
  const body=JSON.stringify(payload);
  const signature=crypto.createHmac('sha256',secret).update(body).digest('hex');
  const r=await fetch(String(env.WORDPRESS_PROVISIONER_URL).replace(/\/$/,''),{method:'POST',headers:{'content-type':'application/json','x-sbc-signature':signature,'x-sbc-schema':'sbc.wordpress.v1'},body,signal:AbortSignal.timeout(20000)});
  const response=await r.json().catch(()=>({}));
  return {ok:r.ok,mode:'PROVIDER',status:r.status,response,verifiedProviderResponse:Boolean(r.ok&&response&&response.status)};
}
module.exports={VERSION,configured,status,provision};
