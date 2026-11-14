'use strict';
/* Source-only, opt-in patch. Never executes on import, application boot or CI.
 * Apply only to a review branch. No auth bypass, no privilege inheritance,
 * no automatic migrations, no server configuration or external publishing.
 * Staged server must then pass its release identity and regression gates.
 */
const fs=require('node:fs');
const path=require('node:path');
const MARK='SBC_ACCOUNT_MANAGER_ROLE_V2';
function once(src,oldv,newv,label){
 if(src.split(oldv).length!==2)throw Error('ACCOUNT_MANAGER_ROLE_PATCH_ANCHOR_'+label);
 return src.replace(oldv,newv);
}
function patch(source){
 if(source.includes(MARK))return {changed:false,source};
 let out=source;
 out=once(out,
  "const SBC_V66101_CALLER_POLICY=require('./enterprise/v66101-caller-access.cjs');",
  "const SBC_V66101_CALLER_POLICY=require('./enterprise/v66101-caller-access.cjs');\nconst SBC_ACCOUNT_MANAGER_ROLE_GATE=require('./enterprise/sbc-account-manager-role-gate-v2.cjs');",
  'CALLER_POLICY');
 out=once(out,
  "  // V55.18.3 — Workforce authorization simplification:",
  "  // "+MARK+": an account manager gets only the assigned Account/Social workspace.\n  if(u.role==='account_manager'&&!SBC_ACCOUNT_MANAGER_ROLE_GATE.allowAccountManager(u,req.method,req.path)) {\n    res.setHeader('Cache-Control','no-store');\n    return res.status(403).json({ok:false,error:'ACCOUNT_MANAGER_WORKSPACE_ONLY'});\n  }\n  // V55.18.3 — Workforce authorization simplification:",
  'AUTH_BOUNDARY');
 out=once(out,
  "function isWorkforceRole(role){return ['caller','lead_researcher','fulfillment'].includes(role)}",
  "function isWorkforceRole(role){return ['caller','account_manager','lead_researcher','fulfillment'].includes(role)}",
  'WORKFORCE_ROLE');
 out=once(out,
  "caller:'Lead Sales Manager',lead_researcher:'Lead Researcher'",
  "caller:'Lead Sales Manager',account_manager:'Account Manager',lead_researcher:'Lead Researcher'",
  'ROLE_LABEL');
 // The two employee provisioning endpoints must accept the new independent role.
 out=once(out,
  "const role=['caller','lead_researcher','fulfillment','manager','sales_manager','hr_manager'].includes(String(b.role||''))",
  "const role=['caller','account_manager','lead_researcher','fulfillment','manager','sales_manager','hr_manager'].includes(String(b.role||''))",
  'USER_CREATE');
 out=once(out,
  "if(!['caller','lead_researcher','fulfillment','manager','sales_manager','hr_manager'].includes(nr))",
  "if(!['caller','account_manager','lead_researcher','fulfillment','manager','sales_manager','hr_manager'].includes(nr))",
  'USER_EDIT');
 out=once(out,
  "if(u?.role==='caller')return res.redirect(302,'/sales-caller.html');",
  "if(u?.role==='caller')return res.redirect(302,'/sales-caller.html');\n  if(u?.role==='account_manager')return res.redirect(302,'/sbc-account-manager-v1.html');",
  'WORKSPACE_REDIRECT');
 return {changed:true,source:out};
}
function stage(root){
 const file=path.join(root,'server.js');
 if(!fs.existsSync(file))throw Error('ACCOUNT_MANAGER_SERVER_SOURCE_NOT_FOUND');
 const result=patch(fs.readFileSync(file,'utf8'));
 if(result.changed)fs.writeFileSync(file,result.source);
 return {changed:result.changed,releaseReady:false,productionEnabled:false};
}
if(require.main===module)console.log('ACCOUNT MANAGER STAGE: ',stage(path.resolve(__dirname,'..')));
module.exports={patch,stage,MARK};
