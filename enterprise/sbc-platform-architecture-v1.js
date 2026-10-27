'use strict';
/**
 * SBC Platform Architecture V1
 * Command Center = SBC control plane. Office Box = customer operating environment.
 * Shared services connect them through explicit, tenant-scoped contracts.
 */
const crypto = require('crypto');
const VERSION = '1.0.0';
const PROTECTED = [
  'credentials_and_secrets', 'owner_security', 'pricing_catalog_tax_discounts',
  'refunds_and_payment_overrides', 'permanent_deletion', 'destructive_infrastructure'
];
const COMMAND_CENTER = [
  'kim_steward', 'production_open_gate', 'observability', 'schema_migrations',
  'audit', 'global_crm', 'lead_research', 'lead_verification', 'acquisition',
  'demo_builder', 'outreach_orchestration', 'payments', 'fulfillment',
  'workforce', 'revenue_intelligence', 'system_diagnostics', 'system_improvement',
  'deployment_recovery', 'owner_controls'
];
const OFFICE_BOX = [
  'customer_dashboard', 'customer_website', 'domain', 'business_email',
  'customer_contacts', 'appointments', 'quotes', 'invoices_payments',
  'customer_orders', 'documents', 'marketing', 'qr_codes', 'print_orders',
  'customer_communications', 'support', 'analytics', 'customer_ai'
];
const SHARED_SERVICES = [
  'identity', 'billing', 'domain_provisioning', 'hosting', 'email',
  'customer_provisioning', 'demo_deployment', 'fulfillment', 'notifications', 'analytics'
];
function id(prefix='arch'){ return `${prefix}_${crypto.randomUUID()}`; }
function clean(v,n=255){ return String(v ?? '').trim().slice(0,n); }
function topology(){
  return {
    version: VERSION,
    model: 'command-center-plus-office-box',
    commandCenter: { role:'SBC_CONTROL_PLANE', owns:COMMAND_CENTER, globalScope:true },
    officeBox: { role:'CUSTOMER_OPERATING_ENVIRONMENT', owns:OFFICE_BOX, tenantScoped:true },
    sharedServices: SHARED_SERVICES,
    protectedBoundaries: PROTECTED,
    rule: 'One SBC control plane, many tenant-scoped Office Box environments. Do not duplicate internal SBC controls into customer tenants.'
  };
}
function officeBoxCapabilities(role='customer'){
  const allowed = new Set(OFFICE_BOX);
  if(role === 'owner' || role === 'manager') allowed.add('customer_support_admin');
  return { version:VERSION, role, tenantScoped:true, capabilities:[...allowed], denied:['global_crm','steward_edit','schema_migrations','global_fulfillment_admin','owner_security','other_tenants_data','deployment_controls'] };
}
function validateBoundary(target, capability){
  const t=String(target||'').toLowerCase();
  const c=String(capability||'').toLowerCase();
  if(t==='office-box' && (c.includes('global')||c.includes('steward')||c.includes('migration')||c.includes('owner_security')||c.includes('deploy'))) return {allowed:false,reason:'Command Center-only capability cannot cross into Office Box tenant scope.'};
  return {allowed:true,reason:'Capability is within declared platform boundary.'};
}
function provisioningPlan({tenantId,customerId,businessName,packageName='',source='command-center'}={}){
  if(!tenantId || !customerId || !businessName) throw new Error('tenantId, customerId and businessName are required.');
  return {
    id:id('provision'), schema:'sbc.office-box.provisioning.v1', version:VERSION,
    tenantId:String(tenantId), customerId:clean(customerId,100), businessName:clean(businessName,180), packageName:clean(packageName,120),
    source:clean(source,80), createdAt:new Date().toISOString(),
    stages:['identity','customer_workspace','website','domain','business_email','billing','analytics','support'],
    mode:'plan-only-until-provider-confirmed',
    requiresHumanFor:['pricing_override','refund','credential_change','destructive_delete']
  };
}
module.exports={VERSION,PROTECTED,COMMAND_CENTER,OFFICE_BOX,SHARED_SERVICES,topology,officeBoxCapabilities,validateBoundary,provisioningPlan,id};
