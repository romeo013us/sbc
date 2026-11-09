'use strict';
/**
 * SBC Fulfillment 2.0 — deterministic, read-only service blueprint compiler.
 * Explicit catalog service codes only. This module makes no purchases, sends
 * no messages, performs no provisioning, and never decides payment validity.
 * It describes work that a durable worker may execute after verified payment.
 */
const VERSION = '2.0.0-preview';
const SERVICE_STEPS = Object.freeze({
  office_box: [
    ['collect_account', 'customer', 'Confirm account and business information', []],
    ['provision_access', 'automation', 'Activate purchased Office Box entitlement', ['collect_account']],
    ['verify_access', 'automation', 'Confirm access works using provider evidence', ['provision_access']],
    ['deliver', 'automation', 'Send activation details and update customer portal', ['verify_access']]
  ],
  starter_website: [
    ['collect_brief', 'customer', 'Collect business details and website content', []],
    ['domain_preflight', 'automation', 'Check domain availability and price', ['collect_brief']],
    ['domain_purchase_approval', 'owner', 'Approve actual domain and hosting charge', ['domain_preflight']],
    ['provision', 'adapter_or_specialist', 'Provision domain and website hosting', ['domain_purchase_approval']],
    ['build', 'specialist', 'Build one-page website from approved brief', ['provision']],
    ['quality_check', 'automation', 'Check HTTPS, DNS, mobile layout and working contacts', ['build']],
    ['launch', 'specialist', 'Publish and verify website with customer', ['quality_check']]
  ],
  business_cards: [
    ['collect_print_specs', 'customer', 'Collect contact details, quantity, finish and shipping address', []],
    ['generate_proof', 'adapter_or_specialist', 'Prepare production-ready card artwork', ['collect_print_specs']],
    ['proof_approval', 'customer', 'Approve exact artwork and printing details', ['generate_proof']],
    ['get_vendor_quote', 'adapter_or_specialist', 'Obtain actual print cost and delivery quote', ['proof_approval']],
    ['vendor_purchase_approval', 'owner', 'Approve wholesale charge and final margin', ['get_vendor_quote']],
    ['submit_order', 'adapter_or_specialist', 'Place supplier order and capture verified receipt', ['vendor_purchase_approval']],
    ['track', 'automation', 'Track actual supplier status and shipping', ['submit_order']],
    ['confirm_delivery', 'automation', 'Verify delivery and inform customer', ['track']]
  ],
  google_business_profile: [
    ['collect_profile', 'customer', 'Collect approved business details, evidence and authorization', []],
    ['prepare_profile', 'adapter_or_specialist', 'Prepare business profile with approved data', ['collect_profile']],
    ['verification', 'customer', 'Complete required Google ownership or verification steps', ['prepare_profile']],
    ['verify_listing', 'specialist', 'Verify public listing and customer access', ['verification']]
  ],
  managed_wordpress: [
    ['collect_site', 'customer', 'Collect approved site brief and administrator details', []],
    ['review_cost', 'owner', 'Approve actual hosting and license expenses', ['collect_site']],
    ['provision_wp', 'adapter_or_specialist', 'Provision WordPress and HTTPS', ['review_cost']],
    ['configure', 'specialist', 'Build and configure the customer website', ['provision_wp']],
    ['qa_wp', 'automation', 'Verify site health, backups and access', ['configure']],
    ['handoff', 'specialist', 'Review site with customer and complete handoff', ['qa_wp']]
  ],
  microsoft_365: [
    ['collect_m365', 'customer', 'Collect verified domain, user and mailbox requirements', []],
    ['approve_license', 'owner', 'Approve current license cost', ['collect_m365']],
    ['provision_m365', 'adapter_or_specialist', 'Provision verified Microsoft 365 license and mailbox', ['approve_license']],
    ['validate_m365', 'automation', 'Verify domain records and sign-in', ['provision_m365']],
    ['handoff_m365', 'specialist', 'Securely transfer access and recovery information', ['validate_m365']]
  ]
});
function error(code){return Object.assign(new Error(code),{code})}
function cleanId(v){const s=String(v??'');return /^[A-Za-z0-9._:-]{1,120}$/.test(s)?s:null}
function compile({tenantId,orderId,sku,services}={}){
  const t=Number(tenantId),oid=cleanId(orderId),product=cleanId(sku);
  if(!Number.isSafeInteger(t)||t<1||!oid||!product)throw error('FULFILLMENT_IDENTITY_REQUIRED');
  if(!Array.isArray(services)||services.length===0)return {version:VERSION,tenantId:t,orderId:oid,sku:product,status:'NEEDS_CATALOG_MAPPING',steps:[],executionAllowed:false};
  if(services.length>30)throw error('FULFILLMENT_TOO_MANY_LINES');
  const invalid=services.filter(s=>!s||typeof s!=='object'||!Object.hasOwn(SERVICE_STEPS,s.code)||!Number.isSafeInteger(Number(s.quantity??1))||Number(s.quantity??1)<1||Number(s.quantity??1)>10000);
  if(invalid.length)return {version:VERSION,tenantId:t,orderId:oid,sku:product,status:'NEEDS_CATALOG_MAPPING',unmappedCodes:invalid.map(s=>String(s?.code??'').slice(0,80)),steps:[],executionAllowed:false};
  const steps=[];
  const sharedIntake=services.length>1;
  if(sharedIntake)steps.push({id:'shared_customer_intake',serviceCode:'shared',line:0,quantity:1,lane:'customer',description:'Confirm customer and business contact details once for the entire package',dependsOn:[],status:'PLANNED'});
  for(let i=0;i<services.length;i++){
    const item=services[i],prefix='line'+(i+1)+'_'+item.code;
    for(const [key,lane,description,previous] of SERVICE_STEPS[item.code]){
      steps.push({id:prefix+'_'+key,serviceCode:item.code,line:i+1,quantity:Number(item.quantity??1),lane,description,dependsOn:previous.length?previous.map(k=>prefix+'_'+k):sharedIntake?['shared_customer_intake']:[],status:'PLANNED'});
    }
  }
  return {version:VERSION,tenantId:t,orderId:oid,sku:product,status:'PLANNED',steps,executionAllowed:false,
    notice:'Execution requires verified payment, server-authorized vendor actions, and a durable task runner. This is a read-only work plan.'};
}
module.exports={VERSION,SERVICE_STEPS,compile};
