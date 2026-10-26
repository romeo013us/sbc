'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6660_WEBSITE_BRIDGE_TENANT_SECURITY';
function once(s,a,b,label){
 const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' expected one anchor got '+n);
 return s.replace(a,b);
}
function patchServer(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate install');
 s=once(s,'function requireMappedRequestTenant(req){',
  "// "+MARKER+": signed server-to-server website identity required for public customer mutations.\n"+
  "const SBC_V6660_BRIDGE=require('./enterprise/v6660-website-bridge.cjs');\n"+
  "function sbcVerifiedWebsiteTenant(req){const v=SBC_V6660_BRIDGE.verify(req,{key:process.env.SBC_WEBSITE_BRIDGE_KEY});if(!v.ok)throw Object.assign(Error(v.code),{code:v.code,status:403});const m=V569_PRODUCTION_EXPANSION.tenantFromHost(v.host);if(!m.ok)throw Object.assign(Error('SITE_BRIDGE_TENANT_UNMAPPED'),{code:'SITE_BRIDGE_TENANT_UNMAPPED',status:403});return Number(m.tenantId);}\n"+
  'function requireMappedRequestTenant(req){','register signed website helper');
 s=once(s,
  "  const tenantResolution=V569_PRODUCTION_EXPANSION.tenantFromHost(req?.headers?.host||req?.hostname||'');\n  if(!tenantResolution?.ok)return res.status(403).json({ok:false,error:'This website host is not mapped to an SBC tenant.'});\n  const tenantId=Number(tenantResolution.tenantId);",
  "  let tenantId;try{tenantId=sbcVerifiedWebsiteTenant(req)}catch(e){return res.status(403).json({ok:false,code:e.code||'SITE_BRIDGE_UNAUTHORIZED'});}",
  'web lead tenant cannot come from hosting domain or spoofable Host');
 s=once(s,
  "app.post('/api/portal/register',rateLimit(),async(req,res)=>{\n  const b=req.body||{}",
  "app.post('/api/portal/register',rateLimit(),async(req,res)=>{\n  let websiteTenant;try{websiteTenant=sbcVerifiedWebsiteTenant(req)}catch(e){return res.status(403).json({ok:false,code:e.code||'SITE_BRIDGE_UNAUTHORIZED'});}\n  const b=req.body||{}",
  'signed portal registration');
 s=once(s,
  "  let tenantId;try{tenantId=requireMappedRequestTenant(req)}catch(e){return res.status(403).json({ok:false,error:e.code||'TENANT_CONTEXT_REQUIRED',message:e.message})}\n  const c=findOrCreatePortalCustomer({...b,email,tenantId});",
  "  const tenantId=websiteTenant;\n  // A self-registered email must not claim an existing CRM lead's data without verification.\n  if((db.customers||[]).some(x=>Number(x.tenantId)===tenantId&&String(x.email||'').trim().toLowerCase()===email))return res.status(409).json({ok:false,error:'An SBC customer record exists. Contact SBC to activate your account securely.'});\n  const c=findOrCreatePortalCustomer({...b,email,tenantId});",
  'prevent existing CRM profile takeover at registration');
 s=once(s,
  "app.post('/api/portal/login',rateLimit(),async(req,res)=>{\n  const email=",
  "app.post('/api/portal/login',rateLimit(),async(req,res)=>{\n  let websiteTenant;try{websiteTenant=sbcVerifiedWebsiteTenant(req)}catch(e){return res.status(403).json({ok:false,code:e.code||'SITE_BRIDGE_UNAUTHORIZED'});}\n  const email=",
  'signed portal login');
 s=once(s,
  "  const a=(db.customerAccounts||[]).find(x=>String(x.email||'').toLowerCase()===email&&x.active!==false);",
  "  const a=(db.customerAccounts||[]).find(x=>String(x.email||'').toLowerCase()===email&&x.active!==false&&(db.customers||[]).some(c=>c.id===x.customerId&&Number(c.tenantId)===websiteTenant));",
  'authenticate account within signed tenant only');
 s=once(s,
  "  a.lastLoginAt=now();await saveData();const c=(db.customers||[]).find(x=>x.id===a.customerId);if(!c)return res.status(404).json({error:'Customer profile not found.'});res.json({ok:true,token:makePortalToken(a),customer:portalSafeCustomer(c)});",
  "  const c=(db.customers||[]).find(x=>x.id===a.customerId&&Number(x.tenantId)===websiteTenant);if(!c)return res.status(401).json({error:'Email or password is incorrect.'});a.lastLoginAt=now();await saveData();res.json({ok:true,token:makePortalToken(a),customer:portalSafeCustomer(c)});",
  'login tenant verified before last-login mutation');
 const staffScope="function sbcPortalStaffScope(req,res,next){if(String(req.user?.role||'')!=='owner')return res.status(403).json({ok:false,code:'PORTAL_STAFF_OWNER_REQUIRED'});try{req.sbcPortalStaffTenant=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'})}next()}\n";
 s=once(s,
  '// Internal portal controls: authenticated SBC staff can inspect and message customers. No price or permanent-delete mutations.',
  '// Internal portal controls: owner only, plus authenticated selected tenant.\n'+staffScope,
  'owner tenant scope for staff portal');
 s=once(s,
  "app.get('/api/portal/admin-summary',auth,(req,res)=>{const accounts=(db.customerAccounts||[]).filter(a=>a.active!==false)",
  "app.get('/api/portal/admin-summary',auth,sbcPortalStaffScope,(req,res)=>{const ownIds=new Set((db.customers||[]).filter(c=>Number(c.tenantId)===req.sbcPortalStaffTenant).map(c=>String(c.id)));const accounts=(db.customerAccounts||[]).filter(a=>a.active!==false&&ownIds.has(String(a.customerId)))",
  'tenant-limited staff account list');
 s=once(s,
  "const messages=(db.customerMessages||[]).filter(m=>m.senderType==='customer'&&!m.readAt).slice(-200)",
  "const messages=(db.customerMessages||[]).filter(m=>m.senderType==='customer'&&!m.readAt&&ownIds.has(String(m.customerId))).slice(-200)",
  'tenant-limited unread message list');
 for(const [method,route] of [
  ['get','/api/portal/internal/:customerId'],['post','/api/portal/internal/:customerId/message'],['post','/api/portal/internal/:customerId/invite']]){
  const a="app."+method+"('"+route+"',auth,";
  s=once(s,a,"app."+method+"('"+route+"',auth,sbcPortalStaffScope,",'scope '+route);
  const b="app."+method+"('"+route+"',auth,sbcPortalStaffScope,async(req,res)=>{const c=(db.customers||[]).find(x=>x.id===req.params.customerId);";
  const c="app."+method+"('"+route+"',auth,sbcPortalStaffScope,async(req,res)=>{const c=(db.customers||[]).find(x=>x.id===req.params.customerId&&Number(x.tenantId)===req.sbcPortalStaffTenant);";
  s=once(s,b,c,'tenant-filter '+route);
 }
 new vm.Script(s,{filename:'server.js'});
 return s;
}
function apply(root){
 const server=path.join(root,'server.js');
 const helperSource=path.join(__dirname,'../enterprise/v6660-website-bridge.cjs');
 const helperTarget=path.join(root,'enterprise/v6660-website-bridge.cjs');
 if(!fs.existsSync(server)||!fs.existsSync(helperSource))throw Error(MARKER+': source files missing');
 const patched=patchServer(fs.readFileSync(server,'utf8'));
 new vm.Script(fs.readFileSync(helperSource,'utf8'),{filename:helperSource});
 fs.copyFileSync(helperSource,helperTarget);fs.writeFileSync(server,patched);
 return {marker:MARKER,files:['server.js','enterprise/v6660-website-bridge.cjs'],noCustomerWrites:true};
}
module.exports={MARKER,patchServer,apply};