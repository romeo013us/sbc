'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6620_LEGACY_CRM_TENANT_GUARDS';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' count '+n);return s.replace(a,b)}
function apply(root){
 const file=path.join(root,'server.js');let server=fs.readFileSync(file,'utf8');
 if(server.includes(MARKER))throw Error(MARKER+': duplicate application');
 const starts=[
  "app.post('/api/customers',auth,ownerOnly,async(req,res)=>{",
  "app.put('/api/customers/:id',auth,ownerOnly,async(req,res)=>{",
  "app.post('/api/customers/:id/account-notes',auth,async(req,res)=>{",
  "app.delete('/api/customers/:id',auth,ownerOnly,async(req,res)=>{",
  "app.post('/api/customers/bulk-delete',auth,ownerOnly,async(req,res)=>{",
  "app.post('/api/quotes',auth,ownerOnly"
 ];
 for(const start of starts)if(server.split(start).length!==2)throw Error(MARKER+': route anchor missing '+start);
 const baselineStart=starts[0];
 server=once(server,baselineStart,"// "+MARKER+": explicitly scoped legacy routes; verified v6606 SQL PATCH remains available.\nconst V6620_LEGACY_CRM=require('./enterprise/v6620-legacy-crm-tenant-guard.cjs');\n"+baselineStart,'tenant helper');
 function part(i,change){
  const a=server.indexOf(starts[i]),b=server.indexOf(starts[i+1],a+starts[i].length);
  if(a<0||b<=a)throw Error(MARKER+': route bounds '+i);
  const orig=server.slice(a,b),updated=change(orig);
  if(orig===updated)throw Error(MARKER+': no effective change '+i);
  server=server.slice(0,a)+updated+server.slice(b);
 }
 part(0,s=>once(s,
  "const dup=leadDuplicateMatches(candidate);",
  "const dup=leadDuplicateMatches(candidate).filter(m=>V6620_LEGACY_CRM.owns(m.customer,requireRequestTenant(req)));",
  'customer duplicate detection tenant scope'));
 part(1,s=>{
  s=once(s,"const c=db.customers.find(x=>x.id===req.params.id);",
   "const c=db.customers.find(x=>x.id===req.params.id&&V6620_LEGACY_CRM.owns(x,requireRequestTenant(req)));",'edit customer tenant scope');
  s=once(s,"Object.assign(c,req.body||{},{id:c.id,updatedAt:now()});",
   "const unsafe=V6620_LEGACY_CRM.validatePatch(req.body);if(unsafe)return res.status(400).json({ok:false,error:unsafe});Object.assign(c,req.body,{id:c.id,tenantId:c.tenantId,updatedAt:now()});",
   'edit whitelist and immutable tenancy');
  return s;
 });
 part(2,s=>once(s,"const c=db.customers.find(x=>x.id===req.params.id);",
 "const c=db.customers.find(x=>x.id===req.params.id&&V6620_LEGACY_CRM.owns(x,requireRequestTenant(req)));",'account note tenant scope'));
 part(3,s=>once(s,"const i=db.customers.findIndex(x=>x.id===req.params.id);",
 "const i=db.customers.findIndex(x=>x.id===req.params.id&&V6620_LEGACY_CRM.owns(x,requireRequestTenant(req)));",'delete tenant scope'));
 part(4,s=>{
  s=once(s,"const ids=Array.isArray(req.body?.ids)?",
    "const tenantId=requireRequestTenant(req);const ids=Array.isArray(req.body?.ids)?",'bulk scoped tenant');
  s=once(s,"const removed=db.customers.filter(c=>ids.includes(String(c.id)));",
    "const removed=db.customers.filter(c=>ids.includes(String(c.id))&&V6620_LEGACY_CRM.owns(c,tenantId));",'bulk tenant selection');
  s=once(s,"db.customers=db.customers.filter(c=>!ids.includes(String(c.id)));",
    "db.customers=db.customers.filter(c=>!(ids.includes(String(c.id))&&V6620_LEGACY_CRM.owns(c,tenantId)));",'bulk post-persist tenant scope');
  return s;
 });
 fs.writeFileSync(file,server);
 fs.mkdirSync(path.join(root,'enterprise'),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'v6620-legacy-crm-tenant-guard.cjs'),path.join(root,'enterprise','v6620-legacy-crm-tenant-guard.cjs'));
 const test=path.join(__dirname,'v6620-legacy-crm-tenant-guard-test.cjs');
 if(!fs.existsSync(test))throw Error(MARKER+': regression test absent');
 fs.mkdirSync(path.join(root,'scripts'),{recursive:true});
 fs.copyFileSync(test,path.join(root,'scripts','v6620-legacy-crm-tenant-guard-test.cjs'));
 return {marker:MARKER,changed:true,customerRoutes:5,nonTenantMutationsBlocked:true,immutableTenantAndIds:true,recoveryAndWriterGatesUnchanged:true};
}
module.exports={apply,MARKER};
