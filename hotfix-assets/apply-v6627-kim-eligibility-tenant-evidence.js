'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6627_KIM_ELIGIBILITY_TENANT_EVIDENCE';
function strictVerified(c){
 const status=String(c?.verificationStatus||'').trim().toLowerCase().replace(/[-_]+/g,' ').replace(/\s+/g,' ');
 return ['verified','passed','sales ready'].includes(status)||(status===''&&c?.verified===true);
}
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' anchor count '+n);return s.replace(a,b);}
function apply(root){
 const file=path.join(root,'enterprise','v56135-kim-mission-controller.js');
 const serverFile=path.join(root,'server.js');
 let kim=fs.readFileSync(file,'utf8'),server=fs.readFileSync(serverFile,'utf8');
 if(kim.includes(MARKER)||server.includes(MARKER))throw Error(MARKER+': duplicate patch');
 kim=once(kim,'function eligible(c){',strictVerified.toString()+'\nfunction eligible(c){','insert exact verified checker');
 kim=once(kim,
  "  return (verification.includes('verified')||verification==='passed'||c.verified===true) && (temp==='warm'||temp==='hot');",
  "  return strictVerified(c) && (temp==='warm'||temp==='hot'); // "+MARKER+": 'unverified' must never count as verified",
  'unsafe substring verification');
 kim=once(kim,
  "tenantId:customer.tenantId||1,interactionData",
  "tenantId:Number(customer.tenantId),interactionData",
  'remove implicit tenant-one Kim mission fallback');
 kim=once(kim,
  "    if(!customer)throw new Error('Customer is required.');",
  "    if(!customer)throw new Error('Customer is required.');\n    if(!Number.isSafeInteger(Number(customer.tenantId))||Number(customer.tenantId)<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});",
  'tenant must be validated before any Kim mission state mutation');
 kim=once(kim,
  "function suppressed(c){return c?.doNotContact===true||c?.salesSuppressed===true||String(c?.status||'').toLowerCase()==='do not contact';}",
  "function suppressed(c){const s=String(c?.status||'').trim().toLowerCase();return c?.doNotContact===true||c?.doNotCall===true||c?.salesSuppressed===true||c?.optedOut===true||c?.isSuppressed===true||['do not contact','do not call','opt out','unsubscribe','lost','closed','duplicate'].includes(s);}",
  'honor explicit opt-out and terminal statuses');
 kim=once(kim,
  "  const all=(Array.isArray(db?.customers)?db.customers:[]).filter(c=>Number(c?.tenantId)===scopedId);",
  "  const raw=Array.isArray(db?.customers)?db.customers:[];\n  const unresolvedTenantRecords=raw.filter(c=>c&&(c.tenantId===null||c.tenantId===undefined||String(c.tenantId).trim()==='')).length;\n  const all=raw.filter(c=>Number(c?.tenantId)===scopedId);\n  const warmHot=all.filter(c=>['warm','hot'].includes(String(c?.leadTemperature||'').trim().toLowerCase()));",
  'explain tenant and eligibility mismatch without assigning tenant');
 kim=once(kim,
  "  return {ok:true,advisoryOnly:true,tenantId:scopedId,tenantCustomers:all.length,",
  "  return {ok:true,advisoryOnly:true,tenantId:scopedId,tenantCustomers:all.length,tenantWarmHot:warmHot.length,unresolvedTenantRecords,",
  'emit aggregate tenant reconciliation counts');
 const old="tenantCustomers:result?.tenantCustomers||0,qualifiedWarmHot:result?.qualifiedWarmHot||0";
 const newer="tenantCustomers:result?.tenantCustomers||0,tenantWarmHot:result?.tenantWarmHot||0,unresolvedTenantRecords:result?.unresolvedTenantRecords||0,qualifiedWarmHot:result?.qualifiedWarmHot||0";
 server=once(server,old,newer,'Kim advisory aggregate report');
 if(!server.includes('SBC_RUNTIME_WRITER_LEASE_REQUIRED')||!server.includes('MYSQL_RECOVERY_REQUIRED'))throw Error(MARKER+': core recovery/writer invariant missing');
 fs.writeFileSync(file,kim);fs.writeFileSync(serverFile,server);
 return {marker:MARKER,changed:true,crmWrites:false,verifiedSubstringRemoved:true,missingTenantNotAssigned:true,existingGatesPreserved:true};
}
module.exports={apply,MARKER,strictVerified};