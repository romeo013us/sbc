// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const id=p=>`${p}_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);

/**
 * V56.10.2 — Wholesale Trade API Gasket.
 * This is deliberately a gasket, not a guessed vendor API implementation.
 * Provider execution is permitted only when an account-specific endpoint,
 * credential and explicit auto-execution flag already exist.
 */
class StatelessFulfillmentGateway{
  constructor(config={}){
    this.routesPath=config.routesPath||path.join(__dirname,'../config/vendor-bidding-routes.json');
    this.env=config.env||process.env;
  }
  routes(){try{return JSON.parse(fs.readFileSync(this.routesPath,'utf8')).vendors||[]}catch{return []}}
  candidate(provider){
    const wanted=String(provider||'').toLowerCase();
    const rows=this.routes().filter(v=>v.status==='active'&&Number(v.slaScore)>=0.90&&v.allowlisted!==false);
    return rows.find(v=>String(v.name||'').toLowerCase().includes(wanted))||null;
  }
  readiness(provider='4over4'){
    const p=String(provider||'').toLowerCase();
    if(p!=='4over4'&&p!=='fouroverfour')return {provider,status:'UNSUPPORTED',liveSubmission:false};
    const endpoint=clean(this.env.FOUROVER4_ORDER_ENDPOINT||this.env.FOUR_OVER_FOUR_API_URL||'',1000);
    const key=clean(this.env.FOUROVER4_API_KEY||this.env.FOUROVER4_API_TOKEN||'',1000);
    const auto=String(this.env.SBC_FOUROVER4_AUTO_EXECUTE||'').toLowerCase()==='true';
    return {provider:'4over4',endpointConfigured:Boolean(endpoint),credentialConfigured:Boolean(key),autoExecution:auto,liveSubmission:Boolean(endpoint&&key&&auto),candidate:this.candidate('4over4')?.name||'4OVER4 account route not configured'};
  }
  buildDispatchPlan(job,provider='4over4'){
    const r=this.readiness(provider);
    if(!r.liveSubmission)return {ok:false,status:r.endpointConfigured&&r.credentialConfigured?'OWNER_ACTIVATION_REQUIRED':'WAITING_VENDOR_CONTRACT',provider:r.provider,readiness:r,requiresProviderActivation:true,jobId:job?.id||''};
    if(!job?.id||!job?.orderId)throw new Error('Wholesale gasket requires a durable fulfillment job and order id.');
    return {ok:true,status:'READY_TO_DISPATCH',provider:'4over4',endpoint:this.env.FOUROVER4_ORDER_ENDPOINT||this.env.FOUR_OVER_FOUR_API_URL,idempotencyKey:clean(job.idempotencyKey||`sbc:${job.id}`,200),payload:{schema:'sbc.vendor-order.v1',jobId:clean(job.id,120),orderId:clean(job.orderId,120),tenantId:Number(__sbcRequireTenantId(job.tenantId)),product:clean(job.product,255),quantity:Number(job.quantity||1),requirements:job.requirements||{},artwork:job.artwork||null}};
  }
  async dispatchToVendor(job,provider='4over4'){
    const plan=this.buildDispatchPlan(job,provider);
    if(!plan.ok)return plan;
    const response=await fetch(plan.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${this.env.FOUROVER4_API_KEY||this.env.FOUROVER4_API_TOKEN}`,'Idempotency-Key':plan.idempotencyKey,'X-SBC-Contract':'sbc.vendor-order.v1'},body:JSON.stringify(plan.payload),signal:AbortSignal.timeout(Number(this.env.SBC_VENDOR_TIMEOUT_MS||30000))});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||data.error||`4OVER4 returned HTTP ${response.status}`);
    return {ok:true,status:'SUBMITTED',provider:'4over4',vendorOrderNumber:data.orderNumber||data.order_id||data.id||'',trackingNumber:data.trackingNumber||data.tracking_number||'',rawStatus:response.status};
  }
  async routeStatelessOrder(order){
    const eligible=this.routes().filter(v=>v.status==='active'&&Number(v.slaScore)>=0.90&&v.allowlisted!==false);
    if(!eligible.length)return {success:false,status:'NO_ELIGIBLE_VENDOR',requiresHuman:true};
    eligible.sort((a,b)=>Number(a.baseCostPerUnit)-Number(b.baseCostPerUnit));
    const v=eligible[0];
    return {success:true,status:'ROUTED_CANDIDATE',vendor:v.name,wholesaleCostCents:Math.round(Number(v.baseCostPerUnit)*100),trackingToken:id('TRK'),providerDispatch:false,requiresProviderActivation:true,orderId:order.orderId};
  }
}
module.exports=StatelessFulfillmentGateway;
