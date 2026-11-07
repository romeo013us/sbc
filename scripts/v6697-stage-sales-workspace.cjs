'use strict';
/* V66.97 stage-only server patch; never changes live customer records. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V6697_CALLER_WORKSPACE';
function replaceOnce(input,needle,newValue,label){
 const n=input.split(needle).length-1;
 if(n!==1)throw new Error('V6697_ANCHOR_'+label+':'+n);
 return input.replace(needle,newValue);
}
function patchServer(input){
 let s=String(input||'');if(s.includes(MARK))return s;
 const routes=[
 "// SBC_V6697_CALLER_WORKSPACE: owner preview is read-only; no session impersonation.",
 "const SBC_SALES_PROJECTION_V6697=require('./enterprise/sales-caller-workspace-v6697.cjs');",
 "app.get('/api/sales-caller/workspace',auth,(req,res)=>{",
 " res.setHeader('Cache-Control','private, no-store');",
 " try{",
 "  const tenantId=requireRequestTenant(req);",
 "  const previewUserId=req.user.role==='owner'?String(req.query?.previewUserId||'').slice(0,120):'';",
 "  const data=SBC_SALES_PROJECTION_V6697.workspace({",
 "   users:db.users||[],actor:req.user,previewUserId,tenantId,customers:db.customers||[],",
 "   reports:db.callReports||[],timeEntries:v9data().timeEntries||[],",
 "   certifications:v9data().certifications||{},onboarding:v9data().onboarding||{},",
 "   canLiveCall:v9CanLiveCall",
 "  });",
 "  return res.json(data);",
 " }catch(e){return res.status(Number(e.status)||403).json({ok:false,error:String(e.message||'WORKSPACE_UNAVAILABLE')});}",
 "});",
 ""].join('\n');
 s=replaceOnce(s,"app.get('/api/v9/bootstrap',auth,async(req,res)=>{",routes+"\napp.get('/api/v9/bootstrap',auth,async(req,res)=>{",'workspace-route');
 s=replaceOnce(s,
  "const customers=caller?db.customers.filter(c=>!c.assignedTo||c.assignedTo===req.user.id):",
  "const customers=caller?db.customers.filter(c=>String(c.assignedTo||'')===String(req.user.id)&&Number(c.tenantId??c.tenant_id)===Number(requireRequestTenant(req))):",
  'bootstrap-strict-assigned-leads');
 s=replaceOnce(s,"const quotes=isOwnerRole||manager||caller?db.quotes:[];",
  "const quotes=isOwnerRole||manager?db.quotes:[];",'bootstrap-quote-privacy');
 s=replaceOnce(s,
  "if(!u)return res.status(401).json({error:'Authentication required.'});\n  req.user=u;",
  "if(!u)return res.status(401).json({error:'Authentication required.'});\n  if(u.expiresAt&&Number.isFinite(new Date(u.expiresAt).valueOf())&&new Date(u.expiresAt).getTime()<=Date.now())return res.status(403).json({ok:false,error:'EMPLOYEE_ACCOUNT_EXPIRED'});\n  req.user=u;",
  'session-expiry');
 s=replaceOnce(s,
  "if(!user)return res.status(401).json({error:'Incorrect username or password.'});\n    // Employee accounts authenticate",
  "if(!user)return res.status(401).json({error:'Incorrect username or password.'});\n    if(user.expiresAt&&Number.isFinite(new Date(user.expiresAt).valueOf())&&new Date(user.expiresAt).getTime()<=Date.now())return res.status(403).json({ok:false,error:'EMPLOYEE_ACCOUNT_EXPIRED'});\n    // Employee accounts authenticate",
  'login-expiry');
 s=replaceOnce(s,
  "app.post('/api/users',auth,ownerOnly,async(req,res)=>{const b=req.body||{},username=",
  "app.post('/api/users',auth,ownerOnly,async(req,res)=>{const b=req.body||{};if(b.expiresAt&&(!/^\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z)?$/.test(String(b.expiresAt))||!Number.isFinite(new Date(b.expiresAt).valueOf())||new Date(b.expiresAt).getTime()<=Date.now()))return res.status(400).json({error:'INVALID_FUTURE_ACCOUNT_EXPIRY'});const username=",
  'account-expiry-validation');
 const tokenPrefix="app.get('/api/voice/token',auth,(req,res)=>{/* SBC_V6690_VOICE_ROLE_GATE */const role=String(req.user?.role||'').trim().toLowerCase();if(!['owner','manager','caller'].includes(role))return res.status(403).json({ok:false,error:'VOICE_CALLER_ROLE_REQUIRED'});";
 s=replaceOnce(s,tokenPrefix,tokenPrefix+
   "if(role==='caller'&&!v9CanLiveCall(req.user))return res.status(403).json({ok:false,error:'CALLER_ONBOARDING_AND_CERTIFICATION_REQUIRED'});",
  'voice-token-certification');
 s=replaceOnce(s,
  "if(!c)return res.status(404).json({error:'Lead not found or not assigned.'});const r={id:id('call'),",
  "if(!c)return res.status(404).json({error:'Lead not found or not assigned.'});if(req.user.role==='caller'&&(!c.assignedTo||String(c.assignedTo)!==String(req.user.id)||Number(c.tenantId??c.tenant_id)!==Number(requireRequestTenant(req))))return res.status(403).json({error:'CALLER_LEAD_NOT_ASSIGNED'});const r={id:id('call'),",
  'call-report-assignment');
 return s;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),location=path.join(root,'server.js'),before=fs.readFileSync(location,'utf8'),next=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V6697_ISOLATED_STAGE!=='YES')throw new Error('V6697_STAGE_ONLY');
  fs.writeFileSync(location,next,'utf8');
  console.log('[V66.97] staged sales caller workspace, certification gate, account expiry');
 }else console.log('[V66.97] patch anchors match; no writes');
}
module.exports={patchServer,MARK};
